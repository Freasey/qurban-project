import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { login } from '../actions';
import { SubmitButton } from '@/components/client';
import { Flash } from '@/components/ui';
import { adminConfigured, isAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Masuk panitia' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await isAdmin()) redirect('/admin');
  const sp = await searchParams;
  return (
    <main className="pub" style={{ maxWidth: 440, paddingTop: 64 }}>
      <div className="brand" style={{ color: 'var(--brand)', padding: 0 }}>
        Tabungan Qurban<small>Panel panitia</small>
      </div>
      <Flash sp={sp} />
      {!adminConfigured() && (
        <div className="notice">
          Akun admin belum diatur. Isi <code>ADMIN_EMAIL</code> dan <code>ADMIN_PASSWORD</code> di environment variables, lalu deploy ulang.
        </div>
      )}
      <form action={login} className="card pad-lg form col">
        <h1>Masuk</h1>
        <label className="field">
          Email
          <input type="email" name="email" required autoComplete="username" />
        </label>
        <label className="field">
          Password
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
      </form>
      <Link href="/" className="small">← Kembali ke halaman pekurban</Link>
    </main>
  );
}
