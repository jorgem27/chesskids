import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignMeta, isCampaignComplete, isNodePlayable, mapLayout, mapPath, nodeStates } from '../src/lib/campaigns';
import { getUnlockedItems, sanitizePet } from '../src/lib/pets';

test('campaign: first node is next, the rest locked', () => {
  assert.deepEqual(nodeStates([10, 11, 12], new Set()), ['next', 'locked', 'locked']);
});

test('campaign: passing a node opens the following one only', () => {
  assert.deepEqual(nodeStates([10, 11, 12], new Set([10])), ['done', 'next', 'locked']);
  assert.equal(isNodePlayable([10, 11, 12], new Set([10]), 11), true);
  assert.equal(isNodePlayable([10, 11, 12], new Set([10]), 12), false);
});

test('campaign: done nodes stay playable (replay) even after reordering', () => {
  // Node 12 was passed, then the coach moved it to the end: it is still replayable.
  assert.deepEqual(nodeStates([10, 11, 12], new Set([12])), ['next', 'locked', 'done']);
  assert.equal(isNodePlayable([10, 11, 12], new Set([12]), 12), true);
});

test('campaign: node outside the campaign is never playable', () => {
  assert.equal(isNodePlayable([10, 11], new Set(), 99), false);
});

test('campaign: complete only when every node is done', () => {
  assert.equal(isCampaignComplete([], new Set()), false);
  assert.equal(isCampaignComplete([1, 2], new Set([1])), false);
  assert.equal(isCampaignComplete([1, 2], new Set([1, 2, 7])), true);
});

test('campaign map: nodes go from bottom to top inside the given band', () => {
  const pts = mapLayout(5, 20, 80);
  assert.equal(pts[0].y, 80);
  assert.equal(pts[4].y, 20);
  assert.ok(pts.every((p) => p.x >= 20 && p.x <= 80));
  assert.ok(mapPath(pts).startsWith('M '));
  assert.equal(mapLayout(1, 20, 80)[0].y, 50);
});

test('campaign meta: validates reward and falls back on theme/emoji', () => {
  assert.deepEqual(campaignMeta({ title: '  ', reward_type: 'pet_flip' }), { error: 'Pon un título a la campaña' });
  assert.deepEqual(campaignMeta({ title: 'A', reward_type: 'nope' }), { error: 'Elige una recompensa' });
  const ok = campaignMeta({ title: 'Mapa', reward_type: 'pet_flip', theme: '<script>', emoji: 'x' });
  assert.ok(!('error' in ok));
  if (!('error' in ok)) { assert.equal(ok.theme, 'bosque'); assert.equal(ok.emoji, '🗺️'); }
});

test('pets: campaign rewards unlock items below their XP', () => {
  assert.ok(!getUnlockedItems(0).some((i) => i.id === 'gafas_sol'));
  assert.ok(getUnlockedItems(0, ['gafas_sol']).some((i) => i.id === 'gafas_sol'));
});

test('pets: sanitize drops locked items, wrong slots and bad bases', () => {
  const unlocked = getUnlockedItems(100);
  assert.equal(sanitizePet('dragon', {}, unlocked), null);
  const p = sanitizePet('torre', { head: 'gorra', face: 'corona', body: 'lazo', feet: '<x>' }, unlocked);
  assert.deepEqual(p, { base: 'torre', equipped: { head: 'gorra' } });
});
