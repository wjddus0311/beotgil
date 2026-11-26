export type Place = { id?: string; place_name: string; x: string; y: string; address_name: string; road_address_name?: string };
export type Coordinate = { latitude: number; longitude: number };
export type Mode = 'walk' | 'transit' | 'car';
export type Route = { seconds: number; distance?: number; segments: Coordinate[][]; directions: string[]; warnings: string[] };
export type Shelter = { id: string; name: string; address: string; lat: number; lon: number; type?: string };
export const safetyNote = '일반 도보 경로입니다. 휠체어 통행 가능 여부와 실시간 재난 위험은 확인되지 않았습니다.';
export const initialRegion = { latitude: 35.7739, longitude: 128.4309, latitudeDelta: 0.035, longitudeDelta: 0.035 };
export function validPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false;
  const p = value as Place;
  return typeof p.place_name === 'string' && !!p.place_name.trim() && typeof p.address_name === 'string'
    && typeof p.x === 'string' && !!p.x.trim() && typeof p.y === 'string' && !!p.y.trim()
    && validCoordinate({ latitude: Number(p.y), longitude: Number(p.x) });
}
export function validCoordinate(p: Coordinate) {
  return Number.isFinite(p.latitude) && p.latitude >= 33 && p.latitude <= 39
    && Number.isFinite(p.longitude) && p.longitude >= 124 && p.longitude <= 132;
}
export function coordinate(p: Place): Coordinate { return { latitude: Number(p.y), longitude: Number(p.x) }; }
export function placeKey(p: Place) { return p.id || `${p.place_name}|${p.x}|${p.y}`; }
export function remember(items: Place[], place: Place, limit = 10) {
  return [place, ...items.filter(p => placeKey(p) !== placeKey(place))].slice(0, limit);
}
export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

type Step = { properties?: { guidance?: string }; path?: { points?: unknown[] } };
type RawRoute = { properties?: { totalTime?: number; totalDistance?: number }; legs?: { steps?: Step[] }[]; steps?: Step[];
  result_code?: number; summary?: { duration?: number; distance?: number }; sections?: { roads?: { vertexes?: number[] }[] }[] };
export function parseRoute(mode: Mode, response: unknown): Route {
  if (!response || typeof response !== 'object') throw new Error('경로 응답이 올바르지 않습니다.');
  const data = response as { status?: string; route?: RawRoute; routes?: RawRoute[] };
  let seconds: number | undefined, distance: number | undefined, steps: Step[] = [], points: unknown[][] = [];
  if (mode === 'walk' && data.status === 'OK' && data.route) {
    seconds = data.route.properties?.totalTime; distance = data.route.properties?.totalDistance;
    steps = (data.route.legs || []).flatMap(leg => leg.steps || []);
    points = [steps.flatMap(step => step.path?.points || [])];
  } else if (mode === 'transit' && data.status === 'OK' && Array.isArray(data.routes)) {
    const fastest = data.routes.filter(r => Number.isFinite(r.properties?.totalTime) && r.properties!.totalTime! >= 0)
      .sort((a, b) => a.properties!.totalTime! - b.properties!.totalTime!)[0];
    seconds = fastest?.properties?.totalTime;
    points = (fastest?.steps || []).map(step => step.path?.points || []);
  } else if (mode === 'car' && data.routes?.[0]?.result_code === 0) {
    const route = data.routes[0]; seconds = route.summary?.duration; distance = route.summary?.distance;
    points = (route.sections || []).flatMap(s => (s.roads || []).map(road => {
      const pairs = [], vertices = road.vertexes || [];
      for (let i = 0; i + 1 < vertices.length; i += 2) pairs.push([vertices[i], vertices[i + 1]]);
      return pairs;
    }));
  }
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) throw new Error('이 구간의 경로와 시간을 확인하지 못했습니다.');
  const segments = points.map(segment => segment.filter((p): p is number[] => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
    .map(([longitude, latitude]) => ({ latitude, longitude })).filter(validCoordinate)).filter(s => s.length >= 2);
  if (mode === 'walk' && !segments.length) throw new Error('도보 경로 좌표를 받지 못했습니다.');
  const directions = steps.map(s => s.properties?.guidance).filter((s): s is string => typeof s === 'string' && !!s);
  return { seconds, distance: Number.isFinite(distance) && distance! >= 0 ? distance : undefined, segments, directions,
    warnings: directions.filter(s => /계단|육교|지하보도|지하도|에스컬레이터/.test(s)) };
}
export function distance(a: Coordinate, b: Coordinate) {
  const r = Math.PI / 180, dy = (a.latitude - b.latitude) * r, dx = (a.longitude - b.longitude) * r;
  const h = Math.sin(dy / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dx / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
