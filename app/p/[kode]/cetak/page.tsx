import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/client';
import { noS } from '@/components/ui';
import { clientIp } from '@/lib/auth';
import { getPekurbanByKode, listSetoran } from '@/lib/data';
import { rp, STATUS_SETORAN, tgl, TIPE_PENYELESAIAN, today } from '@/lib/format';
import { normalizeKode } from '@/lib/qurban';
import { hit, isLimited } from '@/lib/rate';
import { getPengaturan } from '@/lib/settings';

export const metadata: Metadata = { title: 'Ringkasan tabungan', referrer: 'no-referrer' };

export default async function Cetak({ params }: { params: Promise<{ kode: string }> }) {
  const { kode: raw } = await params;
  const kode = normalizeKode(decodeURIComponent(raw));
  const ip = await clientIp();
  if (await isLimited('kode:' + ip, 10, 900)) notFound();
  const p = await getPekurbanByKode(kode);
  if (!p) {
    await hit('kode:' + ip, 900);
    notFound();
  }
  const [s, setoran] = await Promise.all([getPengaturan(), listSetoran(`where s.pekurban_id = $1 and s.status = 'terverifikasi'`, [p.id])]);
  setoran.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id - b.id);

  return (
    <main className="pub" style={{ maxWidth: 760 }}>
      <div className="row no-print">
        <Link className="btn ghost sm" href={`/p/${encodeURIComponent(p.kode)}`}>Kembali</Link>
        <PrintButton className="btn dark sm" />
      </div>
      <section className="card pad-lg stack">
        <div className="between">
          <div>
            <div className="brand" style={{ padding: 0, color: 'var(--brand)' }}>
              {s.namaMasjid}
              <small>{s.alamatMasjid}</small>
            </div>
          </div>
          <span className="chip ok">{s.periode}</span>
        </div>
        <h1>Ringkasan tabungan qurban</h1>
        <div className="three small">
          <div><span className="lbl">Nama</span><div><strong>{p.nama}</strong></div></div>
          <div><span className="lbl">Kode</span><div className="mono"><strong>{p.kode}</strong></div></div>
          <div><span className="lbl">Hewan</span><div><strong>{p.hewan_nama ?? '-'}</strong></div></div>
        </div>
        <table>
          <thead>
            <tr><th>No</th><th>Tanggal</th><th>Metode</th><th className="r">Nominal</th></tr>
          </thead>
          <tbody>
            {setoran.length === 0 && <tr><td colSpan={4} className="empty">Belum ada setoran terverifikasi.</td></tr>}
            {setoran.map((x) => (
              <tr key={x.id}>
                <td>{noS(x.id)}</td>
                <td>{tgl(x.tanggal)}</td>
                <td>{x.metode === 'tunai' ? 'Tunai' : 'Transfer'} · {STATUS_SETORAN[x.status]}</td>
                <td className="r num">{rp(x.nominal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3}>Total setoran terverifikasi</td><td className="r num">{rp(p.total_setor)}</td></tr>
          </tfoot>
        </table>
        <div className="stack" style={{ gap: 0 }}>
          {p.target != null && <div className="pos"><span>{p.biaya ? 'Biaya porsi' : 'Perkiraan biaya porsi'}</span><strong className="num">{rp(p.target)}</strong></div>}
          {p.status === 'aktif' && !p.biaya && <div className="pos"><span>Kekurangan</span><strong className="num">{rp(p.kurang)}</strong></div>}
          {p.peny_tipe && <div className="pos"><span>{TIPE_PENYELESAIAN[p.peny_tipe]}</span><strong className="num">{rp(p.peny_nominal)}</strong></div>}
          {p.status === 'batal' && <div className="pos"><span>Status</span><strong>Batal, dana dikembalikan</strong></div>}
        </div>
        <p className="muted">Dicetak {tgl(today(), true)}. Dokumen ini dibuat otomatis dari sistem tabungan qurban.</p>
        <div className="sig">
          <div>Bendahara{s.namaBendahara ? `: ${s.namaBendahara}` : ''}</div>
          <div>Pekurban: {p.nama}</div>
        </div>
      </section>
    </main>
  );
}
