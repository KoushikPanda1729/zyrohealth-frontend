import type { Metadata } from 'next';
import { fetchPolicy, PolicyDocument, PolicyUnavailable } from '../PolicyDocument';

interface Props {
  params: Promise<{ slug: string }>;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = await fetchPolicy(slug);
  const title = policy?.title ?? titleCase(slug);
  return { title, description: `${title} — ZyroHealth` };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const policy = await fetchPolicy(slug);

  if (!policy) {
    return <PolicyUnavailable title={titleCase(slug)} />;
  }

  return <PolicyDocument {...policy} />;
}
