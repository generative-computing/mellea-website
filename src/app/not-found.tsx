import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function NotFound() {
  return (
    <PageShell>
      <div className="not-found-page">
        <h1 className="not-found-page__title">404</h1>
        <p className="not-found-page__text">This page doesn&apos;t exist.</p>
        <Link href="/" className="btn btn-primary">
          <span>Back to home</span>
          <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
        </Link>
      </div>
    </PageShell>
  );
}
