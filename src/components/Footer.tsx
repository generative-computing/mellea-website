import Link from 'next/link';
import { siteConfig } from '@/config/site';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-brand">© {new Date().getFullYear()} Mellea · Documentation distributed under CC BY 4.0</span>
        <nav className="footer-links">
          <Link href="/blogs">Blog</Link>
          <Link href={siteConfig.docsUrl} target="_blank" rel="noopener noreferrer">Docs</Link>
          <Link href={siteConfig.discussionsUrl} target="_blank" rel="noopener noreferrer">Community</Link>
          <Link href={siteConfig.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</Link>
          {/* <Link href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</Link>
          <Link href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</Link> */}
        </nav>
      </div>
    </footer>
  );
}
