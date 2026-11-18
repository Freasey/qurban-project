import 'server-only';
import { q } from './db';
import { listHewan, listPekurban, saldoAkun } from './data';
import { AKUN } from './qurban';

export async function dataLaporan() {
  const [pekurban, hewan, akun, refundBatal] = await Promise.all([
    listPekurban(),
    listHewan(),
    saldoAkun(),
    q<{ pekurban_id: number; s: number }>(
      `select b.pekurban_id, sum(b.debit)::bigint as s from jurnal_baris b join jurnal j on j.id = b.jurnal_id
       join pekurban p on p.id = b.pekurban_id
       where j.jenis = 'refund' and p.status = 'batal' and b.akun = '${AKUN.TITIPAN}' group by b.pekurban_id`,
    ),
  ]);
  const refundMap = new Map(refundBatal.map((r) => [r.pekurban_id, Number(r.s)]));
  const rows = pekurban.map((p) => {
    const refund = p.status === 'batal' ? refundMap.get(p.id) || 0 : p.peny_tipe === 'refund' ? Number(p.peny_nominal) : 0;
    const infak = p.peny_tipe === 'infak' ? Number(p.peny_nominal) : 0;
    const dialihkan = p.peny_tipe === 'dialihkan' ? Number(p.peny_nominal) : 0;
    return { ...p, refund, infak, dialihkan };
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const tot = {
    setor: sum((r) => Number(r.total_setor)),
    biaya: sum((r) => Number(r.biaya)),
    refund: sum((r) => r.refund),
    infak: sum((r) => r.infak),
    dialihkan: sum((r) => r.dialihkan),
    saldo: sum((r) => Number(r.saldo)),
  };
  const pembelian = hewan.reduce((a, h) => a + (h.status !== 'direncanakan' ? Number(h.harga_realisasi || 0) : 0), 0);
  return {
    rows,
    hewan,
    tot,
    pembelian,
    akun: {
      kas: akun[AKUN.KAS] || 0,
      persediaan: akun[AKUN.PERSEDIAAN] || 0,
      titipan: akun[AKUN.TITIPAN] || 0,
      infak: akun[AKUN.INFAK] || 0,
    },
  };
}
