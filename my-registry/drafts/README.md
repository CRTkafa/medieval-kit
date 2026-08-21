# Taslaklar

Bu klasördeki modeller registry'ye **derlenmez** — `build.ts` yalnızca
`models/` altını tarar. Kod saklanıyor ama yayınlanan pakete girmiyor.

## iron-brazier

Titreyen alevli, kor kömürlü, kendi ışığını taşıyan demir mangal. Teknik
olarak çalışıyor (tipli `actions`, `update()`, dört materyal yuvası) ama kitin
diline ait değil: medieval kitin belkemiği tek gösterişli model değil, yan yana
konduğunda sahne kuran çok sayıda basit parça.

Kite geri almak istenirse `models/` altına taşımak ve `build.ts` içindeki
`MODEL_META`'ya girdisini eklemek yeterli.
