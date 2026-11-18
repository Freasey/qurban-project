import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="pub">
      <section className="card pad-lg stack">
        <h1>Halaman tidak ditemukan</h1>
        <p>Periksa kembali alamatnya.</p>
        <Link className="btn primary" href="/" style={{ alignSelf: 'flex-start' }}>Ke halaman depan</Link>
      </section>
    </main>
  );
}
