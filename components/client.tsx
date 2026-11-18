'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  className = 'btn primary',
  confirm,
  pendingText = 'Memproses…',
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}

function fmt(v: string) {
  const d = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function RupiahInput({ name, defaultValue, required, placeholder = '0' }: { name: string; defaultValue?: number | null; required?: boolean; placeholder?: string }) {
  const [v, setV] = useState(defaultValue ? fmt(String(defaultValue)) : '');
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 600 }}>Rp</span>
      <input
        name={name}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(fmt(e.target.value))}
        style={{ paddingLeft: 40 }}
      />
    </div>
  );
}

/** Input berkas: gambar dikompres di browser (maks 1600px, JPEG) supaya unggahan kecil dan cepat. */
export function UploadInput({ name, required, label = 'Pilih foto' }: { name: string; required?: boolean; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    setPreview(null);
    setInfo('');
    if (!f) return;
    if (f.type === 'application/pdf') {
      setInfo(`${f.name} (${Math.round(f.size / 1024)} KB)`);
      if (f.size > 1_400_000) { setInfo('PDF terlalu besar, maksimal 1,4 MB.'); input.value = ''; }
      return;
    }
    if (!f.type.startsWith('image/')) { setInfo('Pilih foto (JPG/PNG) atau PDF.'); input.value = ''; return; }
    setBusy(true);
    try {
      const out = await compress(f);
      const dt = new DataTransfer();
      dt.items.add(out);
      input.files = dt.files;
      setPreview(URL.createObjectURL(out));
      setInfo(`${Math.round(out.size / 1024)} KB`);
    } catch {
      setPreview(URL.createObjectURL(f));
      setInfo(`${Math.round(f.size / 1024)} KB`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <input ref={ref} type="file" name={name} accept="image/*,application/pdf" required={required} onChange={onChange} aria-label={label} />
      {busy && <span className="muted">Mengompres foto…</span>}
      {preview && <img src={preview} alt="Pratinjau berkas" className="preview" />}
      {info && <span className="muted">{info}</span>}
    </div>
  );
}

async function compress(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.8));
  if (blob.size >= file.size && file.size <= 1_400_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export function PrintButton({ children = 'Cetak atau simpan PDF', className = 'btn dark' }: { children?: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={`${className} no-print`} onClick={() => window.print()}>
      {children}
    </button>
  );
}

export function CopyButton({ text, children = 'Salin', className = 'btn ghost sm' }: { text: string; children?: React.ReactNode; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? 'Tersalin' : children}
    </button>
  );
}

export function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const end = Date.parse(target + 'T00:00:00+07:00');
  const diff = Math.max(0, end - (now ?? end));
  const hari = Math.floor(diff / 86_400_000);
  const jam = Math.floor((diff % 86_400_000) / 3_600_000);
  return (
    <div className="countdown" aria-live="polite">
      <div><strong>{now == null ? '…' : hari}</strong><span>hari</span></div>
      <div><strong>{now == null ? '…' : jam}</strong><span>jam</span></div>
    </div>
  );
}
