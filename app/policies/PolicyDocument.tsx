import { env } from '../../lib/env';

export interface PolicyData {
  title: string;
  content: string;
  updatedAt: string;
}

// Public — matches the platform-owner-managed rows served by
// backend/src/modules/policies (health-admin's Platform → Policies page
// is where these get written).
export async function fetchPolicy(slug: string): Promise<PolicyData | null> {
  try {
    const res = await fetch(`${env.API_URL}/api/policies/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const data = body?.data ?? body;
    if (!data?.title || typeof data.content !== 'string') return null;
    return { title: data.title, content: data.content, updatedAt: data.updatedAt };
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function PolicyDocument({ title, content, updatedAt }: PolicyData) {
  return (
    <main style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px' }}>
        <div style={{ marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 26, width: 'auto' }} />
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginTop: 24, marginBottom: 4 }}>
          {title}
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 40 }}>
          Last updated: {formatDate(updatedAt)}
        </p>

        <div style={{ color: '#334155', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
      </div>
    </main>
  );
}

export function PolicyUnavailable({ title }: { title: string }) {
  return (
    <main style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px' }}>
        <div style={{ marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="ZyroHealth" style={{ height: 26, width: 'auto' }} />
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', marginTop: 24, marginBottom: 12 }}>
          {title}
        </h1>
        <p style={{ color: '#64748b', fontSize: 15 }}>
          This document hasn&rsquo;t been published yet. Please check back soon.
        </p>
      </div>
    </main>
  );
}
