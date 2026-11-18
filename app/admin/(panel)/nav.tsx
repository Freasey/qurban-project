'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: [string, string][] = [
  ['/admin', 'Dashboard'],
  ['/admin/setoran', 'Verifikasi setoran'],
  ['/admin/pekurban', 'Pekurban'],
  ['/admin/hewan', 'Hewan qurban'],
  ['/admin/jurnal', 'Jurnal'],
  ['/admin/laporan', 'Laporan akhir'],
  ['/admin/akun', 'Daftar akun'],
  ['/admin/log', 'Log aktivitas'],
  ['/admin/pengaturan', 'Pengaturan'],
];

export function Nav({ menunggu }: { menunggu: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Menu admin">
      {ITEMS.map(([href, label]) => {
        const on = href === '/admin' ? path === '/admin' : path.startsWith(href);
        return (
          <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            <span>{label}</span>
            {href === '/admin/setoran' && menunggu > 0 && <span className="badge">{menunggu}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
