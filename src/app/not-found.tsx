import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center', padding: '8rem 2rem' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
        404
      </h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        This page doesn&apos;t exist.
      </p>
      <Link href="/" className="btn-primary">
        Back to home →
      </Link>
    </div>
  );
}
