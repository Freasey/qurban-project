import type { Metadata } from 'next';
import { isiDummy, kosongkanData, simpanPengaturan } from '../../actions';
import { SubmitButton } from '@/components/client';
import { Flash } from '@/components/ui';
import { getPengaturan } from '@/lib/settings';

export const metadata: Metadata = { title: 'Pengaturan' };

export default async function Pengaturan({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getPengaturan();
  return (
    <>
      <div>
        <h1>Pengaturan</h1>
        <div className="muted">Informasi ini tampil di halaman pekurban.</div>
      </div>
      <Flash sp={sp} />

      <form action={simpanPengaturan} className="stack-lg">
        <section className="card pad-lg stack">
          <h2>Masjid dan periode</h2>
          <div className="form">
            <label className="field">Nama masjid<input name="namaMasjid" defaultValue={s.namaMasjid} required /></label>
            <label className="field">Alamat / lokasi<input name="alamatMasjid" defaultValue={s.alamatMasjid} /></label>
            <label className="field">Periode<input name="periode" defaultValue={s.periode} placeholder="Qurban 1448 H / 2027" /></label>
            <label className="field">Tanggal Idul Adha<input type="date" name="tanggalIdulAdha" defaultValue={s.tanggalIdulAdha} /></label>
            <label className="field">Batas pelunasan<input type="date" name="batasPelunasan" defaultValue={s.batasPelunasan} /></label>
          </div>
        </section>
        <section className="card pad-lg stack">
          <h2>Rekening dan kontak</h2>
          <div className="form">
            <label className="field">Bank<input name="bank" defaultValue={s.bank} /></label>
            <label className="field">Nomor rekening<input name="noRekening" defaultValue={s.noRekening} inputMode="numeric" /></label>
            <label className="field">Atas nama<input name="atasNamaRekening" defaultValue={s.atasNamaRekening} /></label>
            <label className="field">WhatsApp panitia<input name="waPanitia" defaultValue={s.waPanitia} placeholder="08xxxxxxxxxx" inputMode="tel" /></label>
          </div>
        </section>
        <section className="card pad-lg stack">
          <h2>Penandatangan laporan</h2>
          <div className="form">
            <label className="field">Nama bendahara<input name="namaBendahara" defaultValue={s.namaBendahara} /></label>
            <label className="field">Nama ketua panitia<input name="namaKetua" defaultValue={s.namaKetua} /></label>
          </div>
        </section>
        <section className="card pad-lg stack">
          <h2>Pengumuman</h2>
          <label className="field wide">
            Teks pengumuman di halaman depan <span className="hint">(kosongkan untuk menyembunyikan)</span>
            <textarea name="pengumuman" defaultValue={s.pengumuman} maxLength={600} />
          </label>
        </section>
        <div>
          <SubmitButton>Simpan pengaturan</SubmitButton>
        </div>
      </form>

      <section className="card pad-lg stack">
        <h2>Akun admin</h2>
        <p className="small">
          Email dan password admin diatur lewat environment variable <code>ADMIN_EMAIL</code> dan <code>ADMIN_PASSWORD</code> di Vercel
          (Settings → Environment Variables), lalu redeploy. Setelah password diganti, semua sesi lama otomatis keluar.
        </p>
      </section>

      <section className="card pad-lg stack" style={{ borderColor: '#f0c2bb' }}>
        <h2>Data uji coba</h2>
        <p className="small">
          <strong>Isi data dummy</strong> menghapus semua data lalu mengisi 4 hewan, 15 pekurban, riwayat setoran (terverifikasi, menunggu, ditolak) dengan bukti contoh,
          dan Sapi A yang sudah dibeli sehingga alur penyembelihan dan penyelesaian bisa dicoba. Pengaturan juga diganti dengan contoh.
        </p>
        <div className="row">
          <form action={isiDummy}>
            <SubmitButton className="btn dark" confirm="Semua data akan dihapus dan diganti data dummy. Lanjutkan?" pendingText="Mengisi…">Isi data dummy</SubmitButton>
          </form>
          <form action={kosongkanData}>
            <SubmitButton className="btn danger" confirm="Hapus SEMUA pekurban, hewan, setoran, jurnal, dan berkas? Tidak bisa dikembalikan." pendingText="Menghapus…">Kosongkan semua data</SubmitButton>
          </form>
        </div>
      </section>
    </>
  );
}
