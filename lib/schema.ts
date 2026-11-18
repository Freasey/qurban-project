// Skema SQLite (Cloudflare D1). Waktu disimpan sebagai teks ISO UTC, tanggal sebagai 'YYYY-MM-DD'.
const NOW = `(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;

export const TABEL_HAPUS = [
  'penyelesaian',
  'jurnal_baris',
  'jurnal',
  'setoran',
  'pekurban',
  'hewan',
  'berkas',
  'log_aktivitas',
  'batas_akses',
];
export const TABEL_SALIN = ['berkas', 'hewan', 'pekurban', 'setoran', 'jurnal', 'jurnal_baris', 'penyelesaian', 'log_aktivitas'];

export const SCHEMA = `
create table if not exists pengaturan (
  id integer primary key,
  data text not null default '{}'
);
create table if not exists berkas (
  id text primary key,
  nama text not null default '',
  mime text not null,
  ukuran integer not null,
  isi text not null,
  dibuat text not null default ${NOW}
);
create table if not exists hewan (
  id integer primary key autoincrement,
  nama text not null,
  jenis text not null,
  kapasitas integer not null,
  harga_estimasi integer not null,
  harga_realisasi integer,
  status text not null default 'direncanakan',
  tgl_beli text,
  tgl_sembelih text,
  nota_id text references berkas(id),
  catatan text not null default '',
  dibuat text not null default ${NOW}
);
create table if not exists pekurban (
  id integer primary key autoincrement,
  kode text not null unique,
  nama text not null,
  hp text not null default '',
  alamat text not null default '',
  atas_nama text not null default '',
  hewan_id integer references hewan(id),
  status text not null default 'aktif',
  catatan text not null default '',
  dibuat text not null default ${NOW}
);
create table if not exists setoran (
  id integer primary key autoincrement,
  pekurban_id integer not null references pekurban(id),
  tanggal text not null,
  nominal integer not null check (nominal > 0),
  metode text not null,
  status text not null default 'menunggu',
  alasan text not null default '',
  bukti_id text references berkas(id),
  sumber text not null,
  catatan text not null default '',
  dibuat text not null default ${NOW},
  diverifikasi text
);
create table if not exists jurnal (
  id integer primary key autoincrement,
  tanggal text not null,
  keterangan text not null,
  jenis text not null,
  pekurban_id integer references pekurban(id),
  hewan_id integer references hewan(id),
  setoran_id integer references setoran(id),
  pembalik_dari integer references jurnal(id),
  dibalik integer not null default 0,
  dibuat text not null default ${NOW}
);
create table if not exists jurnal_baris (
  id integer primary key autoincrement,
  jurnal_id integer not null references jurnal(id) on delete cascade,
  akun text not null,
  pekurban_id integer references pekurban(id),
  debit integer not null default 0,
  kredit integer not null default 0
);
create table if not exists penyelesaian (
  pekurban_id integer primary key references pekurban(id),
  tipe text not null,
  nominal integer not null,
  tanggal text not null,
  catatan text not null default '',
  jurnal_id integer references jurnal(id)
);
create table if not exists log_aktivitas (
  id integer primary key autoincrement,
  waktu text not null default ${NOW},
  aksi text not null,
  detail text not null default ''
);
create table if not exists batas_akses (
  kunci text primary key,
  jumlah integer not null,
  mulai text not null
);
create index if not exists setoran_pk_idx on setoran(pekurban_id);
create index if not exists setoran_status_idx on setoran(status);
create index if not exists jb_jurnal_idx on jurnal_baris(jurnal_id);
create index if not exists jb_akun_pk_idx on jurnal_baris(akun, pekurban_id);
create index if not exists pekurban_hewan_idx on pekurban(hewan_id);
`;
