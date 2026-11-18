import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PekurbanForm } from '../form';
import { batalkanPekurban, catatSetoran, gantiKode, hapusPekurban } from '../../../actions';
import { CopyButton, RupiahInput, SubmitButton } from '@/components/client';
import { Bar, Flash, noS, Stat, StatusSetoran } from '@/components/ui';
import { getPekurbanById, listHewan, listSetoran } from '@/lib/data';
import { rp, STATUS_PEKURBAN, tgl, TIPE_PENYELESAIAN, today } from '@/lib/format';
import { siteOrigin } from '@/lib/origin';
import { getPengaturan } from '@/lib/settings';
import { pesanKode, pesanTagihan, waLink } from '@/lib/wa';

export const metadata: Metadata = { title: 'Detail pekurban' };

export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const id = parseInt((await params).id, 10);
  const sp = await searchParams;
  const p = Number.isFinite(id) ? await getPekurbanById(id) : undefined;
  if (!p) notFound();
  const [hewan, setoran, s, origin] = await Promise.all([
    listHewan(),
    listSetoran('where s.pekurban_id = $1', [id]),
    getPengaturan(),
    siteOrigin(),
  ]);
  const link = `${origin}/p/${p.kode}`;
  const waKode = waLink(p.hp, pesanKode(p, origin, s.namaMasjid));
  const waTagih = p.kurang > 0 ? waLink(p.hp, pesanTagihan(p, origin, s.batasPelunasan)) : null;
  const back = `/admin/pekurban/${id}`;

  return (
    <>
      <div>
        <Link href="/admin/pekurban" className="small">← Pekurban</Link>
        <div className="between">
          <div className="row">
            <h1>{p.nama}</h1>
            <span className={`chip ${p.status === 'aktif' ? 'ok' : p.status === 'selesai' ? 'info' : 'bad'}`}>{STATUS_PEKURBAN[p.status]}</span>
          </div>
          <div className="row">
            {waKode && <a className="btn ghost" href={waKode} target="_blank" rel="noreferrer">Kirim kode via WA</a>}
            {waTagih && <a className="btn ghost" href={waTagih} target="_blank" rel="noreferrer">Kirim pengingat</a>}
          </div>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="card stack">
        <div className="between">
          <div className="stack" style={{ gap: 2 }}>
            <span className="lbl">Kode pekurban</span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{p.kode}</span>
          </div>
          <div className="row">
            <CopyButton text={p.kode}>Salin kode</CopyButton>
            <CopyButton text={link}>Salin link</CopyButton>
            <a className="btn ghost sm" href={`/p/${p.kode}`} target="_blank" rel="noreferrer">Buka tampilan pekurban</a>
            <form action={gantiKode}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton className="btn ghost sm" confirm="Buat kode baru? Kode lama langsung tidak berlaku.">Ganti kode</SubmitButton>
            </form>
          </div>
        </div>
      </section>

      <section className="stats">
        <Stat label="Setoran terverifikasi" value={rp(p.total_setor)} note={p.menunggu ? `+ ${rp(p.menunggu)} menunggu` : undefined} />
        <Stat label={p.biaya ? 'Biaya porsi' : 'Target porsi'} value={p.target != null ? rp(p.target) : '-'} note={p.hewan_nama ?? 'Belum ditempatkan'} />
        <Stat
          label={p.biaya ? 'Sisa saldo titipan' : 'Kekurangan'}
          value={p.biaya ? rp(p.saldo) : rp(p.kurang)}
          note={p.target ? <Bar value={p.biaya ? p.target : p.saldo} max={p.target} /> : undefined}
        />
      </section>

      {p.peny_tipe && (
        <div className="flash ok">
          Selesai {tgl(p.peny_tanggal)}: {TIPE_PENYELESAIAN[p.peny_tipe]} {p.peny_nominal ? rp(p.peny_nominal) : ''}
        </div>
      )}

      <div className="two">
        <section className="card pad-lg stack">
          <h2>Data pekurban</h2>
          <PekurbanForm p={p} hewan={hewan} back={back} />
        </section>

        <div className="stack-lg">
          {p.status === 'aktif' && p.hewan_status !== 'disembelih' && (
            <section className="card pad-lg stack">
              <h2>Catat setoran</h2>
              <form action={catatSetoran} className="form">
                <input type="hidden" name="pekurban_id" value={p.id} />
                <input type="hidden" name="back" value={back} />
                <label className="field">
                  Nominal
                  <RupiahInput name="nominal" required />
                </label>
                <label className="field">
                  Tanggal
                  <input type="date" name="tanggal" defaultValue={today()} max={today()} required />
                </label>
                <label className="field">
                  Metode
                  <select name="metode" defaultValue="tunai">
                    <option value="tunai">Tunai</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>
                <input type="hidden" name="langsung" value="1" />
                <SubmitButton className="btn dark">Simpan, langsung terverifikasi</SubmitButton>
              </form>
            </section>
          )}

          <section className="card pad-lg stack">
            <h2>Tindakan lain</h2>
            {p.status === 'aktif' && p.hewan_status !== 'disembelih' && (
              <details>
                <summary>Batalkan pekurban</summary>
                <p className="muted" style={{ margin: '8px 0' }}>
                  Setoran menunggu akan ditolak, saldo {rp(p.saldo)} dicatat sebagai pengembalian dana (Titipan / Kas), dan slot hewan dikosongkan.
                </p>
                <form action={batalkanPekurban} className="inline-form">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="alasan" placeholder="Alasan (opsional)" />
                  <SubmitButton className="btn danger sm" confirm={`Batalkan ${p.nama}? Tindakan ini tidak bisa diurungkan.`}>Batalkan</SubmitButton>
                </form>
              </details>
            )}
            {setoran.length === 0 && (
              <details>
                <summary>Hapus pekurban</summary>
                <p className="muted" style={{ margin: '8px 0' }}>Hanya bisa untuk pekurban tanpa riwayat setoran.</p>
                <form action={hapusPekurban}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="btn danger sm" confirm={`Hapus ${p.nama}?`}>Hapus</SubmitButton>
                </form>
              </details>
            )}
            {p.hewan_status === 'disembelih' && p.status === 'aktif' && (
              <p className="small">
                Hewan sudah disembelih. Selesaikan sisa saldo di halaman <Link href={`/admin/hewan/${p.hewan_id}`}>{p.hewan_nama}</Link>.
              </p>
            )}
            <p className="muted">Terdaftar {tgl(p.dibuat)}.</p>
          </section>
        </div>
      </div>

      <section className="box">
        <table>
          <caption>Riwayat setoran</caption>
          <thead>
            <tr><th>No</th><th>Tanggal</th><th className="r">Nominal</th><th>Metode</th><th>Status</th><th>Bukti</th></tr>
          </thead>
          <tbody>
            {setoran.length === 0 && <tr><td colSpan={6} className="empty">Belum ada setoran.</td></tr>}
            {setoran.map((x) => (
              <tr key={x.id}>
                <td>{noS(x.id)}</td>
                <td>{tgl(x.tanggal)}</td>
                <td className="r num"><strong>{rp(x.nominal)}</strong></td>
                <td>{x.metode} · {x.sumber === 'admin' ? 'admin' : 'pekurban'}</td>
                <td>
                  <StatusSetoran s={x.status} />
                  {x.alasan && <div className="muted">{x.alasan}</div>}
                </td>
                <td>{x.bukti_id ? <a href={`/api/berkas/${x.bukti_id}`} target="_blank" rel="noreferrer">Lihat</a> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {setoran.some((x) => x.status === 'menunggu') && (
        <Link href={`/admin/setoran?q=${encodeURIComponent(p.kode)}`} className="small">Verifikasi setoran menunggu milik {p.nama} →</Link>
      )}
    </>
  );
}
