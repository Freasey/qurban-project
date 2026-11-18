import { STATUS_HEWAN, STATUS_SETORAN } from '@/lib/format';

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === 'string' ? sp.ok : '';
  const err = typeof sp.err === 'string' ? sp.err : '';
  if (!ok && !err) return null;
  return (
    <div className={`flash ${err ? 'bad' : 'ok'}`} role={err ? 'alert' : 'status'}>
      {err || ok}
    </div>
  );
}

export function StatusSetoran({ s }: { s: string }) {
  const cls = s === 'terverifikasi' ? 'ok' : s === 'menunggu' ? 'wait' : 'bad';
  return <span className={`chip ${cls}`}>{STATUS_SETORAN[s] || s}</span>;
}

export function StatusHewan({ s }: { s: string }) {
  const cls = s === 'disembelih' ? 'ok' : s === 'dibeli' ? 'info' : 'neutral';
  return <span className={`chip ${cls}`}>{STATUS_HEWAN[s] || s}</span>;
}

export function Bar({ value, max, big }: { value: number; max: number; big?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`bar${big ? ' big' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="card">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}

export const noS = (id: number) => 'S-' + String(id).padStart(4, '0');
export const noJ = (id: number) => 'J-' + String(id).padStart(4, '0');
