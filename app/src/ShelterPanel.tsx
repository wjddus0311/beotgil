import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Coordinate, Place, Shelter, coordinate, distance, formatDuration, validCoordinate } from './domain';
import { findRoute, request, message } from './api';
import { Button, Heading, Note, Row, styles } from './ui';

const types = [['3', '지진 옥외'], ['2', '무더위'], ['1', '한파'], ['4', '지진해일']];
export function ShelterPanel({ onPins, onFocus, onDestination, locate, onPair }: {
  onPins: (s: Shelter[]) => void; onFocus: (p: Coordinate) => void; onDestination: (p: Place) => void;
  locate: () => Promise<Place>; onPair: (from: Place, to: Place) => void;
}) {
  const [type, setType] = useState('3'), [items, setItems] = useState<Shelter[]>([]), [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current;
    setBusy(true); setItems([]); onPins([]); setStatus('구지읍 장소를 불러오고 있습니다.');
    request<{ shelters: Shelter[] }>('/api/integrated-shelters?type=' + type).then(data => {
      if (id !== generation.current) return;
      if (!Array.isArray(data.shelters)) throw new Error('대피소 응답이 올바르지 않습니다.');
      const valid = data.shelters.filter(s => typeof s.name === 'string' && typeof s.address === 'string' && validCoordinate({ latitude: s.lat, longitude: s.lon }));
      setItems(valid); onPins(valid); setStatus(valid.length ? `구지읍 ${valid.length}곳 · 장소를 선택해 주세요.` : '해당 종류의 등록된 장소가 없습니다.');
    }).catch(error => { if (id === generation.current) setStatus(message(error)); })
      .finally(() => { if (id === generation.current) setBusy(false); });
    return () => { ++generation.current; onPins([]); };
  }, [type, retry, onPins]);
  function asPlace(s: Shelter): Place { return { id: 'shelter-' + s.id, place_name: s.name, address_name: s.address, x: String(s.lon), y: String(s.lat) }; }
  async function fastest() {
    const id = ++generation.current;
    setBusy(true); setStatus('현재 위치와 가까운 후보 5곳의 일반 도보 시간을 비교하고 있습니다.');
    try {
      const from = await locate();
      if (id !== generation.current) return;
      const candidates = [...items].sort((a, b) => distance(coordinate(from), { latitude: a.lat, longitude: a.lon }) - distance(coordinate(from), { latitude: b.lat, longitude: b.lon })).slice(0, 5);
      const results = await Promise.all(candidates.map(async s => { try { return { shelter: s, route: await findRoute(from, asPlace(s)) }; } catch { return null; } }));
      if (id !== generation.current) return;
      const valid = results.filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.route.seconds - b.route.seconds);
      if (!valid.length) throw new Error('후보 장소의 도보 경로를 확인하지 못했습니다.');
      const best = valid[0];
      setStatus(`후보 ${candidates.length}곳 중 경로를 확인한 ${valid.length}곳에서 가장 빠른 곳 · ${best.shelter.name} · 약 ${formatDuration(best.route.seconds)}`);
      onPair(from, asPlace(best.shelter));
    } catch (error) { if (id === generation.current) setStatus(message(error)); }
    finally { if (id === generation.current) setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    <Heading>대피장소·쉼터</Heading><Text style={styles.body}>재난 종류에 맞는 구지읍 장소를 찾아보세요.</Text>
    <Note>휠체어 접근성, 실시간 운영 상태와 재난 위험은 확인되지 않았습니다. 가장 빠른 결과도 안전을 보장하지 않습니다.</Note>
    <Row>{types.map(([value, name]) => <Button key={value} title={name} selected={value === type} onPress={() => setType(value)} />)}</Row>
    <Button title="목록 다시 조회" disabled={busy} onPress={() => setRetry(retry + 1)} />
    <Button title="현재 위치에서 빠른 곳 찾기" primary disabled={busy || !items.length} onPress={fastest} />
    <Note>{status}</Note>
    {items.map(s => <View key={s.id} style={styles.card}><Text style={styles.body}>{s.name}</Text><Text style={styles.muted}>{s.type} · {s.address}</Text><Row><Button title="지도에서 보기" label={`${s.name} 지도에서 보기`} onPress={() => onFocus({ latitude: s.lat, longitude: s.lon })} /><Button title="도착지로 선택" label={`${s.name} 도착지로 선택`} onPress={() => onDestination(asPlace(s))} /></Row></View>)}
  </View>;
}
