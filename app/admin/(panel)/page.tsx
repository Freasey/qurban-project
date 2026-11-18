import type { Metadata } from 'next';
import Link from 'next/link';
import { isiDummy, simpanSaldoBank } from '../actions';
import { RupiahInput, SubmitButton } from '@/components/client';
import { Bar, Flash, noS, Stat, StatusHewan } from '@/components/ui';
import { listHewan, listPekurban, listSetoran, ringkasan } from '@/lib/data';
import { daysBetween, rp, tgl, today } from '@/lib/format';
import { siteOrigin } from '@/lib/origin';
import { getPengaturan } from '@/lib/settings';
import { pesanTagihan, waLink } from '@/lib/wa';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [r, s, hewan, pekurban, menunggu, origin] = await Promise.all([
    ringkasan(),
    getPengaturan(),
    listHewan(),
    listPekurban(`where p.status = 'aktif'`),
    listSetoran(`where s.status = 'menunggu'`, [], 6),
    siteOrigin(),
  ]);
  const kosong = hewan.length === 0 && pekurban.length === 0;
  const belumLunas = pekurban.filter((p) => p.kurang > 0).sort((a, b) => b.kurang - a.kurang);
  const selisih = s.saldoBank == null ? null : s.saldoBank - r.kas;
  const sisaHari = s.batasPelunasan ? daysBetween(today(), s.batasPelunasan) : null;

  return (
    <>
      <div className="between">
        <div>
          <h1>Dashboard</h1>
          <div className="muted">
            {tgl(today(), true)}
            {sisaHari != null && sisaHari >= 0 && ` · ${sisaHari} hari menuju batas pelunasan (${tgl(s.batasPelunasan)})`}
          </div>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/admin/setoran#catat">Catat setoran tunai</Link>
          <Link className="btn primary" href="/admin/pekurban/baru">Tambah pekurban</Link>
        </div>
      </div>
      <Flash sp={sp} />

      {kosong && (
        <section className="card pad-lg stack">
          <h2>Belum ada data</h2>
          <p>Mulai dengan menambahkan hewan qurban dan pekurban, atau isi data dummy untuk mencoba semua fitur.</p>
          <div className="row">
            <form action={isiDummy}>
              <SubmitButton className="btn dark" pendingText="Mengisi…">Isi data dummy</SubmitButton>
            </form>
            <Link className="btn ghost" href="/admin/hewan">Tambah hewan</Link>
            <Link className="btn ghost" href="/admin/pengaturan">Atur rekening dan tanggal</Link>
          </div>
        </section>
      )}

      <section className="stats">
        <Stat label="Kas qurban (sistem)" value={rp(r.kas)} note="Saldo akun Kas/Bank dari jurnal" />
        <Stat label="Titipan pekurban" value={rp(r.titipan)} note="Kewajiban ke pekurban" />
        <Stat
          label="Menunggu verifikasi"
          value={rp(r.pend)}
          note={r.pendN ? <Link href="/admin/setoran">{r.pendN} setoran perlu dicek →</Link> : 'Tidak ada antrian'}
        />
        <Stat label="Pekurban" value={`${r.pekurban} orang`} note={r.tanpaHewan ? `${r.tanpaHewan} belum ditempatkan di hewan` : 'Semua sudah punya hewan'} />
      </section>

      <div className="two">
        <section className="card pad-lg stack">
          <div className="between">
            <h2>Rekonsiliasi bank</h2>
            {selisih == null ? (
              <span className="chip neutral">Belum diisi</span>
            ) : selisih === 0 ? (
              <span className="chip ok">Cocok</span>
            ) : (
              <span className={`chip ${selisih === r.pend ? 'wait' : 'bad'}`}>Selisih {rp(selisih)}</span>
            )}
          </div>
          <div>
            <div className="pos"><span>Saldo rekening menurut mutasi bank</span><strong className="num">{s.saldoBank == null ? '-' : rp(s.saldoBank)}</strong></div>
            <div className="pos"><span>Kas/Bank menurut sistem</span><strong className="num">{rp(r.kas)}</strong></div>
            <div className="pos"><span>Setoran menunggu verifikasi</span><strong className="num">{rp(r.pend)}</strong></div>
          </div>
          {selisih != null && selisih !== 0 && (
            <p className="small">
              {selisih === r.pend
                ? 'Selisih sama persis dengan setoran yang belum diverifikasi. Setelah semua diverifikasi, saldo akan cocok.'
                : `Ada selisih ${rp(selisih - r.pend)} yang belum terjelaskan setelah memperhitungkan setoran menunggu. Periksa mutasi bank: transfer tanpa konfirmasi, biaya admin, atau salah catat.`}
            </p>
          )}
          <form action={simpanSaldoBank} className="form">
            <label className="field">
              Saldo bank terbaru
              <RupiahInput name="saldoBank" defaultValue={s.saldoBank} />
            </label>
            <label className="field" style={{ flexBasis: 150 }}>
              Per tanggal
              <input type="date" name="tanggalSaldoBank" defaultValue={s.tanggalSaldoBank || today()} max={today()} />
            </label>
            <SubmitButton className="btn dark">Simpan</SubmitButton>
          </form>
        </section>

        <section className="card pad-lg stack">
          <div className="between">
            <h2>Setoran terbaru menunggu</h2>
            <Link href="/admin/setoran" className="small">Semua →</Link>
          </div>
          {menunggu.length === 0 && <p className="muted">Tidak ada setoran menunggu.</p>}
          <div>
            {menunggu.map((x) => (
              <div className="list-item" key={x.id}>
                <div>
                  <strong>{x.nama}</strong>
                  <div className="muted">{noS(x.id)} · {tgl(x.tanggal)} · {x.hewan_nama ?? 'tanpa hewan'}</div>
                </div>
                <strong className="num nowrap">{rp(x.nominal)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      {hewan.length > 0 && (
        <section className="box">
          <table>
            <caption>Progres per hewan</caption>
            <thead>
              <tr><th>Hewan</th><th>Peserta</th><th className="r">Dana terverifikasi</th><th className="r">Kebutuhan</th><th>Progres</th><th>Status</th></tr>
            </thead>
            <tbody>
              {hewan.map((h) => {
                const harga = Number(h.harga_realisasi ?? h.harga_estimasi);
                const butuh = h.peserta ? Math.ceil(harga / h.kapasitas) * h.peserta : harga;
                return (
                  <tr key={h.id}>
                    <td><Link href={`/admin/hewan/${h.id}`}><strong>{h.nama}</strong></Link></td>
                    <td>{h.peserta}/{h.kapasitas}</td>
                    <td className="r num">{rp(h.dana)}</td>
                    <td className="r num">{rp(butuh)}</td>
                    <td><Bar value={h.dana} max={butuh} /></td>
                    <td><StatusHewan s={h.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {belumLunas.length > 0 && (
        <section className="box">
          <table>
            <caption>Belum lunas ({belumLunas.length} pekurban)</caption>
            <thead>
              <tr><th>Pekurban</th><th>Hewan</th><th className="r">Saldo</th><th className="r">Menunggu</th><th className="r">Kurang</th><th>Pengingat</th></tr>
            </thead>
            <tbody>
              {belumLunas.slice(0, 10).map((p) => {
                const wa = waLink(p.hp, pesanTagihan(p, origin, s.batasPelunasan));
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/pekurban/${p.id}`}><strong>{p.nama}</strong></Link></td>
                    <td>{p.hewan_nama}</td>
                    <td className="r num">{rp(p.saldo)}</td>
                    <td className="r num">{p.menunggu ? rp(p.menunggu) : '-'}</td>
                    <td className="r num"><strong>{rp(p.kurang)}</strong></td>
                    <td>{wa ? <a className="btn ghost sm" href={wa} target="_blank" rel="noreferrer">Kirim WA</a> : <span className="muted">No HP kosong</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
