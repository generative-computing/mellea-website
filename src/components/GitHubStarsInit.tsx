'use client';

import { useEffect, useLayoutEffect } from 'react';
import { siteConfig } from '@/config/site';

// Layout effect (pre-paint) fills the cached count before the header shows, so no
// "…" flicker on nav; falls back to useEffect during prerender to avoid its warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const CACHE_KEY = 'mellea-github-stars';
/** How long a cached star count stays fresh before we refetch (12 hours). */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface StarsCache {
  count: number;
  timestamp: number;
}

function formatStarCount(count: number): string {
  if (count >= 1000) {
    const value = count / 1000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return String(count);
}

/** Reads a still-fresh cached count, or null if missing, stale, or unreadable. */
function readFreshCache(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as StarsCache;
    if (typeof cached.count !== 'number' || typeof cached.timestamp !== 'number') {
      return null;
    }
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return cached.count;
  } catch {
    return null;
  }
}

function writeCache(count: number): void {
  try {
    const payload: StarsCache = { count, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Fills the header's GitHub star count; rendered in SiteHeader so it remounts (and refills) on each nav. */
export default function GitHubStarsInit() {
  useIsomorphicLayoutEffect(() => {
    const starsEl = document.querySelector('[data-github-stars]');
    const button = document.querySelector('.github-btn');
    if (!starsEl || !button) return;

    const render = (count: number) => {
      starsEl.textContent = formatStarCount(count);
      starsEl.removeAttribute('aria-hidden');
      button.setAttribute('aria-label', `Mellea on GitHub, ${count} stars`);
    };

    // Fresh cache → render and skip the fetch (one request per visitor per TTL).
    const cached = readFreshCache();
    if (cached !== null) {
      render(cached);
      return;
    }

    fetch(`https://api.github.com/repos/${siteConfig.githubRepo}`)
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub API ${response.status}`);
        return response.json();
      })
      .then((data: { stargazers_count: number }) => {
        writeCache(data.stargazers_count);
        render(data.stargazers_count);
      })
      .catch(() => {
        starsEl.textContent = '';
        starsEl.setAttribute('aria-hidden', 'true');
        button.setAttribute('aria-label', 'Mellea on GitHub');
      });
  }, []);

  return null;
}
