export function rp(n: number | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-Rp' : 'Rp') + s;
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function tgl(d: string | Date | null | undefined, panjang = false): string {
  if (!d) return '-';
  const s = typeof d === 'string' ? d.slice(0, 10) : isoWib(d);
  const [y, m, day] = s.split('-').map(Number);
  if (!y || !m || !day) return '-';
  return `${day} ${(panjang ? BULAN_PANJANG : BULAN)[m - 1]} ${y}`;
}

export function waktu(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const jam = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(dt);
  return `${tgl(dt)} ${jam.replace('.', ':')}`;
}

/** Tanggal (YYYY-MM-DD) menurut WIB. */
export function isoWib(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export const today = () => isoWib();

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}

export function parseRupiah(v: unknown): number {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function waNumber(hp: string): string {
  let d = (hp || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}

export const JENIS_HEWAN: Record<string, string> = { sapi: 'Sapi', kambing: 'Kambing', domba: 'Domba' };
export const STATUS_HEWAN: Record<string, string> = {
  direncanakan: 'Belum dibeli',
  dibeli: 'Sudah dibeli',
  disembelih: 'Sudah disembelih',
};
export const STATUS_SETORAN: Record<string, string> = {
  menunggu: 'Menunggu verifikasi',
  terverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
};
export const STATUS_PEKURBAN: Record<string, string> = { aktif: 'Aktif', selesai: 'Selesai', batal: 'Batal' };
export const TIPE_PENYELESAIAN: Record<string, string> = {
  lunas: 'Pas, tidak ada sisa',
  refund: 'Sisa dikembalikan',
  infak: 'Sisa menjadi infak',
  dialihkan: 'Sisa dialihkan ke periode berikutnya',
};
