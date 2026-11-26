"""기존 벗길 서버에 모바일 장소 검색만 추가합니다. REST 키는 서버에 둡니다."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import ssl
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('beotgil_web', ROOT / 'beotgil-server.py')
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)

class AppHandler(web.BeotgilHandler):
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/api/places':
            return self.get_places(url.query)
        return super().do_GET()

    def get_places(self, query):
        keyword = parse_qs(query).get('q', [''])[0].strip()
        if not keyword or len(keyword) > 100:
            return self.send_json(400, {'message': '검색어를 1~100자로 입력해 주세요.'})
        key = os.environ.get('BEOTGIL_KAKAO_REST_KEY')
        if not key:
            return self.send_json(503, {'message': '서버에 카카오 REST API 키가 설정되지 않았습니다.'})
        params = urlencode({'query': keyword, 'x': 128.4309, 'y': 35.7739, 'radius': 20000, 'size': 15})
        request = Request('https://dapi.kakao.com/v2/local/search/keyword.json?' + params,
                          headers={'Authorization': 'KakaoAK ' + key})
        try:
            with urlopen(request, timeout=15, context=ssl.create_default_context()) as response:
                data = json.load(response)
            places = []
            for row in data['documents']:
                if not isinstance(row, dict) or '달성군' not in str(row.get('address_name', '')):
                    continue
                try:
                    lon, lat = float(row['x']), float(row['y'])
                    if not (124 <= lon <= 132 and 33 <= lat <= 39) or not row.get('place_name'):
                        continue
                except (KeyError, ValueError, TypeError):
                    continue
                places.append({field: str(row.get(field) or '') for field in
                               ('id', 'place_name', 'x', 'y', 'address_name', 'road_address_name')})
            return self.send_json(200, {'places': places[:5]})
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError, TypeError):
            return self.send_json(502, {'message': '장소를 검색하지 못했습니다. 서버의 카카오 키와 이용 설정을 확인해 주세요.'})

def main():
    os.chdir(ROOT)
    web.database_path = os.environ.get('BEOTGIL_DATA_PATH', str(ROOT / 'beotgil-data.sqlite3'))
    with sqlite3.connect(web.database_path) as connection:
        connection.execute('CREATE TABLE IF NOT EXISTS facility_corrections (id INTEGER PRIMARY KEY, place_name TEXT NOT NULL, address TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
        connection.execute('CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    host = os.environ.get('BEOTGIL_HOST', '127.0.0.1')
    port = int(os.environ.get('BEOTGIL_PORT', '8081'))
    print(f'벗길 웹·앱 API: http://{host}:{port}', flush=True)
    ThreadingHTTPServer((host, port), AppHandler).serve_forever()

if __name__ == '__main__':
    main()
