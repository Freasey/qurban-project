import type { Metadata } from 'next';
import { saldoAkun } from '@/lib/data';
import { rp } from '@/lib/format';
import { ATURAN_POSTING, DAFTAR_AKUN } from '@/lib/qurban';

export const metadata: Metadata = { title: 'Daftar akun' };

export default async function Akun() {
  const saldo = await saldoAkun();
  return (
    <>
      <div>
        <h1>Daftar akun</h1>
        <div className="muted">Akun dan aturan posting bersifat tetap, jadi pencatatan tidak bergantung pada pilihan akun manual.</div>
      </div>
      <section className="box">
        <table>
          <caption>Daftar akun</caption>
          <thead><tr><th>Kode</th><th>Nama akun</th><th>Jenis</th><th className="r">Saldo</th></tr></thead>
          <tbody>
            {DAFTAR_AKUN.map(([k, n, j]) => (
              <tr key={k}><td className="mono">{k}</td><td>{n}</td><td>{j}</td><td className="r num">{rp(saldo[k] || 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="box">
        <table>
          <caption>Aturan posting otomatis</caption>
          <thead><tr><th>Kejadian</th><th>Debit</th><th>Kredit</th></tr></thead>
          <tbody>
            {ATURAN_POSTING.map(([a, d, k]) => (
              <tr key={a}><td>{a}</td><td>{d}</td><td>{k}</td></tr>
            ))}
            <tr><td>Sisa saldo dialihkan</td><td colSpan={2} className="muted">Tidak dijurnal; tetap tercatat sebagai titipan untuk periode berikutnya.</td></tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
