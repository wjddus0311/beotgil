import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { Coordinate, Mode, Place, Route, Shelter, coordinate, initialRegion, validCoordinate } from './src/domain';
import { findRoute, message } from './src/api';
import { Button, colors } from './src/ui';
import { RoutePanel } from './src/RoutePanel';
import { FeedbackPanel } from './src/FeedbackPanel';
import { ShelterPanel } from './src/ShelterPanel';
import { Feature, WalkingPanel } from './src/WalkingPanel';
import { usePlaces } from './src/usePlaces';
import { initialSheet, sheetReducer, type Panel } from './src/sheet';

function Beotgil() {
  const insets = useSafeAreaInsets(), { height, width } = useWindowDimensions();
  const map = useRef<MapView>(null), scroll = useRef<React.ComponentRef<typeof ScrollView>>(null), version = useRef(0), locationBusy = useRef(false);
  const [{ panel, expanded }, dispatchSheet] = useReducer(sheetReducer, initialSheet);
  const sheetAnimation = useRef(new Animated.Value(0)).current;
  const sheetVisible = panel !== null;
  const [from, setFrom] = useState<Place | null>(null), [to, setTo] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null), [alternative, setAlternative] = useState<{ mode: Mode; route: Route } | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('출발지와 도착지를 검색해 주세요.');
  const [region, setRegion] = useState<Region>(initialRegion), [shelters, setShelters] = useState<Shelter[]>([]), [features, setFeatures] = useState<Feature[]>([]);
  const [location, setLocation] = useState<Coordinate | null>(null);
  const places = usePlaces();
  const landscape = width > height;
  const sheetHeight = Math.min(height - insets.top - insets.bottom - 155, Math.max(200, height * (expanded ? 0.70 : 0.30)));
  const pinsShelter = useCallback((items: Shelter[]) => setShelters(items), []);
  const pinsFeatures = useCallback((items: Feature[]) => setFeatures(items), []);
  useEffect(() => () => { ++version.current; }, []);
  useEffect(() => {
    const animation = Animated.timing(sheetAnimation, { toValue: sheetVisible ? 1 : 0, duration: 220, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [sheetVisible, sheetAnimation]);
  useEffect(() => {
    if (!sheetVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => subscription.remove();
  }, [sheetVisible]);
  function close() { Keyboard.dismiss(); dispatchSheet({ type: 'close' }); }
  function resize(expanded: boolean) { dispatchSheet({ type: 'resize', expanded }); }
  function focus(p: Coordinate) {
    Keyboard.dismiss(); resize(false);
    map.current?.animateToRegion({ ...p, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 400);
  }
  function open(next: Panel, expand = true) { Keyboard.dismiss(); dispatchSheet({ type: 'open', panel: next, expanded: expand }); scroll.current?.scrollTo({ y: 0, animated: false }); }
  function toggle(next: Panel) { Keyboard.dismiss(); dispatchSheet({ type: 'toggle', panel: next }); scroll.current?.scrollTo({ y: 0, animated: false }); }
  function clearRoute() { ++version.current; setRoute(null); setAlternative(null); setBusy(false); setStatus('장소를 선택한 후 길찾기를 눌러 주세요.'); }
  function select(side: 'from' | 'to', p: Place | null) {
    clearRoute(); (side === 'from' ? setFrom : setTo)(p);
    if (p) { places.remember(p); map.current?.animateToRegion({ ...coordinate(p), latitudeDelta: 0.015, longitudeDelta: 0.015 }, 300); }
  }
  async function routeFor(mode: Mode, start = from, end = to) {
    if (!start || !end) return;
    const id = ++version.current;
    setBusy(true); setStatus('경로를 확인하고 있습니다.'); setAlternative(null);
    if (mode === 'walk') setRoute(null);
    Keyboard.dismiss();
    try {
      const result = await findRoute(start, end, mode);
      if (id !== version.current) return;
      if (mode === 'walk') setRoute(result); else setAlternative({ mode, route: result });
      setStatus('경로를 확인했습니다. 이용 전 보행로 정보를 확인해 주세요.'); resize(false);
      const points = result.segments.flat();
      if (points.length) map.current?.fitToCoordinates(points, { edgePadding: { top: insets.top + 145, right: 45, bottom: landscape ? 45 : height * 0.30 + 130, left: landscape ? width * 0.45 : 45 }, animated: true });
    } catch (error) { if (id === version.current) setStatus(message(error)); }
    finally { if (id === version.current) setBusy(false); }
  }
  async function locate(): Promise<Place> {
    if (locationBusy.current) throw new Error('현재 위치를 확인하고 있습니다. 잠시 후 다시 시도해 주세요.');
    locationBusy.current = true;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('현재 위치를 사용하려면 기기 설정에서 벗길의 위치 권한을 허용해 주세요.');
      if (!await Location.hasServicesEnabledAsync()) throw new Error('기기의 위치 서비스를 켜 주세요.');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.')), 15000); })]).finally(() => clearTimeout(timer));
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!validCoordinate(coords)) throw new Error('현재 위치가 국내 서비스 범위 밖입니다. 달성군 출발지를 검색해 주세요.');
      setLocation(coords);
      return { place_name: '현재 위치', address_name: '현재 위치', x: String(coords.longitude), y: String(coords.latitude) };
    } finally { locationBusy.current = false; }
  }
  async function currentLocation(asOrigin = false) {
    const id = version.current;
    try { const p = await locate(); if (id !== version.current) return; if (asOrigin) select('from', p); else focus(coordinate(p)); }
    catch (error) { Alert.alert('현재 위치', message(error)); }
  }
  function pair(start: Place, end: Place) {
    clearRoute(); setFrom(start); setTo(end); places.remember(end); open('route'); void routeFor('walk', start, end);
  }
  const titles: Record<Panel, string> = { route: '달성군 길찾기', feedback: '건의사항', shelters: '구지읍 대피장소', walking: '보행로 정보' };
  return <View style={s.root}>
    <StatusBar style="dark" />
    <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initialRegion} onRegionChangeComplete={setRegion} showsCompass showsUserLocation={false} showsMyLocationButton={false} toolbarEnabled={false} accessibilityLabel="달성군 지도">
      {from && <Marker coordinate={coordinate(from)} title={'출발 · ' + from.place_name} pinColor="#806900" />}
      {to && <Marker coordinate={coordinate(to)} title={'도착 · ' + to.place_name} pinColor="#AE4034" />}
      {location && <Marker coordinate={location} title="현재 위치" pinColor="#2875E6" />}
      {route?.segments.map((points, i) => <Polyline key={'walk' + i} coordinates={points} strokeColor="#A97C00" strokeWidth={6} />)}
      {alternative?.route.segments.map((points, i) => <Polyline key={alternative.mode + i} coordinates={points} strokeColor={alternative.mode === 'car' ? '#C13935' : '#1765C2'} strokeWidth={6} />)}
      {shelters.map(p => <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} title={p.name} description={`${p.type || '대피장소'} · ${p.address}`} pinColor="#836800" />)}
      {features.map(p => <Marker key={p.id} coordinate={p} title={p.name} description={p.detail} pinColor="#755C00" />)}
    </MapView>
    <View style={[s.top, { top: insets.top + 12, right: 14, left: landscape && sheetVisible ? width * 0.44 + 14 : 14 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="장소 검색과 길찾기 열기" onPress={() => open('route')} style={s.search}>
        <Text style={s.brand}>벗길</Text><Text style={s.searchLabel}>어디로 이동하시나요?</Text><Text style={s.searchAction}>길찾기</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Button title="대피장소·쉼터" selected={panel === 'shelters'} onPress={() => toggle('shelters')} />
        <Button title="계단·경사로" selected={panel === 'walking'} onPress={() => toggle('walking')} />
      </ScrollView>
    </View>
    <View style={[s.mapButtons, { bottom: landscape ? insets.bottom + 96 : (sheetVisible ? sheetHeight : 0) + insets.bottom + 96 }]}>
      <Button title="◎" label="현재 위치로 지도 이동" onPress={() => { void currentLocation(); }} />
      <Button title="＋" label="지도 확대" onPress={() => map.current?.animateToRegion({ ...region, latitudeDelta: region.latitudeDelta / 2, longitudeDelta: region.longitudeDelta / 2 }, 250)} />
      <Button title="−" label="지도 축소" onPress={() => map.current?.animateToRegion({ ...region, latitudeDelta: Math.min(90, region.latitudeDelta * 2), longitudeDelta: Math.min(180, region.longitudeDelta * 2) }, 250)} />
    </View>
    <Animated.View pointerEvents={sheetVisible ? 'box-none' : 'none'} accessibilityElementsHidden={!sheetVisible} importantForAccessibility={sheetVisible ? 'auto' : 'no-hide-descendants'} style={[StyleSheet.absoluteFill, { transform: [{ translateY: sheetAnimation.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
    <KeyboardAvoidingView pointerEvents={sheetVisible ? 'box-none' : 'none'} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={[s.sheetFrame, landscape ? { top: insets.top + 8, bottom: insets.bottom + 84, width: width * 0.43 } : { bottom: insets.bottom + 84, height: sheetHeight }]}>
      <View style={s.sheet}>
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '패널 접기' : '패널 펼치기'} accessibilityState={{ expanded }} onPress={() => { Keyboard.dismiss(); resize(!expanded); }} style={s.handleButton}><View style={s.handle} /></Pressable>
        <View style={s.sheetHeader}><View style={s.sheetHeading}><Text accessibilityRole="header" style={s.sheetTitle}>{panel ? titles[panel] : ''}</Text><Text style={s.sheetSubtitle}>휠체어 이동을 위한 지도</Text></View><Button title="닫기" label="패널 닫기" onPress={close} /></View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.content}>
          <View style={panel !== 'route' && { display: 'none' }}><RoutePanel from={from} to={to} route={route} alternative={alternative} status={status} busy={busy} places={places} onSelect={select} onExpand={() => resize(true)} onRoute={mode => { void routeFor(mode); }} onLocate={() => { void currentLocation(true); }} /></View>
          <View style={panel !== 'feedback' && { display: 'none' }}><FeedbackPanel destination={to} onChoose={() => open('route')} /></View>
          {panel === 'shelters' && <ShelterPanel onPins={pinsShelter} onFocus={focus} onDestination={p => { select('to', p); open('route'); }} locate={locate} onPair={pair} />}
          {panel === 'walking' && <WalkingPanel region={region} onPins={pinsFeatures} onFocus={focus} />}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
    </Animated.View>
    <View style={[s.nav, { bottom: insets.bottom + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: panel === 'route', selected: panel === 'route' }} onPress={() => toggle('route')} style={[s.tab, panel === 'route' && s.active]}><Text style={[s.tabText, panel === 'route' && s.activeText]}>↗　길찾기</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: panel === 'feedback', selected: panel === 'feedback' }} onPress={() => toggle('feedback')} style={[s.tab, panel === 'feedback' && s.active]}><Text style={[s.tabText, panel === 'feedback' && s.activeText]}>✎　건의사항</Text></Pressable>
    </View>
  </View>;
}
export default function App() { return <SafeAreaProvider><Beotgil /></SafeAreaProvider>; }
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E9E9E4' }, top: { position: 'absolute', gap: 10 },
  search: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 28, padding: 8, paddingLeft: 16, borderWidth: 1, borderColor: colors.border, elevation: 3, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  brand: { fontSize: 20, fontWeight: '900', color: '#5B4A00' }, searchLabel: { flex: 1, fontSize: 14, color: colors.muted }, searchAction: { backgroundColor: colors.yellow, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, fontWeight: '800', color: colors.ink },
  chips: { gap: 8, paddingBottom: 4 }, mapButtons: { position: 'absolute', right: 14, gap: 6 },
  sheetFrame: { position: 'absolute', left: 0, right: 0 }, sheet: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 6, shadowColor: colors.ink, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, overflow: 'hidden' },
  handleButton: { height: 44, alignItems: 'center', justifyContent: 'center' }, handle: { height: 5, width: 44, backgroundColor: '#BEBBAD', borderRadius: 3 },
  sheetHeader: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 }, sheetHeading: { flex: 1 }, sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.ink }, sheetSubtitle: { fontSize: 12, color: colors.muted, marginTop: 4 }, content: { padding: 20, paddingBottom: 32 },
  nav: { position: 'absolute', left: 10, right: 10, minHeight: 64, padding: 6, flexDirection: 'row', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 36, elevation: 5, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, gap: 6 },
  tab: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 28 }, active: { backgroundColor: colors.yellow }, tabText: { fontSize: 16, fontWeight: '700', color: colors.muted }, activeText: { color: colors.ink },
});
