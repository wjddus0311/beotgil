import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Place, Mode, Route, formatDuration, placeKey, safetyNote } from './domain';
import { message, request, searchPlaces } from './api';
import { Button, Field, Heading, Note, Row, styles } from './ui';
import { usePlaces } from './usePlaces';

type Props = {
  from: Place | null; to: Place | null; route: Route | null; alternative: { mode: Mode; route: Route } | null;
  busy: boolean; status: string; onSelect: (side: 'from' | 'to', place: Place | null) => void;
  onRoute: (mode: Mode) => void; onLocate: () => void; onExpand: () => void;
  places: ReturnType<typeof usePlaces>;
};
function SearchField({ label, place, onSelect, onFocus }: { label: string; place: Place | null; onSelect: (p: Place | null) => void; onFocus: () => void }) {
  const [query, setQuery] = useState(''), [results, setResults] = useState<Place[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => { if (place) setQuery(place.place_name); setResults([]); setStatus(''); setBusy(false); ++version.current; }, [place]);
  useEffect(() => () => { ++version.current; }, []);
  async function search() {
    const id = ++version.current;
    if (!query.trim()) { setStatus('검색할 장소를 입력해 주세요.'); return; }
    setBusy(true); setStatus('장소를 검색하고 있습니다.'); setResults([]);
    try {
      const items = await searchPlaces(query);
      if (id !== version.current) return;
      setResults(items); setStatus(items.length ? '목록에서 장소를 선택하세요.' : '달성군에서 일치하는 장소가 없습니다. 장소명을 더 자세히 입력해 주세요.');
    } catch (error) { if (id === version.current) setStatus(message(error)); }
    finally { if (id === version.current) setBusy(false); }
  }
  return <View>
    <Row style={{ alignItems: 'flex-end' }}><Field label={label} value={query} placeholder={label === '출발지' ? '예: 달성군청' : '예: 달성군 장애인복지관'} onFocus={onFocus}
      onChangeText={value => { ++version.current; setQuery(value); setResults([]); setStatus(''); setBusy(false); onSelect(null); }} returnKeyType="search" onSubmitEditing={search} maxLength={100} />
      <Button title={busy ? '검색 중' : '검색'} label={`${label} 검색`} disabled={busy} onPress={search} /></Row>
    {!!place && <Text style={styles.muted}>선택됨 · {place.place_name} · {place.road_address_name || place.address_name}</Text>}
    {!!status && <Note>{status}</Note>}
    {results.map(p => <View key={placeKey(p)} style={styles.card}><Button title={p.place_name} label={`${label}로 ${p.place_name} 선택`} onPress={() => { ++version.current; setQuery(p.place_name); setResults([]); setStatus(''); onSelect(p); }} /><Text style={styles.muted}>{p.road_address_name || p.address_name}</Text></View>)}
  </View>;
}
function Facility({ place }: { place: Place | null }) {
  const [text, setText] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!place) { setText('도착지를 선택하면 편의시설 정보를 확인합니다.'); return; }
    setText('공공데이터에서 편의시설을 확인하고 있습니다.');
    const params = new URLSearchParams({ name: place.place_name, lat: place.y, lon: place.x });
    request<{ status: string; facilities?: string[] }>('/api/facility?' + params).then(data => {
      if (active) setText(data.status === 'found' && Array.isArray(data.facilities) ? '등록된 편의시설 · ' + data.facilities.join(' · ') + '\n휠체어 통행을 보장하지 않습니다.' : '일치하는 편의시설 정보를 확인하지 못했습니다. 휠체어 이용 여부는 확인이 필요합니다.');
    }).catch(error => { if (active) setText(message(error)); });
    return () => { active = false; };
  }, [place, retry]);
  return <View><Note>{text}</Note>{!!place && <Button title="편의시설 다시 확인" onPress={() => setRetry(retry + 1)} />}</View>;
}
export function RoutePanel(props: Props) {
  const { from, to, route, alternative, places } = props;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setExpanded(false); }, [route]);
  function shelf(items: Place[], saved: boolean) {
    return items.length ? items.map(p => <View key={placeKey(p)} style={styles.card}><Text style={styles.body}>{p.place_name}</Text><Text style={styles.muted}>{p.road_address_name || p.address_name}</Text>
      <Row><Button title="출발" label={`${p.place_name}에서 출발`} onPress={() => props.onSelect('from', p)} /><Button title="도착" label={`${p.place_name}로 도착`} onPress={() => props.onSelect('to', p)} />{saved && <Button title="삭제" label={`${p.place_name} 저장 삭제`} onPress={() => places.remove(p)} />}</Row></View>) : <Text style={styles.muted}>아직 장소가 없습니다.</Text>;
  }
  return <View style={{ gap: 8 }}>
    <Heading>어디로 이동하시나요?</Heading>
    <SearchField label="출발지" place={from} onSelect={p => props.onSelect('from', p)} onFocus={props.onExpand} />
    <Row><Button title="현재 위치에서 출발" onPress={props.onLocate} />{!!from && <Button title="출발지 저장" disabled={!places.ready} onPress={() => places.save(from)} />}</Row>
    <SearchField label="도착지" place={to} onSelect={p => props.onSelect('to', p)} onFocus={props.onExpand} />
    {!!to && <Button title="도착지 저장" disabled={!places.ready} onPress={() => places.save(to)} />}
    <Facility place={to} />
    <Button title={props.busy ? '경로 확인 중…' : '벗길에서 길찾기'} primary disabled={!from || !to || props.busy} onPress={() => props.onRoute('walk')} />
    {!!props.status && <Note>{props.status}</Note>}
    {!!route && <View style={styles.card}>
      <Heading>도보 약 {formatDuration(route.seconds)}</Heading>
      {route.distance !== undefined && <Text style={styles.body}>거리 {route.distance.toLocaleString('ko-KR')}m · 지도에서 갈색 경로</Text>}
      <Note>{safetyNote}</Note>
      <Text style={styles.body}>보행로 정보 · 경사로·단차 미확인</Text>
      {route.warnings.length ? route.warnings.map((s, i) => <Text key={i} style={styles.body}>⚠ {s}</Text>) : <Text style={styles.muted}>계단 등의 언급이 없어도 실제 통행 여부는 확인되지 않았습니다.</Text>}
      {(expanded ? route.directions : route.directions.slice(0, 5)).map((s, i) => <Text key={i} style={styles.body}>{i + 1}. {s}</Text>)}
      {route.directions.length > 5 && <Button title={expanded ? '구간 접기' : '전체 구간 펼치기'} onPress={() => setExpanded(!expanded)} />}
      {route.seconds >= 600 && <><Row><Button title="대중교통 시간" disabled={props.busy} onPress={() => props.onRoute('transit')} /><Button title="자동차 시간" disabled={props.busy} onPress={() => props.onRoute('car')} /></Row><Text style={styles.muted}>교통수단의 휠체어 이용 가능 여부는 확인되지 않았습니다.</Text></>}
      {!!alternative && <Note>{alternative.mode === 'car' ? '자동차 · 빨간색' : '대중교통 · 파란색'} 약 {formatDuration(alternative.route.seconds)}{!alternative.route.segments.length ? '\n경로 좌표가 없어 시간만 표시합니다.' : ''}</Note>}
    </View>}
    {!!places.error && <Note>{places.error}</Note>}
    <Heading>저장한 장소</Heading><Text style={styles.muted}>이 기기에 저장됩니다.</Text>{shelf(places.saved, true)}
    <Heading>최근 선택한 장소</Heading>{shelf(places.recent, false)}
    {!!places.recent.length && <Button title="최근 장소 지우기" onPress={places.clear} />}
  </View>;
}
