import { RupiahInput } from '@/components/client';
import { JENIS_HEWAN } from '@/lib/format';

export function HewanFields({ h }: { h?: { nama: string; jenis: string; kapasitas: number; harga_estimasi: number; catatan: string; status: string } }) {
  const kunci = h?.status === 'disembelih';
  return (
    <>
      <label className="field">
        Nama
        <input name="nama" required defaultValue={h?.nama} placeholder="Sapi A" maxLength={60} />
      </label>
      <label className="field" style={{ flexBasis: 140 }}>
        Jenis
        {kunci ? (
          <>
            <input type="hidden" name="jenis" value={h!.jenis} />
            <input value={JENIS_HEWAN[h!.jenis]} disabled />
          </>
        ) : (
          <select name="jenis" defaultValue={h?.jenis ?? 'sapi'}>
            <option value="sapi">Sapi</option>
            <option value="kambing">Kambing</option>
            <option value="domba">Domba</option>
          </select>
        )}
      </label>
      <label className="field" style={{ flexBasis: 140 }}>
        Slot <span className="hint">(sapi 1–7)</span>
        <input type="number" name="kapasitas" min={1} max={7} defaultValue={h?.kapasitas ?? 7} readOnly={kunci} />
      </label>
      <label className="field">
        Harga estimasi
        <RupiahInput name="harga_estimasi" required defaultValue={h?.harga_estimasi} />
      </label>
      <label className="field wide">
        Catatan <span className="hint">(jenis/berat, peternak, dsb.)</span>
        <input name="catatan" defaultValue={h?.catatan} maxLength={300} />
      </label>
    </>
  );
}
