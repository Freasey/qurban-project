import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'qurban_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export function adminConfigured(): boolean {
  return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

function key(): string {
  // Password ikut menjadi bagian kunci: kalau password diganti, semua sesi lama otomatis keluar.
  return `${process.env.SESSION_SECRET || ''}|${process.env.ADMIN_EMAIL || ''}|${process.env.ADMIN_PASSWORD || ''}`;
}
function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url');
}
function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCredentials(email: string, password: string): boolean {
  if (!adminConfigured()) return false;
  const okEmail = safeEq(email.trim().toLowerCase(), String(process.env.ADMIN_EMAIL).trim().toLowerCase());
  const okPass = safeEq(password, String(process.env.ADMIN_PASSWORD));
  return okEmail && okPass;
}

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || !safeEq(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('cf-connecting-ip') || h.get('x-forwarded-for') || h.get('x-real-ip') || 'lokal').split(',')[0].trim();
}
