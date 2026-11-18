export const SCHEMA = `
create table if not exists pengaturan (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb
);
create table if not exists berkas (
  id text primary key,
  nama text not null default '',
  mime text not null,
  ukuran int not null,
  isi bytea not null,
  dibuat timestamptz not null default now()
);
create table if not exists hewan (
  id serial primary key,
  nama text not null,
  jenis text not null,
  kapasitas int not null,
  harga_estimasi bigint not null,
  harga_realisasi bigint,
  status text not null default 'direncanakan',
  tgl_beli date,
  tgl_sembelih date,
  nota_id text references berkas(id),
  catatan text not null default '',
  dibuat timestamptz not null default now()
);
create table if not exists pekurban (
  id serial primary key,
  kode text not null unique,
  nama text not null,
  hp text not null default '',
  alamat text not null default '',
  atas_nama text not null default '',
  hewan_id int references hewan(id),
  status text not null default 'aktif',
  catatan text not null default '',
  dibuat timestamptz not null default now()
);
create table if not exists setoran (
  id serial primary key,
  pekurban_id int not null references pekurban(id),
  tanggal date not null,
  nominal bigint not null check (nominal > 0),
  metode text not null,
  status text not null default 'menunggu',
  alasan text not null default '',
  bukti_id text references berkas(id),
  sumber text not null,
  catatan text not null default '',
  dibuat timestamptz not null default now(),
  diverifikasi timestamptz
);
create table if not exists jurnal (
  id serial primary key,
  tanggal date not null,
  keterangan text not null,
  jenis text not null,
  pekurban_id int references pekurban(id),
  hewan_id int references hewan(id),
  setoran_id int references setoran(id),
  pembalik_dari int references jurnal(id),
  dibalik boolean not null default false,
  dibuat timestamptz not null default now()
);
create table if not exists jurnal_baris (
  id serial primary key,
  jurnal_id int not null references jurnal(id) on delete cascade,
  akun text not null,
  pekurban_id int references pekurban(id),
  debit bigint not null default 0,
  kredit bigint not null default 0
);
create table if not exists penyelesaian (
  pekurban_id int primary key references pekurban(id),
  tipe text not null,
  nominal bigint not null,
  tanggal date not null,
  catatan text not null default '',
  jurnal_id int references jurnal(id)
);
create table if not exists log_aktivitas (
  id serial primary key,
  waktu timestamptz not null default now(),
  aksi text not null,
  detail text not null default ''
);
create table if not exists batas_akses (
  kunci text primary key,
  jumlah int not null,
  mulai timestamptz not null
);
create index if not exists setoran_pk_idx on setoran(pekurban_id);
create index if not exists setoran_status_idx on setoran(status);
create index if not exists jb_jurnal_idx on jurnal_baris(jurnal_id);
create index if not exists jb_akun_pk_idx on jurnal_baris(akun, pekurban_id);
create index if not exists pekurban_hewan_idx on pekurban(hewan_id);
`;
