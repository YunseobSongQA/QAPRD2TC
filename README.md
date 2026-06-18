# QAPRD2TC — 기획서(PRD) → 테스트 케이스(TC) 자동 생성기

QA 업무 효율 향상을 위해, **기획서를 붙여넣으면 표준 QA 양식의 테스트 케이스를 자동 생성**해 주는 정적 웹 도구입니다.
서버·DB 없이 브라우저에서 바로 동작하며, 입력 데이터는 외부로 전송되지 않습니다.

## ✨ 주요 기능

- **파일 드래그앤드롭** — PPT(.pptx) · 워드(.docx) · 엑셀(.xlsx/.xls) · CSV · 텍스트 파일을 끌어다 놓으면 내용 자동 추출 후 변환
- 기획서(PRD) 텍스트 직접 입력 → 테스트 케이스(TC) 자동 변환
- 주요 기능 자동 인식: 로그인 · 회원가입 · 검색 · 결제 · 장바구니 · 업로드 · 권한 등
- **정상 / 예외 / 경계** 케이스 자동 구성
- 표준 QA 양식 컬럼: `TC ID · 대분류 · 중분류 · 시나리오 · 사전조건 · 테스트 단계 · 기대결과 · 우선순위 · 유형`
- **엑셀(.xlsx)** · CSV · Markdown 내보내기, 클립보드 복사
- 예시 기획서 제공(로그인/쇼핑몰/게시판)

## 🚀 사용법

1. 화면 왼쪽에 기획서 내용을 붙여넣습니다. (제목 `#`, 번호 `1.`, 항목 `-` 로 구조화하면 더 정확합니다)
2. **🚀 테스트 케이스 변환** 버튼을 누릅니다. (`Ctrl/⌘ + Enter`)
3. 결과 표를 검토·보완한 뒤 CSV 또는 Markdown으로 내보냅니다.

> 자동 생성 결과는 **초안**입니다. 실제 적용 전 QA 담당자의 검토를 권장합니다.

## 🛠 기술 구성

| 구분 | 내용 |
|------|------|
| 프론트엔드 | 순수 HTML / CSS / Vanilla JavaScript (빌드 도구 불필요) |
| 변환 엔진 | 규칙 기반 파서 (`assets/js/generator.js`) |
| 파일 파싱 | [JSZip](https://stuk.github.io/jszip/)(PPTX/DOCX 압축 해제) + [SheetJS](https://sheetjs.com/)(엑셀 읽기/쓰기) — 저장소에 self-host (`assets/vendor/`) |
| 배포 | **Cloudflare Pages** ([qaprd2tc.pages.dev](https://qaprd2tc.pages.dev/)) · GitHub Pages 워크플로우도 포함 |
| 보안 CI/CD | CodeQL(코드 취약점) + Gitleaks(시크릿 스캔) — 매 push/PR 자동 실행 |

## 📁 폴더 구조

```
QAPRD2TC/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  ├─ js/
│  │  ├─ generator.js   # 기획서 → TC 변환 규칙 엔진
│  │  ├─ fileparser.js  # PPTX/DOCX/XLSX/CSV/TXT → 텍스트 추출
│  │  ├─ export.js      # 엑셀(xlsx) / CSV / Markdown 내보내기
│  │  ├─ samples.js     # 예시 기획서
│  │  └─ app.js         # 화면 ↔ 엔진 연결 (드래그앤드롭 포함)
│  └─ vendor/           # JSZip, SheetJS (self-host)
└─ .github/workflows/
   ├─ security.yml      # CodeQL + Gitleaks
   └─ deploy.yml        # GitHub Pages 배포
```

## 💻 로컬에서 실행

빌드가 필요 없습니다. 정적 서버로 열면 됩니다.

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## 🌿 브랜치 전략

- `main` : 배포 브랜치 (GitHub Pages 자동 배포)
- `dev`  : 개발 브랜치
- 첫 초안은 `main`에 직접 반영했고, 이후 기능은 `dev` → `main` PR로 진행합니다.

## 🗺 로드맵

- [x] **Phase 1** — 규칙 기반 TC 생성 · UI · 내보내기 · 보안 CI/CD · 배포
- [x] **Phase 1.5** — 파일 드래그앤드롭(PPTX/DOCX/XLSX/CSV) 업로드 · 엑셀(.xlsx) 추출
- [ ] **Phase 2** — AI 모드(본인 Anthropic API 키로 Claude 호출, 더 정교한 TC 생성)
- [ ] TC 항목 직접 편집/추가 기능
- [ ] (필요 시) Supabase 연동으로 TC 세트 저장/공유
