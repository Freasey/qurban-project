import type { Metadata } from 'next';
import { q } from '@/lib/db';
import { waktu } from '@/lib/format';

export const metadata: Metadata = { title: 'Log aktivitas' };

export default async function Log() {
  const rows = await q<{ id: number; waktu: string; aksi: string; detail: string }>('select * from log_aktivitas order by id desc limit 300');
  return (
    <>
      <div>
        <h1>Log aktivitas</h1>
        <div className="muted">Catatan setiap tindakan di sistem, termasuk konfirmasi dari pekurban. 300 entri terakhir.</div>
      </div>
      <section className="box">
        <table>
          <thead><tr><th>Waktu</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="empty">Belum ada aktivitas.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}><td className="nowrap">{waktu(r.waktu)}</td><td><strong>{r.aksi}</strong></td><td>{r.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
