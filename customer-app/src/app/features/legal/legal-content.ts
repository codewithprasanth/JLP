import { BUSINESS } from '../../core/business';

/**
 * Placeholder legal text describing how THIS app actually works (email OTP, COD,
 * 60-second cancellation, own delivery staff, India DPDP Act 2023). Have it reviewed
 * before launch. {radius} and {minOrder} are filled in live from admin Settings.
 */
export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalDocKey = 'privacy' | 'terms' | 'refunds' | 'delivery';

const B = BUSINESS;
const contactLine = `email us at ${B.email}${B.phone ? ` or call ${B.phone}` : ''}`;

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    intro: `This policy explains what personal data ${B.name} ("we", "us") collects when you use our ordering website, why we collect it, and the choices you have. We process personal data in line with India's Digital Personal Data Protection Act, 2023.`,
    sections: [
      {
        heading: 'Data we collect',
        bullets: [
          'Email address — to create your account and log you in with a one-time code.',
          'Name and mobile number — so we know who an order is for and can call you about delivery. We do not send SMS to this number.',
          'Delivery addresses, including the map location you choose — to check that you are within our delivery area and to deliver your order.',
          'Order history — what you ordered, when, the amount, and its status.',
          'Technical data — your IP address and basic request logs, used only for security (for example, to stop abuse of the login page).',
        ],
      },
      {
        heading: 'How we use it',
        bullets: [
          'To log you in, take and deliver your orders, and contact you about them.',
          'To send transactional emails: login codes, order confirmations and order status updates. We do not send marketing emails.',
          'To keep the service secure and prevent fraud or abuse.',
          'To keep business records we are required to keep by law.',
        ],
      },
      {
        heading: 'Consent',
        paragraphs: [
          'By creating an account you consent to this processing. You may withdraw consent at any time by asking us to delete your account (see "Your rights"); we will then stop processing your data except where the law requires us to keep it.',
        ],
      },
      {
        heading: 'Who we share it with',
        paragraphs: ['We never sell your data. We share it only as needed to run the service:'],
        bullets: [
          'Our delivery staff — your name, phone number and delivery address for your order.',
          'Service providers that process data on our behalf: Render (hosting and database, servers in Singapore) and Brevo (sending our emails).',
          'Map tiles are loaded from OpenStreetMap servers, which can see your IP address when the map is shown.',
          'Government or law-enforcement authorities when the law requires it.',
        ],
      },
      {
        heading: 'How long we keep it',
        bullets: [
          'Login codes: 5 minutes. Login sessions: up to 30 days.',
          'Account details and addresses: while your account is active.',
          'Order records: for as long as Indian tax and accounting laws require, even after an account is deleted.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can ask us to access, correct or erase your personal data, nominate someone to exercise these rights on your behalf, and raise a grievance. You can update your name and phone number on your Profile page. For anything else, ${contactLine}. We aim to respond within 30 days.`,
        ],
      },
      {
        heading: 'Cookies and browser storage',
        paragraphs: [
          'We do not use advertising or tracking cookies. Your browser stores your login session and your cart locally so you stay signed in and don’t lose your items.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'All connections are encrypted (HTTPS), login codes are stored only in hashed form, and access to customer data is restricted to the restaurant’s administrator.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: ['This service is meant for people aged 18 and over. Under-18s should use it only with a parent or guardian’s consent.'],
      },
      {
        heading: 'Grievance Officer',
        paragraphs: [
          `${B.grievanceOfficer.name ?? '[Name to be added]'} — ${B.grievanceOfficer.email}. If you are not satisfied with our response, you may complain to the Data Protection Board of India.`,
        ],
      },
      {
        heading: 'Changes',
        paragraphs: ['We may update this policy. The date at the top shows the latest version; significant changes will be shown on the website.'],
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    intro: `These terms apply when you use the ${B.name} ordering website. By creating an account or placing an order you agree to them.`,
    sections: [
      {
        heading: 'Your account',
        bullets: [
          'You log in with your email address and a one-time code. Keep access to your email secure — anyone with it can log in to your account.',
          'Give us accurate details, especially your phone number and delivery address.',
          'You must be 18 or older, or use the service with a parent or guardian’s consent.',
        ],
      },
      {
        heading: 'Orders',
        bullets: [
          'Orders can be placed only while we are accepting orders, for addresses within our delivery area (currently {radius} km from the restaurant), and above the minimum order value (currently ₹{minOrder}).',
          'Menu items depend on availability. We may decline or cancel an order — for example if an item runs out or we cannot deliver — and will tell you why.',
          'Prices shown at checkout are the amount you pay. Delivery is free.',
          'Delivery times are estimates, not guarantees.',
        ],
      },
      {
        heading: 'Payment',
        paragraphs: ['We currently accept Cash on Delivery only. Please pay the order total to our delivery staff when you receive your order.'],
      },
      {
        heading: 'Cancellations and refunds',
        paragraphs: ['See our Cancellation & Refund Policy.'],
      },
      {
        heading: 'Food and allergies',
        paragraphs: [
          'Our food is prepared in a kitchen that handles common allergens. If you have an allergy or dietary requirement, contact us before ordering. We cannot guarantee any dish is free from a particular allergen.',
        ],
      },
      {
        heading: 'Fair use',
        paragraphs: [
          'Do not place false orders, refuse to pay for delivered orders, misuse the login system, or abuse our staff. We may suspend accounts that do.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          'We take care to provide the service reliably, but it is provided "as is". To the extent the law allows, our liability for any order is limited to the amount paid for that order.',
        ],
      },
      {
        heading: 'Governing law',
        paragraphs: ['These terms are governed by the laws of India. Courts in Bengaluru, Karnataka have jurisdiction.'],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms? ${contactLine[0].toUpperCase()}${contactLine.slice(1)}.`],
      },
    ],
  },

  refunds: {
    title: 'Cancellation & Refund Policy',
    intro: 'We want you to be happy with every order. Here is how cancellations and refunds work.',
    sections: [
      {
        heading: 'Cancelling your order',
        bullets: [
          'You can cancel an order yourself within 60 seconds of placing it, using the Cancel button on the confirmation or order page.',
          `After that the kitchen may already be preparing your food. To request a cancellation, ${contactLine} as soon as possible. Orders that are already being prepared or are out for delivery usually cannot be cancelled.`,
        ],
      },
      {
        heading: 'If we cancel your order',
        paragraphs: ['We may decline or cancel an order, for example if an item is unavailable or we cannot deliver to you. You will receive an email with the reason.'],
      },
      {
        heading: 'Refunds',
        bullets: [
          'All orders are currently paid by Cash on Delivery, so a cancelled order is never charged and no refund is needed.',
          `Something wrong with a delivered order (missing or incorrect items, or a quality problem)? ${contactLine[0].toUpperCase()}${contactLine.slice(1)} within 2 hours of delivery, with your order number and a photo if possible. We will offer a replacement, or adjust the amount on your next order, at our discretion.`,
          'When online payment is introduced, approved refunds will be returned to the original payment method within 5–7 working days.',
        ],
      },
    ],
  },

  delivery: {
    title: 'Delivery Policy',
    intro: `${B.name} delivers orders using our own delivery staff.`,
    sections: [
      {
        heading: 'Where we deliver',
        paragraphs: [
          'We deliver to addresses within {radius} km (straight-line distance) of the restaurant. The app checks this when you save an address and again when you place an order.',
        ],
      },
      {
        heading: 'Minimum order and charges',
        bullets: ['Minimum order value: ₹{minOrder}.', 'Delivery is free.'],
      },
      {
        heading: 'When we deliver',
        paragraphs: [
          `${B.hours ? `We are open ${B.hours}. ` : ''}You can order whenever the app shows we are accepting orders. Delivery time depends on how busy the kitchen is and on distance; you can follow your order’s status in the app.`,
        ],
      },
      {
        heading: 'At delivery',
        bullets: [
          'Please be reachable on the phone number in your profile — our delivery staff may call you.',
          'Keep the cash ready (exact change helps).',
          'If we cannot reach you or no one is available to receive the order, it may be cancelled.',
        ],
      },
    ],
  },
};
