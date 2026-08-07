const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not defined');

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined');

export const env = {
  API_URL: apiUrl,
  STRIPE_PUBLISHABLE_KEY: stripeKey,
} as const;
