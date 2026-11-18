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

## Environment variables

| Nama | Keterangan |
| --- | --- |
| `ADMIN_EMAIL` | Email admin (satu-satunya akun) |
| `ADMIN_PASSWORD` | Password admin, disimpan apa adanya (tanpa hash) |
| `SESSION_SECRET` | Opsional, kunci tambahan untuk cookie sesi |
| `DATABASE_URL` | Postgres (Neon). Otomatis terisi saat database Neon dihubungkan di Vercel |

Ganti password: ubah `ADMIN_PASSWORD` di Vercel → Settings → Environment Variables, lalu redeploy. Semua sesi lama otomatis keluar.

## Development

```bash
npm install
cp .env.example .env.local   # isi ADMIN_EMAIL dan ADMIN_PASSWORD
npm run dev
```

Tanpa `DATABASE_URL`, aplikasi memakai PGlite (Postgres embedded) di folder `.data/`. Tabel dibuat otomatis saat pertama jalan.
