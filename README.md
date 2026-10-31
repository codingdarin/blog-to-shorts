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

사진 자동 구성은 용인시와 경기도뉴스포털의 같은 연도 기사 중 공공누리 제1유형에 한정합니다. 사진이 없거나 조건이 불명확하면 중단합니다. 번역과 다국어 더빙은 후속 개발 예정이며 아직 구현되지 않았습니다.

## 검증

```sh
node --test tests/*.test.mjs
npm run check
npm run build
```

테스트 25개 통과. 실제 고양가을꽃축제 선택부터 Roger 내레이션, 브금/효과음 포함 MP4 다운로드까지 검증: 16.6초, 1080x1920, 전체 디코딩 정상.

## 데모 자료 출처

[기사·사진·음원 출처](docs/demo-credits.md), [음원 사용 기록](docs/audio-assets.md). 영상 사진은 중앙 크롭/크기 조정 후 자막을 합성했습니다.

데모 영상 제목: 고양가을꽃축제 / elevenlabs.io. ElevenLabs 무료 플랜으로 생성한 비상업적 해커톤 시연 결과입니다. 사진·음원·음성 이용 조건은 소스코드와 별개입니다.
