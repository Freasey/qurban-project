'use server';

import { redirect } from 'next/navigation';
import { checkCredentials, clientIp, endSession, requireAdmin, startSession } from '@/lib/auth';
import { tx } from '@/lib/db';
import { int, run, safeBack, str } from '@/lib/action';
import { parseRupiah, today } from '@/lib/format';
import { clearHits, hit, isLimited } from '@/lib/rate';
import { isiDataDummy, kosongkan } from '@/lib/seed';
import { DEFAULT_PENGATURAN, setPengaturan, type Pengaturan } from '@/lib/settings';
import * as Q from '@/lib/qurban';

// ---------------------------------------------------------------- sesi

export async function login(form: FormData) {
  const ip = await clientIp();
  const key = 'login:' + ip;
  if (await isLimited(key, 8, 900)) redirect('/admin/login?err=' + encodeURIComponent('Terlalu banyak percobaan. Coba lagi dalam 15 menit.'));
  if (!checkCredentials(str(form, 'email'), String(form.get('password') ?? ''))) {
    await hit(key, 900);
    redirect('/admin/login?err=' + encodeURIComponent('Email atau password salah.'));
  }
  await clearHits(key);
  await startSession();
  await tx((c) => Q.logAksi(c, 'Login admin', ip));
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login?ok=' + encodeURIComponent('Kamu sudah keluar.'));
}

// ---------------------------------------------------------------- pekurban

function pekurbanInput(f: FormData): Q.PekurbanInput {
  const h = int(f, 'hewan_id');
  return {
    nama: str(f, 'nama'),
    hp: str(f, 'hp'),
    alamat: str(f, 'alamat'),
    atas_nama: str(f, 'atas_nama'),
    hewan_id: h > 0 ? h : null,
    catatan: str(f, 'catatan'),
  };
}

export async function simpanPekurban(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(safeBack(f.get('back'), '/admin/pekurban'), async () => {
    if (id) {
      await tx((c) => Q.ubahPekurban(c, id, pekurbanInput(f)));
      return 'Data pekurban diperbarui.';
    }
    const r = await tx((c) => Q.tambahPekurban(c, pekurbanInput(f)));
    return { to: `/admin/pekurban/${r.id}`, ok: `Pekurban ditambahkan dengan kode ${r.kode}.` };
  });
}

export async function gantiKode(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/pekurban/${id}`, async () => `Kode baru: ${await tx((c) => Q.gantiKode(c, id))}. Kode lama tidak berlaku lagi.`);
}

export async function hapusPekurban(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/pekurban/${id}`, async () => {
    await tx((c) => Q.hapusPekurban(c, id));
    return { to: '/admin/pekurban', ok: 'Pekurban dihapus.' };
  });
}

export async function batalkanPekurban(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/pekurban/${id}`, async () => {
    await tx((c) => Q.batalkanPekurban(c, id, today(), str(f, 'alasan')));
    return 'Pekurban dibatalkan. Saldo titipan dicatat sebagai pengembalian dana; pastikan dana benar-benar ditransfer balik.';
  });
}

// ---------------------------------------------------------------- setoran

export async function catatSetoran(f: FormData) {
  await requireAdmin();
  await run(safeBack(f.get('back'), '/admin/setoran'), async () => {
    const pekurban_id = int(f, 'pekurban_id');
    if (!pekurban_id) throw new Q.UserError('Pilih pekurban.');
    const langsung = f.get('langsung') === '1';
    await tx(async (c) => {
      const bukti = await Q.simpanBerkas(c, f.get('bukti') as File | null, false);
      const id = await Q.tambahSetoran(c, {
        pekurban_id,
        tanggal: str(f, 'tanggal') || today(),
        nominal: parseRupiah(f.get('nominal')),
        metode: str(f, 'metode') === 'tunai' ? 'tunai' : 'transfer',
        catatan: str(f, 'catatan'),
        bukti_id: bukti,
        sumber: 'admin',
      });
      await Q.logAksi(c, 'Catat setoran oleh admin', `S-${String(id).padStart(4, '0')}`);
      if (langsung) await Q.verifikasiSetoran(c, id);
    });
    return langsung ? 'Setoran dicatat dan langsung terverifikasi. Jurnal terbentuk.' : 'Setoran dicatat dan masuk antrian verifikasi.';
  });
}

export async function verifikasi(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(safeBack(f.get('back'), '/admin/setoran'), async () => {
    await tx((c) => Q.verifikasiSetoran(c, id));
    return `Setoran S-${String(id).padStart(4, '0')} diterima. Jurnal terbentuk otomatis.`;
  });
}

export async function tolak(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(safeBack(f.get('back'), '/admin/setoran'), async () => {
    await tx((c) => Q.tolakSetoran(c, id, str(f, 'alasan')));
    return `Setoran S-${String(id).padStart(4, '0')} ditolak. Pekurban bisa melihat alasannya.`;
  });
}

export async function batalVerifikasi(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(safeBack(f.get('back'), '/admin/setoran'), async () => {
    await tx((c) => Q.batalkanVerifikasi(c, id, str(f, 'alasan')));
    return 'Verifikasi dibatalkan dengan jurnal pembalik.';
  });
}

// ---------------------------------------------------------------- hewan

function hewanInput(f: FormData): Q.HewanInput {
  const jenis = str(f, 'jenis');
  return {
    nama: str(f, 'nama'),
    jenis,
    kapasitas: jenis === 'sapi' ? int(f, 'kapasitas') || 7 : 1,
    harga_estimasi: parseRupiah(f.get('harga_estimasi')),
    catatan: str(f, 'catatan'),
  };
}

export async function simpanHewan(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(safeBack(f.get('back'), '/admin/hewan'), async () => {
    if (id) {
      await tx((c) => Q.ubahHewan(c, id, hewanInput(f)));
      return 'Data hewan diperbarui.';
    }
    const nid = await tx((c) => Q.tambahHewan(c, hewanInput(f)));
    return { to: `/admin/hewan/${nid}`, ok: 'Hewan ditambahkan.' };
  });
}

export async function hapusHewan(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/hewan/${id}`, async () => {
    await tx((c) => Q.hapusHewan(c, id));
    return { to: '/admin/hewan', ok: 'Hewan dihapus.' };
  });
}

export async function beliHewan(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/hewan/${id}`, async () => {
    await tx(async (c) => {
      const nota = await Q.simpanBerkas(c, f.get('nota') as File | null, false);
      await Q.beliHewan(c, id, { harga: parseRupiah(f.get('harga')), tanggal: str(f, 'tanggal'), nota_id: nota });
    });
    return 'Pembelian dicatat. Jurnal Persediaan hewan / Kas terbentuk.';
  });
}

export async function batalBeli(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/hewan/${id}`, async () => {
    await tx((c) => Q.batalBeli(c, id, str(f, 'alasan')));
    return 'Pembelian dibatalkan dengan jurnal pembalik.';
  });
}

export async function sembelih(f: FormData) {
  await requireAdmin();
  const id = int(f, 'id');
  await run(`/admin/hewan/${id}`, async () => {
    await tx((c) => Q.sembelihHewan(c, id, str(f, 'tanggal')));
    return 'Penyembelihan dicatat. Biaya porsi dibebankan ke titipan tiap pekurban.';
  });
}

export async function selesaikan(f: FormData) {
  await requireAdmin();
  const back = safeBack(f.get('back'), '/admin/hewan');
  await run(back, async () => {
    const tipe = str(f, 'tipe');
    const tanggal = str(f, 'tanggal') || today();
    const semua = f.getAll('pekurban_id').map((v) => parseInt(String(v), 10)).filter((n) => n > 0);
    if (!semua.length) throw new Q.UserError('Tidak ada pekurban yang dipilih.');
    // Paket gratis D1 membatasi sekitar 50 query per request, jadi diproses maksimal 4 orang per klik.
    const MAKS = 4;
    const ids = semua.slice(0, MAKS);
    await tx(async (c) => {
      const hasil: string[] = [];
      for (const id of ids) hasil.push(await Q.selesaikanPekurban(c, id, tipe, tanggal, str(f, 'catatan'), false));
      await Q.logAksi(c, 'Penyelesaian pekurban', hasil.join('; '));
    });
    const sisa = semua.length - ids.length;
    return sisa > 0
      ? `${ids.length} pekurban diselesaikan. Klik "Selesaikan yang dipilih" lagi untuk ${sisa} pekurban berikutnya.`
      : `${ids.length} pekurban diselesaikan.`;
  });
}

// ---------------------------------------------------------------- pengaturan & data

export async function simpanPengaturan(f: FormData) {
  await requireAdmin();
  await run('/admin/pengaturan', async () => {
    const p: Partial<Pengaturan> = {};
    for (const k of Object.keys(DEFAULT_PENGATURAN) as (keyof Pengaturan)[]) {
      if (k === 'saldoBank') continue;
      if (f.has(k)) (p as any)[k] = str(f, k);
    }
    if (f.has('saldoBank')) {
      const raw = str(f, 'saldoBank');
      p.saldoBank = raw === '' ? null : parseRupiah(raw);
    }
    await setPengaturan(p);
    await tx((c) => Q.logAksi(c, 'Ubah pengaturan', Object.keys(p).join(', ')));
    return 'Pengaturan disimpan.';
  });
}

export async function simpanSaldoBank(f: FormData) {
  await requireAdmin();
  await run('/admin', async () => {
    const raw = str(f, 'saldoBank');
    await setPengaturan({ saldoBank: raw === '' ? null : parseRupiah(raw), tanggalSaldoBank: str(f, 'tanggalSaldoBank') || today() });
    await tx((c) => Q.logAksi(c, 'Perbarui saldo bank', raw));
    return 'Saldo rekening menurut mutasi bank diperbarui.';
  });
}

export async function isiDummy() {
  await requireAdmin();
  await run('/admin/pengaturan', async () => {
    await isiDataDummy();
    return { to: '/admin', ok: 'Data dummy berhasil diisi: 15 pekurban, 4 hewan, dan riwayat setoran.' };
  });
}

export async function kosongkanData() {
  await requireAdmin();
  await run('/admin/pengaturan', async () => {
    await tx(async (c) => {
      await kosongkan(c);
      await Q.logAksi(c, 'Kosongkan semua data');
    });
    return 'Semua data transaksi, pekurban, dan hewan dihapus. Pengaturan tetap disimpan.';
  });
}
