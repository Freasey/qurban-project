# Tabungan Qurban

Aplikasi tabungan qurban masjid: pekurban cek saldo dan konfirmasi setoran cukup dengan **kode pekurban** (tanpa login), panitia mengelola semuanya lewat **panel admin**.

## Fitur

**Pekurban** (`/` lalu `/p/QB-XXXXXX`)
- Saldo, target porsi, kekurangan, progres, dan tahapan (terdaftar → lunas → dibeli → disembelih → selesai)
- Konfirmasi setoran + unggah bukti transfer (foto dikompres di browser)
- Riwayat setoran beserta alasan penolakan, nota pembelian hewan, hasil akhir (refund/infak/dialihkan)
- Ringkasan siap cetak, info rekening, hitung mundur Idul Adha, transparansi dana

**Admin** (`/admin`)
- Dashboard, rekonsiliasi saldo bank, daftar belum lunas + pengingat WhatsApp
- Verifikasi setoran (lihat bukti, terima/tolak dengan alasan, batalkan dengan jurnal pembalik), catat setoran tunai
- Kelola pekurban (kode acak, kirim kode via WA, pindah hewan, batal + refund)
- Kelola hewan: catat pembelian (nota) → penyembelihan (porsi dibagi otomatis) → penyelesaian sisa
- Jurnal otomatis berpasangan, laporan pertanggungjawaban (cetak/PDF, CSV), daftar akun, log aktivitas
- Pengaturan masjid/rekening/tanggal, tombol **Isi data dummy** dan **Kosongkan semua data**

## Konfigurasi

| Nama | Tempat | Keterangan |
| --- | --- | --- |
| `DB` | `wrangler.jsonc` → `d1_databases` | Binding Cloudflare D1. Isi `database_id` dengan ID database D1 |
| `ADMIN_EMAIL` | `wrangler.jsonc` → `vars` | Email admin (satu-satunya akun) |
| `ADMIN_PASSWORD` | Secret Worker | Password admin, disimpan apa adanya (tanpa hash) |
| `SESSION_SECRET` | Secret Worker | Opsional, kunci tambahan untuk cookie sesi |

Ganti password: Cloudflare → Workers & Pages → `qurban-project` → Settings → Variables and Secrets → edit `ADMIN_PASSWORD`.
Semua sesi admin lama otomatis keluar.

## Deploy ke Cloudflare Workers

1. **Buat database D1**: Cloudflare → Storage & Databases → D1 → Create (nama `qurban`), atau `npx wrangler d1 create qurban`.
   Salin **Database ID** ke `database_id` di `wrangler.jsonc`, commit, push.
2. **Hubungkan repo**: Workers & Pages → Create → Import a repository → pilih repo ini.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
3. **Secret**: Settings → Variables and Secrets → tambah `ADMIN_PASSWORD` (dan opsional `SESSION_SECRET`) dengan tipe *Secret*.
4. **Domain**: Settings → Domains & Routes → Add → Custom domain → `qurban.worksell.id`.

Atau lewat CLI: `npx wrangler login`, `npx wrangler secret put ADMIN_PASSWORD`, lalu `npm run deploy`.

Tabel dibuat otomatis saat aplikasi pertama kali diakses. Bukti transfer dan nota disimpan di D1 (base64, maks 1,4 MB per berkas;
foto otomatis dikompres di browser).

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # isi ADMIN_PASSWORD
npm run dev                      # Next.js dev + D1 lokal (miniflare, folder .wrangler/)
npm run preview                  # build OpenNext lalu jalankan di runtime Workers lokal
```

Catatan paket gratis D1: maksimal sekitar 50 query per request. Karena itu penyelesaian sisa saldo diproses
maksimal 4 pekurban per klik, dan data dummy dikirim dalam beberapa batch.
