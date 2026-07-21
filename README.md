# LUMENFALL

모바일 우선 세로형 탄막 슈팅 게임입니다. 외부 런타임 의존성 없이 Canvas 2D와 Web Audio API만으로 동작합니다.

## 실행

정적 파일 서버에서 저장소 루트의 `index.html`을 열면 됩니다.

```bash
npx serve .
```

GitHub Pages를 사용하는 경우 저장소의 **Settings → Pages**에서 `main` 브랜치 루트를 배포 대상으로 선택합니다.

## 조작

- 키보드: 방향키 또는 WASD 이동, Shift 포커스, Space/X 폭탄, P 일시정지
- 터치: 화면 드래그 이동, FOCUS 저속 이동, BOMB 폭탄
- 게임패드: 왼쪽 스틱 또는 방향 패드 이동

## 개발

원본 코드는 `build/a_core.js`부터 `build/f2_tests.js`까지의 모듈 파일입니다. 생성 파일인 `build/game.js`와 `index.html`은 직접 수정하지 않습니다.

```bash
npm run build       # 모듈 결합, index.html·PWA 아이콘·캐시 버전 생성
npm run build:check # 생성 파일이 최신인지 검사
npm test            # 자체 테스트, HTML 연동 검사, 장시간 스모크 시뮬레이션
```

빌드 과정은 콘텐츠 해시를 이용해 서비스 워커 캐시 이름을 자동 갱신합니다. HTML 탐색은 네트워크 우선으로 처리되며 오프라인에서는 캐시된 게임을 실행합니다.

## 구조

- `build/a_core.js`–`build/f2_tests.js`: 모듈 원본
- `build/game.js`: 모듈을 결합한 생성 파일
- `build/head.html`, `build/tail.html`: HTML 셸
- `index.html`: 배포용 단일 HTML 생성 파일
- `scripts/build.js`: 재현 가능한 빌드 및 생성 파일 검사
- `assets/`: PWA 아이콘
- `sw.js`, `manifest.webmanifest`: 오프라인/PWA 설정

## 테스트 범위

난수 재현성, 충돌·그레이즈·폭탄·보스 흐름, 상태 전이, 오브젝트 풀, HUD 텍스트 영역, 저장 데이터 복구 및 전체 플레이 시뮬레이션을 검사합니다.
