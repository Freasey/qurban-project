'use server';

import { redirect } from 'next/navigation';
import { clientIp } from '@/lib/auth';
import { one, tx } from '@/lib/db';
import { parseRupiah } from '@/lib/format';
import { run, str } from '@/lib/action';
import { hit, isLimited } from '@/lib/rate';
import { logAksi, normalizeKode, simpanBerkas, tambahSetoran, UserError } from '@/lib/qurban';

export async function cariKode(form: FormData) {
  const kode = normalizeKode(str(form, 'kode'));
  const ip = await clientIp();
  if (await isLimited('kode:' + ip, 10, 900)) redirect('/?err=' + encodeURIComponent('Terlalu banyak percobaan kode yang salah. Coba lagi dalam 15 menit.'));
  const p = await one('select kode from pekurban where kode = $1', [kode]);
  if (!p) {
    await hit('kode:' + ip, 900);
    redirect('/?err=' + encodeURIComponent('Kode pekurban tidak ditemukan. Periksa kembali kode dari panitia.'));
  }
  redirect('/p/' + p.kode);
}

export async function konfirmasiSetoran(form: FormData) {
  const kode = normalizeKode(str(form, 'kode'));
  const back = '/p/' + kode;
  await run(back, async () => {
    if (await isLimited('upload:' + kode, 10, 3600)) throw new UserError('Terlalu banyak konfirmasi dalam satu jam. Coba lagi nanti.');
    const p = await one<{ id: number; nama: string }>('select id, nama from pekurban where kode = $1', [kode]);
    if (!p) throw new UserError('Kode pekurban tidak ditemukan.');
    const nominal = parseRupiah(form.get('nominal'));
    if (nominal < 1000) throw new UserError('Isi nominal setoran.');
    await hit('upload:' + kode, 3600);
    await tx(async (c) => {
      const bukti = await simpanBerkas(c, form.get('bukti') as File | null, true);
      await tambahSetoran(c, {
        pekurban_id: p.id,
        tanggal: str(form, 'tanggal'),
        nominal,
        metode: 'transfer',
        catatan: str(form, 'catatan'),
        bukti_id: bukti,
        sumber: 'pekurban',
      });
      await logAksi(c, 'Konfirmasi setoran dari pekurban', `${p.nama} Rp${nominal.toLocaleString('id-ID')}`);
    });
    return 'Terima kasih, konfirmasi setoran terkirim. Panitia akan memverifikasi dengan mutasi rekening.';
  });
}
