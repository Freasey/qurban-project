import type { Metadata } from 'next';
import Link from 'next/link';
import { Bar, Flash } from '@/components/ui';
import { listHewan, listPekurban } from '@/lib/data';
import { rp, STATUS_PEKURBAN } from '@/lib/format';
import { siteOrigin } from '@/lib/origin';
import { getPengaturan } from '@/lib/settings';
import { pesanKode, waLink } from '@/lib/wa';

export const metadata: Metadata = { title: 'Pekurban' };

export default async function PekurbanList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const st = ['aktif', 'selesai', 'batal', 'semua'].includes(sp.st || '') ? sp.st! : 'semua';
  const hw = sp.h || '';
  const cari = (sp.q || '').trim();
  const where: string[] = [];
  const params: unknown[] = [];
  if (st !== 'semua') { params.push(st); where.push(`p.status = $${params.length}`); }
  if (hw === 'none') where.push('p.hewan_id is null');
  else if (hw) { params.push(parseInt(hw, 10) || 0); where.push(`p.hewan_id = $${params.length}`); }
  if (cari) { params.push(`%${cari}%`); where.push(`(p.nama like $${params.length} or p.kode like $${params.length} or p.hp like $${params.length})`); }
  const [rows, hewan, s, origin] = await Promise.all([
    listPekurban(where.length ? 'where ' + where.join(' and ') : '', params),
    listHewan(),
    getPengaturan(),
    siteOrigin(),
  ]);
  const totSetor = rows.reduce((a, p) => a + Number(p.total_setor), 0);

  return (
    <>
      <div className="between">
        <div>
          <h1>Pekurban</h1>
          <div className="muted">Setiap pekurban punya kode unik untuk melihat datanya tanpa login.</div>
        </div>
        <Link className="btn primary" href="/admin/pekurban/baru">Tambah pekurban</Link>
      </div>
      <Flash sp={sp} />

      <form className="form" action="/admin/pekurban">
        <label className="field">
          Cari
          <input name="q" defaultValue={cari} placeholder="Nama, kode, atau no HP" />
        </label>
        <label className="field" style={{ flexBasis: 160 }}>
          Status
          <select name="st" defaultValue={st}>
            <option value="semua">Semua</option>
            <option value="aktif">Aktif</option>
            <option value="selesai">Selesai</option>
            <option value="batal">Batal</option>
          </select>
        </label>
        <label className="field" style={{ flexBasis: 180 }}>
          Hewan
          <select name="h" defaultValue={hw}>
            <option value="">Semua hewan</option>
            <option value="none">Belum ditempatkan</option>
            {hewan.map((h) => <option key={h.id} value={h.id}>{h.nama}</option>)}
          </select>
        </label>
        <button className="btn ghost" type="submit">Terapkan</button>
      </form>

      <section className="box">
        <table>
          <thead>
            <tr>
              <th>Pekurban</th>
              <th>Hewan</th>
              <th className="r">Setoran</th>
              <th className="r">Menunggu</th>
              <th>Progres</th>
              <th>Status</th>
              <th>Kode</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">Tidak ada pekurban yang cocok.</td></tr>}
            {rows.map((p) => {
              const wa = waLink(p.hp, pesanKode(p, origin, s.namaMasjid));
              return (
                <tr key={p.id} className={p.status === 'batal' ? 'dim' : ''}>
                  <td>
                    <Link href={`/admin/pekurban/${p.id}`}><strong>{p.nama}</strong></Link>
                    <div className="muted">{p.hp || 'tanpa no HP'}</div>
                  </td>
                  <td>{p.hewan_nama ?? <span className="chip wait">Belum</span>}</td>
                  <td className="r num">{rp(p.total_setor)}</td>
                  <td className="r num">{p.menunggu ? rp(p.menunggu) : '-'}</td>
                  <td style={{ minWidth: 120 }}>
                    {p.target ? (
                      <>
                        <Bar value={p.biaya ? p.target : p.saldo} max={p.target} />
                        <div className="muted">{p.kurang ? `kurang ${rp(p.kurang)}` : 'lunas'}</div>
                      </>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${p.status === 'aktif' ? (p.lunas ? 'ok' : 'wait') : p.status === 'selesai' ? 'info' : 'bad'}`}>
                      {p.status === 'aktif' ? (p.lunas ? 'Lunas' : 'Menabung') : STATUS_PEKURBAN[p.status]}
                    </span>
                  </td>
                  <td className="nowrap">
                    <span className="mono small">{p.kode}</span>
                    {wa && p.status === 'aktif' && (
                      <>
                        {' · '}
                        <a href={wa} target="_blank" rel="noreferrer" className="small">Kirim WA</a>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr><td colSpan={2}>{rows.length} pekurban</td><td className="r num">{rp(totSetor)}</td><td colSpan={4}></td></tr>
            </tfoot>
          )}
        </table>
      </section>
    </>
  );
}
