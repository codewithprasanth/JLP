/** Footer + "See also" links. Kept separate so the shell doesn't pull the legal pages into the main bundle. */
export const LEGAL_LINKS: { key: 'privacy' | 'terms' | 'refunds' | 'delivery' | 'contact'; path: string; label: string }[] = [
  { key: 'privacy', path: '/privacy', label: 'Privacy Policy' },
  { key: 'terms', path: '/terms', label: 'Terms of Service' },
  { key: 'refunds', path: '/refund-policy', label: 'Cancellation & Refunds' },
  { key: 'delivery', path: '/delivery-policy', label: 'Delivery Policy' },
  { key: 'contact', path: '/contact', label: 'Contact Us' },
];
