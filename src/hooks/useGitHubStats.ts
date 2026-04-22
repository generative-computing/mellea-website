'use client';

import { useState, useEffect } from 'react';
import { siteConfig } from '@/config/site';

export interface ContributorAvatar {
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface GitHubStats {
  stars: number;
  forks: number;
  latestRelease: { tag: string; name: string; url: string } | null;
  contributors: number;
  contributorAvatars: ContributorAvatar[];
}

type State =
  | { status: 'loading' }
  | { status: 'success'; data: GitHubStats }
  | { status: 'error' };

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function useGitHubStats() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const repo = siteConfig.githubRepo;
    const base = `https://api.github.com/repos/${repo}`;

    Promise.all([
      fetch(base).then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
      fetch(`${base}/releases/latest`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}/contributors?per_page=1&anon=true`).then((r) => {
        // Contributors count lives in the Link header's last page number
        if (!r.ok) return 0;
        const link = r.headers.get('Link') ?? '';
        const match = link.match(/page=(\d+)>;\s*rel="last"/);
        return match ? parseInt(match[1], 10) : 1;
      }),
      fetch(`${base}/contributors?per_page=12`).then((r) =>
        r.ok ? r.json() : []
      ).catch(() => []),
    ])
      .then(([repo, release, contributors, avatarData]) => {
        const contributorAvatars: ContributorAvatar[] = Array.isArray(avatarData)
          ? avatarData
              .filter((c: { type?: string }) => c.type !== 'Anonymous')
              .map((c: { login: string; avatar_url: string; html_url: string }) => ({
                login: c.login,
                avatarUrl: c.avatar_url,
                profileUrl: c.html_url,
              }))
          : [];
        setState({
          status: 'success',
          data: {
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            latestRelease: release
              ? { tag: release.tag_name, name: release.name, url: release.html_url }
              : null,
            contributors,
            contributorAvatars,
          },
        });
      })
      .catch(() => setState({ status: 'error' }));
  }, []);

  return { state, fmt };
}
