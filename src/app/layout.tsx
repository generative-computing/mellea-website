import type { Metadata } from 'next';
import Script from 'next/script';
import { siteConfig } from '@/config/site';
import { assetUrl } from '@/lib/assetUrl';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'Mellea - Control LLMs with code',
    template: '%s | Mellea',
  },
  description: siteConfig.description,
  icons: {
    icon: [{ url: assetUrl('/assets/favicon.svg'), type: 'image/svg+xml' }],
    apple: assetUrl('/assets/favicon.svg'),
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: 'Mellea - Control LLMs with code',
    description: siteConfig.description,
    url: siteConfig.url,
    images: [{ url: siteConfig.ogImage }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mellea - Control LLMs with code',
    description: siteConfig.description,
    images: [siteConfig.ogImage],
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
    <html lang="en" data-asset-base={basePath} data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href={assetUrl('/assets/fonts.css')} />
        <link rel="stylesheet" href={assetUrl('/css/styles.css')} />
        <link rel="stylesheet" href={assetUrl('/css/code-theme.css')} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* IBM Analytics — self-hosted script, guards against localhost internally. See public/analytics.js */}
        <Script src={assetUrl('/analytics.js')} strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
