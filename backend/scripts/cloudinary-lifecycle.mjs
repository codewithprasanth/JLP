// Verifies the menu-image lifecycle against the real Cloudinary account in .env:
// create → replace (old asset deleted) → delete item (asset deleted). Leaves nothing behind.
//   node scripts/cloudinary-lifecycle.mjs    (API must be running: npm run dev)
import 'dotenv/config';
import { deflateSync } from 'node:zlib';
import cloudinaryPkg from 'cloudinary';

const API = process.env.API ?? 'http://localhost:4000/api';
const cloudinary = cloudinaryPkg.v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Minimal valid 32×32 solid-colour PNG. */
function png([r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const W = 32;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(W).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(W).fill(row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
};
const exists = async (publicId) => {
  try {
    await cloudinary.api.resource(publicId);
    return true;
  } catch (e) {
    if (e.error?.http_code === 404) return false;
    throw e;
  }
};
const publicIdFromUrl = (url) => url.split('/upload/')[1].replace(/^v\d+\//, '').replace(/\.\w+$/, '');

const login = await (await fetch(`${API}/admin/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: process.env.SEED_ADMIN_USERNAME ?? 'admin', password: process.env.SEED_ADMIN_PASSWORD }),
})).json();
const auth = { authorization: `Bearer ${login.accessToken}` };
const categoryId = (await (await fetch(`${API}/admin/menu/categories`, { headers: auth })).json())[0].id;

const form = (fields, image) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (image) f.set('image', new Blob([image], { type: 'image/png' }), 'dish.png');
  return f;
};

// 1. Create with image A
let res = await fetch(`${API}/admin/menu/items`, {
  method: 'POST', headers: auth,
  body: form({ name: 'Cloudinary Test Dish', categoryId, price: '99', description: 'lifecycle test' }, png([220, 80, 40])),
});
const created = await res.json();
check('create item with image', res.status === 201 && created.imageUrl?.startsWith('https://res.cloudinary.com/dna5tn1uk/'), created);
const idA = publicIdFromUrl(created.imageUrl);
check(`asset A exists in Cloudinary (${idA})`, await exists(idA));
const pub = await (await fetch(`${API}/menu/items/${created.id}`)).json();
check('public menu serves the Cloudinary URL', pub.imageUrl === created.imageUrl, pub);
const img = await fetch(created.imageUrl);
check('image URL is publicly downloadable', img.ok && img.headers.get('content-type')?.startsWith('image/'), img.status);

// 2. Replace with image B → A must be deleted
res = await fetch(`${API}/admin/menu/items/${created.id}`, { method: 'PATCH', headers: auth, body: form({ price: '109' }, png([40, 120, 220])) });
const updated = await res.json();
const idB = publicIdFromUrl(updated.imageUrl);
check('replace image', res.status === 200 && idB !== idA && updated.price === '109.00', updated);
check('old asset A deleted (no orphan)', !(await exists(idA)));
check('new asset B exists', await exists(idB));

// 3. Edit without image → B kept
res = await fetch(`${API}/admin/menu/items/${created.id}`, { method: 'PATCH', headers: auth, body: form({ name: 'Cloudinary Test Dish 2' }) });
const renamed = await res.json();
check('edit without new image keeps B', renamed.imageUrl === updated.imageUrl, renamed);

// 4. Reject a non-image upload
const bad = new FormData();
bad.set('name', 'x'); bad.set('categoryId', categoryId); bad.set('price', '10');
bad.set('image', new Blob(['not an image'], { type: 'text/plain' }), 'x.txt');
res = await fetch(`${API}/admin/menu/items`, { method: 'POST', headers: auth, body: bad });
check('non-image upload rejected', res.status === 400, await res.json());

// 5. Delete item → B deleted
res = await fetch(`${API}/admin/menu/items/${created.id}`, { method: 'DELETE', headers: auth });
check('delete item', res.status === 200);
check('asset B deleted (no orphan)', !(await exists(idB)));

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
