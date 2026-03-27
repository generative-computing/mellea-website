import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { siteConfig } from '@/config/site';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'Mellea — Reliable, Testable LLM Output for Python',
    template: '%s | Mellea',
  },
  description: siteConfig.description,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/images/mellea-logo.svg',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: 'Mellea — Reliable, Testable LLM Output for Python',
    description: siteConfig.description,
    url: siteConfig.url,
    images: [{ url: '/images/og-hero.png', width: 2064, height: 1104 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mellea — Reliable, Testable LLM Output for Python',
    description: siteConfig.description,
    images: ['/images/og-hero.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mellea',
  description: siteConfig.description,
  url: siteConfig.url,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  programmingLanguage: 'Python',
  codeRepository: siteConfig.githubUrl,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plex.variable} ${plexMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
