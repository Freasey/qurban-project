import Link from 'next/link';
import type { Metadata } from 'next';
import { konfirmasiSetoran } from '@/app/actions';
import { CopyButton, RupiahInput, SubmitButton, UploadInput } from '@/components/client';
import { Bar, Flash, noS, StatusHewan, StatusSetoran } from '@/components/ui';
import { clientIp } from '@/lib/auth';
import { getHewanById, getPekurbanByKode, listPekurban, listSetoran } from '@/lib/data';
import { JENIS_HEWAN, rp, STATUS_PEKURBAN, tgl, TIPE_PENYELESAIAN, today, waNumber } from '@/lib/format';
import { normalizeKode } from '@/lib/qurban';
import { hit, isLimited } from '@/lib/rate';
import { getPengaturan } from '@/lib/settings';

export const metadata: Metadata = { title: 'Data pekurban', referrer: 'no-referrer' };

function Gagal({ judul, pesan }: { judul: string; pesan: string }) {
  return (
    <main className="pub">
      <section className="card pad-lg stack">
        <h1>{judul}</h1>
        <p>{pesan}</p>
        <Link className="btn primary" href="/" style={{ alignSelf: 'flex-start' }}>Kembali</Link>
      </section>
    </main>
  );
}

export default async function PekurbanPage({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { kode: raw } = await params;
  const sp = await searchParams;
  const kode = normalizeKode(decodeURIComponent(raw));
  const ip = await clientIp();
  if (await isLimited('kode:' + ip, 10, 900)) {
    return <Gagal judul="Terlalu banyak percobaan" pesan="Terlalu banyak kode salah dari perangkat ini. Coba lagi dalam 15 menit." />;
  }
  const p = await getPekurbanByKode(kode);
  if (!p) {
    await hit('kode:' + ip, 900);
    return <Gagal judul="Kode tidak ditemukan" pesan="Periksa kembali kode pekurban dari panitia. Kode berbentuk QB-XXXXXX." />;
  }

  const [s, setoran, hewan, rekan] = await Promise.all([
    getPengaturan(),
    listSetoran('where s.pekurban_id = $1', [p.id]),
    p.hewan_id ? getHewanById(p.hewan_id) : Promise.resolve(undefined),
    p.hewan_id ? listPekurban(`where p.hewan_id = $1 and p.status <> 'batal'`, [p.hewan_id]) : Promise.resolve([]),
  ]);
  const k = encodeURIComponent(p.kode);
  const target = p.target ?? 0;
  const sudahSembelih = p.hewan_status === 'disembelih';

  const tahap = [
    { t: 'Terdaftar', done: true },
    { t: 'Menabung', done: p.total_setor > 0 },
    { t: 'Lunas', done: p.lunas },
    { t: 'Hewan dibeli', done: p.hewan_status === 'dibeli' || sudahSembelih },
    { t: 'Disembelih', done: sudahSembelih },
    { t: 'Selesai', done: p.status === 'selesai' },
  ];
  const now = tahap.findIndex((x) => !x.done);

  return (
    <main className="pub">
      <header className="pub-head no-print">
        <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
          Tabungan Qurban<small>{s.namaMasjid}</small>
        </Link>
        <div className="row">
          <Link className="btn ghost sm" href={`/p/${k}/cetak`}>Cetak ringkasan</Link>
          <Link className="btn ghost sm" href="/">Keluar</Link>
        </div>
      </header>

      <Flash sp={sp} />

      <section className="card pad-lg stack-lg">
        <div className="between">
          <div className="stack" style={{ gap: 4 }}>
            <span className="lbl">Assalamu&apos;alaikum</span>
            <h1>{p.nama}</h1>
            <div className="row">
              <span className="chip neutral mono">{p.kode}</span>
              {p.hewan_nama ? (
                <span className="chip info">{p.hewan_nama}</span>
              ) : (
                <span className="chip wait">Belum ditempatkan di hewan</span>
              )}
              {p.status !== 'aktif' && <span className={`chip ${p.status === 'batal' ? 'bad' : 'ok'}`}>{STATUS_PEKURBAN[p.status]}</span>}
            </div>
          </div>
          <div className="stack r" style={{ gap: 2 }}>
            <span className="lbl">{sudahSembelih ? 'Sisa saldo' : 'Saldo tabungan'}</span>
            <span className="val num" style={{ fontSize: 32 }}>{rp(p.saldo)}</span>
            {p.menunggu > 0 && <span className="muted">+ {rp(p.menunggu)} menunggu verifikasi</span>}
          </div>
        </div>

        {p.status === 'batal' ? (
          <div className="notice">Pendaftaran qurban dibatalkan. Dana yang sudah terverifikasi telah dikembalikan oleh panitia.</div>
        ) : target > 0 && !sudahSembelih ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="between small">
              <span>
                Terkumpul <strong>{rp(p.saldo)}</strong> dari {rp(target)}
              </span>
              {p.kurang > 0 ? <span className="chip wait">Kurang {rp(p.kurang)}</span> : <span className="chip ok">Lunas</span>}
            </div>
            <Bar value={p.saldo} max={target} big />
            {p.kurang > 0 && s.batasPelunasan && (
              <span className="muted">Mohon dilunasi sebelum {tgl(s.batasPelunasan, true)}.</span>
            )}
          </div>
        ) : null}

        <div className="steps" aria-label="Tahapan qurban">
          {tahap.map((x, i) => (
            <div key={x.t} className={`step ${x.done ? 'done' : i === now ? 'now' : ''}`}>
              <span className="dot">{x.done ? '✓' : i + 1}</span>
              <span className="t">{x.t}</span>
            </div>
          ))}
        </div>
      </section>

      {p.peny_tipe && (
        <section className="card pad-lg stack">
          <h2>Hasil akhir qurban</h2>
          <div className="pos"><span>Total setoran terverifikasi</span><strong className="num">{rp(p.total_setor)}</strong></div>
          <div className="pos"><span>Biaya porsi {p.hewan_nama}</span><strong className="num">{rp(p.biaya)}</strong></div>
          <div className="pos">
            <span>{TIPE_PENYELESAIAN[p.peny_tipe]}</span>
            <strong className="num">{rp(p.peny_nominal)}</strong>
          </div>
          <p className="muted">Diselesaikan {tgl(p.peny_tanggal, true)}. Jazakumullah khairan, semoga qurbannya diterima.</p>
        </section>
      )}

      <div className="two">
        {hewan && (
          <section className="card pad-lg stack">
            <div className="between">
              <h2>{hewan.nama}</h2>
              <StatusHewan s={hewan.status} />
            </div>
            <div className="pos"><span>Jenis</span><strong>{JENIS_HEWAN[hewan.jenis]}</strong></div>
            <div className="pos"><span>Peserta</span><strong>{hewan.peserta} dari {hewan.kapasitas} slot</strong></div>
            <div className="pos">
              <span>{hewan.harga_realisasi ? 'Harga beli' : 'Harga estimasi'}</span>
              <strong className="num">{rp(hewan.harga_realisasi ?? hewan.harga_estimasi)}</strong>
            </div>
            <div className="pos">
              <span>{sudahSembelih ? 'Biaya porsi kamu' : 'Perkiraan porsi kamu'}</span>
              <strong className="num">{rp(target)}</strong>
            </div>
            {hewan.tgl_beli && <div className="pos"><span>Tanggal beli</span><strong>{tgl(hewan.tgl_beli, true)}</strong></div>}
            {hewan.tgl_sembelih && <div className="pos"><span>Tanggal sembelih</span><strong>{tgl(hewan.tgl_sembelih, true)}</strong></div>}
            {hewan.nota_id && (
              <a className="btn ghost sm" style={{ alignSelf: 'flex-start' }} href={`/api/berkas/${hewan.nota_id}?k=${k}`} target="_blank" rel="noreferrer">
                Lihat nota pembelian
              </a>
            )}
            {rekan.length > 1 && (
              <details>
                <summary className="small">Rekan satu hewan</summary>
                <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {rekan.map((x) => (
                    <li key={x.id}>
                      {x.id === p.id ? <strong>{x.nama} (kamu)</strong> : x.nama.split(' ')[0] + ' ' + (x.nama.split(' ')[1]?.[0] ?? '') + '.'}
                      {' · '}
                      {x.lunas ? 'lunas' : 'menabung'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!sudahSembelih && hewan.harga_realisasi == null && (
              <p className="muted">Harga final mengikuti nota pembelian. Bila ada sisa, panitia akan mengembalikan atau mengalihkannya sesuai kesepakatan.</p>
            )}
          </section>
        )}

        {p.status === 'aktif' && !sudahSembelih ? (
          <section className="card pad-lg stack">
            <h2>Konfirmasi setoran</h2>
            <p className="muted">Sudah transfer? Isi nominal dan unggah foto bukti transfer. Panitia akan memverifikasi dalam 1–2 hari.</p>
            {s.noRekening && (
              <div className="rek">
                <span className="muted">Transfer ke {s.bank}</span>
                <div className="between">
                  <span className="mono">{s.noRekening}</span>
                  <CopyButton text={s.noRekening} />
                </div>
                <span className="small">a.n. {s.atasNamaRekening}</span>
              </div>
            )}
            <form action={konfirmasiSetoran} className="form col">
              <input type="hidden" name="kode" value={p.kode} />
              <label className="field">
                Nominal yang ditransfer
                <RupiahInput name="nominal" required placeholder={p.kurang > 0 ? p.kurang.toLocaleString('id-ID') : '500.000'} />
              </label>
              <label className="field">
                Tanggal transfer
                <input type="date" name="tanggal" required defaultValue={today()} max={today()} />
              </label>
              <label className="field">
                Foto bukti transfer
                <UploadInput name="bukti" required />
              </label>
              <label className="field">
                Catatan <span className="hint">(opsional)</span>
                <input name="catatan" maxLength={200} placeholder="Contoh: transfer dari rekening istri" />
              </label>
              <SubmitButton pendingText="Mengirim…">Kirim konfirmasi</SubmitButton>
            </form>
          </section>
        ) : null}
      </div>

      <section className="box">
        <table>
          <caption>Riwayat setoran</caption>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th className="r">Nominal</th>
              <th>Metode</th>
              <th>Status</th>
              <th>Bukti</th>
            </tr>
          </thead>
          <tbody>
            {setoran.length === 0 && (
              <tr><td colSpan={6} className="empty">Belum ada setoran.</td></tr>
            )}
            {setoran.map((x) => (
              <tr key={x.id}>
                <td className="nowrap">{noS(x.id)}</td>
                <td className="nowrap">{tgl(x.tanggal)}</td>
                <td className="r num nowrap"><strong>{rp(x.nominal)}</strong></td>
                <td>{x.metode === 'tunai' ? 'Tunai' : 'Transfer'}</td>
                <td>
                  <StatusSetoran s={x.status} />
                  {x.alasan && <div className="muted" style={{ marginTop: 4, maxWidth: 320 }}>{x.alasan}</div>}
                </td>
                <td>
                  {x.bukti_id ? (
                    <a href={`/api/berkas/${x.bukti_id}?k=${k}`} target="_blank" rel="noreferrer">Lihat</a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack no-print">
        <div className="between">
          <p className="small">Simpan kode <strong className="mono">{p.kode}</strong> baik-baik. Siapa pun yang tahu kode ini bisa melihat data tabunganmu.</p>
          {s.waPanitia && (
            <a className="btn ghost sm" href={`https://wa.me/${waNumber(s.waPanitia)}?text=${encodeURIComponent(`Assalamu'alaikum, saya ${p.nama} (${p.kode}) ingin bertanya tentang tabungan qurban.`)}`} target="_blank" rel="noreferrer">
              Tanya panitia
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
