import type { Metadata } from 'next';
import Link from 'next/link';
import { PekurbanForm } from '../form';
import { Flash } from '@/components/ui';
import { listHewan } from '@/lib/data';

export const metadata: Metadata = { title: 'Tambah pekurban' };

export default async function Baru({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const hewan = await listHewan();
  return (
    <>
      <div>
        <Link href="/admin/pekurban" className="small">← Pekurban</Link>
        <h1>Tambah pekurban</h1>
        <div className="muted">Kode pekurban dibuat otomatis dan acak. Kirimkan ke pekurban lewat WhatsApp setelah disimpan.</div>
      </div>
      <Flash sp={sp} />
      <section className="card pad-lg">
        <PekurbanForm hewan={hewan} back="/admin/pekurban/baru" />
      </section>
    </>
  );
}
