import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002';
const title = 'ZyroHealth — WhatsApp-Native Telemedicine & Pharmacy Platform';
const description =
  'Book doctor consultations, get e-prescriptions, and order medicines from verified pharmacies — all over WhatsApp or the ZyroHealth app. Fast OTP sign-in, real-time quotes, and home delivery.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | ZyroHealth',
  },
  description,
  applicationName: 'ZyroHealth',
  keywords: [
    'ZyroHealth',
    'telemedicine',
    'online doctor consultation',
    'WhatsApp doctor booking',
    'e-prescription',
    'online pharmacy',
    'medicine delivery',
    'book appointment online',
    'digital health platform India',
  ],
  category: 'health',
  authors: [{ name: 'ZyroHealth' }],
  creator: 'ZyroHealth',
  publisher: 'ZyroHealth',
  formatDetection: { telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'ZyroHealth',
    title,
    description,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ZyroHealth' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.webmanifest',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  name: 'ZyroHealth',
  description,
  url: siteUrl,
  logo: `${siteUrl}/logo-full.png`,
  image: `${siteUrl}/og-image.png`,
  sameAs: [],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
