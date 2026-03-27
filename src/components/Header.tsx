'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/config/site';

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => { setMounted(true); }, []);

  const navLinks = (
    <>
      <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="nav-link" onClick={closeMenu}>
        Docs
      </Link>
      <Link href="/blogs" className={`nav-link ${pathname.startsWith('/blogs') ? 'active' : ''}`} onClick={closeMenu}>
        Blog
      </Link>
      <Link href={siteConfig.discussionsUrl} target="_blank" rel="noopener noreferrer" className="nav-link" onClick={closeMenu}>
        Community
      </Link>
      <Link href={siteConfig.githubUrl} target="_blank" rel="noopener noreferrer" className="nav-link" onClick={closeMenu}>
        GitHub
      </Link>
      <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="nav-cta" onClick={closeMenu}>
        Get Started →
      </Link>
    </>
  );

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-logo" onClick={closeMenu}>
          <span className="logo-bracket">[</span>
          Mellea
          <span className="logo-bracket">]</span>
        </Link>

        <button
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Desktop nav — inline in header */}
        <nav className="header-nav">
          {navLinks}
        </nav>
      </div>

      {/* Mobile nav overlay — portaled to <body> so position:fixed is viewport-relative,
          not relative to the sticky header ancestor (iOS Safari limitation). */}
      {mounted && createPortal(
        <nav
          className={`mobile-nav-overlay${menuOpen ? ' mobile-nav-overlay--open' : ''}`}
          aria-hidden={!menuOpen}
        >
          {navLinks}
        </nav>,
        document.body
      )}
    </header>
  );
}
