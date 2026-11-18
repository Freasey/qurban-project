import { isAdmin } from '@/lib/auth';
import { one } from '@/lib/db';
import { normalizeKode } from '@/lib/qurban';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Tidak ditemukan', { status: 404 });

  let boleh = await isAdmin();
  if (!boleh) {
    const k = new URL(req.url).searchParams.get('k');
    if (k) {
      const kode = normalizeKode(k);
      const r = await one(
        `select 1 from pekurban p where p.kode = $1 and (
           exists (select 1 from setoran s where s.pekurban_id = p.id and s.bukti_id = $2)
           or exists (select 1 from hewan h where h.id = p.hewan_id and h.nota_id = $2))`,
        [kode, id],
      );
      boleh = !!r;
    }
  }
  if (!boleh) return new Response('Tidak diizinkan', { status: 403 });

  const f = await one<{ mime: string; isi: string; nama: string }>('select mime, isi, nama from berkas where id = $1', [id]);
  if (!f) return new Response('Tidak ditemukan', { status: 404 });
  const body = new Uint8Array(Buffer.from(f.isi, 'base64'));
  return new Response(body, {
    headers: {
      'Content-Type': f.mime,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      'Content-Disposition': `inline; filename="${(f.nama || 'berkas').replace(/[^\w.-]/g, '_')}"`,
    },
  });
}
