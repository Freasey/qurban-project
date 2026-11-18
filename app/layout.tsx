import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { dbConfigured } from '@/lib/db';
import './globals.css';

export const dynamic = 'force-dynamic';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const serif = Fraunces({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: { default: 'Tabungan Qurban', template: '%s | Tabungan Qurban' },
  description: 'Cek saldo tabungan qurban dan konfirmasi setoran dengan kode pekurban.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#1f5c46', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const belumAdaDb = !dbConfigured();
  return (
    <html lang="id" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {belumAdaDb ? (
          <main className="pub">
            <section className="card pad-lg stack">
              <h1>Database belum terhubung</h1>
              <p>
                Aplikasi sudah ter-deploy, tetapi belum tersambung ke Cloudflare D1. Isi environment variable{' '}
                <code>CLOUDFLARE_ACCOUNT_ID</code>, <code>CLOUDFLARE_D1_DATABASE_ID</code>, dan <code>CLOUDFLARE_API_TOKEN</code> di
                Vercel (Settings → Environment Variables), lalu <strong>Redeploy</strong>. Tabel akan dibuat otomatis.
              </p>
            </section>
          </main>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
