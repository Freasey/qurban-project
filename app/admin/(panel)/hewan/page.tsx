import type { Metadata } from 'next';
import Link from 'next/link';
import { simpanHewan } from '../../actions';
import { SubmitButton } from '@/components/client';
import { HewanFields } from './fields';
import { Bar, Flash, StatusHewan } from '@/components/ui';
import { listHewan } from '@/lib/data';
import { JENIS_HEWAN, rp } from '@/lib/format';

export const metadata: Metadata = { title: 'Hewan qurban' };

export default async function HewanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const hewan = await listHewan();
  return (
    <>
      <div>
        <h1>Hewan qurban</h1>
        <div className="muted">Sapi dibagi maksimal 7 pekurban, kambing/domba untuk 1 pekurban. Alur: direncanakan → dibeli (nota) → disembelih → penyelesaian sisa.</div>
      </div>
      <Flash sp={sp} />

      <section className="three">
        {hewan.length === 0 && <div className="card muted">Belum ada hewan. Tambahkan di bawah.</div>}
        {hewan.map((h) => {
          const harga = Number(h.harga_realisasi ?? h.harga_estimasi);
          const porsi = Math.ceil(harga / h.kapasitas);
          const butuh = porsi * Math.max(1, h.peserta);
          return (
            <Link key={h.id} href={`/admin/hewan/${h.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="between">
                <h2>{h.nama}</h2>
                <StatusHewan s={h.status} />
              </div>
              <div className="muted">
                {JENIS_HEWAN[h.jenis]} · {h.peserta}/{h.kapasitas} slot · {rp(porsi)} per porsi
              </div>
              <div className="between small">
                <span>{h.harga_realisasi ? 'Harga beli' : 'Estimasi'} <strong className="num">{rp(harga)}</strong></span>
                <span>Dana <strong className="num">{rp(h.dana)}</strong></span>
              </div>
              <Bar value={h.dana} max={butuh} />
              {h.peserta < h.kapasitas && h.status !== 'disembelih' && <span className="chip wait" style={{ alignSelf: 'flex-start' }}>{h.kapasitas - h.peserta} slot kosong</span>}
            </Link>
          );
        })}
      </section>

      <section className="card pad-lg stack">
        <h2>Tambah hewan</h2>
        <form action={simpanHewan} className="form">
          <input type="hidden" name="back" value="/admin/hewan" />
          <HewanFields />
          <SubmitButton>Tambah hewan</SubmitButton>
        </form>
      </section>
    </>
  );
}
