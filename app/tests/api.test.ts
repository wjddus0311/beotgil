import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.EXPO_PUBLIC_API_URL = 'https://beotgil.example';
const { request, searchPlaces } = await import('../src/api.ts');
test('HTTP errors preserve the server message without reporting success', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ message: '키가 설정되지 않았습니다.' }), { status: 503 }));
  await assert.rejects(request('/api/route'), /키가 설정되지 않았습니다/);
});
test('network failures provide an actionable message', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(request('/api/suggestions'), /서버에 연결하지 못했습니다/);
});
test('place search encodes Korean input and discards invalid coordinates', async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ places: [
      { place_name: '달성군청', address_name: '달성군', x: '128.43', y: '35.77' },
      { place_name: '잘못된 좌표', address_name: '달성군', x: 'NaN', y: '35.77' },
    ] }));
  });
  assert.equal((await searchPlaces(' 달성군청 ')).length, 1);
  assert.equal(calls[0], 'https://beotgil.example/api/places?q=' + encodeURIComponent('달성군청'));
});
