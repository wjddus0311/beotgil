import type { Mode, Place } from './domain.ts';
import { parseRoute, validPlace } from './domain.ts';

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export async function request<T>(path: string, body?: object): Promise<T> {
  if (!/^https?:\/\//.test(apiUrl)) throw new Error('app/.env에 EXPO_PUBLIC_API_URL을 설정하고 앱을 다시 시작해 주세요.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(apiUrl + path, { signal: controller.signal, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : `서버 오류 (${response.status})`);
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('조회 시간이 초과되었습니다. 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('서버에 연결하지 못했습니다. 주소와 네트워크를 확인해 주세요.');
    throw error;
  } finally { clearTimeout(timer); }
}
export function message(error: unknown) { return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'; }
export async function searchPlaces(query: string) {
  const data = await request<{ places: unknown[] }>('/api/places?q=' + encodeURIComponent(query.trim()));
  if (!Array.isArray(data.places)) throw new Error('장소 응답이 올바르지 않습니다.');
  return data.places.filter(validPlace);
}
export async function findRoute(from: Place, to: Place, mode: Mode = 'walk') {
  const params = new URLSearchParams({ start_x: from.x, start_y: from.y, end_x: to.x, end_y: to.y, mode });
  return parseRoute(mode, await request<unknown>('/api/route?' + params));
}
