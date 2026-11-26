import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Place } from './domain';
import { request, message } from './api';
import { Button, Field, Heading, Note, styles } from './ui';

export function FeedbackPanel({ destination, onChoose }: { destination: Place | null; onChoose: () => void }) {
  const [content, setContent] = useState(''), [correction, setCorrection] = useState('');
  const [items, setItems] = useState<{ content: string; created_at: string }[]>([]);
  const [status, setStatus] = useState(''), [loading, setLoading] = useState(false), [posting, setPosting] = useState(false);
  const [correctionStatus, setCorrectionStatus] = useState(''), [correcting, setCorrecting] = useState(false);
  const mounted = useRef(true), correctionVersion = useRef(0);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);
  useEffect(() => { ++correctionVersion.current; setCorrection(''); setCorrectionStatus(''); setCorrecting(false); }, [destination]);
  async function load() {
    setLoading(true); setStatus('건의사항을 불러오고 있습니다.');
    try { const data = await request<{ suggestions: typeof items }>('/api/suggestions'); if (!Array.isArray(data.suggestions)) throw new Error('건의 응답이 올바르지 않습니다.'); if (mounted.current) { setItems(data.suggestions); setStatus(''); } }
    catch (error) { if (mounted.current) setStatus(message(error)); }
    finally { if (mounted.current) setLoading(false); }
  }
  async function post() {
    if (!content.trim() || posting) return;
    setPosting(true); setStatus('저장 중입니다.');
    try {
      await request('/api/suggestions', { content: content.trim() });
      if (!mounted.current) return;
      setContent(''); Alert.alert('등록 완료', '건의사항을 저장했습니다.'); await load();
    } catch (error) { if (mounted.current) setStatus(message(error)); }
    finally { if (mounted.current) setPosting(false); }
  }
  async function sendCorrection() {
    if (!destination || !correction.trim() || correcting) return;
    const version = correctionVersion.current;
    setCorrecting(true); setCorrectionStatus('정정 요청을 저장하고 있습니다.');
    try {
      await request('/api/facility-corrections', { place_name: destination.place_name, address: destination.road_address_name || destination.address_name, lat: Number(destination.y), lon: Number(destination.x), content: correction.trim() });
      if (mounted.current && version === correctionVersion.current) { setCorrection(''); setCorrectionStatus('검토 대기 상태로 저장되었습니다. 공공데이터에 바로 반영되지 않습니다.'); }
    } catch (error) { if (mounted.current && version === correctionVersion.current) setCorrectionStatus(message(error)); }
    finally { if (mounted.current && version === correctionVersion.current) setCorrecting(false); }
  }
  return <View style={{ gap: 8 }}>
    <Heading>함께 만드는 벗길</Heading><Text style={styles.body}>이동하며 느낀 불편함이나 바라는 점을 남겨 주세요.</Text>
    <Note>건의 내용은 서버에 저장되어 다른 사용자에게도 표시됩니다. 이름·연락처 등 개인정보는 적지 마세요.</Note>
    <Field label={`건의 내용 (${content.length}/1000)`} value={content} onChangeText={setContent} multiline maxLength={1000} editable={!posting} placeholder="벗길에 바라는 점을 알려 주세요." />
    <Button title={posting ? '등록 중…' : '건의사항 남기기'} primary disabled={!content.trim() || posting} onPress={post} />
    <Heading>편의시설 정보 정정 요청</Heading>
    <Text style={styles.muted}>요청은 검토용으로 저장되며 공공데이터에 바로 반영되지 않습니다.</Text>
    {destination ? <><Note>선택한 건물 · {destination.place_name}{'\n'}{destination.road_address_name || destination.address_name}</Note><Field label="정정 내용" value={correction} onChangeText={setCorrection} multiline maxLength={1000} editable={!correcting} placeholder="예: 출입구에 경사로가 없습니다." /><Button title={correcting ? '전송 중…' : '정정 요청 보내기'} disabled={!correction.trim() || correcting} onPress={sendCorrection} /></> : <Button title="정정할 도착지 선택" onPress={onChoose} />}
    {!!correctionStatus && <Note>{correctionStatus}</Note>}
    <Heading>등록된 건의사항</Heading><Button title={loading ? '불러오는 중…' : '목록 새로고침'} disabled={loading || posting} onPress={load} />
    {!!status && <Note>{status}</Note>}
    {!loading && !items.length && <Text style={styles.muted}>등록된 건의사항이 없습니다.</Text>}
    {items.map((item, i) => <View key={`${item.created_at}-${i}`} style={styles.card}><Text style={styles.body}>{item.content}</Text><Text style={styles.muted}>{item.created_at} UTC</Text></View>)}
  </View>;
}
