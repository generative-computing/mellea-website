'use client';

import Link from 'next/link';
import { useGitHubStats } from '@/hooks/useGitHubStats';
import { siteConfig } from '@/config/site';

function StatItem({
  label,
  value,
  href,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="gh-stat-item">
      <span className="gh-stat-value">{value}</span>
      <span className="gh-stat-label">{label}</span>
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="gh-stat-link">
        {inner}
      </a>
    );
  }
  return inner;
}

function Skeleton() {
  return <span className="gh-skeleton" />;
}

export default function GitHubStats() {
  const { state, fmt } = useGitHubStats();
  const repo = siteConfig.githubRepo;
  const repoUrl = `https://github.com/${repo}`;

  return (
    <div className="gh-stats">
      <div className="gh-stats-header">
        <div className="gh-stats-title">
          <svg className="gh-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="gh-repo-link">
            {repo}
          </a>
        </div>
        {state.status === 'success' && state.data.latestRelease && (
          <a
            href={state.data.latestRelease.url}
            target="_blank"
            rel="noopener noreferrer"
            className="gh-release-badge"
          >
            {state.data.latestRelease.tag}
          </a>
        )}
      </div>

      <div className="gh-stats-body">
      <div className="gh-stats-grid">
        <StatItem
          label="Stars"
          href={`${repoUrl}/stargazers`}
          value={
            state.status === 'loading' ? (
              <Skeleton />
            ) : state.status === 'error' ? (
              '—'
            ) : (
              <>
                <svg className="gh-stat-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                </svg>
                {fmt(state.data.stars)}
              </>
            )
          }
        />

        <StatItem
          label="Forks"
          href={`${repoUrl}/forks`}
          value={
            state.status === 'loading' ? (
              <Skeleton />
            ) : state.status === 'error' ? (
              '—'
            ) : (
              <>
                <svg className="gh-stat-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
                </svg>
                {fmt(state.data.forks)}
              </>
            )
          }
        />

        <StatItem
          label="Contributors"
          href={`${repoUrl}/graphs/contributors`}
          value={
            state.status === 'loading' ? (
              <Skeleton />
            ) : state.status === 'error' ? (
              '—'
            ) : (
              <>
                <svg className="gh-stat-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
                </svg>
                {fmt(state.data.contributors)}
              </>
            )
          }
        />
      </div>
      <div className="gh-stats-footer">
        {state.status === 'success' && state.data.contributorAvatars.length > 0 && (
          <div className="gh-avatars" data-testid="contributor-avatars">
            {state.data.contributorAvatars.map((c) => (
              <a
                key={c.login}
                href={c.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={c.login}
                className="gh-avatar-link"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.avatarUrl} alt={c.login} className="gh-avatar" width={28} height={28} />
              </a>
            ))}
          </div>
        )}
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gh-github-btn"
        >
          View on GitHub →
        </a>
      </div>
      </div>
    </div>
  );
}
