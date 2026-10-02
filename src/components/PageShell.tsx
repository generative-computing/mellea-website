import type { ReactNode } from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

interface PageShellProps {
  children: ReactNode;
}

/** Shared header + main wrapper + footer for inner pages. */
export default function PageShell({ children }: PageShellProps) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="inner-page">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
