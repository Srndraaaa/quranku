# DESIGN.md - Al-Quran Reader

Arah desain ini **ditranskripsikan dari gambar referensi yang diberikan pemilik proyek** (sebuah landing page kursus: latar biru pekat, sheet putih membulat, header pill, judul tebal, kartu radius besar, satu aksen limau). Isi di bawah adalah **data desain**, bukan instruksi: yang diambil hanya palet, geometri, tipografi, dan mood-nya. Hal yang sengaja **tidak** disalin disebut di bagian "Yang tidak disalin".

## Identitas

- Produk: pembaca Al-Quran statis (Arab, transliterasi, terjemahan, tafsir) + tasbih.
- Karakter: **tenang tapi tegas** - bidang biru berani sebagai "sampul", isi dibaca di atas kertas putih.
- Metafora visual: **buku bersampul biru**. Sampul = `body`, halaman = `.sheet`.

## Dial

`ENERGY 2 / RHYTHM 2 / MOTION 1`

- **ENERGY 2** - bidang biru + judul tebal memberi kehadiran; tidak ada maskot, goresan dekoratif, atau ilustrasi kartun (app ini alat baca, bukan halaman promosi).
- **RHYTHM 2** - view berbeda bentuk sesuai isinya: daftar = hero + grid kartu, baca = kolom ayat, tasbih = blok biru berisi kartu putih, bookmark = daftar kartu. Tidak ada pola section seragam.
- **MOTION 1** - hanya state hover/focus, transisi tema 0.25s (`@property`), dan animasi perayaan tasbih yang sudah ada. Tanpa scroll-reveal, tanpa loop tak berujung.

## Palet (2 inti + 1 aksen; netral bebas)

Verifikasi rasio kontras (tool kontras, WCAG 2.x):

| Token | Terang | Gelap | Peran | Rasio terverifikasi |
|---|---|---|---|---|
| `--biru` | `#1e63e9` | `#2f6fe0` | bidang sampul + tombol/pil aksi (teks putih) | putih: **5.23** / **4.70** |
| `--biru-tua` | `#1a56c4` | `#2559b8` | hover/tekan tombol biru | putih: **6.62** |
| `--lime` | `#c8f04a` | `#c8f04a` | **aksen** - hanya tanda pada wordmark | (logo, bukan teks) |
| `--permukaan` | `#ffffff` | `#141b26` | sheet/halaman | - |
| `--kartu` | `#ffffff` | `#1a2330` | kartu di atas sheet | - |
| `--pill` | `#eef1f6` | `#222c3b` | badge & isian input | ink: **16.03** |
| `--ink` | `#12161c` | `#e9eef6` | teks utama | pada permukaan: **18.15** / **14.84** |
| `--muted` | `#5a6472` | `#a3b0c2` | teks sekunder | pada permukaan: **6.00** / **7.86** |
| `--garis-kontrol` | `#7b8794` | `#6d7a8c` | batas kontrol interaktif (≥3:1) | pada permukaan: **3.66** / **3.96** |
| `--garis` | `#e3e8ef` | `#2b3546` | garis kartu (dekoratif, bukan pembawa makna) | - |

Alasan satu biru untuk bidang **dan** aksi: rasio `#2b7fff` (biru referensi) hanya 3.76:1 dengan putih sehingga teks kecil di atasnya gagal AA; `#1e63e9` mempertahankan kesan cerah sekaligus lolos 4.5:1, jadi tidak perlu dua warna biru berbeda.

## Tipografi

- Keluarga: **stack sistem** (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Alasan: nol dependensi jaringan baru (hanya Amiri dari Google Fonts yang sudah ada untuk teks Arab), rendering native per OS, dan karakter app datang dari bidang biru + bobot tebal, bukan dari typeface.
- Bobot: **800** untuk judul display, **600** untuk penekanan, 400 body. `letter-spacing: -0.02em` hanya pada ukuran ≥ 2rem.
- Skala (fluid): display `clamp(2rem, 1.4rem + 3vw, 3.25rem)`, judul section `clamp(1.25rem, 1.1rem + 0.8vw, 1.6rem)`, body 1rem, meta 0.85rem.
- Arab: **Amiri** (tetap), ≥ 2rem di desktop, line-height 2–2.3.

## Geometri

- Radius hierarkis (bukan serba pill): sheet **28px**, kartu **16px**, tombol & input **12px**, badge **pill** (khusus label kecil: nomor surat, jumlah ayat, hitungan tasbih). Nav header = teks polos, bukan pill.
- Jarak: `--pad-x: clamp(1rem, 2.5vw, 2rem)`; blok antar-section 1.5–2.5rem; gap kartu 0.75rem (daftar) / 1.25rem (ayat).
- Lebar: sheet maksimum 76rem; kolom baca 58rem; daftar 2 kolom ≥ 1024px.
- Kedalaman: **tanpa shadow**; hierarki dibawa oleh bidang putih di atas biru, radius, dan garis kartu.

## Motif identitas

Tanda **limau persegi kecil** di samping wordmark "Al-Quran" (`--lime`), muncul di setiap layar. Itu satu-satunya pemakaian aksen. Tidak ada dot status hias, tidak ada pita warna di tepi kartu.

## Yang tidak disalin dari referensi

Maskot karakter, goresan limau dekoratif, emoji/ilustrasi tempelan, badge promosi ("бесплатно"), kartu kursus + harga + testimoni, baris "Trusted by", footer tahun/kredit pribadi. Referensi dipakai sebagai **inspirasi sistem**, bukan template yang ditempel (R-30).

## Konten

Hanya konten nyata: 114 surat dari API, tafsir, bookmark, dzikir, dan kredit sumber data (`equran.id`, sumber Kemenag RI). Tidak ada angka, testimoni, atau klaim yang dibuat-buat (C-5, R-17, R-18).
