'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';

const CMD = 'uv pip install mellea';

export default function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://pypi.org/pypi/mellea/json')
      .then((r) => r.json())
      .then((data) => setVersion(data.info?.version ?? null))
      .catch(() => null);
  }, []);

  function copy() {
    navigator.clipboard.writeText(CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="install-cmd-row">
      <div className="install-cmd">
        <code className="install-cmd-text">{CMD}</code>
        {version && <span className="install-cmd-version">v{version}</span>}
        <button className="install-cmd-copy" onClick={copy} aria-label="Copy install command">
          {copied ? (
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 12v2a1.5 1.5 0 0 1-1.5 1.5H2.5A1.5 1.5 0 0 1 1 14V5.5A1.5 1.5 0 0 1 2.5 4H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>
      <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">Get Started →</Link>
      <Link href="/blogs" className="btn-secondary">Read the blog</Link>
    </div>
  );
}
