import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash, noJ } from '@/components/ui';
import { q } from '@/lib/db';
import { rp, tgl } from '@/lib/format';
import { NAMA_AKUN } from '@/lib/qurban';

export const metadata: Metadata = { title: 'Jurnal' };

const JENIS: Record<string, string> = {
  setoran: 'Setoran',
  beli: 'Pembelian',
  sembelih: 'Penyembelihan',
  refund: 'Pengembalian',
  infak: 'Infak',
  koreksi: 'Koreksi',
};

export default async function JurnalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const jenis = sp.j && JENIS[sp.j] ? sp.j : '';
  const params: unknown[] = [];
  let where = '';
  if (jenis) { params.push(jenis); where = 'where j.jenis = $1'; }
  const jurnal = await q<any>(
    `select j.*, s.nama as pk_nama, h.nama as hw_nama from jurnal j
     left join pekurban s on s.id = j.pekurban_id left join hewan h on h.id = j.hewan_id
     ${where} order by j.tanggal desc, j.id desc limit 400`,
    params,
  );
  const ids = jurnal.map((j) => j.id);
  const baris = ids.length
    ? await q<any>(
        `select b.*, p.nama as pk_nama from jurnal_baris b left join pekurban p on p.id = b.pekurban_id
         where b.jurnal_id in (select value from json_each($1)) order by b.jurnal_id, b.kredit > 0, b.id`,
        [JSON.stringify(ids)],
      )
    : [];
  const byJ = new Map<number, any[]>();
  for (const b of baris) byJ.set(b.jurnal_id, [...(byJ.get(b.jurnal_id) || []), b]);
  const totD = baris.reduce((a, b) => a + Number(b.debit), 0);
  const totK = baris.reduce((a, b) => a + Number(b.kredit), 0);

  return (
    <>
      <div>
        <h1>Jurnal</h1>
        <div className="muted">Terbentuk otomatis dari setiap kejadian. Jurnal tidak bisa diedit; koreksi selalu memakai jurnal pembalik.</div>
      </div>
      <Flash sp={sp} />
      <div className="row">
        <Link href="/admin/jurnal" className={`btn sm ${!jenis ? 'primary' : 'ghost'}`}>Semua</Link>
        {Object.entries(JENIS).map(([k, l]) => (
          <Link key={k} href={`/admin/jurnal?j=${k}`} className={`btn sm ${jenis === k ? 'primary' : 'ghost'}`}>{l}</Link>
        ))}
      </div>
      <section className="box">
        <table>
          <thead>
            <tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Akun</th><th className="r">Debit</th><th className="r">Kredit</th></tr>
          </thead>
          <tbody>
            {jurnal.length === 0 && <tr><td colSpan={6} className="empty">Belum ada jurnal.</td></tr>}
            {jurnal.map((j) =>
              (byJ.get(j.id) || []).map((b, i) => (
                <tr key={b.id} className={j.dibalik ? 'dim' : ''}>
                  <td className="nowrap">{i === 0 ? noJ(j.id) : ''}</td>
                  <td className="nowrap">{i === 0 ? tgl(j.tanggal) : ''}</td>
                  <td>
                    {i === 0 && (
                      <>
                        {j.keterangan}
                        <div className="row" style={{ marginTop: 4 }}>
                          <span className="chip neutral">{JENIS[j.jenis] ?? j.jenis}</span>
                          {!!j.dibalik && <span className="chip bad">Sudah dibalik</span>}
                          {!!j.pembalik_dari && <span className="chip wait">Pembalik {noJ(j.pembalik_dari)}</span>}
                        </div>
                      </>
                    )}
                  </td>
                  <td className={b.kredit > 0 ? 'indent' : ''}>
                    <span className="muted mono">{b.akun}</span> {NAMA_AKUN[b.akun] ?? b.akun}
                    {b.pk_nama && <span className="muted"> ({b.pk_nama})</span>}
                  </td>
                  <td className="r num">{b.debit ? rp(b.debit) : ''}</td>
                  <td className="r num">{b.kredit ? rp(b.kredit) : ''}</td>
                </tr>
              )),
            )}
          </tbody>
          {jurnal.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>Total {totD === totK ? '(seimbang)' : '(TIDAK SEIMBANG)'}</td>
                <td className="r num">{rp(totD)}</td>
                <td className="r num">{rp(totK)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </>
  );
}
