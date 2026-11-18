import { isAdmin } from '@/lib/auth';
import { today } from '@/lib/format';
import { dataLaporan } from '@/lib/laporan';
import { STATUS_PEKURBAN } from '@/lib/format';

const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return new Response('Tidak diizinkan', { status: 403 });
  const { rows, tot } = await dataLaporan();
  const head = ['Kode', 'Nama', 'No HP', 'Hewan', 'Setoran terverifikasi', 'Menunggu', 'Biaya porsi', 'Dikembalikan', 'Infak', 'Dialihkan', 'Saldo titipan', 'Status'];
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push(
      [r.kode, r.nama, r.hp, r.hewan_nama ?? '', r.total_setor, r.menunggu, r.biaya, r.refund, r.infak, r.dialihkan, r.saldo, STATUS_PEKURBAN[r.status]]
        .map(cell)
        .join(';'),
    );
  }
  lines.push(['', 'TOTAL', '', '', tot.setor, '', tot.biaya, tot.refund, tot.infak, tot.dialihkan, tot.saldo, ''].map(cell).join(';'));
  // BOM + sep=; supaya Excel (locale Indonesia) membuka kolom dengan benar
  const body = '﻿' + lines.join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="laporan-qurban-${today()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
