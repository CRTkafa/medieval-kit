/**
 * Cinematic showcase — a hands-off tour of the whole kit, built to be recorded.
 *
 * The goal is a clip you can post: every model in the kit, every slider being
 * driven, the animated models actually animating, no cursor, no UI. The length
 * is a setting because it is really a pacing setting — the kit has 27 models,
 * so 30 s is about a second each (a montage: "look how much is in here"), 60 s
 * is a little over two, and 90 s gives each model three and a third, which is
 * the first length that feels unhurried.
 *
 * Three decisions shape the choreography:
 *
 *   - The orbit angle NEVER resets. It increases monotonically for the whole
 *     run, across model swaps. Re-framing per model and easing the angle from
 *     zero each time produced a visible stutter at every cut; a continuous
 *     sweep reads as one camera move over a turntable.
 *   - The framing distance and target are chased with an exponential approach
 *     rather than snapped. Models differ from a 0.17 m tankard to a 5.2 m
 *     fence, so a hard cut in distance is a jump-scare.
 *   - The parameter sweep MORPHS, it does not rebuild. The first version drove
 *     `configure()` on a throttled clock, and that looked exactly like what it
 *     was: the model freezing and jumping a dozen times a second. Now both ends
 *     of a beat are built once and `src/morph.ts` blends the vertex buffers
 *     every frame. The price is that integer parameters have to hold still for
 *     the length of a beat, because they change the triangle count and there is
 *     nothing to blend between; they change at the cuts instead.
 *
 * This module owns no scene state. The viewer stays the owner and passes in a
 * small host interface; the showcase only decides what should be true at time
 * `t`.
 */
import type { PerspectiveCamera, Vector3 } from 'three/webgpu'

export interface ShowcaseFraming {
  /** Bounding-sphere centre of the current model. */
  readonly centre: Vector3
  /** Bounding-sphere radius. */
  readonly radius: number
}

export interface ShowcaseHost {
  readonly camera: PerspectiveCamera
  /** Orbit target the viewer's controls are looking at. */
  readonly target: Vector3
  /** The models to tour, in order. */
  readonly models: readonly string[]
  /** Numeric control ranges for a model, straight from the registry metadata. */
  controls(id: string): ReadonlyArray<{ key: string; min: number; max: number; step: number }>
  /** Swap the displayed model. */
  select(id: string): void
  /** Apply a configuration patch to the current model. */
  configure(patch: Record<string, number>): void
  /**
   * Builds both ends of the beat and captures their vertex buffers.
   *
   * Returns false when the two builds are not topologically identical, which
   * is the showcase's cue to fall back to stepped rebuilds rather than blend
   * mismatched buffers.
   */
  prepareMorph(from: Record<string, number>, to: Record<string, number>): boolean
  /** Blends the live geometry between the two prepared ends. */
  applyMorph(t: number): void
  /** Fire the current model's action, if it has one. */
  triggerAction(): void
  /** True when the current model exposes an action. */
  hasAction(): boolean
  framing(): ShowcaseFraming
  /** Address and caption line shown over the render. */
  caption(address: string, note: string, opacity: number): void
  /** Dip to black between beats. */
  dim(amount: number): void
  /** Hide the side rail and overlays for a clean recording. */
  setChromeHidden(hidden: boolean): void
}

/** Smooth, symmetric ease. Used for every per-beat ramp. */
function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/**
 * Deterministic per-beat randomness.
 *
 * The same reason the models use a seeded generator: a showcase that looks
 * different on every run cannot be iterated on. Record it, watch it, change a
 * number, record the identical take again.
 */
function beatRandom(seed: number): () => number {
  let state = (seed * 0x9e3779b1) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Beat {
  readonly id: string
  readonly from: Record<string, number>
  readonly to: Record<string, number>
  /** Fraction of the beat at which the action fires. Negative = no action. */
  readonly actionAt: number
}

export interface Showcase {
  start(durationSeconds: number): void
  stop(): void
  isRunning(): boolean
  /** Called from the viewer's animation loop. Returns true while running. */
  update(deltaSeconds: number): boolean
  /** 0–1 progress, for a recorder that wants to stop itself. */
  progress(): number
}

export interface ShowcaseOptions {
  /** How far the camera sweeps per beat, in radians. */
  readonly sweepPerBeat?: number
  /** How often the configuration is re-applied, in seconds. */
  readonly configInterval?: number
  /** Seed for the parameter draws. */
  readonly seed?: number
}

export function createShowcase(host: ShowcaseHost, options: ShowcaseOptions = {}): Showcase {
  // Reused every frame; allocating a vector per frame is the kind of garbage
  // that shows up as a stutter in a recording.
  const aim = host.target.clone()
  const sweepPerBeat = options.sweepPerBeat ?? 1.9
  const configInterval = options.configInterval ?? 0.07
  const seed = options.seed ?? 7

  let beats: Beat[] = []
  let beatLength = 0
  let elapsed = 0
  let running = false
  let index = -1
  let orbit = 0
  let sinceConfig = 0
  let actionFired = false
  let distance = 0
  let morphing = false

  /** Draws a start and end value for every numeric control except the seed. */
  function planBeat(id: string, order: number): Beat {
    const random = beatRandom(seed + order * 977)
    const from: Record<string, number> = {}
    const to: Record<string, number> = {}

    for (const control of host.controls(id)) {
      if (control.key === 'seed') {
        // The seed jumps once per beat rather than sweeping: interpolating it
        // would rebuild a different model on every step and read as noise.
        const value = Math.round(control.min + random() * (control.max - control.min))
        from[control.key] = value
        to[control.key] = value
        continue
      }
      // Both ends are pulled away from the extremes. The far ends of a slider
      // are there to prove the range, not to look good, and a showcase that
      // opens on a degenerate configuration sells nothing.
      const span = control.max - control.min
      const low = control.min + span * 0.18
      const high = control.max - span * 0.18

      if (control.step >= 1) {
        // Integer controls are held FIXED for the whole beat. They change the
        // triangle count, and a sweep can only be morphed while both ends have
        // the same topology. They still vary — between beats, where the cut
        // hides the change.
        const value = Math.round(low + random() * (high - low))
        from[control.key] = value
        to[control.key] = value
        continue
      }

      const a = low + random() * (high - low)
      const b = low + random() * (high - low)
      // Guarantee the parameter actually travels; two random draws land close
      // together often enough to make a beat look static.
      const spread = Math.abs(b - a) < span * 0.25
        ? (a < (low + high) / 2 ? high : low)
        : b
      from[control.key] = a
      to[control.key] = spread
    }
    return {
      id,
      from,
      to,
      // Fire a little after the parameter sweep starts, so the two do not
      // compete for attention within the same beat.
      actionAt: 0.35,
    }
  }

  /**
   * Fallback path, used only when a beat cannot be morphed.
   *
   * Rebuilding is what the morph exists to avoid — it is throttled, and a
   * throttled rebuild is visibly steppy — so this runs only if the two ends
   * turned out to have different topology despite the integer parameters being
   * pinned.
   */
  function applyAt(beat: Beat, t: number): void {
    const patch: Record<string, number> = {}
    const eased = ease(t)
    for (const control of host.controls(beat.id)) {
      const a = beat.from[control.key]
      const b = beat.to[control.key]
      if (a === undefined || b === undefined) continue
      const raw = a + (b - a) * eased
      patch[control.key] = control.step >= 1 ? Math.round(raw) : raw
    }
    host.configure(patch)
  }

  function enterBeat(next: number): void {
    index = next
    const beat = beats[index]!
    actionFired = false
    host.select(beat.id)
    morphing = host.prepareMorph(beat.from, beat.to)
    if (!morphing) applyAt(beat, 0)
    // Snap the distance on the very first beat so the run does not open with
    // the camera flying in from wherever the previous model left it.
    if (next === 0) distance = fitDistance()
  }

  function fitDistance(): number {
    const { radius } = host.framing()
    // The margin is generous on purpose. A sweep changes the model's size while
    // the camera is already moving, and the framing chase always lags a little;
    // with a tight fit that lag crops the model. 1.55 keeps the whole silhouette
    // inside the frame even at the widest point of a sweep.
    return (radius * 1.55) / Math.sin((host.camera.fov * Math.PI) / 360)
  }

  return {
    start(durationSeconds: number): void {
      beats = host.models.map((id, order) => planBeat(id, order))
      beatLength = durationSeconds / Math.max(1, beats.length)
      elapsed = 0
      orbit = 0.6
      sinceConfig = 0
      index = -1
      running = true
      host.setChromeHidden(true)
      enterBeat(0)
    },

    stop(): void {
      running = false
      host.setChromeHidden(false)
      host.caption('', '', 0)
      host.dim(0)
    },

    isRunning: () => running,
    progress: () => (beats.length === 0 ? 0 : elapsed / (beatLength * beats.length)),

    update(deltaSeconds: number): boolean {
      if (!running) return false
      const dt = Math.min(0.05, Math.max(0, deltaSeconds))
      elapsed += dt

      const total = beatLength * beats.length
      if (elapsed >= total) {
        this.stop()
        return false
      }

      const wanted = Math.min(beats.length - 1, Math.floor(elapsed / beatLength))
      if (wanted !== index) enterBeat(wanted)

      const beat = beats[index]!
      const t = (elapsed - index * beatLength) / beatLength

      // --- Parameters -----------------------------------------------------
      // Morphing runs every frame; only the fallback needs a slower clock.
      if (morphing) {
        host.applyMorph(ease(t))
      } else {
        sinceConfig += dt
        if (sinceConfig >= configInterval) {
          sinceConfig = 0
          applyAt(beat, t)
        }
      }

      if (!actionFired && host.hasAction() && t >= beat.actionAt) {
        actionFired = true
        host.triggerAction()
      }

      // --- Camera --------------------------------------------------------------
      // The orbit is continuous across beats; only the framing chases.
      orbit += (sweepPerBeat / beatLength) * dt
      const { centre } = host.framing()
      const wantedDistance = fitDistance()
      // Exponential approach: frame-rate independent and it never overshoots.
      // The rate was raised from 3.4 to 7 after watching a run: at the slower
      // rate the camera was still catching up to the previous model's size a
      // second into the next beat.
      distance += (wantedDistance - distance) * (1 - Math.exp(-7 * dt))

      // A slow rise and fall in elevation over each beat keeps the move from
      // reading as a flat turntable.
      const lift = 0.42 + Math.sin(t * Math.PI) * 0.16
      host.camera.position.set(
        centre.x + Math.sin(orbit) * distance * Math.cos(lift),
        centre.y + Math.sin(lift) * distance,
        centre.z + Math.cos(orbit) * distance * Math.cos(lift),
      )
      // The clip planes have to travel with the camera. The viewer sets them
      // once, when a model is framed; the showcase then moves the camera from a
      // 0.17 m tankard to a 5.2 m fence without rebuilding that framing, so the
      // planes it inherited were wrong for most of the run and cut visible
      // chunks out of the model.
      const { radius: fitRadius } = host.framing()
      host.camera.near = Math.max(0.005, distance - fitRadius * 4)
      host.camera.far = distance + fitRadius * 12
      host.camera.updateProjectionMatrix()
      // The look-at point sits slightly BELOW the bounding-sphere centre, which
      // lifts the model in frame. Aiming dead centre left the base of tall
      // models sitting under the caption and, on short wide windows, clipped
      // off the bottom entirely.
      aim.copy(centre)
      aim.y -= host.framing().radius * 0.1
      host.target.lerp(aim, 1 - Math.exp(-9 * dt))
      host.camera.lookAt(host.target)

      // --- Caption and cut ------------------------------------------------------
      // Ramps are in seconds, not fractions, so a 30 s run and a 60 s run cut
      // at the same speed instead of the short one feeling frantic.
      // Shorter than it was: at 0.22 s each side, a 2.2 s beat spent a fifth of
      // itself dimmed, which is a large part of why the tour felt rushed —
      // there was simply less time with the model fully visible.
      const fade = Math.min(0.13, beatLength * 0.16)
      const into = Math.min(1, (elapsed - index * beatLength) / fade)
      const outOf = Math.min(1, ((index + 1) * beatLength - elapsed) / fade)
      const visible = ease(Math.min(into, outOf))
      host.caption(`@medieval-kit/${beat.id}`, `${index + 1} / ${beats.length}`, visible)
      // The dip is what hides the model swap. It is deliberately short: long
      // enough to cover the pop, short enough not to feel like a slideshow.
      host.dim((1 - visible) * 0.92)

      return true
    },
  }
}
