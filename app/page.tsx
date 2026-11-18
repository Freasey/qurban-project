import Link from 'next/link';
import { cariKode } from './actions';
import { Countdown, SubmitButton } from '@/components/client';
import { Bar, Flash, StatusHewan } from '@/components/ui';
import { listHewan, ringkasan } from '@/lib/data';
import { daysBetween, JENIS_HEWAN, rp, tgl, today, waNumber } from '@/lib/format';
import { getPengaturan } from '@/lib/settings';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [s, hewan, r] = await Promise.all([getPengaturan(), listHewan(), ringkasan()]);
  const sisaHari = s.batasPelunasan ? daysBetween(today(), s.batasPelunasan) : null;
  const sapi = hewan.filter((h) => h.jenis === 'sapi');
  const kecil = hewan.filter((h) => h.jenis !== 'sapi');
  const target = hewan.reduce((a, h) => a + Number(h.harga_realisasi ?? h.harga_estimasi), 0);

  return (
    <main className="pub">
      <header className="pub-head">
        <div className="brand">
          Tabungan Qurban<small>{s.namaMasjid}{s.alamatMasjid ? `, ${s.alamatMasjid}` : ''}</small>
        </div>
        <span className="chip ok">{s.periode}</span>
      </header>

      <section className="hero">
        <div className="stack" style={{ gap: 6 }}>
          <h1>Cek tabungan qurban kamu</h1>
          <p>Masukkan kode pekurban dari panitia untuk melihat saldo, riwayat setoran, dan status hewan qurban.</p>
        </div>
        <form action={cariKode}>
          <input name="kode" placeholder="QB-XXXXXX" required autoComplete="off" aria-label="Kode pekurban" maxLength={12} />
          <SubmitButton className="btn" pendingText="Mencari…">Lihat data saya</SubmitButton>
        </form>
        {sp.err && <div className="flash bad" role="alert" style={{ color: 'var(--bad)' }}>{sp.err}</div>}
        {s.tanggalIdulAdha && (
          <div className="between">
            <div>
              <div className="small" style={{ color: '#d8e8df' }}>Menuju Idul Adha, {tgl(s.tanggalIdulAdha, true)}</div>
              <Countdown target={s.tanggalIdulAdha} />
            </div>
            {sisaHari != null && sisaHari >= 0 && (
              <div className="small" style={{ color: '#fbebc8', fontWeight: 600 }}>
                Batas pelunasan {tgl(s.batasPelunasan, true)} ({sisaHari} hari lagi)
              </div>
            )}
          </div>
        )}
      </section>

      {s.pengumuman && (
        <section className="notice">
          <strong>Pengumuman panitia. </strong>
          {s.pengumuman}
        </section>
      )}

      <section className="stats">
        <div className="card">
          <span className="lbl">Dana terkumpul</span>
          <span className="val">{rp(r.ver)}</span>
          <span className="muted">Setoran yang sudah diverifikasi</span>
        </div>
        <div className="card">
          <span className="lbl">Pekurban</span>
          <span className="val">{r.pekurban} orang</span>
          <span className="muted">
            {sapi.length} sapi, {kecil.length} kambing/domba
          </span>
        </div>
        <div className="card">
          <span className="lbl">Kebutuhan dana</span>
          <span className="val">{rp(target)}</span>
          <Bar value={r.ver} max={target} />
        </div>
      </section>

      {hewan.length > 0 && (
        <section className="box">
          <table>
            <caption>Hewan qurban</caption>
            <thead>
              <tr>
                <th>Hewan</th>
                <th>Slot terisi</th>
                <th className="r">Biaya per porsi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hewan.map((h) => {
                const harga = Number(h.harga_realisasi ?? h.harga_estimasi);
                const sisa = h.kapasitas - h.peserta;
                return (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.nama}</strong> <span className="muted">{JENIS_HEWAN[h.jenis]}</span>
                    </td>
                    <td>
                      {h.peserta} dari {h.kapasitas}
                      {sisa > 0 && h.status !== 'disembelih' && <span className="chip wait" style={{ marginLeft: 8 }}>{sisa} slot kosong</span>}
                    </td>
                    <td className="r num">
                      {rp(Math.ceil(harga / h.kapasitas))}
                      {!h.harga_realisasi && <div className="muted">estimasi</div>}
                    </td>
                    <td><StatusHewan s={h.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="two">
        <div className="card pad-lg stack">
          <h2>Cara menabung</h2>
          <ol className="stack" style={{ margin: 0, paddingLeft: 20, gap: 8 }}>
            <li>Daftar ke panitia dan dapatkan kode pekurban.</li>
            <li>Transfer setoran (boleh dicicil) ke rekening qurban.</li>
            <li>Buka halaman ini, masukkan kode, lalu unggah foto bukti transfer.</li>
            <li>Panitia mencocokkan dengan mutasi rekening. Status berubah menjadi terverifikasi.</li>
          </ol>
        </div>
        <div className="card pad-lg stack">
          <h2>Rekening qurban</h2>
          {s.noRekening ? (
            <div className="rek">
              <span className="muted">{s.bank}</span>
              <span className="mono">{s.noRekening}</span>
              <span className="small">a.n. {s.atasNamaRekening}</span>
            </div>
          ) : (
            <p className="muted">Nomor rekening belum diisi panitia.</p>
          )}
          {s.waPanitia && (
            <a className="btn ghost" href={`https://wa.me/${waNumber(s.waPanitia)}`} target="_blank" rel="noreferrer">
              Hubungi panitia via WhatsApp
            </a>
          )}
        </div>
      </section>

      <footer className="foot">
        {s.namaMasjid} · <Link href="/admin">Masuk panitia</Link>
      </footer>
    </main>
  );
}
