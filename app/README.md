# 벗길 React Native

기존 웹앱의 노란색 강조색, 전체 지도, 접고 펼치는 하단 패널과 길찾기·건의사항 메뉴를 Expo/React Native로 구현했습니다. 화면은 네이티브 컴포넌트이며 지도는 iOS Apple Maps / Android Google Maps입니다. 장소 검색과 경로는 기존 카카오 API를 사용합니다.

처음에는 패널이 닫혀 있습니다. 하단 길찾기·건의사항 버튼을 누르면 패널이 올라오고 해당 버튼이 노란색으로 활성 표시됩니다. 같은 버튼을 다시 누르거나 패널의 ‘닫기’, Android 뒤로가기를 누르면 닫히고 활성 표시가 해제됩니다. 비활성 표시된 버튼도 클릭할 수 있으며 검색 입력과 작성 중인 건의 내용은 패널을 닫아도 유지됩니다.

## 실행

Node.js 24 LTS, Python 3 및 같은 네트워크의 iOS/Android 기기를 사용합니다.

1. 이 폴더에서 `npm ci`를 실행합니다.
2. `.env.example`을 `.env`로 복사하고 `EXPO_PUBLIC_API_URL`을 서버 컴퓨터의 LAN 주소로 설정합니다. 실제 기기의 `localhost`는 그 기기 자신입니다. Android 에뮬레이터는 `http://10.0.2.2:8081`, iOS 시뮬레이터는 `http://localhost:8081`을 사용할 수 있습니다.
3. 서버 터미널에서 아래 명령을 실행합니다. 기존 서버 대신 실행하며 같은 웹페이지와 API를 제공합니다. 기존 SQLite 파일도 그대로 사용합니다.

```sh
export BEOTGIL_KAKAO_REST_KEY='카카오 REST API 키'
# 필요에 따라 기존 BEOTGIL_PUBLIC_DATA_KEY, BEOTGIL_INTEGRATED_SAFETY_KEY,
# BEOTGIL_SAFETY_DATA_KEY 환경변수도 설정합니다.
BEOTGIL_HOST=0.0.0.0 python3 server.py
```

4. 앱 터미널에서 `npm start`를 실행하고 SDK 버전에 맞는 Expo Go로 QR 코드를 엽니다. 환경변수 변경 후 Metro를 다시 시작합니다.

REST API 키는 서버 환경변수에만 설정합니다. `EXPO_PUBLIC_*` 값은 앱에 포함되어 사용자에게 공개됩니다. LAN 서버는 신뢰하는 개발 네트워크에서만 사용하고 운영 시 HTTPS 서버를 사용하세요. 로컬 HTTP는 개발용입니다.

## 네이티브 빌드

- iOS: Xcode 및 시뮬레이터 설치 후 `npm run ios`.
- Android: Android Studio/SDK 설치 후 `npm run android`. `.env`의 `GOOGLE_MAPS_ANDROID_API_KEY`를 설정하고 Google Cloud에서 Maps SDK for Android를 활성화합니다. 키는 Android 패키지 `kr.beotgil.app`과 서명 인증서로 제한합니다. Expo Go는 자체 지도 설정을 사용합니다.
- 지도/위치 플러그인 또는 네이티브 설정을 바꾸면 다시 빌드합니다. 위치 권한은 사용자가 현재 위치 버튼을 누를 때만 요청합니다.

## 제공 기능과 제약

- 달성군 장소 검색, 출발·도착 선택, 현재 위치, 일반 도보 경로 및 구간 안내.
- 도보 10분 이상인 경우 대중교통/자동차 시간과 제공되는 경로 좌표 표시.
- 저장 장소 및 최근 10개 장소를 기기에 보관. 웹브라우저 저장 장소와는 별개입니다.
- 도착지 편의시설 조회 및 정정 요청, 건의사항 등록/최근 목록.
- 구지읍 재난 종류별 대피소, 현재 위치와 가까운 후보 5곳의 도보 시간 비교.
- 현재 지도 범위의 계단/경사로 조회. 학교 주변은 웹과 같은 2026-11-20 저장 자료 0건을 사용합니다. 응암육교 공공데이터도 표시합니다. OpenStreetMap 기여자 / ODbL.

경로는 휠체어 안전 경로가 아닙니다. 계단·경사로 자료는 경로 계산에 반영되지 않으며, 휠체어 통행 가능 여부·단차·실시간 위험·대피소 운영 상태는 확인되지 않았습니다. 데이터가 없다는 것이 통행 가능하다는 뜻은 아닙니다. 실시간 턴바이턴 내비게이션과 앱스토어 배포는 포함하지 않습니다.

`server.py`는 상위 폴더의 `beotgil-server.py`를 상속합니다. 단독으로 다른 저장소로 옮길 때는 상위 서버도 필요합니다. 추가 API는 `GET /api/places?q=검색어`이며, 달성군의 유효한 장소 최대 5개를 반환합니다. 기존 API의 키·데이터·오류 정책을 재사용합니다.

## 검사

```sh
npm run typecheck
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npx expo install --check
npx expo export --platform ios --platform android --output-dir dist
```

실제 기기에서 검색→출발/도착 선택→경로 확인, 입력 수정 시 경로 해제, 저장 후 재실행, 위치 권한 거절, 대피소 조회, 건의/정정 등록을 확인합니다. 실서버 건의는 실제 SQLite에 저장되므로 검증용 서버는 `BEOTGIL_DATA_PATH=/tmp/beotgil-app-test.sqlite3` 등 별도 파일을 사용하세요.

현재 `npm audit`에는 Expo fingerprint의 간접 의존성 minimatch에 따른 중간 등급 경고 3건이 남습니다. 빌드 도구의 파일 패턴 처리 관련 경고이며 SDK를 구형으로 내리는 자동 수정은 적용하지 않았습니다. 자세한 검증 범위는 [구현 기록](docs/implementation.md)에 있습니다.
