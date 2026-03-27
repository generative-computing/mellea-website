'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/config/site';

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

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

        <nav className={`header-nav${menuOpen ? ' header-nav--open' : ''}`}>
          <Link
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
            onClick={closeMenu}
          >
            Docs
          </Link>
          <Link
            href="/blogs"
            className={`nav-link ${pathname.startsWith('/blogs') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Blog
          </Link>
          <Link
            href={siteConfig.discussionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
            onClick={closeMenu}
          >
            Community
          </Link>
          <Link
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link"
            onClick={closeMenu}
          >
            GitHub
          </Link>
          <Link
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-cta"
            onClick={closeMenu}
          >
            Get Started →
          </Link>
        </nav>
      </div>
    </header>
  );
}
