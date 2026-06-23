'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { siteConfig } from '@/config/site';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const emptySubscribe = () => () => {};
const SCROLL_THRESHOLD = 12;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [stars, setStars] = useState<string | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/generative-computing/mellea')
      .then((r) => r.json())
      .then((data) => {
        const count = data.stargazers_count;
        if (typeof count === 'number') {
          setStars(count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count));
        }
      })
      .catch(() => {});
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="site-nav__link" onClick={closeMenu}>
        Docs
      </Link>
      <Link href="/blogs" className="site-nav__link" onClick={closeMenu}>
        Blog
      </Link>
      <Link href={siteConfig.discussionsUrl} target="_blank" rel="noopener noreferrer" className="site-nav__link" onClick={closeMenu}>
        Community
      </Link>
    </>
  );

  return (
    <div className="site-header-shell">
      <header className={`site-header${isScrolled ? ' is-scrolled' : ''}`} id="site-header">
        <Link href="/" className="brand" onClick={closeMenu} aria-label="Mellea home">
          <Image
            className="brand__icon"
            src={`${basePath}/images/mel-icon.svg`}
            alt=""
            width={20}
            height={17}
            unoptimized
          />
          <Image
            className="brand__wordmark"
            src={`${basePath}/images/mellea-wordmark.svg`}
            alt="Mellea"
            width={90}
            height={24}
            unoptimized
          />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navLinks}
        </nav>

        <div className="site-header__actions">
          <Link
            className="github-btn"
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mellea on GitHub"
          >
            <Image
              className="github-btn__icon"
              src={`${basePath}/images/icon-github.svg`}
              alt=""
              width={24}
              height={24}
              unoptimized
            />
            <span className="github-btn__stars">{stars ?? '…'}</span>
          </Link>
          <Link
            className="btn-nav-get-started"
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get started
            <Image
              src={`${basePath}/images/icon-arrow-up-right.svg`}
              alt=""
              width={20}
              height={20}
              unoptimized
            />
          </Link>
        </div>

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
      </header>

      {mounted && createPortal(
        <nav
          className={`mobile-nav-overlay${menuOpen ? ' mobile-nav-overlay--open' : ''}`}
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
        >
          {navLinks}
          <Link
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="site-nav__link"
            onClick={closeMenu}
          >
            GitHub
          </Link>
          <Link
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="site-nav__link"
            onClick={closeMenu}
          >
            Get Started
          </Link>
        </nav>,
        document.body
      )}
    </div>
  );
}
