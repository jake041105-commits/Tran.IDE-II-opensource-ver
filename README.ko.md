[English](README.md) | **한국어**

# Tran.IDE II (v0.12)

> **🄯 (c)카피레프트 Copyleft — Tran.IDE | a Bakk jaejin production**  
> **1:1 양방향 자연어 ↔ 코드 통합 개발 환경 (Bidirectional 1:1 Natural Language ↔ Code IDE)**

---

## 개요 (Overview)

**Tran.IDE II**는 기존 프로그래밍 언어의 원문 코드(RAW Code)를 영어 자연어(`EN Natural`) 및 한국어(`KO Korean`)와 **1:1 배타적 매핑**으로 상호 변환하며 편집·실행·오류 진단할 수 있는 데스크톱 IDE입니다.

코드의 기호(`()`, `{}`, `:`, `;`)나 영문 키워드를 외우지 않아도 자연어 어순으로 코드를 작성하고, 반대로 기존 소스 코드를 불러와 자연어 문장 요약으로 해석할 수 있습니다.

---

## 주요 기능 (Key Features)

- **3단 표시/편집 모드 (`RAW Code` / `EN Natural` / `KO Korean`)**:
  - 주석과 문자열 리터럴을 보호하면서 키워드 및 식별자를 자연어로 마스킹/역컴파일하고, 자연어 입력을 원문 코드로 컴파일합니다.
- **7개 언어 실행 & 자연어 줄 에러 진단 (7-Language Runner & Error Highlighting)**:
  - Python, JavaScript, TypeScript(오프라인 내장 `tsWorker.js`), C, Java, Kotlin, Swift 실행을 지원합니다.
  - 컴파일/런타임 오류 발생 시 원문 줄 번호를 자연어 에디터 줄로 역매핑하여 **빨간 에러 하이라이트와 한국어/영어 원인 요약**을 바로 표시합니다.
- **배타적 1:1 매칭 사전 (`매칭사전`) & 빠른 코드 검색 (`Quick Code Search`)**:
  - 각 코드 토큰당 고유한 대표 자연어 및 배타적 동의어 묶음을 제공합니다.
- **문장 코딩 & 코드 요약 (`Sentence Composer & Code Summarizer`)**:
  - 값 담기, 조건문(`만약 ~이면`), 연속 파이프라인(`골라서 정렬하고 파일저장`), 반복문(`하나씩`, `N번 반복`, `동안`) 등 한국어/영어 어순 문장으로 코드를 생성하고 코드 줄을 자연어로 요약합니다.
- **오프라인 품사 태깅 어휘 DB (`dicts/vocab_ko.json`, `dicts/vocab_en.json`)**:
  - 네트워크 연결 없이도 로컬에서 자연어-코드 검증 및 자동완성을 수행합니다.

---

## 설치 및 실행 (Installation & Usage)

### 방법 1. 일반 사용자 — 인스톨러(`Setup.exe`)로 간편 설치 (권장)
별도 환경 설정 없이 한 번에 설치하고 `Tran.IDE II.exe`로 바로 실행할 수 있습니다.
1. GitHub **Releases** 페이지에서 **`Tran.IDE_II_v0.12_Setup.exe`**(또는 무설치 `Tran.IDE_II_v0.12_Portable.zip`)를 다운로드합니다.
2. 설치 마법사를 실행하면 **Python, Node.js(JS/TS), TinyCC(C), OpenJDK(Java), Kotlin, WebView2** 런타임이 함께 구성됩니다.
3. (선택) Swift 실행이 필요한 경우 설치 단계의 **"Install Swift for Windows toolchain via winget"** 체크박스를 선택하거나 별도로 Swift for Windows를 설치합니다.

### 방법 2. 개발자 / 소스 클론 바로 실행 (`run_tran_ide.bat`)
1. 저장소를 내려받습니다.
2. **`run_tran_ide.bat`** 파일을 더블클릭하면 최초 1회 `.venv` 생성 및 `requirements.txt` 패키지 설치 후 자동으로 `Tran.IDE II`가 실행됩니다.
   *(또는 수동 실행: `python -m venv .venv` → `.venv\Scripts\activate` → `pip install -r requirements.txt` → `python main.py`)*

### 방법 3. 인스톨러 & 실행 파일(`.exe`) 직접 빌드
Windows 환경에서 **`build_installer.bat`** 을 더블클릭하거나 아래 명령어를 실행하면 `dist/` 폴더에 **`Tran.IDE_II_v0.12_Setup.exe`** 와 **`Tran.IDE_II_v0.12_Portable.zip`** 이 자동 생성됩니다.

```bash
# 전체 포터블 런타임(Python, Node.js, TinyCC, OpenJDK, Kotlin) 포함 인스톨러 빌드
python scripts/build_installer.py

# Python 전용 경량 인스톨러 빌드
python scripts/build_installer.py --lite

# 현재 소스와 함께 쓸 Tran.IDE II.exe 런처만 컴파일
python scripts/build_installer.py --launcher-only
```

---

## 프로젝트 구조 (Project Structure)

```text
.
├── main.py                        # pywebview 브릿지 API, 7개 언어 실행기 & 에러 진단, 앱 진입점
├── dict_manager.py                # 언어 카트리지 및 1:1 양방향 사전 로더
├── run_tran_ide.bat               # Windows 원클릭 자동 세팅 & 실행 런처
├── build_installer.bat            # Windows 원클릭 인스톨러(.exe / Setup.exe) 빌더 실행기
├── requirements.txt               # Python 의존성 목록
├── LICENSE                        # GNU Affero General Public License v3.0 (AGPL-3.0)
├── NOTICE                         # 저작권, 카피레프트 고지 및 서드파티 라이선스 안내
├── CONTRIBUTING.md                # 기여 가이드
├── README.md                      # 영문 README (기본)
├── README.ko.md                   # 한국어 README
├── scripts/
│   └── build_installer.py         # 포터블 런타임 내장 인스톨러 & Tran.IDE II.exe 자동 빌더
├── installer/
│   ├── launcher.cs                # 네이티브 Windows 실행 런처 (Tran.IDE II.exe)
│   └── TranIDE2.iss               # Inno Setup 인스톨러 스크립트
├── .github/workflows/
│   └── release.yml                # GitHub Actions 자동 빌드 및 Releases 배포 워크플로우
├── ui/                            # 프론트엔드 UI (index.html, app.js, style.css, Monaco Editor)
└── dicts/                         # 7개 언어 카트리지 및 오프라인 KO/EN 어휘 DB
```

---

## 라이선스 (License)

이 프로젝트는 **GNU Affero General Public License v3.0 (AGPL-3.0-or-later)** 라이선스 하에 배포됩니다.  
자세한 조건은 [LICENSE](LICENSE) 및 [NOTICE](NOTICE) 파일을 참고하세요.

```text
🄯 (c)카피레프트 Copyleft — Tran.IDE
Copyright (C) 2026 Bakk jaejin (a Bakk jaejin production)
```
