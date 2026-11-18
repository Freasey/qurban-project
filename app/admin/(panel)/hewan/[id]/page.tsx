import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HewanFields } from '../fields';
import { batalBeli, beliHewan, hapusHewan, selesaikan, sembelih, simpanHewan } from '../../../actions';
import { RupiahInput, SubmitButton, UploadInput } from '@/components/client';
import { Flash, Stat, StatusHewan } from '@/components/ui';
import { getHewanById, listPekurban } from '@/lib/data';
import { JENIS_HEWAN, rp, tgl, TIPE_PENYELESAIAN, today } from '@/lib/format';
import { bagiPorsi } from '@/lib/qurban';

export const metadata: Metadata = { title: 'Detail hewan' };

export default async function HewanDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const id = parseInt((await params).id, 10);
  const sp = await searchParams;
  const h = Number.isFinite(id) ? await getHewanById(id) : undefined;
  if (!h) notFound();
  const peserta = await listPekurban(`where p.hewan_id = $1 and p.status <> 'batal'`, [id]);
  peserta.sort((a, b) => a.id - b.id);
  const back = `/admin/hewan/${id}`;
  const harga = Number(h.harga_realisasi ?? h.harga_estimasi);
  const aktif = peserta.filter((p) => p.status === 'aktif');
  const porsi = h.status === 'dibeli' && aktif.length ? bagiPorsi(harga, aktif.length) : [];
  const siapSembelih = h.status === 'dibeli' && aktif.length > 0 && aktif.every((p, i) => p.saldo >= porsi[i]);
  const belumSelesai = h.status === 'disembelih' ? aktif : [];
  const totalSisa = belumSelesai.reduce((a, p) => a + p.saldo, 0);

  return (
    <>
      <div>
        <Link href="/admin/hewan" className="small">← Hewan qurban</Link>
        <div className="row">
          <h1>{h.nama}</h1>
          <StatusHewan s={h.status} />
        </div>
        <div className="muted">{JENIS_HEWAN[h.jenis]} · {h.catatan || 'tanpa catatan'}</div>
      </div>
      <Flash sp={sp} />

      <section className="stats">
        <Stat label="Peserta" value={`${h.peserta}/${h.kapasitas}`} note={h.peserta < h.kapasitas ? `${h.kapasitas - h.peserta} slot kosong` : 'Penuh'} />
        <Stat label={h.harga_realisasi ? 'Harga beli' : 'Harga estimasi'} value={rp(harga)} note={h.harga_realisasi ? `Estimasi awal ${rp(h.harga_estimasi)}` : `${rp(Math.ceil(harga / h.kapasitas))} per porsi`} />
        <Stat label="Dana terverifikasi" value={rp(h.dana)} note={h.menunggu ? `+ ${rp(h.menunggu)} menunggu` : undefined} />
      </section>

      {/* ---------- tahap */}
      {h.status === 'direncanakan' && (
        <section className="card pad-lg stack">
          <h2>Catat pembelian</h2>
          <p className="muted">Isi harga realisasi sesuai nota dan unggah fotonya. Jurnal Persediaan hewan / Kas terbentuk otomatis, dan nota bisa dilihat pekurban.</p>
          <form action={beliHewan} className="form">
            <input type="hidden" name="id" value={h.id} />
            <label className="field">
              Harga realisasi
              <RupiahInput name="harga" required defaultValue={h.harga_estimasi} />
            </label>
            <label className="field" style={{ flexBasis: 160 }}>
              Tanggal beli
              <input type="date" name="tanggal" defaultValue={today()} max={today()} required />
            </label>
            <label className="field wide">
              Foto nota pembelian
              <UploadInput name="nota" required />
            </label>
            <SubmitButton className="btn dark" confirm="Catat pembelian? Kas akan berkurang sebesar harga realisasi.">Catat pembelian</SubmitButton>
          </form>
        </section>
      )}

      {h.status === 'dibeli' && (
        <section className="card pad-lg stack">
          <div className="between">
            <h2>Catat penyembelihan</h2>
            {siapSembelih ? <span className="chip ok">Semua saldo cukup</span> : <span className="chip wait">Ada saldo yang kurang</span>}
          </div>
          <p className="muted">
            Dibeli {tgl(h.tgl_beli, true)} seharga {rp(harga)}.{' '}
            {h.nota_id && <a href={`/api/berkas/${h.nota_id}`} target="_blank" rel="noreferrer">Lihat nota</a>}. Biaya dibagi rata ke {aktif.length} pekurban
            {aktif.length ? ` (${rp(porsi[0])} per orang)` : ''}.
            {aktif.length < h.kapasitas && ' Slot belum penuh, jadi porsi per orang lebih besar dari estimasi.'}
          </p>
          <form action={sembelih} className="form">
            <input type="hidden" name="id" value={h.id} />
            <label className="field" style={{ flexBasis: 180, flexGrow: 0 }}>
              Tanggal sembelih
              <input type="date" name="tanggal" defaultValue={today()} max={today()} required />
            </label>
            <SubmitButton className="btn primary" confirm="Catat penyembelihan? Porsi akan dibebankan ke titipan setiap pekurban.">Catat penyembelihan</SubmitButton>
          </form>
          <details>
            <summary className="small">Batalkan pembelian</summary>
            <form action={batalBeli} className="inline-form" style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={h.id} />
              <input name="alasan" required placeholder="Alasan, misal salah input harga" />
              <SubmitButton className="btn danger sm" confirm="Batalkan pembelian dengan jurnal pembalik?">Batalkan</SubmitButton>
            </form>
          </details>
        </section>
      )}

      {h.status === 'disembelih' && (
        <section className="card pad-lg stack">
          <h2>Penyelesaian sisa saldo</h2>
          <p className="muted">
            Disembelih {tgl(h.tgl_sembelih, true)}.{' '}
            {h.nota_id && <a href={`/api/berkas/${h.nota_id}`} target="_blank" rel="noreferrer">Lihat nota</a>}.{' '}
            {belumSelesai.length
              ? `${belumSelesai.length} pekurban belum diselesaikan, total sisa ${rp(totalSisa)}. Pekurban tanpa sisa otomatis dicatat lunas.`
              : 'Semua pekurban sudah diselesaikan.'}
          </p>
          {belumSelesai.length > 0 && (
            <form action={selesaikan} className="stack">
              <input type="hidden" name="back" value={back} />
              <div className="stack" style={{ gap: 4 }}>
                {belumSelesai.map((p) => (
                  <label key={p.id} className="row small" style={{ fontWeight: 600 }}>
                    <input type="checkbox" name="pekurban_id" value={p.id} defaultChecked style={{ width: 18, minHeight: 18 }} />
                    {p.nama} <span className="muted">sisa {rp(p.saldo)}{p.menunggu ? `, ada setoran menunggu ${rp(p.menunggu)}` : ''}</span>
                  </label>
                ))}
              </div>
              <div className="form">
                <label className="field">
                  Sisa saldo
                  <select name="tipe" defaultValue="infak">
                    <option value="infak">{TIPE_PENYELESAIAN.infak}</option>
                    <option value="refund">{TIPE_PENYELESAIAN.refund}</option>
                    <option value="dialihkan">{TIPE_PENYELESAIAN.dialihkan}</option>
                  </select>
                </label>
                <label className="field" style={{ flexBasis: 160 }}>
                  Tanggal
                  <input type="date" name="tanggal" defaultValue={today()} max={today()} />
                </label>
                <label className="field">
                  Catatan
                  <input name="catatan" placeholder="Opsional, misal sesuai akad" />
                </label>
                <SubmitButton className="btn primary" confirm="Selesaikan pekurban yang dipilih?">Selesaikan yang dipilih</SubmitButton>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ---------- peserta */}
      <section className="box">
        <table>
          <caption>Peserta</caption>
          <thead>
            <tr>
              <th>#</th>
              <th>Pekurban</th>
              <th className="r">Setoran</th>
              <th className="r">Menunggu</th>
              <th className="r">{h.status === 'disembelih' ? 'Biaya porsi' : 'Porsi'}</th>
              <th className="r">{h.status === 'disembelih' ? 'Sisa' : 'Kurang'}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {peserta.length === 0 && <tr><td colSpan={7} className="empty">Belum ada peserta. Tempatkan pekurban dari halaman Pekurban.</td></tr>}
            {peserta.map((p, i) => {
              const ai = aktif.indexOf(p);
              const pr = h.status === 'dibeli' && ai >= 0 ? porsi[ai] : p.target ?? 0;
              const kurang = h.status === 'disembelih' ? p.saldo : Math.max(0, pr - p.saldo);
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td>
                    <Link href={`/admin/pekurban/${p.id}`}><strong>{p.nama}</strong></Link>
                    {p.atas_nama && p.atas_nama !== p.nama && <div className="muted">a.n. {p.atas_nama}</div>}
                  </td>
                  <td className="r num">{rp(p.total_setor)}</td>
                  <td className="r num">{p.menunggu ? rp(p.menunggu) : '-'}</td>
                  <td className="r num">{rp(pr)}</td>
                  <td className="r num">{h.status === 'disembelih' && p.status === 'selesai' ? '-' : rp(kurang)}</td>
                  <td>
                    {p.status === 'selesai' ? (
                      <span className="chip info">{TIPE_PENYELESAIAN[p.peny_tipe || ''] ?? 'Selesai'}{p.peny_nominal ? ` ${rp(p.peny_nominal)}` : ''}</span>
                    ) : h.status === 'disembelih' ? (
                      <span className="chip wait">Belum diselesaikan</span>
                    ) : kurang > 0 ? (
                      <span className="chip wait">Kurang</span>
                    ) : (
                      <span className="chip ok">Cukup</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {h.kapasitas - h.peserta > 0 && h.status !== 'disembelih' && (
            <tfoot>
              <tr><td colSpan={7} className="muted">{h.kapasitas - h.peserta} slot kosong · <Link href="/admin/pekurban/baru">Tambah pekurban</Link></td></tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="card pad-lg stack">
        <h2>Ubah data hewan</h2>
        <form action={simpanHewan} className="form">
          <input type="hidden" name="id" value={h.id} />
          <input type="hidden" name="back" value={back} />
          <HewanFields h={h} />
          <SubmitButton className="btn dark">Simpan</SubmitButton>
        </form>
        {h.status === 'direncanakan' && h.peserta === 0 && (
          <form action={hapusHewan}>
            <input type="hidden" name="id" value={h.id} />
            <SubmitButton className="btn danger sm" confirm={`Hapus ${h.nama}?`}>Hapus hewan</SubmitButton>
          </form>
        )}
      </section>
    </>
  );
}
