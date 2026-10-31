# 동네컷 / Local Cut

지역 축제의 기사와 실제 행사 사진을 AI 대본, 한국어 내레이션, 자막, 브금이 담긴 세로 쇼츠로 만드는 HACK:ON 프로젝트입니다.

- 공개 데모: https://codingdarin.github.io/local-shorts/
- 저장소: https://github.com/codingdarin/local-shorts
- 흐름: 일정 확인 -> 행사 선택 -> 대본과 영상 생성
- 공개 페이지는 소개와 실제 결과 영상입니다. GitHub Pages에서는 Node/FFmpeg 서버를 실행할 수 없으므로 새 영상 생성은 로컬 실행이 필요합니다.

## 로컬 실행

Node.js 24 이상, Windows 한국어 음성(기본 음성 사용 시).

```sh
npm ci
# .env.example을 .env로 복사하고 개인 API 키 입력
npm start
```

http://localhost:4310 에 접속합니다. API 키는 서버에서만 사용하며 저장소에 올리지 않습니다.

- TOUR_API_KEY: 한국관광공사 국문 관광정보 서비스
- NVIDIA_API_KEY 또는 GEMINI_API_KEY: AI 대본 생성. 무료 계정 확인 후 AI_FREE_TIER_CONFIRMED=true
- ELEVENLABS_API_KEY: 선택 사항. 연결 시 Roger 기본 음성, 다른 음성 선택 가능. 미연결 시 Windows 무료 한국어 음성

## 구현 범위

전국 행사 조회, 관련 기사 검색, 국내 행사 홍보 적합성 분류, 기사별 사진 이용 조건 확인, 4장면 AI 대본과 사진 매칭, 해요체 검사, 한국어 더빙, 음악/전환음, 1080x1920 MP4 출력. 기사와 대본·사진·음성·음악은 고급 커스텀에서 변경할 수 있습니다.

사진 자동 구성은 용인시와 경기도뉴스포털의 같은 연도 기사 중 공공누리 제1유형에 한정합니다. 사진이 없거나 조건이 불명확하면 중단합니다. 한국어 또는 영어를 선택할 수 있습니다. 영어 선택 시 검증된 한국어 초안을 AI가 번역하고 Roger로 영어 더빙합니다. 영어 더빙에는 ElevenLabs 연결이 필요합니다.

## 검증

```sh
node --test tests/*.test.mjs
npm run check
npm run build
```

테스트 27개 통과. 실제 고양가을꽃축제 선택부터 Roger 내레이션, 브금/효과음 포함 MP4 다운로드까지 검증: 16.6초, 1080x1920, 전체 디코딩 정상. 영어 번역/더빙 결과도 실제 버튼으로 생성하고 다운로드 검증: 19.0초, 1080x1920.

## 데모 자료 출처

[기사·사진·음원 출처](docs/demo-credits.md), [음원 사용 기록](docs/audio-assets.md). 영상 사진은 중앙 크롭/크기 조정 후 자막을 합성했습니다.

데모 영상 제목: 고양가을꽃축제 / elevenlabs.io. ElevenLabs 무료 플랜으로 생성한 비상업적 해커톤 시연 결과입니다. 사진·음원·음성 이용 조건은 소스코드와 별개입니다.

## 노트북을 공개 시연 서버로 사용

GitHub Pages 자체는 정적 호스팅입니다. 실제 생성은 노트북 Node 서버와 Cloudflare Quick Tunnel로 연결할 수 있습니다. 서버와 터널 프로세스, 노트북 전원 및 인터넷 연결을 유지해야 합니다. 임시 터널을 재시작하면 주소가 바뀌므로 `docs/live-config.json`의 URL과 서버의 `PUBLIC_ORIGIN`을 함께 갱신해야 합니다.

공개 시연 중에는 동시 영상 합성을 1개로 제한합니다. API 키는 노트북 `.env`에만 저장합니다. `PUBLIC_ORIGIN=https://발급된주소.trycloudflare.com` 설정 후 서버를 재시작합니다.
