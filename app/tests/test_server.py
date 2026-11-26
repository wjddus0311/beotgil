import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
import tempfile
import sqlite3
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from urllib.error import URLError
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('app_server', Path(__file__).parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class SearchTests(unittest.TestCase):
    def call(self, query):
        handler = object.__new__(server.AppHandler)
        output = []
        handler.send_json = lambda code, data: output.append((code, data))
        handler.get_places(query)
        return output[0]

    def test_empty_query_is_rejected(self):
        self.assertEqual(self.call('q=')[0], 400)

    def test_missing_key_is_explicit(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.call('q=달성군청')[0], 503)

    def test_upstream_failure_returns_retryable_error_without_private_key(self):
        with patch.dict(os.environ, {'BEOTGIL_KAKAO_REST_KEY': 'private-key'}), patch.object(server, 'urlopen', side_effect=URLError('offline')):
            code, data = self.call('q=달성군청')
        self.assertEqual(code, 502)
        self.assertNotIn('private-key', json.dumps(data))

    def test_only_valid_dalseong_places_and_no_key_are_returned(self):
        rows = [dict(id='1', place_name='달성군청', x='128.43', y='35.77', address_name='대구 달성군'),
                dict(id='2', place_name='다른 장소', x='128.43', y='35.77', address_name='서울'),
                dict(id='3', place_name='오류', x='NaN', y='35.77', address_name='달성군')]
        with patch.dict(os.environ, {'BEOTGIL_KAKAO_REST_KEY': 'private-key'}), patch.object(server, 'urlopen', return_value=io.BytesIO(json.dumps({'documents': rows}).encode())):
            code, data = self.call('q=달성군청')
        self.assertEqual(code, 200)
        self.assertEqual([p['id'] for p in data['places']], ['1'])
        self.assertNotIn('private-key', json.dumps(data))

class IntegrationTests(unittest.TestCase):
    def test_app_handler_keeps_existing_feedback_endpoints_and_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            database = str(Path(directory) / 'test.sqlite3')
            with sqlite3.connect(database) as connection:
                connection.execute('CREATE TABLE suggestions (id INTEGER PRIMARY KEY, content TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
                connection.execute('CREATE TABLE facility_corrections (id INTEGER PRIMARY KEY, place_name TEXT, address TEXT, lat REAL, lon REAL, content TEXT)')
            with patch.object(server.web, 'database_path', database, create=True):
                httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.AppHandler)
                thread = threading.Thread(target=httpd.serve_forever, daemon=True)
                thread.start()
                client = HTTPConnection(*httpd.server_address, timeout=3)
                try:
                    def call(method, path, body=None):
                        client.request(method, path, json.dumps(body) if body is not None else None, {'Content-Type': 'application/json'})
                        response = client.getresponse()
                        return response.status, json.loads(response.read())
                    self.assertEqual(call('POST', '/api/suggestions', {'content': '  '})[0], 400)
                    self.assertEqual(call('POST', '/api/suggestions', {'content': '앱 검증'})[0], 201)
                    self.assertEqual(call('GET', '/api/suggestions')[1]['suggestions'][0]['content'], '앱 검증')
                    self.assertEqual(call('POST', '/api/facility-corrections', {'place_name': '달성군청', 'address': '', 'lat': 35.77, 'lon': 128.43, 'content': '출입구 확인 요청'})[0], 201)
                    self.assertEqual(call('GET', '/api/places?q=')[0], 400)
                    with sqlite3.connect(database) as connection:
                        self.assertEqual(connection.execute('SELECT count(*) FROM facility_corrections').fetchone()[0], 1)
                finally:
                    client.close()
                    httpd.shutdown()
                    httpd.server_close()
                    thread.join()

if __name__ == '__main__':
    unittest.main()
