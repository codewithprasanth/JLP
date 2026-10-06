/**
 * ONE place for the restaurant's public and legal details — used by the header,
 * footer, legal pages and contact page. Edit here; nothing else needs to change.
 * Delivery radius and minimum order are NOT here: they come live from admin Settings.
 */
export const BUSINESS = {
  name: 'Jinisha Lovely Products',
  shortName: 'JLP',
  address: 'Victorian View Layout, Borewell Road, Nallurhalli, Whitefield, Bengaluru, Karnataka 560066',
  email: 'sendthistoprasanth@gmail.com', // TODO: a dedicated support address
  phone: null as string | null, // TODO: e.g. '+91 98765 43210'
  hours: null as string | null, // TODO: e.g. 'Every day, 11:00 AM – 10:00 PM'
  fssai: null as string | null, // TODO: 14-digit FSSAI licence number once issued
  grievanceOfficer: {
    name: null as string | null, // TODO: required under India's DPDP Act 2023
    email: 'sendthistoprasanth@gmail.com',
  },
  legal: {
    lastUpdated: '6 October 2026',
    /** Shows a "draft" notice on the legal pages. Set to false once a lawyer has reviewed them. */
    isDraft: true,
  },
} as const;
