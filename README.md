# 블로그 투 쇼츠

블로그 본문과 첨부 이미지를 30~60초, 4~6장면의 세로 영상 초안으로 만드는 웹서비스 MVP입니다. 기본값은 **쇼츠 톤 · 6장면 · 45초**입니다.

- 저장소: https://github.com/codingdarin/blog-to-shorts (private)
- 기반 코드: https://github.com/codingdarin/local-shorts 의 `5ca3c00`
- 요구사항·진행·검증: [PLAN.md](PLAN.md)
- 프로젝트 규칙: [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md)

## 스택

| 영역 | 구현 |
|---|---|
| 백엔드 | Python 3.12, FastAPI, Uvicorn |
| 크롤링 | httpx, BeautifulSoup |
| AI · ElevenLabs | httpx로 기존 API 호출 |
| 영상 합성 | Python 비동기 subprocess → FFmpeg |
| 진행률 | FastAPI StreamingResponse → NDJSON |
| 프런트엔드 | React, TypeScript, Vite, Tailwind, shadcn/ui |

Node.js는 프런트 빌드·테스트 도구입니다. HTTP 서버와 크롤링·AI·영상 합성은 `backend/`의 Python 코드에서 실행합니다. 기존 API 경로와 요청·응답 형식을 유지합니다.

## 설치와 실행

Python 3.12 이상, Node.js 24 이상, FFmpeg가 필요합니다. TTS 기본값은 ElevenLabs의 Roger입니다. 사용 가능한 Roger가 없으면 Windows 기본 음성을 선택하며 안내합니다. 무료 대안은 Windows의 Microsoft Heami Desktop 음성입니다. 다른 OS에서는 사용 가능한 ElevenLabs 음성 또는 음성 끄기를 선택합니다.

Windows PowerShell:

```powershell
# python이 Windows CPython을 가리키는지 확인합니다.
python --version
python -m venv .venv
& ./.venv/Scripts/python.exe -m pip install -r requirements-lock.txt
npm ci
# 최초 설정 시에만 복사합니다. 기존 .env는 덮어쓰지 않습니다.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# .env에 제공받은 API 키와 확인된 사용 환경을 설정합니다.
npm start
```

`npm start`는 프런트를 빌드한 뒤 가상환경의 `python -m backend`를 실행합니다. 활성화된 가상환경이 없어도 저장소의 `.venv`를 찾습니다. MSYS Python처럼 pip/venv가 없는 Python이 먼저 검색되면 첫 두 명령에 Windows CPython의 전체 경로를 사용하세요.

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-lock.txt
npm ci
# .env.example을 .env로 복사하고 API 환경 설정
npm start
```

http://127.0.0.1:4311 에 접속합니다. 원본 local-shorts는 4310을 사용하므로 함께 실행할 수 있습니다. 기본 서버는 로컬 주소에만 바인딩합니다. 빌드 후 서버만 실행할 때는 Windows에서 `.venv/Scripts/python.exe -m backend`, 다른 OS에서 `.venv/bin/python -m backend`를 사용합니다.

FFmpeg는 `FFMPEG_PATH` → `local-data/bin/ffmpeg.exe`(Windows) 또는 `ffmpeg` → 시스템 PATH 순으로 찾습니다. 새 환경은 시스템 FFmpeg를 설치하거나 `.env`에 실행 파일 경로를 지정하세요. `ffmpeg-static` npm 패키지는 프런트 움직임 회귀 테스트용 개발 의존성이고 Python 서버에서 불러오지 않습니다.

`requirements.txt`는 실행 의존성, `requirements-dev.txt`는 테스트 의존성, `requirements-lock.txt`는 검증한 실행·테스트 환경의 고정 버전입니다. 서버는 메모리 작업 잠금과 다운로드 캐시를 사용하므로 Uvicorn **단일 worker**로 실행합니다. 작업 중 자동 reload는 사용하지 않습니다.

## 사용 흐름

1. 네이버 블로그 개별 글 URL을 불러오거나 제목·본문을 직접 입력합니다.
2. 접힌 본문·이미지 영역을 펼쳐 수집 결과(최대 8장)를 확인합니다. 이미지를 삭제하거나 내 사진을 추가할 수 있습니다.
3. 교육·리뷰·마케팅·쇼츠 톤, 4~6장면, 목표 길이, 더빙 속도(1·1.25·1.5·1.75·2배)를 선택합니다.
4. AI가 본문과 이미지를 함께 분석해 Hook → 본문 → CTA 대본과 이미지 매칭을 만듭니다. API 연결 전에는 수동 대본을 작성할 수 있습니다.
5. 제목의 줄바꿈, 장면 이미지, 자막별 문구와 두 줄 배치를 직접 수정하고 슬라이더로 확인합니다. 자막 개수는 이미지 장면 수보다 많을 수 있습니다.
6. TTS·자막·음악을 합성한 1080×1920 MP4를 미리보고 내려받습니다. 파일명은 한국 날짜 기준 `YYMMDD_영상제목.mp4`입니다. SRT 자막과 출처 파일도 저장할 수 있습니다.

검정 배경, 두 줄 제목 강조, 사진 확대·축소·좌우 이동을 제공합니다. 움직이는 사진은 지정 영역을 채우도록 가장자리가 잘릴 수 있고, 움직임을 끄면 원래 비율로 배치합니다. 배경음악은 해당 로컬 음원 파일이 있을 때 Salsa가 기본값이며 없으면 음악 없음으로 시작합니다. 음원 파일은 저장소에 포함하지 않습니다.

음성이 목표보다 길면 최대 60초 안에서 길이를 늘리고, 60초를 넘으면 이미 생성한 음성의 속도를 자동 조정합니다. 추가 TTS 요청 없이 음성을 재사용합니다. 자막·SRT는 편집한 페이지와 줄바꿈을 보존하며, 페이지 시간은 문구 길이에 비례한 추정값입니다.

## API 환경

- `OPENAI_API_KEY`, `NVIDIA_API_KEY`: 대본과 이미지 분석. 화면에서 사용할 제공자를 선택합니다. Gemini 지원은 제거했습니다.
- `OPENAI_MODEL`(기본 `gpt-5.6-terra`), `NVIDIA_MODEL`: 이미지 입력·구조화 출력을 지원하는 모델 ID입니다. 제공받은 계정에서 허용된 모델로 화면에서 변경할 수 있습니다. OpenAI는 Responses API + JSON Schema를 사용하고 응답 저장은 `store=false`로 요청합니다.
- `AI_FREE_TIER_CONFIRMED=true`: NVIDIA 무료 사용 범위를 확인한 후 설정합니다. `OPENAI_CREDITS_CONFIRMED=true`는 제공받은 OpenAI 크레딧/사용 한도를 확인한 뒤 설정합니다. 추가 결제·자동 충전은 수행하지 않습니다.
- `ELEVENLABS_API_KEY`: 선택 사항. 음성과 잔여 크레딧을 확인하고 사용자가 선택한 경우에만 TTS를 요청합니다. 기본은 사용 가능한 Roger이며, Windows 무료 음성도 선택할 수 있습니다.
- `PORT=4311`, `HOST=127.0.0.1`: 로컬 서버 주소입니다.
- `FFMPEG_PATH`: 선택 사항. FFmpeg 실행 파일의 절대 경로 또는 저장소 기준 상대 경로입니다.
- `PUBLIC_ORIGIN`: 별도 호스트의 프런트를 사용할 때 허용할 정확한 Origin입니다. 기본은 localhost/127.0.0.1의 서버 포트입니다. 기본 로컬 앱에는 인증이 없으므로 개인 PC에서 사용합니다.

화면의 API 키 입력은 해당 탭 메모리에서만 유지되고 요청마다 Python 서버를 거쳐 선택한 제공자에게 전달됩니다. 새로고침·제공자 변경·키 지우기 시 제거됩니다. 서버 환경변수의 키는 브라우저에 보내지 않습니다. 브라우저 localStorage에는 허용된 API·모델 선택만 저장하고 키·본문·출력·사용 확인은 저장하지 않습니다. 키를 계속 사용하려면 Git에서 제외된 서버 `.env`에 보관하세요. 브라우저 키 입력은 localhost 또는 HTTPS에서만 활성화합니다. 이는 공개 서비스용 사용자 인증·비밀 저장소를 대체하지 않습니다.

AI 분석에는 768px 이하 JPEG로 변환한 이미지와 본문을 전달합니다. 이미지가 없으면 본문만 분석합니다. 키와 원문·이미지·음원·출력 영상·가상환경은 Git에 올리지 않습니다. API 키가 있는 실제 환경을 테스트용 모의 응답으로 간주하지 않습니다.

## 수집 범위와 한계

네이버 PC·모바일 개별 글 URL과 PostView 링크를 지원합니다. 모바일 공개 HTML에서 스마트에디터 ONE 및 구형 본문 영역을 읽으며, 네이버 블로그 이미지 호스트만 다운로드합니다. 로그인·비공개·삭제·차단 글은 우회하지 않습니다. 본문은 12,000자, HTML은 4MB, 이미지 한 장은 8MB로 제한합니다. 글 구조가 바뀌면 파서 수정이 필요할 수 있습니다.

현재 작업은 브라우저 메모리에 유지되고 새로고침하면 초기화됩니다. 영상 링크는 서버 메모리에서 최대 3개, 15분간 유지되며 서버 재시작 시 만료됩니다. 클라이언트가 생성 연결을 끊으면 Python 작업과 실행 중 FFmpeg도 취소하고 해당 작업의 임시 파일을 정리합니다.

로그인·자동 SNS 게시·작업 내역 저장·AI 이미지 생성·외부 배포는 포함하지 않았습니다. 공개 배포 전에는 접근 제어, API 사용량 제한과 저장 정책이 필요합니다.

## 검증

```sh
npm test
npm run check
npm run build
```

`npm test`는 프런트 Node 테스트와 Python pytest를 함께 실행합니다. `tests_python/fixtures/node-parity.json`은 전환 전 Node의 시간·SRT·움직임·효과음 결과로, Python 이식의 출력 일치를 검증합니다. 실제 수집, AI 호출, TTS·영상 합성을 구분한 최신 검증 결과는 PLAN.md에 기록합니다.
