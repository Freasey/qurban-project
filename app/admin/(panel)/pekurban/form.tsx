import { simpanPekurban } from '../../actions';
import { SubmitButton } from '@/components/client';
import type { HewanRow, PekurbanRow } from '@/lib/data';

export function PekurbanForm({ p, hewan, back }: { p?: PekurbanRow; hewan: HewanRow[]; back: string }) {
  const bolehPindah = !p || (p.status === 'aktif' && p.hewan_status !== 'disembelih');
  return (
    <form action={simpanPekurban} className="form">
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="back" value={back} />
      <label className="field">
        Nama lengkap
        <input name="nama" required defaultValue={p?.nama} maxLength={120} />
      </label>
      <label className="field">
        Nomor WhatsApp
        <input name="hp" inputMode="tel" defaultValue={p?.hp} placeholder="08xxxxxxxxxx" maxLength={20} />
      </label>
      <label className="field">
        Qurban atas nama <span className="hint">(untuk niat/pengumuman)</span>
        <input name="atas_nama" defaultValue={p?.atas_nama} placeholder="Misal: Ahmad bin Fulan" maxLength={160} />
      </label>
      <label className="field">
        Hewan
        {bolehPindah ? (
          <select name="hewan_id" defaultValue={p?.hewan_id ?? ''}>
            <option value="">Belum ditempatkan</option>
            {hewan
              .filter((h) => h.status !== 'disembelih' || h.id === p?.hewan_id)
              .map((h) => {
                const penuh = h.peserta >= h.kapasitas && h.id !== p?.hewan_id;
                return (
                  <option key={h.id} value={h.id} disabled={penuh}>
                    {h.nama} ({h.peserta}/{h.kapasitas}){penuh ? ' penuh' : ''}
                  </option>
                );
              })}
          </select>
        ) : (
          <>
            <input type="hidden" name="hewan_id" value={p?.hewan_id ?? ''} />
            <input value={p?.hewan_nama ?? '-'} disabled />
          </>
        )}
      </label>
      <label className="field wide">
        Alamat
        <input name="alamat" defaultValue={p?.alamat} maxLength={240} />
      </label>
      <label className="field wide">
        Catatan internal <span className="hint">(tidak terlihat pekurban)</span>
        <textarea name="catatan" defaultValue={p?.catatan} maxLength={1000} />
      </label>
      <SubmitButton>{p ? 'Simpan perubahan' : 'Tambah pekurban'}</SubmitButton>
    </form>
  );
}
