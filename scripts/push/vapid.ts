// Generates a VAPID key pair for the streak reminders. Run once: `npm run push:keys`, then
//   npx wrangler secret put VAPID_PRIVATE_KEY   (paste the private key)
// and add VAPID_PUBLIC_KEY / VAPID_SUBJECT as vars in wrangler.jsonc (or as secrets too).
const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('VAPID_SUBJECT=mailto:tu-email@ejemplo.com');

export {};
