# 음원 출처와 사용 기록

확인일: 2026-10-31. 원본 음원은 `local-data/music/`에 보관하며 Git에 포함하지 않는다.

| ID | 곡 / 제작자 | 원본 링크 | 라이선스 | 앱 적용 위치 | 영상 적용 기록 |
| --- | --- | --- | --- | --- | --- |
| salsa | Happy Latin Salsa Dance / kornevmusic (ANDRII KORNIEV) | [원본](https://pixabay.com/music/salsa-happy-latin-salsa-dance-621026/) | Pixabay Content License, Content ID 등록 | 기본 자동 선택 브금, 20초 미리 듣기, MP4 배경음 | 사용자가 선택한 출력에 반영; 이번 검증 영상은 swing 사용 |
| lunar | Chinese Lunar New Year / ViacheslavStarostin | [원본](https://pixabay.com/music/china-chinese-lunar-new-year-465871/) | Pixabay Content License, Content ID 등록 | 선택형 브금, 20초 미리 듣기, MP4 배경음 | 아직 완성 시연 영상에는 사용하지 않음 |
| swing | Bring Back the Swing (Upbeat Jazz) / EvolvingVibes | [원본](https://pixabay.com/music/traditional-jazz-bring-back-the-swing-upbeat-jazz-617230/) | Pixabay Content License, Content ID 등록 | 선택형 브금, 20초 미리 듣기, MP4 배경음 | yongin-music-sfx.mp4에 적용: 18.2초, 음량 16%, 페이드 포함 |
| light | 라이트 비트 / 동네컷 자체 합성 | `music.mjs` | 프로젝트에서 직접 합성한 음원, 자유 사용 | 외부 음원 파일이 없을 때 기본 곡, 선택형 브금 | 음원 연결 전 기본 테스트용 |
| cut | 짧은 전환음 / 동네컷 자체 합성 | `music.mjs` | 프로젝트에서 직접 합성한 효과음, 자유 사용 | 2~4번 장면 시작 시점에 0.16초 적용, 체크박스로 끌 수 있음 | 배경음과 별도로 렌더링에 혼합 |

세 번째 사용자 링크는 [festival 검색 결과](https://pixabay.com/music/search/festival/?order=ec)다. 그 목록에서 swing 곡을 선택했으며, 검색 페이지 자체를 음원으로 등록하지 않았다.

## 이용 조건 확인

- [Pixabay 공식 라이선스 요약](https://pixabay.com/service/license-summary/): 무료 사용, 출처 표시 없이 사용, 새로운 작업물에 맞춘 편집을 허용한다. 원본에 가까운 콘텐츠의 단독 판매·배포는 금지한다. 앱은 음원 원본 다운로드 버튼을 제공하지 않고 로컬 편집용 미리 듣기와 영상 합성에 사용한다.
- 세 곡 모두 원본 페이지에서 `Free for use under the Pixabay Content License` 및 `Content ID Registered` 표시를 확인했다. Content ID 등록은 무료 사용 여부와 별개이며, YouTube 업로드 시 권리 주장이 발생할 수 있다.
- 증빙 링크: [salsa 인증서](https://pixabay.com/music/621026/license/), [lunar 인증서](https://pixabay.com/music/465871/license/), [swing 인증서](https://pixabay.com/music/617230/license/). 인증서 파일 자체는 아직 확보하지 않았다. 공식 안내: [Content ID 주장 해제](https://pixabay.com/blog/posts/how-to-clear-a-youtube-content-id-claim-with-a-pix-190/).
- 제작자 크레딧과 원문/라이선스 링크를 앱의 `사진 출처 내려받기` 파일에 음원 정보와 함께 저장한다. 사용자가 곡을 바꾸면 현재 선택 곡의 정보가 기록된다.
- 공개 배포는 아직 하지 않았다. 원본 MP3를 저장소나 별도 음원 다운로드 서비스로 재배포하지 않는다.

## 파일과 혼합 방식

| ID | 원본 파일 | 미리 듣기 파일 |
| --- | --- | --- |
| salsa | `local-data/music/salsa.mp3` | `local-data/music/salsa-preview.mp3` |
| lunar | `local-data/music/lunar.mp3` | `local-data/music/lunar-preview.mp3` |
| swing | `local-data/music/swing.mp3` | `local-data/music/swing-preview.mp3` |

미리 듣기는 시작 20초를 사용한다. 영상에서는 선택 곡을 필요한 길이만큼 반복하고, 시작/끝에 짧은 페이드를 적용한다. 기본 브금 음량은 16%, 조절 범위는 0~50%다. 내레이션은 별도 트랙으로 유지한 뒤 효과음과 혼합하며 피크 제한을 적용한다. 장면 전환 시점은 실제 내레이션 길이와 영상 프레임 길이를 기준으로 계산한다.

추가 곡은 원본 페이지의 이용 조건을 확인한 뒤 `music.mjs` 카탈로그에 등록하고 이 표와 사용 기록을 갱신한다. 파일이 없으면 카탈로그에서 제외된다.


## 추가 적용 기록: 고양가을꽃축제

- 파일: `local-data/deliverables/goyang-festival-auto.mp4`
- 브금: salsa / Happy Latin Salsa Dance / kornevmusic / Pixabay Content License.
- 20.27초, 음량 16%, 시작·끝 페이드. 컷 전환 효과음 3곳, 무료 Heami 내레이션과 혼합.
- 기사/사진: 경기도뉴스포털, 안주형 기자, 공공누리 제1유형. 상세 원문/사진 링크는 `local-data/deliverables/goyang-festival-auto-credits.md`.

## 추가 적용 기록: ElevenLabs 내레이션 검증

| 결과물 | 브금 | 사용 방식 | 내레이션 |
| --- | --- | --- | --- |
| local-data/deliverables/goyang-elevenlabs.mp4 | salsa / Happy Latin Salsa Dance / kornevmusic / 위 원본 및 Pixabay 라이선스 동일 | 16.3초, 16%, 시작/끝 페이드, 자체 합성 컷 전환음 3곳 | ElevenLabs Laura, multilingual v2, 무료 포함 크레딧 115 사용 |

기사/사진 출처는 local-data/deliverables/goyang-elevenlabs-credits.md에 기록했다.

- 2026-10-31 버튼 전체 흐름 검증: local-data/deliverables/goyang-roger-button.mp4, 16.6초. salsa 기본곡 16%, 자체 전환음 3곳, ElevenLabs Roger 내레이션. 기존 고양 기사/사진 및 Pixabay 원본 링크와 라이선스 동일.

- 공개 데모 docs/demo.mp4 (한국어 16.6초), docs/demo-en.mp4 (영어 19.0초): salsa 16%, 자체 전환 효과음, ElevenLabs Roger. Pixabay 원본/라이선스 동일. 비상업적 해커톤 시연. 상세 기사/사진/음성 출처 docs/demo-credits.md.
