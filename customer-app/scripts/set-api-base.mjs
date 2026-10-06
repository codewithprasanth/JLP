// Render build step: writes the production API URL into environment.prod.ts.
// Render passes the API's host (e.g. "jlp-api.onrender.com") as API_HOST via the
// blueprint (fromService → host), so nobody has to hard-code or remember the URL.
// Fails the build rather than shipping an app that points at a placeholder.
import { writeFileSync } from 'node:fs';

const raw = (process.env.API_HOST ?? '').trim().replace(/\/+$/, '');
if (!raw) {
  console.error('API_HOST is not set — refusing to build a production bundle without the API address.');
  process.exit(1);
}
const origin = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
const target = new URL('../src/environments/environment.prod.ts', import.meta.url);
writeFileSync(
  target,
  `// Generated at build time by scripts/set-api-base.mjs — do not edit.
export const environment = {
  production: true,
  apiBase: '${origin}/api',
};
`,
);
console.log(`environment.prod.ts → ${origin}/api`);
