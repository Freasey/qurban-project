import type { Metadata } from 'next';
import Link from 'next/link';
import { batalVerifikasi, catatSetoran, tolak, verifikasi } from '../../actions';
import { RupiahInput, SubmitButton, UploadInput } from '@/components/client';
import { Flash, noS, StatusSetoran } from '@/components/ui';
import { listPekurban, listSetoran } from '@/lib/data';
import { rp, tgl, today, waktu } from '@/lib/format';

export const metadata: Metadata = { title: 'Verifikasi setoran' };

const FILTER: [string, string][] = [
  ['menunggu', 'Menunggu'],
  ['terverifikasi', 'Terverifikasi'],
  ['ditolak', 'Ditolak'],
  ['semua', 'Semua'],
];

export default async function SetoranPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = FILTER.some((x) => x[0] === sp.f) ? sp.f! : 'menunggu';
  const cari = (sp.q || '').trim();
  const where: string[] = [];
  const params: unknown[] = [];
  if (f !== 'semua') { params.push(f); where.push(`s.status = $${params.length}`); }
  if (cari) { params.push(`%${cari}%`); where.push(`(p.nama like $${params.length} or p.kode like $${params.length})`); }
  const [rows, pekurban] = await Promise.all([
    listSetoran(where.length ? 'where ' + where.join(' and ') : '', params),
    listPekurban(`where p.status = 'aktif'`),
  ]);
  const back = `/admin/setoran?f=${f}${cari ? `&q=${encodeURIComponent(cari)}` : ''}`;
  const total = rows.reduce((a, x) => a + Number(x.nominal), 0);

  return (
    <>
      <div>
        <h1>Verifikasi setoran</h1>
        <div className="muted">Cocokkan bukti transfer dengan mutasi rekening qurban. Saat diterima, jurnal langsung terbentuk.</div>
      </div>
      <Flash sp={sp} />

      <div className="between">
        <div className="row" role="tablist">
          {FILTER.map(([k, l]) => (
            <Link key={k} href={`/admin/setoran?f=${k}${cari ? `&q=${encodeURIComponent(cari)}` : ''}`} className={`btn sm ${f === k ? 'primary' : 'ghost'}`} aria-current={f === k ? 'page' : undefined}>
              {l}
            </Link>
          ))}
        </div>
        <form className="inline-form" action="/admin/setoran">
          <input type="hidden" name="f" value={f} />
          <input name="q" defaultValue={cari} placeholder="Cari nama atau kode" aria-label="Cari" />
          <button className="btn ghost sm" type="submit">Cari</button>
        </form>
      </div>

      <section className="box">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Pekurban</th>
              <th>Tanggal</th>
              <th className="r">Nominal</th>
              <th>Bukti</th>
              <th>Status</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">Tidak ada setoran {f !== 'semua' ? FILTER.find((x) => x[0] === f)![1].toLowerCase() : ''}.</td></tr>}
            {rows.map((x) => {
              const terkunci = x.pekurban_status !== 'aktif' || x.hewan_status === 'disembelih';
              return (
                <tr key={x.id}>
                  <td className="nowrap">{noS(x.id)}</td>
                  <td>
                    <Link href={`/admin/pekurban/${x.pekurban_id}`}><strong>{x.nama}</strong></Link>
                    <div className="muted">{x.hewan_nama ?? 'Tanpa hewan'} · {x.sumber === 'admin' ? 'dicatat admin' : 'dari pekurban'}</div>
                    {x.catatan && <div className="muted">“{x.catatan}”</div>}
                  </td>
                  <td className="nowrap">
                    {tgl(x.tanggal)}
                    <div className="muted">masuk {waktu(x.dibuat)}</div>
                  </td>
                  <td className="r num nowrap"><strong>{rp(x.nominal)}</strong><div className="muted">{x.metode}</div></td>
                  <td>
                    {x.bukti_id ? (
                      <a href={`/api/berkas/${x.bukti_id}`} target="_blank" rel="noreferrer" title="Buka bukti">
                        {x.bukti_mime === 'application/pdf' ? <span className="chip neutral">PDF</span> : <img className="thumb" src={`/api/berkas/${x.bukti_id}`} alt={`Bukti ${noS(x.id)}`} loading="lazy" />}
                      </a>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    <StatusSetoran s={x.status} />
                    {x.alasan && <div className="muted" style={{ maxWidth: 240, marginTop: 4 }}>{x.alasan}</div>}
                  </td>
                  <td>
                    {x.status === 'menunggu' && (
                      <div className="stack" style={{ gap: 6 }}>
                        <form action={verifikasi}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton className="btn primary sm">Terima</SubmitButton>
                        </form>
                        <details>
                          <summary className="small">Tolak</summary>
                          <form action={tolak} className="inline-form" style={{ marginTop: 6 }}>
                            <input type="hidden" name="id" value={x.id} />
                            <input type="hidden" name="back" value={back} />
                            <input name="alasan" required placeholder="Alasan, terlihat oleh pekurban" />
                            <SubmitButton className="btn danger sm">Tolak</SubmitButton>
                          </form>
                        </details>
                      </div>
                    )}
                    {x.status === 'terverifikasi' && !terkunci && (
                      <details>
                        <summary className="small muted">Batalkan</summary>
                        <form action={batalVerifikasi} className="inline-form" style={{ marginTop: 6 }}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="back" value={back} />
                          <input name="alasan" required placeholder="Alasan pembatalan" />
                          <SubmitButton className="btn danger sm" confirm="Batalkan verifikasi? Jurnal pembalik akan dibuat.">Batalkan</SubmitButton>
                        </form>
                      </details>
                    )}
                    {x.status === 'terverifikasi' && terkunci && <span className="muted">Terkunci</span>}
                    {x.status === 'ditolak' && <span className="muted">Tidak dijurnal</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr><td colSpan={3}>{rows.length} setoran</td><td className="r num">{rp(total)}</td><td colSpan={3}></td></tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="card pad-lg stack" id="catat">
        <h2>Catat setoran oleh admin</h2>
        <p className="muted">Untuk setoran tunai, atau transfer yang tidak dikonfirmasi pekurban tapi sudah terlihat di mutasi rekening.</p>
        <form action={catatSetoran} className="form">
          <input type="hidden" name="back" value={back} />
          <label className="field">
            Pekurban
            <select name="pekurban_id" required defaultValue="">
              <option value="" disabled>Pilih pekurban</option>
              {pekurban.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} · {p.hewan_nama ?? 'tanpa hewan'}{p.kurang ? ` · kurang ${rp(p.kurang)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Nominal
            <RupiahInput name="nominal" required />
          </label>
          <label className="field" style={{ flexBasis: 150 }}>
            Tanggal
            <input type="date" name="tanggal" defaultValue={today()} max={today()} required />
          </label>
          <label className="field" style={{ flexBasis: 140 }}>
            Metode
            <select name="metode" defaultValue="tunai">
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="field wide">
            Catatan <span className="hint">(opsional)</span>
            <input name="catatan" maxLength={200} placeholder="Contoh: diterima setelah kajian Ahad" />
          </label>
          <label className="field wide">
            Bukti / kuitansi <span className="hint">(opsional)</span>
            <UploadInput name="bukti" />
          </label>
          <label className="row small" style={{ fontWeight: 600, flexBasis: '100%' }}>
            <input type="checkbox" name="langsung" value="1" defaultChecked style={{ width: 18, minHeight: 18 }} />
            Langsung tandai terverifikasi (uang sudah diterima)
          </label>
          <SubmitButton className="btn dark">Simpan setoran</SubmitButton>
        </form>
      </section>
    </>
  );
}
