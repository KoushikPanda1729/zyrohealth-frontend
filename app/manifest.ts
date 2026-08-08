import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZyroHealth — Telemedicine & Pharmacy Platform',
    short_name: 'ZyroHealth',
    description: 'Book doctors, get e-prescriptions, and order medicines — over WhatsApp or the app.',
    start_url: '/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
