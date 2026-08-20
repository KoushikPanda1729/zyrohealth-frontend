import type { Metadata } from 'next';
import { fetchPolicy, PolicyDocument, PolicyUnavailable } from '../policies/PolicyDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ZyroHealth collects, uses, and protects your information.',
};

// Stable URL for Play Console / App Store listings — content itself lives
// in the 'privacy-policy' policy row, edited from health-admin's
// Platform → Policies page (see backend/src/modules/policies).
export default async function PrivacyPolicyPage() {
  const policy = await fetchPolicy('privacy-policy');

  if (!policy) {
    return <PolicyUnavailable title="Privacy Policy" />;
  }

  return <PolicyDocument {...policy} />;
}
