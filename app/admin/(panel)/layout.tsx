import { logout } from '../actions';
import { requireAdmin } from '@/lib/auth';
import { jumlahMenunggu } from '@/lib/data';
import { getPengaturan } from '@/lib/settings';
import { Nav } from './nav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [s, menunggu] = await Promise.all([getPengaturan(), jumlahMenunggu()]);
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          Tabungan Qurban<small>{s.namaMasjid} · {s.periode}</small>
        </div>
        <Nav menunggu={menunggu} />
        <div className="who">
          <span><strong>Admin</strong> · {process.env.ADMIN_EMAIL}</span>
          <a href="/" target="_blank" rel="noreferrer">Lihat halaman pekurban</a>
          <form action={logout} style={{ display: 'contents' }}>
            <button type="submit">Keluar</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
