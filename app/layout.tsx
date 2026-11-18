import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
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
  return (
    <html lang="id" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
