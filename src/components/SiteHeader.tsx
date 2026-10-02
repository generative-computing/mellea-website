'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { assetUrl } from '@/lib/assetUrl';
import GitHubStarsInit from './GitHubStarsInit';

const emptySubscribe = () => () => {};
const SCROLL_THRESHOLD = 12;

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  // Lock body scroll while the mobile menu is open so the page can't slide
  // behind the (transparent) header. Paired with body.mobile-menu-open in CSS.
  useEffect(() => {
    document.body.classList.toggle('mobile-menu-open', menuOpen);
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [menuOpen]);

  // Close the menu if the viewport grows past the mobile breakpoint (e.g. device
  // rotation): the hamburger is gone above 767px, so a lingering-open overlay
  // would double up the nav/CTA against the restored desktop header.
  useEffect(() => {
    const mobileNavBreakpoint = window.matchMedia('(min-width: 768px)');
    const closeAboveBreakpoint = () => {
      if (mobileNavBreakpoint.matches) setMenuOpen(false);
    };
    mobileNavBreakpoint.addEventListener('change', closeAboveBreakpoint);
    return () =>
      mobileNavBreakpoint.removeEventListener('change', closeAboveBreakpoint);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link
        href={siteConfig.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="site-nav__link"
        onClick={closeMenu}
      >
        Docs
      </Link>
      <Link
        href="/blogs"
        className={`site-nav__link${pathname.startsWith('/blogs') ? ' site-nav__link--active' : ''}`}
        onClick={closeMenu}
      >
        Blog
      </Link>
      <Link
        href={siteConfig.discussionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="site-nav__link"
        onClick={closeMenu}
      >
        Community
      </Link>
    </>
  );

  return (
    <div className="site-header-shell">
      <GitHubStarsInit />
      <header
        className={`site-header${isScrolled ? ' is-scrolled' : ''}`}
        id="site-header"
      >
        <Link className="brand" href="/" aria-label="Mellea home" onClick={closeMenu}>
          <img
            className="brand__icon"
            src={assetUrl('/assets/mel-icon.svg')}
            alt=""
            width={20}
            height={17}
          />
          <img
            className="brand__wordmark"
            src={assetUrl('/assets/mellea-wordmark.svg')}
            alt="Mellea"
            width={90}
            height={24}
          />
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navLinks}
        </nav>

        <div className="site-header__actions">
          <a
            className="github-btn"
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mellea on GitHub"
          >
            <img
              className="github-btn__icon"
              src={assetUrl('/assets/icon-github.svg')}
              alt=""
              width={24}
              height={24}
            />
            <span className="github-btn__stars" data-github-stars aria-hidden="true">
              &hellip;
            </span>
          </a>
          <Link className="btn btn-nav-get-started" href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer">
            <span>Get started</span>
            <img src={assetUrl('/assets/icon-arrow-up-right.svg')} alt="" width={20} height={20} />
          </Link>

          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {mounted && createPortal(
        <nav
          className={`mobile-nav-overlay${menuOpen ? ' mobile-nav-overlay--open' : ''}`}
          aria-label="Mobile navigation"
          aria-hidden={!menuOpen}
        >
          {navLinks}
          <Link
            href={siteConfig.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="site-nav__link mobile-nav__cta"
            onClick={closeMenu}
          >
            <span>Get started</span>
            <span className="btn__icon-mask btn__icon-mask--arrow-up-right" aria-hidden="true" />
          </Link>
        </nav>,
        document.body,
      )}
    </div>
  );
}
