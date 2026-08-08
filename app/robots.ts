import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login'],
        // Everything past login requires auth — nothing there is
        // discoverable or useful to a crawler, so keep it out of the index.
        disallow: [
          '/dashboard', '/doctors', '/bookings', '/orders', '/prescriptions',
          '/profile', '/ai', '/call', '/chat', '/doctor/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
