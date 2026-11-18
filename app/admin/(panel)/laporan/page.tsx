import type { Metadata } from 'next';
import { PrintButton } from '@/components/client';
import { StatusHewan } from '@/components/ui';
import { rp, STATUS_PEKURBAN, tgl, today } from '@/lib/format';
import { dataLaporan } from '@/lib/laporan';
import { getPengaturan } from '@/lib/settings';

export const metadata: Metadata = { title: 'Laporan akhir' };

function Pos({ a, b, bold }: { a: string; b: string; bold?: boolean }) {
  return (
    <div className="pos">
      <span>{bold ? <strong>{a}</strong> : a}</span>
      <strong className="num">{b}</strong>
    </div>
  );
}

export default async function Laporan() {
  const [{ rows, hewan, tot, pembelian, akun }, s] = await Promise.all([dataLaporan(), getPengaturan()]);
  const aset = akun.kas + akun.persediaan;
  const seimbang = aset === akun.titipan + akun.infak;
  const selesaiSemua = hewan.length > 0 && hewan.every((h) => h.status === 'disembelih') && rows.every((r) => r.status !== 'aktif');

  return (
    <>
      <div className="between">
        <div>
          <h1>Laporan pertanggungjawaban</h1>
          <div className="muted">
            {s.namaMasjid} · {s.periode} · per {tgl(today(), true)}
          </div>
        </div>
        <div className="row no-print">
          <a className="btn ghost" href="/admin/laporan/csv">Unduh CSV (Excel)</a>
          <PrintButton />
        </div>
      </div>
      {!selesaiSemua && (
        <div className="notice no-print">Periode belum selesai: masih ada hewan yang belum disembelih atau pekurban yang belum diselesaikan. Angka di bawah adalah posisi sementara.</div>
      )}

      <div className="two">
        <section className="card pad-lg stack">
          <h2>Ringkasan dana</h2>
          <div>
            <Pos a="Setoran terverifikasi dari pekurban" b={rp(tot.setor)} />
            <Pos a="Pembelian hewan (harga realisasi)" b={rp(pembelian)} />
            <Pos a="Dikembalikan ke pekurban" b={rp(tot.refund)} />
            <Pos a="Menjadi infak (dipindah ke kas masjid)" b={rp(tot.infak)} />
            <Pos a="Dialihkan ke periode berikutnya" b={rp(tot.dialihkan)} />
            <Pos a="Saldo kas rekening qurban" b={rp(akun.kas)} bold />
          </div>
          <p className="muted">Saldo kas = setoran − pembelian − pengembalian. Infak dan dana dialihkan masih berada di rekening sampai dipindahkan.</p>
        </section>

        <section className="card pad-lg stack">
          <div className="between">
            <h2>Neraca</h2>
            <span className={`chip ${seimbang ? 'ok' : 'bad'}`}>{seimbang ? 'Seimbang' : 'Tidak seimbang'}</span>
          </div>
          <div>
            <Pos a="1-1100 Kas/Bank rekening qurban" b={rp(akun.kas)} />
            <Pos a="1-1200 Persediaan hewan qurban" b={rp(akun.persediaan)} />
            <Pos a="Total aset" b={rp(aset)} bold />
            <Pos a="2-1100 Titipan dana qurban" b={rp(akun.titipan)} />
            <Pos a="4-1100 Pendapatan infak sisa qurban" b={rp(akun.infak)} />
            <Pos a="Total kewajiban + pendapatan" b={rp(akun.titipan + akun.infak)} bold />
          </div>
        </section>
      </div>

      <section className="box">
        <table>
          <caption>Rekap per hewan</caption>
          <thead>
            <tr><th>Hewan</th><th>Peserta</th><th className="r">Estimasi</th><th className="r">Realisasi</th><th className="r">Dana terkumpul</th><th>Tanggal</th><th>Status</th></tr>
          </thead>
          <tbody>
            {hewan.length === 0 && <tr><td colSpan={7} className="empty">Belum ada hewan.</td></tr>}
            {hewan.map((h) => (
              <tr key={h.id}>
                <td><strong>{h.nama}</strong></td>
                <td>{h.peserta}/{h.kapasitas}</td>
                <td className="r num">{rp(h.harga_estimasi)}</td>
                <td className="r num">{h.harga_realisasi ? rp(h.harga_realisasi) : '-'}</td>
                <td className="r num">{rp(h.dana)}</td>
                <td className="small">{h.tgl_beli ? `Beli ${tgl(h.tgl_beli)}` : '-'}{h.tgl_sembelih ? ` · Sembelih ${tgl(h.tgl_sembelih)}` : ''}</td>
                <td><StatusHewan s={h.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="box">
        <table>
          <caption>Rekap per pekurban</caption>
          <thead>
            <tr>
              <th>Pekurban</th><th>Hewan</th><th className="r">Setoran</th><th className="r">Biaya porsi</th>
              <th className="r">Dikembalikan</th><th className="r">Infak</th><th className="r">Dialihkan</th><th className="r">Saldo titipan</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="empty">Belum ada pekurban.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={r.status === 'batal' ? 'dim' : ''}>
                <td><strong>{r.nama}</strong></td>
                <td>{r.hewan_nama ?? '-'}</td>
                <td className="r num">{rp(r.total_setor)}</td>
                <td className="r num">{r.biaya ? rp(r.biaya) : '-'}</td>
                <td className="r num">{r.refund ? rp(r.refund) : '-'}</td>
                <td className="r num">{r.infak ? rp(r.infak) : '-'}</td>
                <td className="r num">{r.dialihkan ? rp(r.dialihkan) : '-'}</td>
                <td className="r num">{rp(r.saldo)}</td>
                <td>{STATUS_PEKURBAN[r.status]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="r num">{rp(tot.setor)}</td>
              <td className="r num">{rp(tot.biaya)}</td>
              <td className="r num">{rp(tot.refund)}</td>
              <td className="r num">{rp(tot.infak)}</td>
              <td className="r num">{rp(tot.dialihkan)}</td>
              <td className="r num">{rp(tot.saldo)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card pad-lg">
        <p className="small">Disusun dari jurnal sistem tabungan qurban. Bukti transfer dan nota pembelian tersimpan dan dapat diperiksa.</p>
        <div className="sig">
          <div>Bendahara{s.namaBendahara ? <><br /><strong>{s.namaBendahara}</strong></> : ''}</div>
          <div>Ketua panitia qurban{s.namaKetua ? <><br /><strong>{s.namaKetua}</strong></> : ''}</div>
        </div>
      </section>
    </>
  );
}
