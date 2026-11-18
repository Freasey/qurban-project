import 'server-only';
import { randomUUID } from 'node:crypto';
import { batchExec, lit, type Conn } from './db';
import { addDays, rp, tgl, today } from './format';
import { AKUN, randomKode } from './qurban';
import { TABEL_HAPUS } from './schema';
import { DEFAULT_PENGATURAN } from './settings';

const HAPUS_SQL = [...TABEL_HAPUS.map((t) => `delete from ${t}`), `delete from sqlite_sequence where name in (${TABEL_HAPUS.map(lit).join(', ')})`];

export async function kosongkan(c: Conn) {
  for (const s of HAPUS_SQL) await c.query(s);
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

function svgBukti(nama: string, nominal: number, tanggal: string, rek: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
<rect width="420" height="560" fill="#ffffff"/><rect width="420" height="90" fill="#0f6b5a"/>
<text x="24" y="52" font-family="Arial" font-size="22" font-weight="bold" fill="#fff">Transfer Berhasil</text>
<text x="24" y="76" font-family="Arial" font-size="13" fill="#d7efe9">Contoh bukti transfer (data dummy)</text>
<text x="24" y="140" font-family="Arial" font-size="13" fill="#667">Nominal</text>
<text x="24" y="172" font-family="Arial" font-size="30" font-weight="bold" fill="#123">${esc(rp(nominal))}</text>
<text x="24" y="220" font-family="Arial" font-size="13" fill="#667">Tanggal</text>
<text x="24" y="242" font-family="Arial" font-size="17" fill="#123">${esc(tgl(tanggal, true))}</text>
<text x="24" y="284" font-family="Arial" font-size="13" fill="#667">Dari</text>
<text x="24" y="306" font-family="Arial" font-size="17" fill="#123">${esc(nama)}</text>
<text x="24" y="348" font-family="Arial" font-size="13" fill="#667">Ke rekening</text>
<text x="24" y="370" font-family="Arial" font-size="17" fill="#123">${esc(rek)}</text>
<text x="24" y="412" font-family="Arial" font-size="13" fill="#667">Berita</text>
<text x="24" y="434" font-family="Arial" font-size="17" fill="#123">Tabungan qurban</text>
<rect x="24" y="480" width="372" height="1" fill="#dde"/>
<text x="24" y="512" font-family="Arial" font-size="12" fill="#99a">Ref ${Math.random().toString(36).slice(2, 12).toUpperCase()}</text>
</svg>`;
  return Buffer.from(svg);
}

function svgNota(hewan: string, harga: number, tanggal: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="420" viewBox="0 0 480 420">
<rect width="480" height="420" fill="#fffdf6"/><rect x="12" y="12" width="456" height="396" fill="none" stroke="#c9b98f" stroke-width="2"/>
<text x="32" y="58" font-family="Georgia" font-size="24" font-weight="bold" fill="#3a2e12">NOTA PEMBELIAN</text>
<text x="32" y="82" font-family="Arial" font-size="13" fill="#7a6a42">Peternakan Berkah Jaya (contoh, data dummy)</text>
<text x="32" y="130" font-family="Arial" font-size="15" fill="#333">Tanggal: ${esc(tgl(tanggal, true))}</text>
<text x="32" y="170" font-family="Arial" font-size="15" fill="#333">Barang: 1 ekor sapi limousin, ${esc(hewan)}</text>
<text x="32" y="200" font-family="Arial" font-size="15" fill="#333">Berat hidup: kurang lebih 420 kg</text>
<rect x="32" y="232" width="416" height="1" fill="#c9b98f"/>
<text x="32" y="276" font-family="Arial" font-size="15" fill="#333">Total</text>
<text x="448" y="276" text-anchor="end" font-family="Georgia" font-size="26" font-weight="bold" fill="#3a2e12">${esc(rp(harga))}</text>
<text x="32" y="360" font-family="Arial" font-size="13" fill="#7a6a42">Lunas. Terima kasih.</text>
</svg>`;
  return Buffer.from(svg);
}

type SeedPk = { nama: string; hp: string; hewan: string | null; verified: number[]; pending?: number[]; ditolak?: [number, string][]; tunai?: boolean };
type R = Record<string, unknown>;

/**
 * Data dummy disusun langsung di JavaScript (mengikuti aturan posting yang sama dengan aplikasi),
 * lalu dikirim ke D1 dalam beberapa batch saja. D1 membatasi jumlah query per request,
 * jadi menyimpan ratusan baris satu per satu tidak memungkinkan.
 */
export async function isiDataDummy() {
  const T = today();
  const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const rek = `BSI 7123456789 a.n. Panitia Qurban`;
  const pengaturan = {
    ...DEFAULT_PENGATURAN,
    namaMasjid: 'Masjid Baitul Makmur',
    alamatMasjid: 'Prima Bintara, Bekasi',
    periode: 'Qurban 1448 H / 2027',
    bank: 'Bank Syariah Indonesia',
    noRekening: '7123456789',
    atasNamaRekening: 'Panitia Qurban Masjid Baitul Makmur',
    waPanitia: '081234567890',
    tanggalIdulAdha: '2027-05-16',
    batasPelunasan: '2027-04-30',
    pengumuman: 'Sapi B masih membuka 2 slot. Hubungi panitia untuk mendaftar. Setoran bisa dicicil sampai batas pelunasan.',
    namaBendahara: 'Hasan Basri',
    namaKetua: 'H. Abdul Karim',
    saldoBank: null as number | null,
    tanggalSaldoBank: T,
  };

  const berkas: R[] = [];
  const hewan: R[] = [];
  const pekurban: R[] = [];
  const setoran: R[] = [];
  const jurnal: R[] = [];
  const baris: R[] = [];
  const log: R[] = [];

  const file = (buf: Buffer, nama: string) => {
    const id = randomUUID();
    berkas.push({ id, nama, mime: 'image/svg+xml', ukuran: buf.length, isi: buf.toString('base64'), dibuat: nowIso });
    return id;
  };
  const postJurnal = (j: { tanggal: string; keterangan: string; jenis: string; pekurban_id?: number; hewan_id?: number; setoran_id?: number }, b: [string, number | null, number, number][]) => {
    const id = jurnal.length + 1;
    jurnal.push({ id, tanggal: j.tanggal, keterangan: j.keterangan, jenis: j.jenis, pekurban_id: j.pekurban_id ?? null, hewan_id: j.hewan_id ?? null, setoran_id: j.setoran_id ?? null, pembalik_dari: null, dibalik: 0, dibuat: nowIso });
    for (const [akun, pk, debit, kredit] of b) baris.push({ id: baris.length + 1, jurnal_id: id, akun, pekurban_id: pk, debit, kredit });
  };
  const noS = (id: number) => 'S-' + String(id).padStart(4, '0');

  const HEWAN: [string, string, number, number, string][] = [
    ['Sapi A', 'sapi', 7, 21_000_000, 'Sapi limousin'],
    ['Sapi B', 'sapi', 7, 22_400_000, 'Sapi bali'],
    ['Kambing 1', 'kambing', 1, 3_500_000, ''],
    ['Kambing 2', 'kambing', 1, 3_200_000, ''],
  ];
  const idHewan: Record<string, number> = {};
  for (const [nama, jenis, kapasitas, harga, catatan] of HEWAN) {
    const id = hewan.length + 1;
    idHewan[nama] = id;
    hewan.push({ id, nama, jenis, kapasitas, harga_estimasi: harga, harga_realisasi: null, status: 'direncanakan', tgl_beli: null, tgl_sembelih: null, nota_id: null, catatan, dibuat: nowIso });
  }

  const data: SeedPk[] = [
    { nama: 'Ahmad Fauzi', hp: '081311110001', hewan: 'Sapi A', verified: [1_000_000, 1_100_000, 1_000_000] },
    { nama: 'Budi Santoso', hp: '081311110002', hewan: 'Sapi A', verified: [3_000_000] },
    { nama: 'Citra Lestari', hp: '081311110003', hewan: 'Sapi A', verified: [1_500_000, 1_500_000] },
    { nama: 'Dedi Kurniawan', hp: '081311110004', hewan: 'Sapi A', verified: [1_000_000, 650_000, 1_300_000] },
    { nama: 'Eko Prasetyo', hp: '081311110005', hewan: 'Sapi A', verified: [800_000, 800_000, 800_000, 600_000], tunai: true },
    { nama: 'Fitri Handayani', hp: '081311110006', hewan: 'Sapi A', verified: [3_000_000] },
    { nama: 'Hj. Siti Aminah', hp: '081311110007', hewan: 'Sapi A', verified: [2_000_000, 1_200_000] },
    { nama: 'Gilang Ramadhan', hp: '081311110008', hewan: 'Sapi B', verified: [1_000_000, 1_000_000], pending: [700_000] },
    { nama: 'Hendra Wijaya', hp: '081311110009', hewan: 'Sapi B', verified: [3_200_000] },
    { nama: 'Indah Permata', hp: '081311110010', hewan: 'Sapi B', verified: [600_000, 600_000], pending: [500_000] },
    { nama: 'Joko Susilo', hp: '081311110011', hewan: 'Sapi B', verified: [1_500_000], ditolak: [[400_000, 'Nominal di bukti tidak sama dengan mutasi rekening. Mohon unggah ulang bukti yang benar.']] },
    { nama: 'Kartika Sari', hp: '081311110012', hewan: 'Sapi B', verified: [800_000] },
    { nama: 'Lukman Hakim', hp: '081311110013', hewan: 'Kambing 1', verified: [1_500_000, 2_000_000] },
    { nama: 'Maya Anggraini', hp: '081311110014', hewan: 'Kambing 2', verified: [1_000_000, 1_000_000], pending: [400_000] },
    { nama: 'Nur Hidayat', hp: '081311110015', hewan: null, verified: [1_000_000] },
  ];

  const kodeDipakai = new Set<string>();
  const kodeContoh: string[] = [];
  let kas = 0;
  let menunggu = 0;
  for (const [i, d] of data.entries()) {
    let kode = randomKode();
    while (kodeDipakai.has(kode)) kode = randomKode();
    kodeDipakai.add(kode);
    const pid = pekurban.length + 1;
    pekurban.push({
      id: pid, kode, nama: d.nama, hp: d.hp,
      alamat: `Perumahan Prima Bintara Blok ${String.fromCharCode(65 + (i % 6))}${(i % 9) + 1}`,
      atas_nama: d.nama.replace(/^Hj\. /, ''), hewan_id: d.hewan ? idHewan[d.hewan] : null, status: 'aktif', catatan: '', dibuat: nowIso,
    });
    if (i < 3) kodeContoh.push(`${d.nama}: ${kode}`);
    const n = d.verified.length;
    for (const [j, nominal] of d.verified.entries()) {
      const tanggal = addDays(T, -(150 - j * Math.floor(120 / Math.max(1, n - 1))) - i);
      const tunai = !!d.tunai;
      const sid = setoran.length + 1;
      setoran.push({
        id: sid, pekurban_id: pid, tanggal, nominal, metode: tunai ? 'tunai' : 'transfer', status: 'terverifikasi', alasan: '',
        bukti_id: tunai ? null : file(svgBukti(d.nama, nominal, tanggal, rek), 'bukti-dummy.svg'),
        sumber: tunai ? 'admin' : 'pekurban', catatan: tunai ? 'Setor tunai ke bendahara setelah kajian' : '', dibuat: nowIso, diverifikasi: nowIso,
      });
      postJurnal(
        { tanggal, keterangan: `Setoran ${d.nama} terverifikasi (${noS(sid)}, ${tunai ? 'tunai' : 'transfer'})`, jenis: 'setoran', pekurban_id: pid, setoran_id: sid },
        [[AKUN.KAS, null, nominal, 0], [AKUN.TITIPAN, pid, 0, nominal]],
      );
      kas += nominal;
    }
    for (const [nominal, alasan] of d.ditolak || []) {
      const tanggal = addDays(T, -20);
      setoran.push({
        id: setoran.length + 1, pekurban_id: pid, tanggal, nominal, metode: 'transfer', status: 'ditolak', alasan,
        bukti_id: file(svgBukti(d.nama, nominal - 50_000, tanggal, rek), 'bukti-dummy.svg'), sumber: 'pekurban', catatan: '', dibuat: nowIso, diverifikasi: nowIso,
      });
    }
    for (const [j, nominal] of (d.pending || []).entries()) {
      const tanggal = addDays(T, -1 - j - (i % 3));
      setoran.push({
        id: setoran.length + 1, pekurban_id: pid, tanggal, nominal, metode: 'transfer', status: 'menunggu', alasan: '',
        bukti_id: file(svgBukti(d.nama, nominal, tanggal, rek), 'bukti-dummy.svg'), sumber: 'pekurban', catatan: 'Cicilan bulan ini', dibuat: nowIso, diverifikasi: null,
      });
      menunggu += nominal;
    }
  }

  // Sapi A sudah dibeli (belum disembelih), supaya alur penyembelihan dan penyelesaian bisa dicoba.
  const tBeli = addDays(T, -4);
  const hargaBeli = 20_650_000;
  Object.assign(hewan[0], { status: 'dibeli', harga_realisasi: hargaBeli, tgl_beli: tBeli, nota_id: file(svgNota('Sapi A', hargaBeli, tBeli), 'nota-dummy.svg') });
  postJurnal({ tanggal: tBeli, keterangan: 'Pembelian Sapi A (nota terlampir)', jenis: 'beli', hewan_id: 1 }, [[AKUN.PERSEDIAAN, null, hargaBeli, 0], [AKUN.KAS, null, 0, hargaBeli]]);
  kas -= hargaBeli;

  // Saldo bank menurut mutasi = kas sistem + setoran yang belum diverifikasi (sudah masuk rekening).
  pengaturan.saldoBank = kas + menunggu;
  log.push({ id: 1, waktu: nowIso, aksi: 'Isi data dummy', detail: `15 pekurban, 4 hewan. Contoh kode: ${kodeContoh.join(', ')}` });

  const ins = (t: string, rows: R[]) => rows.map((r) => `insert into ${t} (${Object.keys(r).join(', ')}) values (${Object.values(r).map(lit).join(', ')})`);
  await batchExec([
    ...HAPUS_SQL,
    `insert into pengaturan (id, data) values (1, ${lit(JSON.stringify(pengaturan))}) on conflict (id) do update set data = excluded.data`,
    ...ins('berkas', berkas),
    ...ins('hewan', hewan),
    ...ins('pekurban', pekurban),
    ...ins('setoran', setoran),
    ...ins('jurnal', jurnal),
    ...ins('jurnal_baris', baris),
    ...ins('log_aktivitas', log),
  ]);
}
