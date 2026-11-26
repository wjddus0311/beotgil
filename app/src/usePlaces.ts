import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place, placeKey, remember, validPlace } from './domain';

const savedKey = 'beotgil.savedPlaces.v1', recentKey = 'beotgil.recentPlaces.v1';
export function usePlaces() {
  const [saved, setSaved] = useState<Place[]>([]), [recent, setRecent] = useState<Place[]>([]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const latest = useRef({ saved: [] as Place[], recent: [] as Place[] });
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(savedKey), AsyncStorage.getItem(recentKey)]).then(values => {
      const lists = values.map(value => { const parsed: unknown = JSON.parse(value || '[]'); if (!Array.isArray(parsed)) throw new Error(); return parsed.filter(validPlace); });
      if (active) { latest.current = { saved: lists[0], recent: lists[1].slice(0, 10) }; setSaved(latest.current.saved); setRecent(latest.current.recent); setReady(true); }
    }).catch(() => { if (active) setError('기기에 저장된 장소를 읽지 못했습니다. 앱을 다시 시작해 주세요.'); });
    return () => { active = false; };
  }, []);
  function write(kind: 'saved' | 'recent', transform: (places: Place[]) => Place[]) {
    if (!ready) return;
    queue.current = queue.current.then(async () => {
      const next = transform(latest.current[kind]);
      try {
        await AsyncStorage.setItem(kind === 'saved' ? savedKey : recentKey, JSON.stringify(next));
        latest.current[kind] = next; (kind === 'saved' ? setSaved : setRecent)(next); setError('');
      } catch { setError('장소를 기기에 저장하지 못했습니다. 저장 공간을 확인해 주세요.'); }
    });
  }
  return { saved, recent, ready, error,
    save: (p: Place) => write('saved', items => remember(items, p, Infinity)),
    remove: (p: Place) => write('saved', items => items.filter(item => placeKey(item) !== placeKey(p))),
    remember: (p: Place) => { if (p.place_name !== '현재 위치') write('recent', items => remember(items, p)); },
    clear: () => write('recent', () => []),
  };
}
