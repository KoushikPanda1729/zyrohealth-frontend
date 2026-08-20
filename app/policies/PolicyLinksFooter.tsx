'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from 'antd';
import { env } from '../../lib/env';

const { Text } = Typography;

interface PolicyLink {
  slug: string;
  title: string;
}

function publicUrl(slug: string): string {
  return slug === 'privacy-policy' ? '/privacy' : `/policies/${slug}`;
}

// Shown at the bottom of auth screens — pulls whatever the platform owner
// has published on the Policies admin page (backend/src/modules/policies),
// so new policy types show up here automatically without a code change.
export function PolicyLinksFooter() {
  const [policies, setPolicies] = useState<PolicyLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${env.API_URL}/api/policies`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.data) return;
        setPolicies(body.data.map((p: PolicyLink) => ({ slug: p.slug, title: p.title })));
      })
      .catch(() => {
        // Non-fatal — the auth form itself doesn't depend on this.
      });
    return () => { cancelled = true; };
  }, []);

  if (policies.length === 0) return null;

  return (
    <div style={{ textAlign: 'center', marginTop: 28 }}>
      <Text type="secondary" style={{ fontSize: 12.5 }}>
        By continuing, you agree to our{' '}
        {policies.map((p, i) => (
          <React.Fragment key={p.slug}>
            <a href={publicUrl(p.slug)} target="_blank" rel="noopener noreferrer">{p.title}</a>
            {i < policies.length - 2 ? ', ' : i === policies.length - 2 ? ' and ' : ''}
          </React.Fragment>
        ))}
        .
      </Text>
    </div>
  );
}
