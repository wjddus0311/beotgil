import React, { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Region } from 'react-native-maps';
import { Coordinate, validCoordinate } from './domain';
import { message } from './api';
import { Button, Heading, Note, styles } from './ui';

export type Feature = Coordinate & { id: string; name: string; detail: string };
const publicFeature: Feature = { id: 'eungam', latitude: 35.654524, longitude: 128.417041, name: '응암육교', detail: '달성군 육교정보 · 점자블록·경사로 등록 · 2026-06-24 기준. 실제 진입 위치와 통행 가능 여부는 미확인.' };
export function WalkingPanel({ region, onPins, onFocus }: { region: Region; onPins: (items: Feature[]) => void; onFocus: (point: Coordinate) => void }) {
  const [items, setItems] = useState<Feature[]>([]), [status, setStatus] = useState('지도를 확대하고 현재 지도에서 조회해 주세요.'), [busy, setBusy] = useState(false);
  const version = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { ++version.current; controller.current?.abort(); onPins([]); }, [onPins]);
  async function load() {
    const id = ++version.current;
    controller.current?.abort();
    if (region.latitudeDelta > 0.07 || region.longitudeDelta > 0.09) { setStatus('지도를 더 확대한 뒤 조회해 주세요.'); return; }
    const south = region.latitude - region.latitudeDelta / 2, north = region.latitude + region.latitudeDelta / 2;
    const west = region.longitude - region.longitudeDelta / 2, east = region.longitude + region.longitudeDelta / 2;
    const local = south >= 35.638 && north <= 35.688 && west >= 128.383 && east <= 128.444;
    const within = (p: Coordinate) => p.latitude >= south && p.latitude <= north && p.longitude >= west && p.longitude <= east;
    const features = within(publicFeature) ? [publicFeature] : [];
    setItems(features); onPins(features); setBusy(true); setStatus('계단·경사로 정보를 불러오고 있습니다.');
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      if (!local) {
        const bbox = [south, west, north, east].map(n => n.toFixed(5)).join(',');
        const query = `[out:json][timeout:25];(nwr["highway"="steps"](${bbox});nwr["ramp:wheelchair"="yes"](${bbox});nwr["ramp"="yes"]["highway"](${bbox});nwr["ramp"="separate"]["highway"](${bbox}););out center 250;`;
        const response = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query), { signal: abort.signal });
        if (!response.ok) throw new Error('OpenStreetMap 조회에 실패했습니다.');
        const data = await response.json() as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
        if (!Array.isArray(data.elements)) throw new Error('지도 정보 응답이 올바르지 않습니다.');
        for (const item of data.elements) {
          const latitude = item.lat ?? item.center?.lat, longitude = item.lon ?? item.center?.lon;
          if (latitude === undefined || longitude === undefined || !validCoordinate({ latitude, longitude })) continue;
          const tags = item.tags || {}, name = tags.highway === 'steps' ? '계단' : '경사로';
          const feature = { id: `${item.type}/${item.id}`, latitude, longitude, name: tags.name ? `${name} · ${tags.name}` : name,
            detail: `OSM 등록 정보 · 휠체어: ${tags.wheelchair || '미등록'} · 경사로: ${tags['ramp:wheelchair'] || tags.ramp || '미등록'} · 경사: ${tags.incline || '미등록'}. 실제 통행 여부는 미확인.` };
          if (!features.some(p => p.id === feature.id)) features.push(feature);
        }
      }
      if (id !== version.current) return;
      setItems(features); onPins(features);
      setStatus(`${features.length}곳 · ${local ? '학교 주변 OSM 저장 자료 2026-11-20 기준 0건. ' : ''}자료가 없는 구간도 통행 가능 여부는 확인되지 않았습니다.`);
    } catch (error) { if (id === version.current) setStatus(abort.signal.aborted ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.' : message(error)); }
    finally { clearTimeout(timer); if (id === version.current) setBusy(false); }
  }
  return <View style={{ gap: 8 }}><Heading>계단·경사로 정보</Heading><Text style={styles.body}>현재 지도 범위의 등록 정보를 확인하세요.</Text><Button title={busy ? '조회 중…' : '현재 지도에서 계단·경사로 찾기'} primary disabled={busy} onPress={load} /><Note>{status}</Note>
    <Note>이 정보는 경로 계산에 반영되지 않습니다. 경사로·단차 및 휠체어 통행 여부를 현장에서 확인해 주세요.</Note>
    {items.map(p => <View key={p.id} style={styles.card}><Text style={styles.body}>{p.name}</Text><Text style={styles.muted}>{p.detail}</Text><Button title="지도에서 보기" label={`${p.name} 지도에서 보기`} onPress={() => onFocus(p)} /></View>)}
    <Button title="© OpenStreetMap 기여자 · ODbL" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => setStatus('출처 링크를 열지 못했습니다.')); }} />
  </View>;
}
