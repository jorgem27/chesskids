import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, nextTier, pastSeasons, rankRows, seasonBadges, seasonFor, tierFor } from '../src/lib/seasons';
import { toCsv, type ReportRow } from '../src/lib/report';
import { makeInviteCode, normalizeInvite, sameSecret } from '../src/lib/clubs';
import { validPushEndpoint, vapidJwt } from '../src/lib/push';
import { familyMessage } from '../src/lib/family';

test('seasons: school terms and summer', () => {
  assert.deepEqual(seasonFor('2026-10-03'), { id: '2026-T1', name: 'Temporada de otoño', emoji: '🍂', start: '2026-09-01', end: '2026-12-31' });
  assert.equal(seasonFor('2027-01-01').id, '2027-T2');
  assert.equal(seasonFor('2027-03-31').id, '2027-T2');
  assert.equal(seasonFor('2027-04-01').id, '2027-T3');
  assert.equal(seasonFor('2027-08-31').id, '2027-V');
  assert.deepEqual(pastSeasons(seasonFor('2027-02-10'), 3).map((s) => s.id), ['2026-T1', '2026-V', '2026-T3']);
  assert.equal(daysLeft(seasonFor('2026-12-30'), '2026-12-30'), 1);
});

test('seasons: tiers, badges and shared ranks', () => {
  assert.equal(tierFor(149), null);
  assert.equal(tierFor(150)?.id, 'bronce');
  assert.equal(tierFor(5000)?.id, 'diamante');
  assert.equal(nextTier(400)?.id, 'oro');
  assert.equal(nextTier(1500), null);
  assert.deepEqual(seasonBadges({ xp: 450, solved: 120, activeDays: 21, rank: 2, players: 8 }), ['bronce', 'plata', 'constante', 'problemas-100', 'podio']);
  // No podium with 0 XP or in a class of two.
  assert.ok(!seasonBadges({ xp: 0, solved: 0, activeDays: 0, rank: 1, players: 8 }).includes('podio'));
  assert.ok(!seasonBadges({ xp: 50, solved: 0, activeDays: 1, rank: 1, players: 2 }).includes('podio'));
  // Summer is short: leagues and day badges need half.
  const summer = seasonFor('2027-07-15');
  assert.equal(tierFor(75, summer)?.id, 'bronce');
  assert.ok(seasonBadges({ xp: 0, solved: 0, activeDays: 10, rank: 5, players: 8 }, summer).includes('constante'));
  assert.deepEqual(rankRows([{ xp: 50 }, { xp: 30 }, { xp: 30 }, { xp: 10 }]).map((r) => r.rank), [1, 2, 2, 4]);
});

test('report: Excel-friendly CSV without formula injection', () => {
  const row: ReportRow = {
    id: 1, name: '=HYPERLINK("x")', username: 'lucia.torre42', group: 'Exploradores', level: 3, xp: 420, streak: 2, bestStreak: 5,
    solved: 35, minutes: 63, games: 10, homeworkDone: 3, homeworkTotal: 4, avgStars: 2.5, xp7: 40, solved7: 4, xp30: 120, activeDays30: 6, lastDay: '2026-10-02',
  };
  const csv = toCsv([row]);
  assert.ok(csv.startsWith('﻿"Alumno";"Grupo"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), 'formula is neutralised and quotes doubled');
  assert.ok(csv.includes('"2,5"'), 'decimal comma for Spanish Excel');
  assert.equal(csv.trim().split('\r\n').length, 2);
});

test('invites: codes are normalised and compared safely', () => {
  const code = makeInviteCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(normalizeInvite(' abcd efgh '), 'ABCD-EFGH');
  assert.equal(normalizeInvite('abcd-efg'), '');
  assert.ok(sameSecret('club-2026', 'club-2026'));
  assert.ok(!sameSecret('club-2026', 'club-2027'));
  assert.ok(!sameSecret('', ''), 'an unset sign-up code never matches');
});

test('push: only real push services, and a verifiable VAPID JWT', async () => {
  assert.ok(validPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(validPushEndpoint('https://web.push.apple.com/QGx'));
  assert.ok(validPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!validPushEndpoint('http://fcm.googleapis.com/x'));
  assert.ok(!validPushEndpoint('https://evil.example/fcm.googleapis.com'));
  assert.ok(!validPushEndpoint('https://fcm.googleapis.com.evil.example/x'));
  assert.ok(!validPushEndpoint('https://localhost:8787/x'));

  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwt = await vapidJwt('https://fcm.googleapis.com', { publicKey: Buffer.from(raw).toString('base64url'), privateKey: jwk.d!, subject: 'mailto:a@b.es' }, 1000);
  const [h, p, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url').toString()), { aud: 'https://fcm.googleapis.com', exp: 1000 + 12 * 3600, sub: 'mailto:a@b.es' });
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${h}.${p}`));
  assert.ok(ok, 'signature verifies with the public key');
});

test('family: weekly WhatsApp message', () => {
  const link = 'https://x.es/familia/abc';
  const busy = familyMessage('Lucía', { xp: 120, solved: 14, secs: 3900, activeDays: 4, streak: 3, level: 5, stickers: 1 }, link);
  assert.ok(busy.includes('4 días practicando'));
  assert.ok(busy.includes('14 problemas resueltos'));
  assert.ok(busy.includes('1 h 5 min'));
  assert.ok(busy.includes('Racha de 3 días'));
  assert.ok(busy.includes('1 cromo nuevo'));
  assert.ok(busy.endsWith(link));
  const idle = familyMessage('Mateo', { xp: 0, solved: 0, secs: 0, activeDays: 0, streak: 0, level: 1, stickers: 0 }, link);
  assert.ok(idle.includes('no ha jugado'));
  assert.ok(!idle.includes('Racha'));
});
