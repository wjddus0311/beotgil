import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validPlace, remember, parseRoute, formatDuration } from '../src/domain.ts';

const place = { id: '1', place_name: '달성군청', x: '128.43', y: '35.77', address_name: '대구 달성군' };
test('stored places require a name and finite Korean coordinates', () => {
  assert.equal(validPlace(place), true);
  for (const bad of [{ ...place, x: '' }, { ...place, y: 'NaN' }, { ...place, x: '200' }, { ...place, place_name: '' }, null]) assert.equal(validPlace(bad), false);
});
test('recent places deduplicate by location and keep the newest ten', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ ...place, id: String(i) }));
  const result = remember(items, place);
  assert.equal(result.length, 10);
  assert.equal(result[0].id, '1');
  assert.equal(result.filter(p => p.id === '1').length, 1);
});
test('walking routes preserve instructions and flag stairs without claiming accessibility', () => {
  const route = parseRoute('walk', { status: 'OK', route: { properties: { totalTime: 620, totalDistance: 500 }, legs: [{ steps: [{ properties: { guidance: '육교 계단으로 이동' }, path: { points: [[128.4, 35.7], [128.41, 35.71]] } }] }] } });
  assert.equal(route.seconds, 620);
  assert.deepEqual(route.warnings, ['육교 계단으로 이동']);
  assert.equal(route.segments[0][0].latitude, 35.7);
});
test('invalid and failed route summaries are rejected, transit may have time only', () => {
  assert.throws(() => parseRoute('walk', { status: 'OK', route: { properties: { totalTime: -1 }, legs: [] } }));
  assert.throws(() => parseRoute('car', { routes: [{ result_code: 1, summary: { duration: 10 } }] }));
  assert.equal(parseRoute('transit', { status: 'OK', routes: [{ properties: { totalTime: 100 }, steps: [] }, { properties: { totalTime: 40 }, steps: [] }] }).seconds, 40);
  assert.equal(formatDuration(3601), '1시간 1분');
});
