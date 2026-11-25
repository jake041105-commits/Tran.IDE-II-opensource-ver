/* ============================================================================
 *   🄯 (c)카피레프트 Copyleft — Tran.IDE
 *   a Bakk jaejin production
 *   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
 * ============================================================================ */

/**
 * Tran.IDE Foundation Engine (app.js)
 * - Engine 1: Context-Aware 2-Layer Masking Engine (RAW Code -> Natural Word Overlay)
 * - Engine 2: Single-Pass Atomic Bidirectional Input Engine (Natural Word -> RAW Code)
 * - Multi-language cartridge switcher (Python, JavaScript, Kotlin, Swift)
 */

const SAMPLE_SNIPPETS = {
  python: [
    "# [Python 테스트] 주석이나 문자열(\"def\", \"print\") 안의 단어는 번역되지 않고 보호됩니다.",
    "def check_status(score):",
    "    if score >= 80:",
    "        print(\"Pass: def print are safe inside strings\")",
    "        return True",
    "    else:",
    "        print(\"Retry\")",
    "        return False",
    "",
    "print(check_status(95))",
    "# 아래 빈 줄에 한글로 '정의' 또는 '출력'을 치고 스페이스바나 '('를 눌러보세요!",
    ""
  ].join("\n"),

  javascript: [
    "// [JavaScript 테스트] 아래에 '함수', '상수', '만약' 등을 입력해 보세요.",
    "function evaluateScore(score) {",
    "    const passCut = 80;",
    "    if (score >= passCut) {",
    "        console.log(\"Passed!\");",
    "        return true;",
    "    } else {",
    "        return false;",
    "    }",
    "}",
    ""
  ].join("\n"),

  typescript: [
    "// [TypeScript 테스트] 아래에 '함수', '상수', '만약' 등을 입력하거나 실행해 보세요.",
    "interface Student {",
    "    name: string;",
    "    score: number;",
    "}",
    "",
    "function judge(st: Student): boolean {",
    "    if (st.score >= 80) {",
    "        console.log(\"합격\");",
    "        return true;",
    "    } else {",
    "        console.log(\"불합격\");",
    "        return false;",
    "    }",
    "}",
    "",
    "console.log(judge({ name: \"지민\", score: 95 }));",
    ""
  ].join("\n"),

  kotlin: [
    "// [Kotlin 테스트] 아래에 '함수', '고정값', '줄출력' 등을 입력해 보세요.",
    "fun checkScore(score: Int): Boolean {",
    "    val limit = 80",
    "    if (score >= limit) {",
    "        println(\"Kotlin Success\")",
    "        return true",
    "    } else {",
    "        return false",
    "    }",
    "}",
    ""
  ].join("\n"),

  swift: [
    "// [Swift / Xcode 테스트] 아래에 '함수', '방어', '상수', '출력' 등을 입력해 보세요.",
    "func verifyUser(age: Int) -> Bool {",
    "    let minAge = 20",
    "    guard age >= minAge else {",
    "        print(\"Access Denied\")",
    "        return false",
    "    }",
    "    print(\"Welcome!\")",
    "    return true",
    "}",
    ""
  ].join("\n"),

  c: [
    "// [C 언어 테스트] 아래에 '서식출력', '서식입력', '동적메모리할당' 등을 입력해 보세요.",
    "#include <stdio.h>",
    "",
    "int main(void) {",
    "    int age = 20;",
    '    printf("Tran.IDE C Environment: age=%d\\n", age);',
    "    return 0;",
    "}",
    ""
  ].join("\n"),

  java: [
    "// [Java 언어 테스트] 아래에 '공개접근지정자', '줄바꿈출력' 등을 입력해 보세요.",
    "public class Main {",
    "    public static void main(String[] args) {",
    '        System.out.println("Tran.IDE Java Environment");',
    "    }",
    "}",
    ""
  ].join("\n")
};

function isJsLikeLang(lang) {
  const l = String(lang || "").toLowerCase();
  return l === "javascript" || l === "typescript";
}

function codegenLang(lang) {
  const l = String(lang || "python").toLowerCase();
  return l === "typescript" ? "javascript" : l;
}

// State
window.editor = null;
window.currentLang = "python";
window.displayMode = "ko"; // 'raw' | 'en' | 'ko'
window.uiLang = "en"; // Default UI interface language: English ('en' | 'ko')
window.activeDecorations = [];
window.tabs = [];
window.activeTabId = null;
let editor = null;
let currentLang = "python";
let displayMode = "ko"; // 'raw' | 'en' | 'ko'
let targetLocale = "ko";
let uiLang = "en";
let activeDecorations = [];
let runtimeErrorDecorations = [];
let currentRuntimeStatus = null;
let isInternalReplacement = false;
let isSwitchingTab = false;
let completionDisposable = null;
let completionIndex = [];
const hoverMdCache = new Map();
let tabs = [];
let activeTabId = null;
let draggedTabId = null;
const SESSION_STORAGE_KEY = "tran_ide2_workspace_session_v01";
const USER_LEARNED_STORAGE_KEY = "tran_ide2_learned_mappings_v1";
let showInlineSentenceSummary = true;
let semanticInvertedIndex = new Map();
let semanticIndexBuiltFromGlobal = false;
let allCartridgesViaBridgeLoaded = false;
let allCartridgesLoadingPromise = null;
let vocabLexicon = { ko: null, en: null, koMeta: null, enMeta: null };
let vocabLexiconLoading = { ko: null, en: null };
let currentRawLineMap = new Map(); // 1-based editor lineNumber -> { rawLine, isRawKept, ok, unknownWords }
let currentNaturalDiagnostics = []; // { lineNumber, startCol, endCol, word, message }
let userLearnedMappings = {
  global: {},
  python: {},
  javascript: {},
  kotlin: {},
  swift: {},
  c: {},
  java: {}
};
let completionCommandRegistered = false;

const UI_I18N = {
  en: {
    btn_open: "Open",
    btn_save: "Save",
    label_cartridge: "Code Language",
    mode_raw: "RAW Code",
    mode_en: "EN Natural",
    mode_ko: "KO Korean",
    status_valid: "1:1 Valid",
    status_conflict: "Conflict",
    btn_run: "Run (Python)",
    pane_raw_title: "Raw Code Buffer",
    pane_raw_badge: "IDE Compatible",
    pane_dict_title: "1:1 Dictionary Cartridge",
    th_raw: "Code (RAW)",
    th_en: "Canonical EN & Synonyms",
    th_target: "Canonical KO & Synonyms",
    th_en_canonical: "Canonical EN Word",
    th_ko_canonical: "Canonical Target Word",
    pane_console_title: "Output & Engine Log (Bidirectional Trace)",
    btn_clear_log: "Clear Log",
    ui_modal_title: "Interface Language (UI)",
    ui_modal_desc: "Select the display language for menus, buttons, and panels in Tran.IDE.",
    locale_modal_title: "Target Translation Language Plugin",
    locale_modal_desc: "Select the target natural language pack for 1:1 code translation. External language plugins appear here automatically.",
    locale_ko_meta: "Built-in 1:1 Translation Cartridge",
    locale_none_name: "None (English Only)",
    locale_none_meta: "Disable 2nd translation (1st-stage EN natural mode only)",
    locale_plugin_slot: "+ External Language Plugin Slot (Ready for future language packs)",
    status_active: "Active",
    status_select: "Select",
    btn_confirm: "Confirm",
    words_unit: "Words (1:1)",
    ui_btn_prefix: "UI",
    target_btn_prefix: "Target",
    slot1_search_title: "Quick Code Search",
    slot1_search_placeholder: "Search Code / EN / Target instantly...",
    btn_search_more: "Show More (Go to Matching Dictionary) →",
    slot2_raw_btn: "View Raw Code",
    slot2_raw_sub: "Open Full-Screen Raw Code Buffer",
    slot3_dict_btn: "Matching Dictionary",
    slot3_dict_sub: "Exclusive 1:N Natural Word Bundles & Grammar",
    slot4_editor_btn: "Dictionary Editor Tool",
    slot4_editor_sub: "Manage mappings & multi-language packs",
    slot4_editor_badge: "Studio",
    btn_back: "Back",
    btn_copy_raw: "Copy Raw Code",
    dict_fullscreen_title: "Tran.IDE Matching Dictionary (1:N Exclusive Bundles & Grammar)",
    dict_search_placeholder: "Search in Dictionary (RAW / EN / Description)...",
    dict_lang_all: "All Languages",
    dict_sort_label: "Sort By:",
    dict_sort_rel: "Relevance",
    dict_sort_abc: "ABC Order",
    dict_sort_ganada: "Natural Order",
    dict_sort_role: "By Code Role",
    th_lang: "Language",
    th_role: "Code Role",
    th_syntax: "Syntax Pattern",
    th_desc: "Description & Usage (Click Row)",
    word_usage_title: "Word Role & How to Use",
    word_synonyms_title: "Exclusive Natural Synonym Bundle (Auto-unified to canonical word on input)",
    word_desc_title: "What This Code Does",
    word_natural_grammar_title: "Natural Input Grammar & Word-Order Example",
    word_where_title: "Where & How Is It Used?",
    word_syntax_title: "Syntax Pattern (Brackets, Quotes & Symbols)",
    word_inside_title: "What Goes Inside Parentheses or Blocks",
    word_result_title: "What Happens After (Result)",
    word_example_title: "Real-World Example & 1:1 Bidirectional Mapping",
    word_tip_title: "Tran.IDE Editor Input Tip",
    example_head_raw: "RAW Code (Saved on Disk)",
    example_head_en: "Stage 1: EN Natural Mode Display/Input",
    example_head_ko: "Stage 2: Target Natural Mode Display/Input",
    dict_editor_title: "Matching Dictionary Editor Studio (1:1 Multi-Language Mapper)",
    editor_status_valid: "1:1 Valid (0 Conflicts)",
    btn_add_word: "+ Add Word Mapping",
    btn_save_dict: "Save Dictionary Changes",
    editor_scope_label: "Target Cartridge",
    editor_scope_common: "Works Everywhere (common.json)",
    editor_locale_label: "Target Language Code",
    editor_filter_placeholder: "Filter words to edit (Code / EN / Target / Role)...",
    new_word_code_ph: "Raw Code (e.g. myFunc)",
    new_word_en_ph: "Stage 1 EN Natural (e.g. my_custom_function)",
    new_word_target_ph: "Stage 2 Target Natural",
    new_word_cat_ph: "Word Group (e.g. Helper Command)",
    new_word_desc_ph: "Description & usage summary",
    btn_confirm_add: "Add Mapping",
    btn_cancel_add: "Cancel",
    th_editor_desc: "Syntax & Usage Summary",
    th_editor_action: "Manage",
    slot5_sentence_btn: "Sentence Composer & Summary",
    slot5_sentence_sub: "Write EN/KO sentences -> code & read code summaries",
    slot5_sentence_badge: "v0.12",
    sentence_studio_title: "Natural Word-Order Composer & Code Sentence Summarizer",
    btn_inline_summary_on: "Inline Compile Preview: ON",
    btn_inline_summary_off: "Inline Compile Preview: OFF",
    sentence_composer_heading: "1. Natural Word-Order -> Code Auto-Complete (KO / EN)",
    sentence_composer_desc: "Type plain English or Korean sentences without memorizing (), \"\", :, {} symbols. Supports 4 patterns across all 6 languages.",
    btn_insert_code: "Insert Into Editor",
    learned_mappings_title: "My Learned Word Mappings (Always Ranked #1)",
    btn_clear_learned: "Reset Learned",
    sentence_summary_heading: "2. Current Code -> Plain Korean Sentence Summary",
    sentence_summary_desc: "Summarizes code chunks (condition, filter, sort, loop, save, print) into natural Korean sentences."
  },
  ko: {
    btn_open: "열기",
    btn_save: "저장",
    label_cartridge: "코드의 언어",
    mode_raw: "RAW 원문",
    mode_en: "EN 원어 자연어",
    mode_ko: "KO 한국어 자연어",
    status_valid: "1:1 무결성 정상",
    status_conflict: "중복 충돌",
    btn_run: "실행 (Python)",
    pane_raw_title: "실제 저장되는 원문 코드 (Raw Buffer)",
    pane_raw_badge: "외부 IDE 호환",
    pane_dict_title: "로드된 1:1 사전 카트리지",
    th_raw: "코드 원문",
    th_en: "대표 영어 (EN) & 동의어",
    th_target: "대표 한국어 & 동의어 묶음",
    th_en_canonical: "일정 영어 대표 단어",
    th_ko_canonical: "일정 한국어 대표 단어",
    pane_console_title: "실행 결과 & 엔진 로그 (쌍방향 변환 기록)",
    btn_clear_log: "로그 지우기",
    ui_modal_title: "인터페이스 언어 (UI 설정)",
    ui_modal_desc: "Tran.IDE의 메뉴, 버튼, 패널에 표시될 인터페이스 언어를 선택합니다.",
    locale_modal_title: "최종 번역 언어 (언어 플러그인) 설정",
    locale_modal_desc: "원어 자연어(EN)를 거쳐 최종적으로 변환될 자연어 언어 팩을 선택합니다. 외부 언어 플러그인을 추가하면 아래 목록에 자동으로 등록됩니다.",
    locale_ko_meta: "기본 탑재 1:1 번역 사전 플러그인",
    locale_none_name: "사용 안 함 (None · English Only)",
    locale_none_meta: "2차 번역 끄기 (순수 영어권 / 1단계 EN만 사용)",
    locale_plugin_slot: "+ 추가 언어 플러그인 슬롯 (준비 중 — 추후 일본어/중국어 등 언어팩 확장 지원)",
    status_active: "선택됨",
    status_select: "선택",
    btn_confirm: "확인",
    words_unit: "단어 (1:1)",
    ui_btn_prefix: "언어",
    target_btn_prefix: "번역어",
    slot1_search_title: "빠른 코드 검색",
    slot1_search_placeholder: "코드 / 영어 / 한국어 즉시 검색...",
    btn_search_more: "더보기 (매칭사전으로 이동) →",
    slot2_raw_btn: "코드 원문보기",
    slot2_raw_sub: "실제 저장되는 원문 코드(Raw Buffer) 전체화면 보기",
    slot3_dict_btn: "매칭사전",
    slot3_dict_sub: "코드별 배타적 자연어 묶음 & 입력 문법·사용법 사전",
    slot4_editor_btn: "매칭 사전 편집 툴",
    slot4_editor_sub: "코드-자연어 매칭 관리 및 다국어 사전 편집",
    slot4_editor_badge: "편집 스튜디오",
    btn_back: "뒤로가기",
    btn_copy_raw: "원문 복사",
    dict_fullscreen_title: "Tran.IDE 통합 매칭사전 (코드별 배타적 자연어 묶음)",
    dict_search_placeholder: "매칭사전 내 검색 (코드 원문 / 영어 자연어 / 한국어 자연어 / 설명)...",
    dict_lang_all: "전체 (All)",
    dict_sort_label: "인덱싱 정렬:",
    dict_sort_rel: "관련도순",
    dict_sort_abc: "ABC순",
    dict_sort_ganada: "가나다순",
    dict_sort_role: "코드 역할순",
    th_lang: "언어",
    th_role: "코드 역할",
    th_syntax: "자연어 입력 문법",
    th_desc: "설명 (클릭하여 상세 보기)",
    word_usage_title: "단어 역할 및 사용 방법",
    word_synonyms_title: "이 코드만 가리키는 배타적 자연어 동의어 묶음 (입력 시 대표 단어로 자동 통일)",
    word_desc_title: "이 코드가 하는 일",
    word_natural_grammar_title: "자연어 입력 문법 & 어순 예시",
    word_where_title: "어디에 어떻게 쓰이나요?",
    word_syntax_title: "문법 형식 (괄호, 따옴표, 기호 조합)",
    word_inside_title: "괄호나 블록 안에 들어가는 내용",
    word_result_title: "실행 결과 (이걸 쓰면 나오는 결과)",
    word_example_title: "실전 사용 예제 & 3단계 1:1 매칭",
    word_tip_title: "Tran.IDE 에디터 입력 팁",
    example_head_raw: "RAW 원문 코드 (실제 파일 저장 코드)",
    example_head_en: "1단계 EN 원어 자연어 모드 표시/입력",
    example_head_ko: "2단계 KO 한국어 자연어 모드 표시/입력",
    dict_editor_title: "매칭 사전 편집 툴 (1:1 카트리지 & 다국어 매칭 스튜디오)",
    editor_status_valid: "1:1 무결성 정상 (중복 0건)",
    btn_add_word: "+ 새 단어 매칭 추가",
    btn_save_dict: "사전 변경사항 저장",
    editor_scope_label: "편집할 사전 카트리지",
    editor_scope_common: "모든 언어 공통 말 (common.json)",
    editor_locale_label: "매칭 대상 언어 코드",
    editor_filter_placeholder: "편집할 단어 필터링 (코드 / EN / 번역어 / 역할)...",
    new_word_code_ph: "코드 원문 (예: myFunc)",
    new_word_en_ph: "1단계 영어 자연어 (예: my_custom_function)",
    new_word_target_ph: "2단계 번역 자연어 (예: 내일꾼명령)",
    new_word_cat_ph: "무슨 역할인가요? (예: 바로 쓰는 일꾼 명령)",
    new_word_desc_ph: "단어 설명 및 사용법 요약",
    btn_confirm_add: "추가 반영",
    btn_cancel_add: "취소",
    th_editor_desc: "기본 문법 및 사용법 요약",
    th_editor_action: "관리",
    slot5_sentence_btn: "문장 코딩 & 코드 요약",
    slot5_sentence_sub: "어순 문장으로 코드 생성 & 코드 줄별 문장 해석",
    slot5_sentence_badge: "v0.12",
    sentence_studio_title: "자연어 어순 조합기 & 기존 코드 문장 요약기",
    btn_inline_summary_on: "에디터 줄 끝 변환 미리보기: ON",
    btn_inline_summary_off: "에디터 줄 끝 변환 미리보기: OFF",
    sentence_composer_heading: "1. 기호 암기 없는 자연어 어순 → 코드 자동완성 (한국어 / English)",
    sentence_composer_desc: "괄호(), 따옴표\"\", 콜론:, 중괄호{}를 몰라도 아래 예시 버튼을 누르거나 DB 등록 자연어로 문장을 적으면 현재 선택된 언어 코드로 완성됩니다.",
    btn_insert_code: "에디터에 코드 넣기",
    learned_mappings_title: "내가 선택해 학습된 개인화 추천 단어 (항상 1순위 적용)",
    btn_clear_learned: "학습 초기화",
    sentence_summary_heading: "2. 현재 코드 → 자연어 문장 요약 표시",
    sentence_summary_desc: "코드를 단어 하나씩 끊어 읽지 않고 조건·필터·정렬·반복·파일저장·출력 덩어리를 파악해 자연스러운 한국어 어순으로 풀어 설명합니다."
  }
};

let currentOverlayItem = null;

function updateRunButtonLabel() {
  const btn = document.getElementById("btn-run");
  const labelEl =
    document.getElementById("btn-run-label") ||
    document.querySelector("#btn-run span[data-i18n='btn_run']");
  if (!labelEl) return;
  const langKey = String(currentLang || "python").toLowerCase();
  const langName =
    typeof SCOPE_LABELS !== "undefined" && SCOPE_LABELS[langKey]
      ? SCOPE_LABELS[langKey]
      : langKey.toUpperCase();
  labelEl.textContent = uiLang === "ko" ? `실행 (${langName})` : `Run (${langName})`;
  if (btn) {
    const ready = currentRuntimeStatus ? currentRuntimeStatus[langKey] : null;
    if (ready === true) {
      btn.title = uiLang === "ko" ? `${langName} 실행 가능 (F5)` : `Run ${langName} — Runtime Ready (F5)`;
      btn.classList.remove("runtime-missing");
    } else if (ready === false) {
      btn.title = uiLang === "ko" ? `${langName} 런타임 미감지 (클릭 시 안내) (F5)` : `${langName} runtime not detected (F5)`;
      btn.classList.add("runtime-missing");
    } else {
      btn.title = uiLang === "ko" ? `코드 실행 (${langName}) (F5)` : `Run Code (${langName}) (F5)`;
      btn.classList.remove("runtime-missing");
    }
  }
}

async function refreshRuntimeStatus() {
  if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api.get_runtime_status !== "function") {
    return null;
  }
  try {
    currentRuntimeStatus = await window.pywebview.api.get_runtime_status();
    updateRunButtonLabel();
    return currentRuntimeStatus;
  } catch (_) {
    return null;
  }
}

function applyUiLanguage(lang, persist = false) {
  uiLang = lang === "ko" ? "ko" : "en";
  window.uiLang = uiLang;
  document.body.classList.toggle("ui-lang-en", uiLang === "en");
  hoverMdCache.clear();
  if (uiLang === "en" && displayMode === "ko") {
    if (editor && typeof switchDisplayMode === "function") {
      switchDisplayMode("en", false);
    } else {
      displayMode = "en";
      window.displayMode = displayMode;
      document.querySelectorAll(".mode-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-mode") === "en");
      });
    }
  }
  if (uiLang === "en" && dictBrowserState && dictBrowserState.sort === "ganada") {
    dictBrowserState.sort = "abc";
  }
  const dict = UI_I18N[uiLang];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) {
      el.setAttribute("placeholder", dict[key]);
    }
  });

  const uiBtnLabel = document.getElementById("ui-lang-btn-label");
  if (uiBtnLabel) {
    uiBtnLabel.textContent = `${dict.ui_btn_prefix}: ${uiLang.toUpperCase()}`;
  }

  const localeBtnLabel = document.getElementById("locale-btn-label");
  if (localeBtnLabel) {
    localeBtnLabel.textContent = `${dict.target_btn_prefix}: ${targetLocale.toUpperCase()}`;
  }

  document.querySelectorAll("#ui-lang-list .locale-item").forEach((item) => {
    const itemLang = item.getAttribute("data-ui-lang");
    const isAct = itemLang === uiLang;
    item.classList.toggle("active", isAct);
    const pill = item.querySelector(".ui-lang-pill");
    if (pill) {
      pill.textContent = isAct ? dict.status_active : dict.status_select;
      pill.className = `status-pill ui-lang-pill${isAct ? " valid" : ""}`;
    }
  });

  document.querySelectorAll("#locale-plugin-list .locale-item").forEach((item) => {
    const itemLoc = item.getAttribute("data-locale");
    const isAct = itemLoc === targetLocale;
    item.classList.toggle("active", isAct);
    const pill = item.querySelector(".locale-pill");
    if (pill) {
      pill.textContent = isAct ? dict.status_active : dict.status_select;
      pill.className = `status-pill locale-pill${isAct ? " valid" : ""}`;
    }
  });

  renderDictionaryStatus();
  updateRunButtonLabel();

  if (editor) {
    updateMasks();
    registerDictionaryCompletions();
    registerDictionaryHover();
    updateLangMatchDot();
  }

  if (persist) {
    saveWorkspaceState();
  }
}

async function setTargetLocale(newLocale) {
  targetLocale = newLocale || "ko";
  window.targetLocale = targetLocale;

  const forceEnFromKo = targetLocale === "none" && displayMode === "ko";
  if (targetLocale === "none") {
    document.body.classList.add("locale-none");
  } else {
    document.body.classList.remove("locale-none");
  }

  const dict = UI_I18N[uiLang] || UI_I18N.en;
  const localeBtnLabel = document.getElementById("locale-btn-label");
  if (localeBtnLabel) {
    localeBtnLabel.textContent = `${dict.target_btn_prefix}: ${targetLocale.toUpperCase()}`;
  }

  document.querySelectorAll("#locale-plugin-list .locale-item").forEach((item) => {
    const itemLoc = item.getAttribute("data-locale");
    const isAct = itemLoc === targetLocale;
    item.classList.toggle("active", isAct);
    const pill = item.querySelector(".locale-pill");
    if (pill) {
      pill.textContent = isAct ? dict.status_active : dict.status_select;
      pill.className = `status-pill locale-pill${isAct ? " valid" : ""}`;
    }
  });

  await loadLanguageCartridge(currentLang);
  rebuildFlatGlobalEntries();
  if (forceEnFromKo) {
    await switchDisplayMode("en", false);
  } else {
    if ((displayMode === "ko" || displayMode === "en") && editor) {
      const activeTab = getActiveTab();
      if (activeTab && !activeTab.userEditedNatural) {
        activeTab.naturalCache = {};
        activeTab.naturalCompiledSig = {};
        activeTab.dualBaseline = {};
        isSwitchingTab = true;
        try {
          editor.setValue(getEditorBufferForMode(activeTab, displayMode));
          adoptEditorNaturalCache(activeTab, displayMode);
        } finally {
          isSwitchingTab = false;
        }
      }
    }
    if (editor) {
      registerDictionaryCompletions();
      registerDictionaryHover();
    }
    refreshAllViews();
  }
  saveWorkspaceState();
  logConsole(
    targetLocale === "none"
      ? (uiLang === "ko" ? "2차 번역 목적어 비활성화 (영어 1단계 모드 전용)" : "2nd Target Translation disabled (1st-stage EN mode only)")
      : (uiLang === "ko" ? `번역 대상 언어 변경: ${targetLocale.toUpperCase()}` : `Target translation language switched: ${targetLocale.toUpperCase()}`)
  );
}

// Loaded 1:1 Dictionary State
let dictPack = {
  language: "python",
  is_valid_1to1: true,
  conflicts: [],
  entries: {},
  maps: {
    code_to_en: {},
    code_to_ko: {},
    en_to_code: {},
    ko_to_code: {}
  }
};

// Utility Logger
function logConsole(msg, type = "info") {
  const out = document.getElementById("console-output");
  if (!out) return;
  const time = new Date().toLocaleTimeString(uiLang === "ko" ? "ko-KR" : "en-US", { hour12: false });
  const prefix = type === "error" ? "[ERR]" : type === "conv" ? "[1:1]" : "[LOG]";
  out.textContent += `[${time}] ${prefix} ${msg}\n`;
  out.scrollTop = out.scrollHeight;
}

// Configure and load Monaco Editor (Offline first, CDN fallback)
function bootMonaco() {
  if (window.__MONACO_FALLBACK_CDN || typeof require === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js";
    script.onload = () => initMonacoWithBase("https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs");
    document.head.appendChild(script);
  } else {
    initMonacoWithBase("vendor/monaco-editor/min/vs");
  }
}

function configureMonacoNaturalWordPatterns() {
  if (!window.monaco || !monaco.languages) return;
  const naturalWordPattern = /[A-Za-z0-9_가-힣ㄱ-ㅎㅏ-ㅣ]+/g;
  ["plaintext", "python", "javascript", "typescript", "kotlin", "swift", "c", "java"].forEach((lang) => {
    try {
      monaco.languages.setLanguageConfiguration(lang, {
        wordPattern: naturalWordPattern
      });
    } catch (_) {}
  });
  if (monaco.languages.typescript && monaco.languages.typescript.javascriptDefaults) {
    try {
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        noLib: true,
        allowNonTsExtensions: true
      });
    } catch (_) {}
  }
  if (monaco.languages.typescript && monaco.languages.typescript.typescriptDefaults) {
    try {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        noLib: true,
        allowNonTsExtensions: true
      });
    } catch (_) {}
  }
}

function initMonacoWithBase(vsPath) {
  require.config({ paths: { vs: vsPath } });
  require(["vs/editor/editor.main"], async function () {
    configureMonacoNaturalWordPatterns();
    editor = monaco.editor.create(document.getElementById("editor-container"), {
      value: SAMPLE_SNIPPETS.python,
      language: "python",
      theme: "vs-dark",
      fontSize: 14,
      fontFamily: "Consolas, 'Pretendard', 'Malgun Gothic', monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      lineNumbersMinChars: 3,
      padding: { top: 12, bottom: 12 },
      wordBasedSuggestions: false,
      hover: { enabled: true, delay: 140, sticky: true },
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: {
        showWords: false,
        snippetsPreventQuickSuggestions: false,
        localityBonus: false
      },
      renderValidationDecorations: "off",
      overviewRulerLanes: 0,
      overviewRulerBorder: false
    });
    window.editor = editor;
    window.__bootStages = ["editor_created"];
    try {
      setupEditorEvents();
      window.__bootStages.push("setupEditorEvents");

      // Wait briefly for pywebview Python bridge methods when running inside Desktop WebView
      if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api.get_vocab_lexicon_raw !== "function") {
        await new Promise((resolve) => {
          let settled = false;
          const startedAt = Date.now();
          let iv = null;
          const finish = () => {
            if (settled) return;
            settled = true;
            if (iv) clearInterval(iv);
            resolve();
          };
          window.addEventListener("pywebviewready", finish, { once: true });
          iv = setInterval(() => {
            if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_vocab_lexicon_raw === "function") {
              finish();
            } else if (!window.pywebview && Date.now() - startedAt > 350) {
              finish();
            } else if (Date.now() - startedAt > 3000) {
              finish();
            }
          }, 25);
        });
      }
      window.__bootStages.push("bridge_ready");

      await Promise.all([
        loadUserLearnedMappings(),
        loadVocabLexicons(),
        loadAllRawCartridges().catch(() => {})
      ]);
      window.__bootStages.push("loaded_lexicons");
      window.__bootStages.push("loaded_all_cartridges");

      if (sessionRestorePromise) {
        await sessionRestorePromise;
      } else if (!backendSessionSynced) {
        await restoreWorkspaceState();
      }
      window.__bootStages.push("restored_workspace");

      applyUiLanguage(uiLang, false);
      window.__bootStages.push("applied_ui_lang");

      registerDictionaryCompletions();
      registerDictionaryHover();
      refreshAllViews();
      updateLangMatchDot();
      window.__bootStages.push("initialized_views");
      window.__tranIdeBooted = true;
      logConsole("Tran.IDE II v0.12 Engine initialized (Dual-Buffer Natural Editor + Offline POS Vocab DB).");
    } catch (bootErr) {
      window.__tranIdeBootError = String(bootErr && bootErr.stack ? bootErr.stack : bootErr);
      console.error("Tran.IDE II boot failed:", bootErr);
      if (typeof logConsole === "function") {
        logConsole("Boot error: " + window.__tranIdeBootError, "error");
      }
    }
  });
}

// Fetch 1:1 dictionary cartridge from Python backend (or fallback in browser test mode)
async function loadLanguageCartridge(lang) {
  currentLang = lang;
  if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_dictionary === "function") {
    dictPack = await window.pywebview.api.get_dictionary(lang, targetLocale);
  } else {
    // Fallback if opened directly in browser before pywebview ready
    const commonResp = await fetch(`../dicts/common.json`).then(r => r.json()).catch(() => ({ entries: {} }));
    const langResp = await fetch(`../dicts/${lang}.json`).then(r => r.json()).catch(() => ({ entries: {} }));
    const merged = Object.assign({}, commonResp.entries || {}, langResp.entries || {});
    dictPack = buildLocalPack(lang, merged);
  }

  if (dictPack && dictPack.entries) {
    initExclusiveBundleIndexes();
    registerCartridgeBundlesIntoIndex(dictPack.entries);
    if (!allCartridgesCache[lang] || !allCartridgesCache[lang].__rawScope) {
      allCartridgesCache[lang] = { scope: lang, entries: dictPack.entries };
    }
    rebuildFlatGlobalEntries();
    buildLanguageExclusivityIndex();
  }
  rebuildCompletionIndex();
  protectedIntervalCache.clear();
  renderDictionaryStatus();
  updateRunButtonLabel();
}

function buildLocalPack(lang, entries) {
  const code_to_en = {}, code_to_ko = {}, en_to_code = {}, ko_to_code = {};
  for (const [code, tr] of Object.entries(entries)) {
    if (tr.en) { code_to_en[code] = tr.en; en_to_code[tr.en] = code; }
    if (tr.ko) { code_to_ko[code] = tr.ko; ko_to_code[tr.ko] = code; }
  }
  return {
    language: lang,
    entry_count: Object.keys(entries).length,
    is_valid_1to1: true,
    conflicts: [],
    entries,
    maps: { code_to_en, code_to_ko, en_to_code, ko_to_code }
  };
}

let codeIdentToNatCache = { ko: null, en: null };

function updateQuickSearchTotalBadge() {
  const totalBadge = document.getElementById("quick-search-total-badge");
  if (!totalBadge) return;
  const koCount = vocabLexicon.ko ? Object.keys(vocabLexicon.ko).length : 0;
  const enCount = vocabLexicon.en ? Object.keys(vocabLexicon.en).length : 0;
  const total = koCount + enCount;
  if (total > 0) {
    totalBadge.textContent = `${total.toLocaleString()} Words`;
  } else {
    totalBadge.textContent = `${flatGlobalEntries.length.toLocaleString()} Words`;
  }
}

async function loadVocabLexicon(langCode = "ko") {
  const lang = langCode === "en" ? "en" : "ko";
  if (vocabLexicon[lang] && Object.keys(vocabLexicon[lang]).length > 0) return vocabLexicon[lang];
  if (vocabLexiconLoading[lang]) return vocabLexiconLoading[lang];

  vocabLexiconLoading[lang] = (async () => {
    let data = null;
    if (window.pywebview && window.pywebview.api && window.pywebview.api.get_vocab_lexicon_raw) {
      try {
        const rawRes = await window.pywebview.api.get_vocab_lexicon_raw(lang);
        const parsed = typeof rawRes === "string"
          ? JSON.parse(rawRes)
          : (rawRes && rawRes.raw_json ? JSON.parse(rawRes.raw_json) : null);
        if (parsed && parsed.entries) {
          data = { _meta: parsed._meta || (rawRes && rawRes.meta) || {}, entries: parsed.entries };
        }
      } catch (_) {}
    }
    if (!data) {
      try {
        const fetched = await fetch(`../dicts/vocab_${lang}.json`).then((r) => r.json());
        if (fetched && fetched.entries) {
          data = fetched;
        }
      } catch (_) {}
    }
    if (!data && window.pywebview && window.pywebview.api && window.pywebview.api.get_vocab_lexicon) {
      try {
        const res = await window.pywebview.api.get_vocab_lexicon(lang);
        if (res && res.ok && res.entries) {
          data = res;
        }
      } catch (_) {}
    }
    if (data && data.entries && Object.keys(data.entries).length > 0) {
      vocabLexicon[lang] = data.entries;
      vocabLexicon[lang + "Meta"] = data._meta || {};
      codeIdentToNatCache[lang] = null;
    }
    if (typeof window !== "undefined") {
      window.vocabLexicon = vocabLexicon;
    }
    updateQuickSearchTotalBadge();
    return vocabLexicon[lang] || {};
  })();

  try {
    return await vocabLexiconLoading[lang];
  } finally {
    vocabLexiconLoading[lang] = null;
  }
}

async function loadVocabLexicons() {
  await Promise.all([loadVocabLexicon("ko"), loadVocabLexicon("en")]);
}

function getVocabEntry(rawWord, mode = "ko") {
  const m = mode === "en" ? "en" : "ko";
  const lex = vocabLexicon[m];
  if (!lex) return null;
  const key = m === "en" ? String(rawWord || "").trim().toLowerCase() : String(rawWord || "").trim();
  if (!key || !Object.prototype.hasOwnProperty.call(lex, key)) return null;
  const arr = lex[key];
  if (!Array.isArray(arr)) return null;
  const meta = vocabLexicon[m + "Meta"];
  const posMap = (meta && meta.posMap) || {
    n: "noun", v: "verb", a: "adj", d: "adv",
    p: "particle", t: "article", r: "preposition", c: "conjunction", g: "grammar"
  };
  return {
    word: key,
    pos: posMap[arr[0]] || arr[0] || "noun",
    varIdent: arr[1] || "",
    codes: Array.isArray(arr[2]) ? arr[2] : []
  };
}
if (typeof window !== "undefined") {
  window.vocabLexicon = vocabLexicon;
  window.getVocabEntry = getVocabEntry;
  window.loadVocabLexicon = loadVocabLexicon;
}

function renderDictionaryStatus() {
  const pill = document.getElementById("dict-status");
  const countEl = document.getElementById("dict-count");
  const dict = UI_I18N[uiLang] || UI_I18N.en;
  if (countEl) {
    countEl.textContent = `${dictPack.entry_count || 0} ${dict.words_unit}`;
  }
  if (!pill) return;

  if (dictPack.is_valid_1to1) {
    pill.classList.add("hidden");
    pill.className = "status-pill valid hidden";
  } else {
    pill.classList.remove("hidden");
    pill.innerHTML = `<svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>${dict.status_conflict} (${dictPack.conflicts.length})</span>`;
    pill.className = "status-pill invalid";
    dictPack.conflicts.forEach(c => logConsole(c, "error"));
  }
}

function renderDictionaryTable() {
  const tbody = document.getElementById("dict-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const entries = dictPack.entries || {};
  for (const [code, tr] of Object.entries(entries)) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(code)}</td><td>${escapeHtml(tr.en || "")}</td><td>${escapeHtml(tr.ko || "")}</td>`;
    tbody.appendChild(row);
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ============================================================================
// ENGINE 1: Context-Aware 2-Layer Masking Engine (Code -> Natural Language)
// ============================================================================

function isProtectedTokenType(tokenType) {
  if (!tokenType) return false;
  const t = tokenType.toLowerCase();
  return (
    t.includes("comment") ||
    t.includes("string") ||
    t.includes("regexp")
  );
}

const protectedIntervalCache = new Map();
const PROTECTED_CACHE_MAX = 4000;

function getProtectedIntervalsForLine(lineText, languageId) {
  const cacheKey = languageId + "\u0000" + lineText;
  const hit = protectedIntervalCache.get(cacheKey);
  if (hit) return hit;
  const result = computeProtectedIntervalsForLine(lineText, languageId);
  if (protectedIntervalCache.size >= PROTECTED_CACHE_MAX) protectedIntervalCache.clear();
  protectedIntervalCache.set(cacheKey, result);
  return result;
}

function computeProtectedIntervalsForLine(lineText, languageId) {
  // Primary: Use Monaco's built-in language tokenizer
  try {
    const tokens = monaco.editor.tokenize(lineText, languageId)[0] || [];
    const intervals = [];
    for (let i = 0; i < tokens.length; i++) {
      const startCol = tokens[i].offset;
      const endCol = i + 1 < tokens.length ? tokens[i + 1].offset : lineText.length;
      if (isProtectedTokenType(tokens[i].type)) {
        intervals.push([startCol, endCol]);
      }
    }
    if (intervals.length > 0 || tokens.length > 1) {
      return intervals;
    }
  } catch (_) {
    // Fallback below if language tokenizer is not yet initialized
  }

  // Fallback lexical guard for strings and line comments (# or //)
  const fallbackIntervals = [];
  let inSingle = false, inDouble = false, start = 0;
  for (let i = 0; i < lineText.length; i++) {
    const ch = lineText[i];
    const prev = i > 0 ? lineText[i - 1] : "";
    if (!inSingle && !inDouble) {
      if (ch === "#" || (ch === "/" && lineText[i + 1] === "/")) {
        fallbackIntervals.push([i, lineText.length]);
        break;
      }
      if (ch === "'") { inSingle = true; start = i; }
      else if (ch === '"') { inDouble = true; start = i; }
    } else if (inSingle && ch === "'" && prev !== "\\") {
      inSingle = false;
      fallbackIntervals.push([start, i + 1]);
    } else if (inDouble && ch === '"' && prev !== "\\") {
      inDouble = false;
      fallbackIntervals.push([start, i + 1]);
    }
  }
  if (inSingle || inDouble) fallbackIntervals.push([start, lineText.length]);
  return fallbackIntervals;
}

function isOffsetInsideIntervals(offset, intervals) {
  for (const [s, e] of intervals) {
    if (offset >= s && offset < e) return true;
  }
  return false;
}

function resolveCodeOrEntryFromCandidate(cand, originalWord) {
  if (!cand) return null;
  if (dictPack && dictPack.entries && Object.prototype.hasOwnProperty.call(dictPack.entries, cand)) {
    return { code: cand, entry: dictPack.entries[cand], scope: currentLang, matchedWord: originalWord };
  }
  const mappedCode = lookupNaturalWordToCode(cand);
  if (mappedCode) {
    if (dictPack && dictPack.entries && Object.prototype.hasOwnProperty.call(dictPack.entries, mappedCode)) {
      return { code: mappedCode, entry: dictPack.entries[mappedCode], scope: currentLang, matchedWord: originalWord };
    }
    if (allCartridgesCache) {
      for (const sc of [currentLang, "common", "javascript", "typescript", "python", "kotlin", "swift", "c", "java"]) {
        const scEntries = allCartridgesCache[sc] && allCartridgesCache[sc].entries;
        if (scEntries && Object.prototype.hasOwnProperty.call(scEntries, mappedCode)) {
          return { code: mappedCode, entry: scEntries[mappedCode], scope: sc, matchedWord: originalWord };
        }
      }
    }
    const bHit = typeof CODE_BUNDLES_BY_CODE !== "undefined" ? CODE_BUNDLES_BY_CODE.get(mappedCode) : null;
    if (bHit) {
      return { code: bHit.code, entry: bHit, scope: currentLang, matchedWord: originalWord };
    }
  }
  if (allCartridgesCache) {
    const scopes = [currentLang, "common", "javascript", "typescript", "python", "kotlin", "swift", "c", "java"];
    for (const sc of scopes) {
      if (allCartridgesCache[sc] && allCartridgesCache[sc].entries) {
        const scEntries = allCartridgesCache[sc].entries;
        if (Object.prototype.hasOwnProperty.call(scEntries, cand)) {
          return { code: cand, entry: scEntries[cand], scope: sc, matchedWord: originalWord };
        }
      }
    }
  }
  if (flatEntryLookup && flatEntryLookup.size > 0) {
    const found = flatEntryLookup.get(cand);
    if (found) {
      return { code: found.code, entry: found, scope: found.scope, matchedWord: originalWord };
    }
  }
  if (typeof CODE_BUNDLES_BY_CODE !== "undefined" && CODE_BUNDLES_BY_CODE.has(cand)) {
    const bHit = CODE_BUNDLES_BY_CODE.get(cand);
    return { code: bHit.code, entry: bHit, scope: currentLang, matchedWord: originalWord };
  }
  return null;
}

function getDictionaryEntryDetails(word) {
  if (!word) return null;
  const raw = String(word).trim();
  if (!raw) return null;

  const candidates = [raw];
  const bare = typeof stripTrailingKoParticle === "function" ? stripTrailingKoParticle(raw) : raw;
  if (bare && !candidates.includes(bare)) candidates.push(bare);
  if (typeof extractBilingualStems === "function") {
    for (const st of extractBilingualStems(raw)) {
      if (st && !candidates.includes(st)) candidates.push(st);
    }
  }

  for (const cand of candidates) {
    const direct = resolveCodeOrEntryFromCandidate(cand, raw);
    if (direct) return direct;
  }

  // Fallback: check registered variable nouns & disjoint subwords so hovering natural nouns/identifiers also explains them
  for (const cand of candidates) {
    const low = cand.toLowerCase();
    if (typeof KO_NOUN_TO_IDENT !== "undefined" && KO_NOUN_TO_IDENT[cand]) {
      const nInfo = KO_NOUN_TO_IDENT[cand];
      return {
        code: nInfo.single,
        scope: currentLang,
        matchedWord: raw,
        entry: {
          code: nInfo.single,
          ko: cand,
          en: nInfo.single,
          category: "변수 이름 명사 (DB)",
          category_en: "Registered Variable Noun (DB)",
          grammar_ko: `${cand}에 [값]을 넣기  (예: ${cand}에 80을 넣기)`,
          grammar_ex_ko: `${cand}에 80을 넣기`,
          grammar_en: `assign_value ${nInfo.single} = [value]`,
          grammar_ex_en: `set ${nInfo.single} to 80`,
          desc: `'${cand}' 값을 저장하는 변수 이름(${nInfo.single})이에요.`,
          desc_en: `Registered variable identifier '${nInfo.single}' for '${cand}'.`
        }
      };
    }
    if (typeof IDENT_TO_KO_NOUN !== "undefined" && IDENT_TO_KO_NOUN[cand]) {
      const koLabel = IDENT_TO_KO_NOUN[cand];
      return {
        code: cand,
        scope: currentLang,
        matchedWord: raw,
        entry: {
          code: cand,
          ko: koLabel,
          en: cand,
          category: "변수 식별자 (DB)",
          category_en: "Registered Identifier (DB)",
          grammar_ko: `${koLabel}에 [값]을 넣기`,
          grammar_ex_ko: `${koLabel}에 80을 넣기`,
          grammar_en: `set ${cand} to [value]`,
          grammar_ex_en: `set ${cand} to 80`,
          desc: `'${koLabel}' 정보를 담아두는 변수 이름이에요.`,
          desc_en: `Variable identifier representing '${koLabel}'.`
        }
      };
    }
    if (typeof REVERSE_KO_SUBWORD_GLOSS !== "undefined" && REVERSE_KO_SUBWORD_GLOSS.has(cand)) {
      const subEng = REVERSE_KO_SUBWORD_GLOSS.get(cand);
      return {
        code: subEng,
        scope: currentLang,
        matchedWord: raw,
        entry: {
          code: subEng,
          ko: cand,
          en: subEng,
          category: "배타적 구성 단어",
          category_en: "Exclusive Subword",
          desc: `코드 이름 '${subEng}'을(를) 뜻하는 고정 자연어 단어 '${cand}'예요.`,
          desc_en: `Exclusive subword '${cand}' for identifier token '${subEng}'.`
        }
      };
    }
    if (typeof KO_SUBWORD_GLOSS !== "undefined" && KO_SUBWORD_GLOSS[low]) {
      const koGloss = KO_SUBWORD_GLOSS[low];
      return {
        code: cand,
        scope: currentLang,
        matchedWord: raw,
        entry: {
          code: cand,
          ko: koGloss,
          en: cand,
          category: "배타적 구성 단어",
          category_en: "Exclusive Subword",
          desc: `식별자 조각 '${cand}'는 '${koGloss}'를 뜻해요.`,
          desc_en: `Identifier part '${cand}' means '${koGloss}'.`
        }
      };
    }
  }

  return null;
}

function makeHoverSvgImg(paths, strokeColor = "#10b981") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" width="14" height="14" />`;
}

const TRAN_HOVER_ASSETS = {
  book: makeHoverSvgImg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', "#10b981"),
  swap: makeHoverSvgImg('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>', "#34d399"),
  bulb: makeHoverSvgImg('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', "#10b981"),
  target: makeHoverSvgImg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', "#22d14e"),
  syntax: makeHoverSvgImg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>', "#a78bfa"),
  inside: makeHoverSvgImg('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/>', "#f59e0b"),
  result: makeHoverSvgImg('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>', "#10b981"),
  fn: makeHoverSvgImg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="12" y1="2" x2="12" y2="22"/>', "#22d14e"),
  condition: makeHoverSvgImg('<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>', "#22d14e"),
  loop: makeHoverSvgImg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>', "#22d14e"),
  assign: makeHoverSvgImg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>', "#22d14e"),
  input: makeHoverSvgImg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>', "#22d14e"),
  print: makeHoverSvgImg('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>', "#22d14e"),
  save: makeHoverSvgImg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>', "#22d14e"),
  file: makeHoverSvgImg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', "#22d14e"),
  stop: makeHoverSvgImg('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8"/>', "#22d14e"),
  skip: makeHoverSvgImg('<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>', "#22d14e"),
  warn: makeHoverSvgImg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', "#22d14e"),
  lock: makeHoverSvgImg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', "#22d14e"),
  note: makeHoverSvgImg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', "#22d14e"),
  tag: makeHoverSvgImg('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>', "#22d14e"),
  spark: makeHoverSvgImg('<polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2"/>', "#22d14e"),
  related: makeHoverSvgImg('<circle cx="12" cy="12" r="3"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><line x1="7" y1="8" x2="10" y2="10"/><line x1="17" y1="8" x2="14" y2="10"/><line x1="7" y1="16" x2="10" y2="14"/><line x1="17" y1="16" x2="14" y2="14"/>', "#22d14e"),
  rule: makeHoverSvgImg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>', "#22d14e")
};

function hoverIcon(name) {
  return (TRAN_HOVER_ASSETS && TRAN_HOVER_ASSETS[name]) || TRAN_HOVER_ASSETS.book;
}

function isHarvestedGlossPhrase(text, code) {
  const t = String(text || "").trim();
  const c = String(code || "").trim();
  if (!t || t === c) return false;
  if (typeof CODE_BUNDLES_BY_CODE !== "undefined" && CODE_BUNDLES_BY_CODE.has(c)) {
    const b = CODE_BUNDLES_BY_CODE.get(c);
    if (b && (b.en === t || b.ko === t)) return false;
  }
  if (/_/.test(t) && t.length > c.length) return true;
  if (t.length >= 18) return true;
  return false;
}

function shortNaturalForCode(code, mode = "ko") {
  const c = String(code || "").trim();
  if (!c) return "";
  if (typeof CODE_BUNDLES_BY_CODE !== "undefined" && CODE_BUNDLES_BY_CODE.has(c)) {
    const b = CODE_BUNDLES_BY_CODE.get(c);
    if (mode === "en") return (b && b.en) || c;
    return (b && b.ko) || (b && b.en) || c;
  }
  return c;
}

function naturalInsertForDictEntry(code, tr, mode = "ko") {
  const c = String(code || "").trim();
  if (mode === "raw") return c;
  const exclusive = typeof CODE_BUNDLES_BY_CODE !== "undefined" ? CODE_BUNDLES_BY_CODE.get(c) : null;
  if (exclusive) {
    return mode === "en" ? (exclusive.en || c) : (exclusive.ko || exclusive.en || c);
  }
  return c;
}

const TRAN_SVG_ICONS = {
  abc: `<svg class="tran-inline-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d14e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  ganada: `<svg class="tran-inline-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="3.6" y1="9" x2="20.4" y2="9"/><line x1="3.6" y1="15" x2="20.4" y2="15"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/></svg>`,
  role: `<svg class="tran-inline-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`
};

function hoverMarkdownForCode(code) {
  if (!code) return "";
  const key = `${currentLang}|${uiLang}|${targetLocale}|${code}`;
  if (hoverMdCache.has(key)) return hoverMdCache.get(key);
  const details = getDictionaryEntryDetails(code);
  const md = details ? formatWordHoverMarkdown(code, details) : "";
  hoverMdCache.set(key, md);
  return md;
}

function formatWordHoverMarkdown(word, details, translatedText = null, lineContextText = "") {
  const code = (details && details.code) || word;
  const entry = (details && details.entry) || {};
  const rawEntry = entry.rawEntry || entry;
  const isEnUi = uiLang === "en";
  const scope = (details && details.scope) || currentLang;

  const en = entry.en || rawEntry.en || "";
  const ko = entry.ko || rawEntry.ko || "";
  let category = isEnUi
    ? (entry.category_en || rawEntry.category_en || entry.category || rawEntry.category || "")
    : (entry.category || rawEntry.category || "");
  if (!category) {
    category = inferWordRole(code, rawEntry, scope, isEnUi);
  }
  const langLabel = (typeof SCOPE_LABELS !== "undefined" && SCOPE_LABELS[scope]) || scope;

  const guide = buildWordUsageGuide({
    ...rawEntry,
    ...entry,
    scope,
    langLabel,
    code,
    en,
    ko,
    category: isEnUi ? (entry.category || rawEntry.category || "") : category,
    category_en: isEnUi ? category : (entry.category_en || rawEntry.category_en || ""),
  });

  const example = isEnUi
    ? (entry.example_en || rawEntry.example_en || entry.example || rawEntry.example || guide.hoverExample || "")
    : (entry.example || rawEntry.example || guide.hoverExample || "");

  const bundle = typeof getExclusiveBundleMeta === "function"
    ? getExclusiveBundleMeta(code, scope, rawEntry, entry)
    : null;
  const canonicalKo = (bundle && bundle.ko) || ko || code;
  const canonicalEn = (bundle && bundle.en) || en || code;
  const synKoList = (bundle && Array.isArray(bundle.synonyms_ko) ? bundle.synonyms_ko : []).filter((s) => s && s !== canonicalKo);
  const synEnList = (bundle && Array.isArray(bundle.synonyms_en) ? bundle.synonyms_en : []).filter((s) => s && s !== canonicalEn);
  const grammarRule = isEnUi
    ? ((bundle && bundle.grammar_en) || entry.grammar_en || rawEntry.grammar_en || "")
    : ((bundle && bundle.grammar_ko) || entry.grammar_ko || rawEntry.grammar_ko || "");
  const grammarEx = isEnUi
    ? ((bundle && bundle.grammar_ex_en) || entry.grammar_ex_en || rawEntry.grammar_ex_en || "")
    : ((bundle && bundle.grammar_ex_ko) || entry.grammar_ex_ko || rawEntry.grammar_ex_ko || "");

  const lines = [];
  lines.push(`### ${hoverIcon("book")} \`${code}\` ${category ? `_(${category})_` : ""}`);

  if (lineContextText) {
    const lineSummary = isEnUi
      ? (typeof summarizeCodeLineToEnglish === "function" ? summarizeCodeLineToEnglish(lineContextText, currentLang) : null)
      : (typeof summarizeCodeLineToKorean === "function" ? summarizeCodeLineToKorean(lineContextText, currentLang) : null);
    const sentence = lineSummary && (isEnUi ? lineSummary.sentenceEn : lineSummary.sentenceKo);
    if (sentence) {
      const sumIcon = hoverIcon(lineSummary.iconKey || "note");
      lines.push(`${sumIcon} **${isEnUi ? "Line summary:" : "이 줄의 문장 요약:"}** ${sentence}`);
    }
  }

  if (isEnUi || targetLocale === "none") {
    lines.push(`${hoverIcon("tag")} **Canonical Natural Word:** \`${canonicalEn}\` _(always normalized to this single word)_`);
    if (word && word !== code && word.toLowerCase() !== canonicalEn.toLowerCase()) {
      lines.push(`${hoverIcon("spark")} **Matched Synonym:** \`${word}\` ➔ auto-normalizes to \`${canonicalEn}\``);
    }
    if (synEnList.length > 0) {
      lines.push(`${hoverIcon("related")} **Exclusive Related Words (not shared with any other code):** ${synEnList.slice(0, 10).map((s) => `\`${s}\``).join(" · ")}`);
    }
  } else {
    lines.push(`${hoverIcon("tag")} **고정 대표 자연어:** \`${canonicalKo}\` / \`${canonicalEn}\` _(항상 이 일정한 단어로 통일)_`);
    if (word && word !== code && word !== canonicalKo && word.toLowerCase() !== canonicalEn.toLowerCase()) {
      lines.push(`${hoverIcon("spark")} **입력 단어 정규화:** \`${word}\` ➔ 자동완성·변환 시 \`${canonicalKo}\`로 통일`);
    }
    if (synKoList.length > 0) {
      lines.push(`${hoverIcon("related")} **배타적 연관 자연어 묶음 (다른 코드와 공유 안 함):** ${synKoList.slice(0, 10).map((s) => `\`${s}\``).join(" · ")}`);
    } else if (synEnList.length > 0) {
      lines.push(`${hoverIcon("related")} **배타적 연관 영어 묶음:** ${synEnList.slice(0, 8).map((s) => `\`${s}\``).join(" · ")}`);
    }
  }

  if (grammarRule) {
    lines.push(
      isEnUi
        ? `${hoverIcon("rule")} **Required Natural Grammar:** \`${grammarRule}\`${grammarEx ? `  \nExample: \`${grammarEx}\`` : ""}`
        : `${hoverIcon("rule")} **자연어 입력 문법 안내:** \`${grammarRule}\`${grammarEx ? `  \n입력 예시: \`${grammarEx}\`` : ""}`
    );
  }
  lines.push("---");

  if (guide.desc) {
    lines.push(`${TRAN_HOVER_ASSETS.bulb} **${isEnUi ? "What does it do?" : "무슨 일을 하나요?"}** ${guide.desc}`);
  }
  if (guide.usage) {
    lines.push(`${TRAN_HOVER_ASSETS.target} **${isEnUi ? "When do you use it?" : "언제 쓰나요?"}** ${guide.usage}`);
  }
  if (guide.syntax) {
    lines.push(`${TRAN_HOVER_ASSETS.syntax} **${isEnUi ? "How to write it:" : "이렇게 적어요:"}** \`${guide.syntax}\``);
  }
  if (guide.inside) {
    lines.push(`${TRAN_HOVER_ASSETS.inside} **${isEnUi ? "What goes inside ( ) or { }:" : "괄호·블록 안에 넣을 것:"}** ${guide.inside}`);
  }
  if (example) {
    lines.push("```" + currentLang + "\n" + example + "\n```");
  }
  if (guide.result) {
    lines.push(`${TRAN_HOVER_ASSETS.result} **${isEnUi ? "What happens after:" : "쓰고 나면 이렇게 돼요:"}** ${guide.result}`);
  }

  return lines.join("\n\n");
}

function getNaturalWordAtPosition(model, position) {
  if (!model || !position) return null;
  const lineText = model.getLineContent(position.lineNumber) || "";
  const col0 = position.column - 1;
  const regex = /[A-Za-z0-9_가-힣ㄱ-ㅎㅏ-ㅣ]+/g;
  let m;
  while ((m = regex.exec(lineText)) !== null) {
    const start0 = m.index;
    const end0 = start0 + m[0].length;
    if (col0 >= start0 && col0 <= end0) {
      return {
        word: m[0],
        startColumn: start0 + 1,
        endColumn: end0 + 1
      };
    }
  }
  return model.getWordAtPosition(position);
}

function getNaturalWordUntilPosition(model, position) {
  if (!model || !position) return { word: "", startColumn: 1, endColumn: 1 };
  const lineText = model.getLineContent(position.lineNumber) || "";
  const beforeCursor = lineText.slice(0, Math.max(0, position.column - 1));
  const m = beforeCursor.match(/[A-Za-z0-9_가-힣ㄱ-ㅎㅏ-ㅣ]+$/);
  if (m) {
    return {
      word: m[0],
      startColumn: position.column - m[0].length,
      endColumn: position.column
    };
  }
  return {
    word: "",
    startColumn: position.column,
    endColumn: position.column
  };
}
window.getNaturalWordUntilPosition = getNaturalWordUntilPosition;

let hoverDisposables = [];
function findNaturalHoverTargetAtPosition(model, position) {
  const wordInfo = getNaturalWordAtPosition(model, position);
  if (wordInfo && wordInfo.word) return wordInfo;
  if (!model || !position) return null;
  const lineText = model.getLineContent(position.lineNumber) || "";
  const col0 = Math.max(0, position.column - 1);
  const opRe = /(===|!==|>=|<=|==|!=|&&|\|\||=>|\?\?|\+\+|--|[=+\-*/<>!?:])/g;
  let m;
  while ((m = opRe.exec(lineText)) !== null) {
    if (col0 >= m.index && col0 <= m.index + m[0].length) {
      return {
        word: m[0],
        startColumn: m.index + 1,
        endColumn: m.index + m[0].length + 1
      };
    }
  }
  return null;
}

function registerDictionaryHover() {
  if (!window.monaco || !monaco.languages || !monaco.languages.registerHoverProvider) return;
  while (hoverDisposables.length > 0) {
    try { hoverDisposables.pop().dispose(); } catch (_) {}
  }
  configureMonacoNaturalWordPatterns();
  const hoverProvider = {
    provideHover: function (model, position) {
      const wordInfo = findNaturalHoverTargetAtPosition(model, position);
      if (!wordInfo || !wordInfo.word) return null;

      const word = wordInfo.word;
      const details = getDictionaryEntryDetails(word);
      if (!details) return null;

      const lineText = model.getLineContent(position.lineNumber) || "";
      const mdString = formatWordHoverMarkdown(word, details, null, lineText);
      return {
        range: new monaco.Range(
          position.lineNumber,
          wordInfo.startColumn,
          position.lineNumber,
          wordInfo.endColumn
        ),
        contents: [{ value: mdString, supportHtml: true, isTrusted: true }]
      };
    }
  };
  if (typeof window !== "undefined") window.__tranHoverProvider = hoverProvider;
  const langs = Array.from(new Set(["plaintext", currentLang, "python", "javascript", "typescript", "kotlin", "swift", "c", "java"].filter(Boolean)));
  for (const langId of langs) {
    try {
      hoverDisposables.push(monaco.languages.registerHoverProvider(langId, hoverProvider));
    } catch (_) {}
  }
}

// ============================================================================
// Tran.IDE II (v0.12) Offline Engines:
//  1) KO/EN Stemmer + Bilingual Synonym Clusters + Inverted Index + User-Learned Mappings
//  2) Symbol-Free Skeletons + KO/EN Word-Order Sentence -> Code Composer
//  3) Functional Chunk Recognizer -> KO/EN Natural Sentence Summarizer
//  4) Dual-Buffer Compiler/Decompiler + Offline POS Vocab DB Validator
// ============================================================================

const KO_VERB_ENDINGS = [
  "시키다", "시키기", "되어다", "되다", "되기", "하다", "하기", "해주다", "해주기",
  "내다", "내기", "주다", "주기", "보다", "보기", "우다", "우기", "이다", "라기",
  "해서", "하고", "하여", "하며", "해요", "한다", "하는", "되는", "시키는", "할", "됨", "기", "다"
];

const KO_PARTICLES = [
  "에다가", "에서는", "에서", "으로는", "으로", "에게는", "에게", "부터", "까지", "처럼", "만큼", "보다", "마다",
  "에는", "에도", "에만", "이나", "이랑", "들은", "들이", "들을", "들의", "들과", "들도", "은", "는", "이", "가",
  "을", "를", "에", "로", "와", "과", "의", "도", "만", "나", "랑", "들"
];

function extractKoreanStems(rawWord) {
  const clean = String(rawWord || "").trim().toLowerCase();
  if (!clean) return [];
  const stems = [];
  const addStem = (s) => {
    const val = String(s || "").trim();
    if (val && !stems.includes(val)) stems.push(val);
  };
  addStem(clean);

  // Split multi-word phrase tokens first
  const parts = clean.split(/[\s,._/()+]+/).filter(Boolean);
  for (const part of parts) {
    addStem(part);

    // Strip verb/adjective endings
    for (const end of KO_VERB_ENDINGS) {
      if (part.length > end.length + 1 && part.endsWith(end)) {
        const base = part.slice(0, part.length - end.length);
        addStem(base);
        // Strip particle if base still ends with one
        for (const p of KO_PARTICLES) {
          if (base.length > p.length + 1 && base.endsWith(p)) {
            addStem(base.slice(0, base.length - p.length));
          }
        }
      }
    }

    // Strip trailing particles directly (and nested plural "-들" if left at end)
    for (const p of KO_PARTICLES) {
      if (part.length > p.length + 1 && part.endsWith(p)) {
        const stripped = part.slice(0, part.length - p.length);
        addStem(stripped);
        if (stripped.length > 2 && stripped.endsWith("들")) {
          addStem(stripped.slice(0, stripped.length - 1));
        }
      }
    }

    // Decompose compact Korean compound phrases across internal particles (e.g. "화면에보여주기")
    if (/[가-힣]/.test(part) && part.length >= 4) {
      const midSplit = part.split(/(?:에서|으로|에|를|을|로)/).filter((seg) => seg && seg.length >= 2);
      if (midSplit.length > 1) {
        for (const seg of midSplit) {
          addStem(seg);
          for (const end of KO_VERB_ENDINGS) {
            if (seg.length > end.length + 1 && seg.endsWith(end)) {
              addStem(seg.slice(0, seg.length - end.length));
            }
          }
        }
      }
    }
  }

  return stems;
}
if (typeof window !== "undefined") window.extractKoreanStems = extractKoreanStems;

const EN_IRREGULAR_STEMS = {
  wrote: "write", written: "write", writing: "write",
  sorted: "sort", sorting: "sort",
  filtered: "filter", filtering: "filter",
  printed: "print", printing: "print",
  displayed: "display", displaying: "display",
  saved: "save", saving: "save",
  stored: "store", storing: "store",
  found: "find", finding: "find",
  kept: "keep", keeping: "keep",
  repeated: "repeat", repeating: "repeat",
  defined: "define", defining: "define",
  returned: "return", returning: "return",
  made: "make", making: "make",
  put: "put", putting: "put",
  set: "set", setting: "set",
  got: "get", getting: "get",
  ran: "run", running: "run",
  added: "add", adding: "add",
  removed: "remove", removing: "remove",
  deleted: "delete", deleting: "delete",
  counted: "count", counting: "count",
  split: "split", splitting: "split",
  joined: "join", joining: "join",
  checked: "check", checking: "check",
  evaluated: "evaluate", evaluating: "evaluate",
  verified: "verify", verifying: "verify"
};

function extractEnglishStems(rawWord) {
  const clean = String(rawWord || "").trim();
  if (!clean) return [];
  const stems = [];
  const addStem = (s) => {
    const val = String(s || "").trim().toLowerCase();
    if (val && !stems.includes(val)) stems.push(val);
  };
  addStem(clean);

  // Split camelCase as well as punctuation/underscores
  const camelSpaced = clean.replace(/([a-z])([A-Z])/g, "$1 $2");
  const parts = camelSpaced.split(/[\s,._/()+]+/).filter(Boolean);
  for (const partRaw of parts) {
    const part = partRaw.toLowerCase();
    addStem(part);
    if (EN_IRREGULAR_STEMS[part]) {
      addStem(EN_IRREGULAR_STEMS[part]);
    }
    if (part.length > 5 && part.endsWith("ing")) {
      const base = part.slice(0, -3);
      addStem(base);
      addStem(base + "e");
    }
    if (part.length > 4 && part.endsWith("ied")) {
      addStem(part.slice(0, -3) + "y");
    } else if (part.length > 4 && part.endsWith("ed")) {
      const base = part.slice(0, -2);
      addStem(base);
      addStem(part.slice(0, -1));
    }
    if (part.length > 4 && part.endsWith("ies")) {
      addStem(part.slice(0, -3) + "y");
    } else if (part.length > 4 && part.endsWith("es")) {
      addStem(part.slice(0, -2));
      addStem(part.slice(0, -1));
    } else if (part.length > 3 && part.endsWith("s") && !part.endsWith("ss")) {
      addStem(part.slice(0, -1));
    }
    if (part.length > 5 && part.endsWith("ly")) {
      addStem(part.slice(0, -2));
    }
    if (part.length > 4 && (part.endsWith("er") || part.endsWith("or"))) {
      addStem(part.slice(0, -2));
    }
  }
  return stems;
}
if (typeof window !== "undefined") window.extractEnglishStems = extractEnglishStems;

function extractBilingualStems(rawWord) {
  const ko = extractKoreanStems(rawWord);
  if (/[A-Za-z]/.test(String(rawWord || ""))) {
    const en = extractEnglishStems(rawWord);
    for (const s of en) {
      if (!ko.includes(s)) ko.push(s);
    }
  }
  return ko;
}

const CODE_SYNONYM_BUNDLES = [
  { code: "=", ko: "넣기", synonyms_ko: ["담기", "대입하기", "집어넣기", "할당하기", "값넣기", "대입", "할당"], en: "assign_value", synonyms_en: ["put_into", "set_value", "store_in", "bind_value"], role_ko: "변수에 값 저장", role_en: "Assign value to variable", grammar_ko: "[이름]에 [값]을 넣기  (예: 점수에 10을 넣기)", grammar_ex_ko: "점수에 10을 넣기", grammar_en: "assign_value [name] = [value]  (e.g. set score to 80)", grammar_ex_en: "set score to 80" },
  { code: "if", ko: "만약", synonyms_ko: ["만약에", "만일", "조건이면", "받는다면", "입력된다면", "일때", "조건문"], en: "if_when", synonyms_en: ["when_if", "suppose_if", "condition_check", "in_case"], role_ko: "조건 분기 시작", role_en: "Conditional branch", grammar_ko: "만약 [대상]이 [비교값] 이상이면 [할일]  (예: 만약 점수가 80 이상이면 합격을 출력)", grammar_ex_ko: "만약 점수가 80 이상이면 합격을 출력", grammar_en: "if_when [target] >= [value] then [action]", grammar_ex_en: "when score >= 80 print pass" },
  { code: "elif", ko: "아니고만약", synonyms_ko: ["그게아니고만약", "또다른조건이면", "다중분기"], en: "else_if_when", synonyms_en: ["other_if", "next_condition", "alt_branch_if"], role_ko: "파이썬 추가 조건 분기", role_en: "Python else-if branch", grammar_ko: "아니고만약 [조건]이면 [할일]", grammar_ex_ko: "아니고만약 점수 60 이상이면 보통 출력", grammar_en: "else_if_when [condition] then [action]", grammar_ex_en: "else_if_when score >= 60 print ok" },
  { code: "else if", ko: "아니면만약", synonyms_ko: ["그렇지않고만약", "다른조건일때"], en: "otherwise_if", synonyms_en: ["fallback_if", "or_else_if"], role_ko: "JS/Java/C 추가 조건 분기", role_en: "JS/Java/C else-if branch", grammar_ko: "아니면만약 [조건]이면 [할일]", grammar_ex_ko: "아니면만약 점수 60 이상이면 보통 콘솔출력", grammar_en: "otherwise_if [condition] then [action]", grammar_ex_en: "otherwise_if score >= 60 console_log ok" },
  { code: "else", ko: "아니면", synonyms_ko: ["그밖에", "그렇지않으면", "나머지경우", "안맞으면"], en: "otherwise_else", synonyms_en: ["fallback_else", "if_not_so", "or_else"], role_ko: "조건이 모두 아닐 때", role_en: "Fallback branch when condition is false", grammar_ko: "아니면 [할일]  (만약 줄 바로 다음 줄에 적기)", grammar_ex_ko: "아니면 불합격 출력", grammar_en: "otherwise_else [action]  (after an if block)", grammar_ex_en: "otherwise_else print fail" },
  { code: "switch", ko: "경우분기", synonyms_ko: ["선택분기", "갈래나누기", "스위치문"], en: "switch_case", synonyms_en: ["branch_choice", "dispatch_value"], role_ko: "값에 따라 여러 갈래 선택", role_en: "Multi-way value switch", grammar_ko: "경우분기 [값]에 따라 갈래 실행", grammar_ex_ko: "경우분기 등급", grammar_en: "switch_case [value]", grammar_ex_en: "switch_case grade" },
  { code: "case", ko: "경우", synonyms_ko: ["해당경우", "케이스", "갈래항목"], en: "when_case", synonyms_en: ["case_branch", "match_case_arm"], role_ko: "경우분기 안의 각 선택지", role_en: "Single switch branch option", grammar_ko: "경우 [비교값]: [할일]", grammar_ex_ko: "경우 1:", grammar_en: "when_case [value]: [action]", grammar_ex_en: "when_case 1" },
  { code: "default", ko: "기본값분기", synonyms_ko: ["나머지기본", "디폴트분기", "기본선택"], en: "default_branch", synonyms_en: ["fallback_default", "standard_choice"], role_ko: "맞는 경우가 없을 때 기본 실행", role_en: "Default branch when no case matches", grammar_ko: "기본값분기: [기본 실행]", grammar_ex_ko: "기본값분기", grammar_en: "default_branch: [action]", grammar_ex_en: "default_branch" },
  { code: "for", ko: "반복", synonyms_ko: ["하나씩반복", "차례반복", "횟수반복", "목록순회", "포문"], en: "repeat_loop", synonyms_en: ["loop_each", "iterate_each", "each_item", "repeat_times"], role_ko: "목록이나 횟수만큼 반복", role_en: "For loop over items or count", grammar_ko: "[목록]에서 하나씩 꺼내 [할일]  또는  [횟수]번 반복", grammar_ex_ko: "목록에서 하나씩", grammar_en: "repeat_loop each item in [list]", grammar_ex_en: "repeat_loop 5 times" },
  { code: "while", ko: "동안", synonyms_ko: ["동안반복", "계속반복", "조건반복", "하는동안", "와일문"], en: "while_loop", synonyms_en: ["keep_looping", "as_long_as", "until_stop"], role_ko: "조건이 참인 동안 계속 반복", role_en: "While condition remains true loop", grammar_ko: "[대상]이 [비교값] 미만 동안  (예: 점수가 10 미만 동안)", grammar_ex_ko: "점수가 10 미만 동안", grammar_en: "while_loop [condition]", grammar_ex_en: "while_loop score < 10" },
  { code: "break", ko: "반복탈출", synonyms_ko: ["즉시멈춤", "빠져나가기", "루프종료", "그만두기"], en: "break_loop", synonyms_en: ["exit_loop", "stop_repeating"], role_ko: "반복문 즉시 중단", role_en: "Exit loop immediately", grammar_ko: "반복탈출  (반복문 안에서 멈출 때 사용)", grammar_ex_ko: "반복탈출", grammar_en: "break_loop", grammar_ex_en: "break_loop" },
  { code: "continue", ko: "다음차례", synonyms_ko: ["이번건넘기", "건너뛰기", "계속진행"], en: "continue_next", synonyms_en: ["skip_turn", "next_iteration"], role_ko: "이번 회차만 건너뛰고 다음 반복으로", role_en: "Skip current iteration and move to next", grammar_ko: "다음차례", grammar_ex_ko: "다음차례", grammar_en: "continue_next", grammar_ex_en: "continue_next" },
  { code: "def", ko: "함수정의", synonyms_ko: ["기능정의", "기능만들기", "명령만들기", "파이썬함수"], en: "define_func", synonyms_en: ["make_function", "create_routine", "py_def"], role_ko: "Python 함수 정의", role_en: "Define Python function", grammar_ko: "함수정의 [함수이름] 재료 [매개변수들]", grammar_ex_ko: "함수정의 인사하기 재료 이름", grammar_en: "define_func [name] with [params]", grammar_ex_en: "define_func greet with name" },
  { code: "function", ko: "함수선언", synonyms_ko: ["기능선언", "자스함수", "웹함수", "펑션"], en: "declare_function", synonyms_en: ["js_function", "new_function", "build_function"], role_ko: "JavaScript 함수 선언", role_en: "Declare JavaScript function", grammar_ko: "함수선언 [함수이름] 재료 [매개변수들]", grammar_ex_ko: "함수선언 인사하기 재료 이름", grammar_en: "declare_function [name] ([params])", grammar_ex_en: "declare_function greet (name)" },
  { code: "fun", ko: "코틀린함수", synonyms_ko: ["펀함수", "짧은함수"], en: "kotlin_fun", synonyms_en: ["fun_decl", "kt_function"], role_ko: "Kotlin 함수 정의", role_en: "Kotlin function keyword", grammar_ko: "코틀린함수 [이름] 재료 [매개변수]", grammar_ex_ko: "코틀린함수 인사 재료 이름", grammar_en: "kotlin_fun [name] ([params])", grammar_ex_en: "kotlin_fun greet (name)" },
  { code: "func", ko: "스위프트함수", synonyms_ko: ["펑크함수", "스위프트기능"], en: "swift_func", synonyms_en: ["func_decl", "ios_function"], role_ko: "Swift 함수 정의", role_en: "Swift function keyword", grammar_ko: "스위프트함수 [이름] 재료 [매개변수]", grammar_ex_ko: "스위프트함수 인사 재료 이름", grammar_en: "swift_func [name] ([params])", grammar_ex_en: "swift_func greet (name)" },
  { code: "return", ko: "반환", synonyms_ko: ["돌려주기", "결과돌려주기", "값내보내기", "리턴"], en: "return_result", synonyms_en: ["give_back", "send_result", "hand_back"], role_ko: "함수 결과값 돌려주기", role_en: "Return result from function", grammar_ko: "[보낼값]을 반환  (예: 점수를 반환 / 80을 반환)", grammar_ex_ko: "점수를 반환", grammar_en: "return_result [value]", grammar_ex_en: "return_result score" },
  { code: "print", ko: "출력", synonyms_ko: ["화면출력", "프린트", "글자찍기", "찍기", "내보여주기"], en: "print_out", synonyms_en: ["print_text", "show_result", "display_text"], role_ko: "화면 출력 (Python/Swift)", role_en: "Standard output print", grammar_ko: "[보여줄값]을 출력  (예: 10을 출력 / 점수를 출력)", grammar_ex_ko: "10을 출력", grammar_en: "print_out [value]", grammar_ex_en: "print_out hello" },
  { code: "console.log", ko: "콘솔출력", synonyms_ko: ["로그출력", "콘솔기록", "화면표시", "보여주기", "띄우기"], en: "console_log", synonyms_en: ["log_message", "show_console", "debug_print"], role_ko: "JavaScript 콘솔 출력", role_en: "JavaScript console.log output", grammar_ko: "[보여줄값]을 콘솔출력  (예: 점수를 콘솔출력)", grammar_ex_ko: "점수를 콘솔출력", grammar_en: "console_log [value]", grammar_ex_en: "console_log score" },
  { code: "console.warn", ko: "경고출력", synonyms_ko: ["주의출력", "노란경고"], en: "console_warn", synonyms_en: ["warn_log", "warning_message"], role_ko: "노란색 경고 로그 출력", role_en: "Yellow warning console log", grammar_ko: "[경고글]을 경고출력", grammar_ex_ko: "주의필요를 경고출력", grammar_en: "console_warn [message]", grammar_ex_en: "console_warn check_input" },
  { code: "console.error", ko: "오류출력", synonyms_ko: ["에러출력", "빨간경고"], en: "console_error", synonyms_en: ["error_log", "fail_message"], role_ko: "빨간색 에러 로그 출력", role_en: "Red error console log", grammar_ko: "[오류글]을 오류출력", grammar_ex_ko: "실패함을 오류출력", grammar_en: "console_error [message]", grammar_ex_en: "console_error failed" },
  { code: "println", ko: "줄출력", synonyms_ko: ["한줄출력", "줄바꿈출력", "프린트라인"], en: "print_line", synonyms_en: ["line_output", "write_line"], role_ko: "한 줄 출력 후 줄바꿈 (Kotlin/Java)", role_en: "Print one line with newline", grammar_ko: "[내용]을 줄출력", grammar_ex_ko: "합격을 줄출력", grammar_en: "print_line [value]", grammar_ex_en: "print_line pass" },
  { code: "printf", ko: "서식출력", synonyms_ko: ["양식출력", "씨출력", "형식맞춤출력"], en: "format_print", synonyms_en: ["c_printf", "formatted_output"], role_ko: "C 언어 서식 지정 화면 출력", role_en: "C formatted printf output", grammar_ko: "[서식글, 값]을 서식출력", grammar_ex_ko: "점수를 서식출력", grammar_en: "format_print [format], [value]", grammar_ex_en: "format_print score" },
  { code: "System.out.println", ko: "자바출력", synonyms_ko: ["시스템줄출력", "자바화면출력"], en: "java_println", synonyms_en: ["system_out_print", "java_line_output"], role_ko: "Java 표준 화면 출력", role_en: "Java standard output line", grammar_ko: "[값]을 자바출력", grammar_ex_ko: "합격을 자바출력", grammar_en: "java_println [value]", grammar_ex_en: "java_println pass" },
  { code: "let", ko: "변수선언", synonyms_ko: ["바꾸는상자", "변동변수", "렛상자"], en: "let_var", synonyms_en: ["mutable_box", "declare_let"], role_ko: "바꿀 수 있는 변수 선언", role_en: "Mutable variable binding", grammar_ko: "변수선언 [이름]에 [값]을 넣기", grammar_ex_ko: "변수선언 점수에 80을 넣기", grammar_en: "let_var [name] = [value]", grammar_ex_en: "let_var score = 80" },
  { code: "const", ko: "상수선언", synonyms_ko: ["고정상자", "불변상수", "안바뀌는값"], en: "const_value", synonyms_en: ["fixed_box", "locked_value", "immutable_const"], role_ko: "값이 안 바뀌는 상수 선언", role_en: "Constant immutable binding", grammar_ko: "상수선언 [이름]에 [값]을 넣기", grammar_ex_ko: "상수선언 만점에 100을 넣기", grammar_en: "const_value [name] = [value]", grammar_ex_en: "const_value max_score = 100" },
  { code: "var", ko: "자유변수", synonyms_ko: ["바변수", "일반상자", "유동변수"], en: "var_slot", synonyms_en: ["general_var", "open_variable"], role_ko: "일반 변수 상자 선언", role_en: "General variable declaration", grammar_ko: "자유변수 [이름]에 [값]을 넣기", grammar_ex_ko: "자유변수 횟수에 0을 넣기", grammar_en: "var_slot [name] = [value]", grammar_ex_en: "var_slot count = 0" },
  { code: "val", ko: "고정값", synonyms_ko: ["읽기전용값", "발상수", "불변값"], en: "val_fixed", synonyms_en: ["read_only_val", "kotlin_val"], role_ko: "한 번 정하면 못 바꾸는 값 (Kotlin)", role_en: "Read-only value binding", grammar_ko: "고정값 [이름]에 [값]을 넣기", grammar_ex_ko: "고정값 이름에 철수를 넣기", grammar_en: "val_fixed [name] = [value]", grammar_ex_en: "val_fixed title = hello" },
  { code: "true", ko: "참", synonyms_ko: ["맞음", "트루", "진실값"], en: "bool_true", synonyms_en: ["yes_true", "correct_flag"], role_ko: "논리 참(맞다) 값", role_en: "Boolean true value", grammar_ko: "참  (조건이나 상태 값에 사용)", grammar_ex_ko: "합격에 참 넣기", grammar_en: "bool_true", grammar_ex_en: "passed = bool_true" },
  { code: "True", ko: "파이썬참", synonyms_ko: ["대문자참", "파이썬맞음"], en: "py_true", synonyms_en: ["capital_true", "python_true"], role_ko: "Python 대문자 참(True)", role_en: "Python capitalized True", grammar_ko: "파이썬참", grammar_ex_ko: "합격에 파이썬참 넣기", grammar_en: "py_true", grammar_ex_en: "passed = py_true" },
  { code: "false", ko: "거짓", synonyms_ko: ["틀림", "펄스", "거짓값"], en: "bool_false", synonyms_en: ["no_false", "wrong_flag"], role_ko: "논리 거짓(아니다) 값", role_en: "Boolean false value", grammar_ko: "거짓", grammar_ex_ko: "실패에 거짓 넣기", grammar_en: "bool_false", grammar_ex_en: "failed = bool_false" },
  { code: "False", ko: "파이썬거짓", synonyms_ko: ["대문자거짓", "파이썬틀림"], en: "py_false", synonyms_en: ["capital_false", "python_false"], role_ko: "Python 대문자 거짓(False)", role_en: "Python capitalized False", grammar_ko: "파이썬거짓", grammar_ex_ko: "실패에 파이썬거짓 넣기", grammar_en: "py_false", grammar_ex_en: "failed = py_false" },
  { code: "None", ko: "값없음", synonyms_ko: ["파이썬없음", "논값", "비어있음"], en: "none_empty", synonyms_en: ["no_value_none", "py_none"], role_ko: "Python 빈 값(None)", role_en: "Python empty value None", grammar_ko: "값없음", grammar_ex_ko: "결과에 값없음 넣기", grammar_en: "none_empty", grammar_ex_en: "result = none_empty" },
  { code: "null", ko: "빈상자", synonyms_ko: ["널값", "빈참조", "비운상자"], en: "null_empty", synonyms_en: ["empty_null", "missing_ref"], role_ko: "빈 객체 참조(null)", role_en: "Null empty reference", grammar_ko: "빈상자", grammar_ex_ko: "대상에 빈상자 넣기", grammar_en: "null_empty", grammar_ex_en: "target = null_empty" },
  { code: "nil", ko: "스위프트없음", synonyms_ko: ["닐값", "빈스위프트"], en: "swift_nil", synonyms_en: ["nil_empty", "ios_nil"], role_ko: "Swift 빈 값(nil)", role_en: "Swift nil value", grammar_ko: "스위프트없음", grammar_ex_ko: "결과에 스위프트없음 넣기", grammar_en: "swift_nil", grammar_ex_en: "result = swift_nil" },
  { code: "undefined", ko: "미정의", synonyms_ko: ["정해지지않음", "언디파인드", "값아직없음"], en: "not_defined", synonyms_en: ["unassigned_val", "js_undefined"], role_ko: "JS 값이 아직 정해지지 않은 상태", role_en: "JS undefined state", grammar_ko: "미정의", grammar_ex_ko: "값에 미정의 넣기", grammar_en: "not_defined", grammar_ex_en: "val = not_defined" },
  { code: "and", ko: "그리고", synonyms_ko: ["동시에", "둘다참", "또한"], en: "both_and", synonyms_en: ["and_also", "together_true"], role_ko: "두 조건 모두 참일 때 (Python)", role_en: "Logical AND (Python)", grammar_ko: "[조건1] 그리고 [조건2]", grammar_ex_ko: "만약 점수 60 이상 그리고 출석 참이면 통과 출력", grammar_en: "[cond1] both_and [cond2]", grammar_ex_en: "if score >= 60 both_and attend == true" },
  { code: "&&", ko: "모두참", synonyms_ko: ["겹조건", "논리곱기호", "앤드기호"], en: "symbol_and", synonyms_en: ["double_amp", "c_style_and"], role_ko: "JS/Java/C 두 조건 모두 참(&&)", role_en: "Logical AND operator (&&)", grammar_ko: "[조건1] 모두참 [조건2]", grammar_ex_ko: "만약 점수 60 이상 모두참 출석 참이면 통과 콘솔출력", grammar_en: "[cond1] symbol_and [cond2]", grammar_ex_en: "if score >= 60 symbol_and attend" },
  { code: "or", ko: "또는", synonyms_ko: ["혹은", "둘중하나", "아니거나"], en: "either_or", synonyms_en: ["or_else_logic", "any_true"], role_ko: "둘 중 하나만 참이어도 참 (Python)", role_en: "Logical OR (Python)", grammar_ko: "[조건1] 또는 [조건2]", grammar_ex_ko: "만약 점수 90 이상 또는 특기 참이면 합격 출력", grammar_en: "[cond1] either_or [cond2]", grammar_ex_en: "if score >= 90 either_or bonus" },
  { code: "||", ko: "하나라도참", synonyms_ko: ["논리합기호", "오어기호", "둘중참"], en: "symbol_or", synonyms_en: ["double_pipe", "c_style_or"], role_ko: "JS/Java/C 둘 중 하나 참(||)", role_en: "Logical OR operator (||)", grammar_ko: "[조건1] 하나라도참 [조건2]", grammar_ex_ko: "만약 점수 90 이상 하나라도참 특기 참이면 합격 콘솔출력", grammar_en: "[cond1] symbol_or [cond2]", grammar_ex_en: "if score >= 90 symbol_or bonus" },
  { code: "not", ko: "부정", synonyms_ko: ["반대로", "아닌경우", "참거짓뒤집기"], en: "logical_not", synonyms_en: ["flip_bool", "not_true"], role_ko: "참/거짓 뒤집기 (Python)", role_en: "Logical NOT (Python)", grammar_ko: "부정 [조건]", grammar_ex_ko: "만약 부정 완료면 진행 출력", grammar_en: "logical_not [condition]", grammar_ex_en: "if logical_not done" },
  { code: "!", ko: "느낌표부정", synonyms_ko: ["반전기호", "논리반전", "낫기호"], en: "bang_not", synonyms_en: ["negate_symbol", "exclamation_not"], role_ko: "JS/Java/C 논리 반전(!)", role_en: "Logical NOT operator (!)", grammar_ko: "느낌표부정 [조건]", grammar_ex_ko: "만약 느낌표부정 완료면 진행 콘솔출력", grammar_en: "bang_not [condition]", grammar_ex_en: "if bang_not done" },
  { code: "input", ko: "입력받기", synonyms_ko: ["입력", "입력하고", "키보드입력", "물어보기", "질문받기"], en: "ask_input", synonyms_en: ["read_user_input", "prompt_user", "keyboard_input"], role_ko: "사용자에게 값 입력받기", role_en: "Read user input", grammar_ko: "[이름]에 [안내문] 입력받기  (예: 점수에 숫자입력 입력받기)", grammar_ex_ko: "점수에 점수입력 입력받기", grammar_en: "ask_input [prompt]", grammar_ex_en: "score = ask_input enter_score" },
  { code: "prompt", ko: "창입력", synonyms_ko: ["알림창물어보기", "팝업입력"], en: "prompt_dialog", synonyms_en: ["popup_ask", "browser_prompt"], role_ko: "브라우저 입력 팝업창 띄우기", role_en: "Browser prompt input dialog", grammar_ko: "[안내글] 창입력", grammar_ex_ko: "이름을 입력하세요 창입력", grammar_en: "prompt_dialog [message]", grammar_ex_en: "prompt_dialog enter_name" },
  { code: "open", ko: "파일열기", synonyms_ko: ["열기", "문서열기", "불러오기"], en: "open_file", synonyms_en: ["access_file", "load_handle"], role_ko: "파일을 읽거나 쓰기 위해 열기", role_en: "Open file handle", grammar_ko: "[파일이름] 파일열기", grammar_ex_ko: "기록 파일열기", grammar_en: "open_file [filename]", grammar_ex_en: "open_file data.txt" },
  { code: "read", ko: "내용읽기", synonyms_ko: ["파일읽기", "전부읽기", "읽어오기"], en: "read_content", synonyms_en: ["get_file_text", "fetch_lines"], role_ko: "파일 내용 읽어오기", role_en: "Read text contents from file", grammar_ko: "[파일] 내용읽기", grammar_ex_ko: "일기 내용읽기", grammar_en: "read_content [file]", grammar_ex_en: "read_content file" },
  { code: "write", ko: "파일저장", synonyms_ko: ["파일쓰기", "내용쓰기", "기록남기기", "저장소쓰기"], en: "write_file", synonyms_en: ["save_text_file", "store_to_file", "record_file"], role_ko: "파일에 글자 기록하기", role_en: "Write content into file", grammar_ko: "[대상] 파일저장", grammar_ex_ko: "점수목록 파일저장", grammar_en: "write_file [content]", grammar_ex_en: "write_file scores" },
  { code: "close", ko: "파일닫기", synonyms_ko: ["연결닫기", "정리하고닫기"], en: "close_resource", synonyms_en: ["shut_file", "finish_handle"], role_ko: "열었던 파일이나 연결 안전 종료", role_en: "Close open file or connection", grammar_ko: "[파일] 파일닫기", grammar_ex_ko: "파일상자 파일닫기", grammar_en: "close_resource [file]", grammar_ex_en: "close_resource file" },
  { code: "len", ko: "길이", synonyms_ko: ["몇개인지", "칸수", "원소개수"], en: "count_len", synonyms_en: ["how_many_items", "total_length"], role_ko: "목록이나 글자 개수 세기 (Python)", role_en: "Count length of list or string", grammar_ko: "[대상] 길이", grammar_ex_ko: "목록 길이", grammar_en: "count_len [target]", grammar_ex_en: "count_len items" },
  { code: "length", ko: "글자길이", synonyms_ko: ["배열길이", "길이속성", "칸길이"], en: "item_length", synonyms_en: ["array_length", "string_length"], role_ko: "배열·문자열 길이 속성 (JS/Java)", role_en: "Length property (JS/Java)", grammar_ko: "[배열] 글자길이", grammar_ex_ko: "이름 글자길이", grammar_en: "[array] item_length", grammar_ex_en: "items item_length" },
  { code: "size", ko: "크기", synonyms_ko: ["전체용량", "컬렉션크기", "사이즈"], en: "item_size", synonyms_en: ["box_capacity", "total_size"], role_ko: "모음·파일 크기 구하기", role_en: "Size or capacity", grammar_ko: "[모음] 크기", grammar_ex_ko: "장바구니 크기", grammar_en: "[box] item_size", grammar_ex_en: "cart item_size" },
  { code: "count", ko: "개수세기", synonyms_ko: ["몇번나옴", "등장횟수", "카운트"], en: "count_matches", synonyms_en: ["tally_items", "how_often"], role_ko: "같은 값이 몇 번 들어있는지 세기", role_en: "Count matching occurrences", grammar_ko: "[목록]에서 [값]을 개수세기", grammar_ex_ko: "점수에서 100을 개수세기", grammar_en: "[list] count_matches [val]", grammar_ex_en: "scores count_matches 100" },
  { code: "range", ko: "숫자범위", synonyms_ko: ["차례숫자", "연속수", "범위만들기"], en: "number_range", synonyms_en: ["number_seq", "count_range"], role_ko: "0부터 지정한 수 앞까지 숫자 줄 만들기", role_en: "Generate sequence of numbers", grammar_ko: "숫자범위 [끝숫자]", grammar_ex_ko: "숫자범위 10", grammar_en: "number_range [stop]", grammar_ex_en: "number_range 10" },
  { code: "append", ko: "끝에추가", synonyms_ko: ["덧붙이기", "뒤에붙이기", "어펜드"], en: "append_item", synonyms_en: ["add_to_end", "tack_on"], role_ko: "목록 맨 끝에 새 값 붙이기 (Python/Swift)", role_en: "Append item to list end", grammar_ko: "[목록]에 [새값]을 끝에추가", grammar_ex_ko: "목록에 95를 끝에추가", grammar_en: "[list] append_item [value]", grammar_ex_en: "items append_item 95" },
  { code: "push", ko: "밀어넣기", synonyms_ko: ["배열추가", "맨뒤넣기", "푸시"], en: "push_item", synonyms_en: ["push_back", "js_add_end"], role_ko: "배열 맨 뒤에 새 값 추가 (JS)", role_en: "Push item to array end (JS)", grammar_ko: "[배열]에 [새값]을 밀어넣기", grammar_ex_ko: "점수목록에 90을 밀어넣기", grammar_en: "[array] push_item [value]", grammar_ex_en: "scores push_item 90" },
  { code: "add", ko: "더해넣기", synonyms_ko: ["모음넣기", "새항목추가", "주머니넣기"], en: "add_element", synonyms_en: ["insert_into_set", "collection_add"], role_ko: "집합·목록에 항목 더하기 (Java/Kotlin/Set)", role_en: "Add element into collection or set", grammar_ko: "[상자]에 [값]을 더해넣기", grammar_ex_ko: "방문자에 민수를 더해넣기", grammar_en: "[box] add_element [value]", grammar_ex_en: "visitors add_element Alex" },
  { code: "pop", ko: "꺼내지우기", synonyms_ko: ["맨끝꺼내기", "뽑아내기", "팝"], en: "pop_item", synonyms_en: ["take_last", "pull_and_remove"], role_ko: "마지막 값 꺼내고 목록에서 지우기", role_en: "Pop and return item", grammar_ko: "[목록] 꺼내지우기", grammar_ex_ko: "목록 꺼내지우기", grammar_en: "[list] pop_item", grammar_ex_en: "items pop_item" },
  { code: "insert", ko: "끼워넣기", synonyms_ko: ["중간넣기", "자리삽입", "인서트"], en: "insert_at", synonyms_en: ["place_at_index", "tuck_in"], role_ko: "원하는 자리 번호에 새 값 끼워넣기", role_en: "Insert element at index", grammar_ko: "[목록]의 [위치]에 [값]을 끼워넣기", grammar_ex_ko: "목록의 0에 99를 끼워넣기", grammar_en: "[list] insert_at [pos] [val]", grammar_ex_en: "items insert_at 0 99" },
  { code: "remove", ko: "지우기", synonyms_ko: ["찾아지우기", "항목삭제", "빼버리기"], en: "remove_item", synonyms_en: ["erase_match", "drop_item"], role_ko: "같은 값 찾아서 지우기", role_en: "Remove matching item", grammar_ko: "[목록]에서 [값]을 지우기", grammar_ex_ko: "장바구니에서 사과를 지우기", grammar_en: "[list] remove_item [val]", grammar_ex_en: "cart remove_item apple" },
  { code: "clear", ko: "싹비우기", synonyms_ko: ["전부지우기", "초기화비우기", "클리어"], en: "clear_all", synonyms_en: ["empty_box", "wipe_all"], role_ko: "상자 안 내용물 전부 비우기", role_en: "Empty container completely", grammar_ko: "[상자] 싹비우기", grammar_ex_ko: "장바구니 싹비우기", grammar_en: "[box] clear_all", grammar_ex_en: "cart clear_all" },
  { code: "sort", ko: "정렬", synonyms_ko: ["줄세우기", "순서맞추기", "제자리정렬", "나란히정렬"], en: "sort_items", synonyms_en: ["order_in_place", "arrange_items"], role_ko: "작은 순·가나다순 정렬", role_en: "Sort items in ascending order", grammar_ko: "[목록] 정렬  (예: 점수 정렬)", grammar_ex_ko: "점수 정렬", grammar_en: "[list] sort_items", grammar_ex_en: "scores sort_items" },
  { code: "sorted", ko: "새로정렬", synonyms_ko: ["정렬복사", "정렬결과", "차례대로만들기"], en: "sorted_copy", synonyms_en: ["new_sorted_list", "ordered_copy"], role_ko: "원본 유지하며 새 정렬 목록 만들기", role_en: "Return a new sorted list", grammar_ko: "[목록] 새로정렬", grammar_ex_ko: "점수 새로정렬", grammar_en: "sorted_copy [list]", grammar_ex_en: "sorted_copy scores" },
  { code: "reverse", ko: "뒤집기", synonyms_ko: ["거꾸로뒤집기", "역순정렬", "순서반전"], en: "reverse_order", synonyms_en: ["flip_order", "invert_list"], role_ko: "목록 앞뒤 순서 뒤집기", role_en: "Reverse order of items", grammar_ko: "[목록] 뒤집기", grammar_ex_ko: "목록 뒤집기", grammar_en: "[list] reverse_order", grammar_ex_en: "items reverse_order" },
  { code: "filter", ko: "골라내기", synonyms_ko: ["고르기", "골라", "걸러내기", "추려내기", "필터"], en: "filter_items", synonyms_en: ["pick_matching", "keep_where", "sift_items"], role_ko: "조건에 맞는 항목만 골라내기", role_en: "Filter items matching condition", grammar_ko: "[목록]에서 [조건] 골라내기  (예: 점수에서 80 이상 골라내기)", grammar_ex_ko: "점수에서 80 이상 골라내기", grammar_en: "filter_items [list] where [condition]", grammar_ex_en: "filter_items scores >= 80" },
  { code: "map", ko: "하나씩바꾸기", synonyms_ko: ["모두변환", "맵변환", "일괄변환"], en: "map_transform", synonyms_en: ["convert_each", "transform_all"], role_ko: "모든 항목을 규칙대로 한 번에 변환", role_en: "Transform each item in a collection", grammar_ko: "[목록] [변환식] 하나씩바꾸기", grammar_ex_ko: "점수 하나씩바꾸기", grammar_en: "[list] map_transform [rule]", grammar_ex_en: "scores map_transform x * 2" },
  { code: "forEach", ko: "모두실행", synonyms_ko: ["하나씩일시키기", "전체순회", "포이치"], en: "for_each_do", synonyms_en: ["visit_every_item", "do_for_each"], role_ko: "모든 항목마다 차례로 일 실행", role_en: "Run action for each item", grammar_ko: "[배열] 모두실행", grammar_ex_ko: "점수 모두실행", grammar_en: "[array] for_each_do [step]", grammar_ex_en: "scores for_each_do log" },
  { code: "reduce", ko: "합쳐줄이기", synonyms_ko: ["모아줄이기", "누적계산", "리듀스"], en: "reduce_one", synonyms_en: ["fold_items", "accumulate_all"], role_ko: "여러 항목을 하나로 합쳐 계산", role_en: "Fold many items into one result", grammar_ko: "[배열] 합쳐줄이기", grammar_ex_ko: "점수 합쳐줄이기", grammar_en: "[array] reduce_one [fn]", grammar_ex_en: "scores reduce_one add" },
  { code: "includes", ko: "포함확인", synonyms_ko: ["들어있는지", "있는지검사", "포함여부"], en: "includes_item", synonyms_en: ["is_inside", "has_member"], role_ko: "목록·글자 안에 값이 있는지 확인 (JS)", role_en: "Check if value is inside (JS)", grammar_ko: "[목록]에 [값]이 포함확인", grammar_ex_ko: "목록에 사과가 포함확인", grammar_en: "[box] includes_item [val]", grammar_ex_en: "cart includes_item apple" },
  { code: "split", ko: "쪼개기", synonyms_ko: ["글자자르기", "구분자나누기", "스플릿"], en: "split_text", synonyms_en: ["break_words", "chop_by"], role_ko: "기준 문자로 긴 글자 나누기", role_en: "Split string into pieces", grammar_ko: "[글자]을 [구분자]로 쪼개기", grammar_ex_ko: "문장을 쉼표로 쪼개기", grammar_en: "[text] split_text [sep]", grammar_ex_en: "sentence split_text comma" },
  { code: "join", ko: "이어붙이기", synonyms_ko: ["조각합치기", "하나로잇기", "조인"], en: "join_pieces", synonyms_en: ["glue_text", "combine_parts"], role_ko: "조각 글자들을 하나로 연결", role_en: "Join strings into one text", grammar_ko: "[목록]을 [연결글]로 이어붙이기", grammar_ex_ko: "단어들을 쉼표로 이어붙이기", grammar_en: "[list] join_pieces [glue]", grammar_ex_en: "words join_pieces space" },
  { code: "replace", ko: "바꿔치기", synonyms_ko: ["글자바꾸기", "치환하기", "교체하기"], en: "replace_text", synonyms_en: ["swap_words", "substitute_text"], role_ko: "옛 글자를 새 글자로 바꾸기", role_en: "Replace matching text", grammar_ko: "[글자] [옛말] [새말] 바꿔치기", grammar_ex_ko: "문장 옛글 새글 바꿔치기", grammar_en: "[text] replace_text [old] [new]", grammar_ex_en: "msg replace_text old new" },
  { code: "trim", ko: "여백깎기", synonyms_ko: ["양끝빈칸제거", "공백자르기", "트림"], en: "trim_spaces", synonyms_en: ["cut_blank_edges", "clean_ends"], role_ko: "앞뒤 빈칸 깔끔히 제거 (JS/Java)", role_en: "Trim edge whitespace (JS/Java)", grammar_ko: "[글자] 여백깎기", grammar_ex_ko: "이름 여백깎기", grammar_en: "[text] trim_spaces", grammar_ex_en: "name trim_spaces" },
  { code: "strip", ko: "양끝다듬기", synonyms_ko: ["파이썬여백제거", "빈칸벗기기", "스트립"], en: "strip_edges", synonyms_en: ["py_trim", "peel_spaces"], role_ko: "앞뒤 빈칸·줄바꿈 제거 (Python)", role_en: "Strip leading/trailing spaces (Python)", grammar_ko: "[글자] 양끝다듬기", grammar_ex_ko: "이름 양끝다듬기", grammar_en: "[text] strip_edges", grammar_ex_en: "name strip_edges" },
  { code: "sum", ko: "총합", synonyms_ko: ["모두더하기", "합계구하기", "다합치기"], en: "sum_total", synonyms_en: ["add_all_nums", "total_sum"], role_ko: "숫자 목록의 총합 계산", role_en: "Sum all numbers in list", grammar_ko: "[숫자목록] 총합", grammar_ex_ko: "점수목록 총합", grammar_en: "sum_total [numbers]", grammar_ex_en: "sum_total scores" },
  { code: "max", ko: "최대값", synonyms_ko: ["가장큰수", "일등값", "최고값"], en: "max_value", synonyms_en: ["biggest_val", "highest_num"], role_ko: "가장 큰 값 찾기", role_en: "Find largest value", grammar_ko: "[목록] 최대값", grammar_ex_ko: "점수 최대값", grammar_en: "max_value [list]", grammar_ex_en: "max_value scores" },
  { code: "min", ko: "최소값", synonyms_ko: ["가장작은수", "꼴찌값", "최저값"], en: "min_value", synonyms_en: ["smallest_val", "lowest_num"], role_ko: "가장 작은 값 찾기", role_en: "Find smallest value", grammar_ko: "[목록] 최소값", grammar_ex_ko: "점수 최소값", grammar_en: "min_value [list]", grammar_ex_en: "min_value scores" },
  { code: "abs", ko: "절댓값", synonyms_ko: ["음수떼기", "순수크기", "부호없애기"], en: "abs_value", synonyms_en: ["positive_size", "drop_minus"], role_ko: "마이너스 부호 뗀 크기", role_en: "Absolute distance from zero", grammar_ko: "[숫자] 절댓값", grammar_ex_ko: "차이 절댓값", grammar_en: "abs_value [number]", grammar_ex_en: "abs_value diff" },
  { code: "round", ko: "반올림", synonyms_ko: ["가까운수맞추기", "소수반올림"], en: "round_num", synonyms_en: ["nearest_number", "round_decimal"], role_ko: "소수점 반올림", role_en: "Round decimal number", grammar_ko: "[숫자] 반올림", grammar_ex_ko: "평균 반올림", grammar_en: "round_num [number]", grammar_ex_en: "round_num avg" },
  { code: "random", ko: "랜덤뽑기", synonyms_ko: ["무작위수", "임의값", "주사위뽑기"], en: "random_pick", synonyms_en: ["dice_number", "chance_value"], role_ko: "무작위 숫자 뽑기", role_en: "Generate random number", grammar_ko: "랜덤뽑기", grammar_ex_ko: "행운수에 랜덤뽑기 넣기", grammar_en: "random_pick", grammar_ex_en: "lucky = random_pick" },
  { code: "str", ko: "글자상자", synonyms_ko: ["문자형", "글자로바꾸기", "텍스트형"], en: "str_text", synonyms_en: ["make_text", "py_string"], role_ko: "문자열 자료형·변환 (Python)", role_en: "String type/convert (Python)", grammar_ko: "[값] 글자상자", grammar_ex_ko: "점수 글자상자", grammar_en: "str_text [value]", grammar_ex_en: "str_text score" },
  { code: "String", ko: "문자열형", synonyms_ko: ["글자클래스", "스트링형", "대문자글자형"], en: "string_class", synonyms_en: ["text_class", "capital_string"], role_ko: "문자열 클래스/형 (JS/Java/Swift/Kotlin)", role_en: "String class/type", grammar_ko: "[값] 문자열형", grammar_ex_ko: "점수 문자열형", grammar_en: "string_class [value]", grammar_ex_en: "string_class score" },
  { code: "int", ko: "정수형", synonyms_ko: ["딱떨어지는수", "소수없는수", "정수변환"], en: "whole_int", synonyms_en: ["integer_num", "cast_int"], role_ko: "정수 자료형·변환", role_en: "Whole integer type/conversion", grammar_ko: "[값] 정수형", grammar_ex_ko: "나이 정수형", grammar_en: "whole_int [value]", grammar_ex_en: "whole_int age" },
  { code: "float", ko: "소수형", synonyms_ko: ["실수형", "소수점수", "플로트"], en: "decimal_float", synonyms_en: ["floating_num", "cast_float"], role_ko: "소수점 있는 실수형", role_en: "Floating decimal number", grammar_ko: "[값] 소수형", grammar_ex_ko: "평균 소수형", grammar_en: "decimal_float [value]", grammar_ex_en: "decimal_float avg" },
  { code: "bool", ko: "논리형", synonyms_ko: ["참거짓형", "불리언짧음", "맞틀림형"], en: "logic_bool", synonyms_en: ["short_boolean", "truth_type"], role_ko: "참·거짓 논리 자료형 (Python/Swift/C)", role_en: "Short boolean logic type", grammar_ko: "[값] 논리형", grammar_ex_ko: "완료 논리형", grammar_en: "logic_bool [value]", grammar_ex_en: "logic_bool done" },
  { code: "list", ko: "목록", synonyms_ko: ["줄목록", "리스트상자", "목록만들기"], en: "item_list", synonyms_en: ["py_list", "ordered_items"], role_ko: "순서대로 담는 목록 상자", role_en: "Ordered list box", grammar_ko: "목록 [항목들]", grammar_ex_ko: "과일에 목록 넣기", grammar_en: "item_list [items]", grammar_ex_en: "fruits = item_list" },
  { code: "Array", ko: "배열", synonyms_ko: ["줄배열", "어레이", "칸상자"], en: "value_array", synonyms_en: ["js_array", "fixed_slots"], role_ko: "배열 목록 상자 (JS/Kotlin/Swift)", role_en: "Array container class", grammar_ko: "배열 [항목들]", grammar_ex_ko: "점수들 배열", grammar_en: "value_array [items]", grammar_ex_en: "value_array scores" },
  { code: "dict", ko: "사전", synonyms_ko: ["이름표상자", "딕셔너리", "짝궁상자"], en: "key_dict", synonyms_en: ["lookup_book", "py_dict"], role_ko: "이름표-값 사전 상자 (Python)", role_en: "Key-value dictionary (Python)", grammar_ko: "사전 [이름표: 값]", grammar_ex_ko: "성적표 사전", grammar_en: "key_dict [pairs]", grammar_ex_en: "key_dict scores" },
  { code: "set", ko: "중복없는모음", synonyms_ko: ["고유집합", "중복제거주머니"], en: "unique_set", synonyms_en: ["distinct_bag", "py_set"], role_ko: "중복 없는 고유 값 집합", role_en: "Unique items set", grammar_ko: "[목록] 중복없는모음", grammar_ex_ko: "이름들 중복없는모음", grammar_en: "unique_set [items]", grammar_ex_en: "unique_set names" },
  { code: "class", ko: "설계도", synonyms_ko: ["클래스설계", "물건틀", "분류틀"], en: "blueprint_class", synonyms_en: ["object_template", "class_def"], role_ko: "객체 설계도(class)", role_en: "Object class blueprint", grammar_ko: "설계도 [이름]", grammar_ex_ko: "설계도 캐릭터", grammar_en: "blueprint_class [name]", grammar_ex_en: "blueprint_class Player" },
  { code: "import", ko: "도구불러오기", synonyms_ko: ["모듈가져오기", "외부도구가져오기", "임포트"], en: "bring_tool", synonyms_en: ["import_module", "load_library"], role_ko: "다른 파일·라이브러리 도구 가져오기", role_en: "Import external library or module", grammar_ko: "[도구이름] 도구불러오기", grammar_ex_ko: "수학 도구불러오기", grammar_en: "bring_tool [module]", grammar_ex_en: "bring_tool math" },
  { code: "try", ko: "시도", synonyms_ko: ["안전시도", "오류감시시작", "해보기"], en: "try_safely", synonyms_en: ["attempt_safely", "watch_errors"], role_ko: "오류가 날 수 있는 작업 감싸서 실행", role_en: "Try block guarding possible errors", grammar_ko: "시도 [위험할수있는일]", grammar_ex_ko: "시도 파일열기", grammar_en: "try_safely [steps]", grammar_ex_en: "try_safely open_file" },
  { code: "except", ko: "오류잡기", synonyms_ko: ["예외처리", "파이썬오류대비", "문제발생시"], en: "handle_except", synonyms_en: ["py_catch_error", "on_exception"], role_ko: "시도 중 오류 잡아서 처리 (Python)", role_en: "Python exception handler", grammar_ko: "오류잡기 [대체할일]", grammar_ex_ko: "오류잡기 안내 출력", grammar_en: "handle_except [fallback]", grammar_ex_en: "handle_except print err" },
  { code: "catch", ko: "에러받기", synonyms_ko: ["예외잡기", "자스오류처리", "캐치"], en: "catch_error", synonyms_en: ["trap_failure", "js_catch"], role_ko: "시도 중 오류 잡기 (JS/Java/Kotlin/C++)", role_en: "Catch error handler (JS/Java)", grammar_ko: "에러받기 [대체할일]", grammar_ex_ko: "에러받기 안내 콘솔출력", grammar_en: "catch_error [fallback]", grammar_ex_en: "catch_error console_log err" },
  { code: "finally", ko: "마무리항상", synonyms_ko: ["끝나고무조건", "항상실행마무리"], en: "always_finally", synonyms_en: ["cleanup_always", "finish_block"], role_ko: "성공/실패 상관없이 마지막에 항상 실행", role_en: "Finally block always executed", grammar_ko: "마무리항상 [정리할일]", grammar_ex_ko: "마무리항상 파일닫기", grammar_en: "always_finally [cleanup]", grammar_ex_en: "always_finally close_resource" },
  { code: "async", ko: "기다림없이", synonyms_ko: ["비동기작업", "백그라운드함수"], en: "async_mode", synonyms_en: ["background_task", "non_blocking_fn"], role_ko: "기다리는 동안 멈추지 않는 비동기 표시", role_en: "Async non-blocking modifier", grammar_ko: "기다림없이 함수선언 [이름]", grammar_ex_ko: "기다림없이 함수선언 불러오기", grammar_en: "async_mode declare_function [name]", grammar_ex_en: "async_mode declare_function fetch_data" },
  { code: "await", ko: "도착기다리기", synonyms_ko: ["완료기다림", "결과대기"], en: "wait_ready", synonyms_en: ["await_answer", "pause_for_result"], role_ko: "비동기 작업 끝날 때까지 잠깐 기다림", role_en: "Await asynchronous result", grammar_ko: "도착기다리기 [비동기작업]", grammar_ex_ko: "도착기다리기 주소요청", grammar_en: "wait_ready [promise]", grammar_ex_en: "wait_ready fetch_web" },
  { code: "fetch", ko: "웹요청하기", synonyms_ko: ["인터넷가져오기", "주소요청", "서버호출"], en: "fetch_web", synonyms_en: ["request_url", "download_api"], role_ko: "웹 주소에서 정보 가져오기", role_en: "Fetch network resource from URL", grammar_ko: "[주소] 웹요청하기", grammar_ex_ko: "주소 웹요청하기", grammar_en: "fetch_web [url]", grammar_ex_en: "fetch_web api_url" },
  { code: "document.getElementById", ko: "아이디로부품찾기", synonyms_ko: ["화면아이디찾기", "태그아이디가져오기"], en: "find_by_id", synonyms_en: ["get_page_id", "dom_id_lookup"], role_ko: "HTML 화면에서 ID로 요소 찾기", role_en: "Find DOM element by id", grammar_ko: "[아이디이름] 아이디로부품찾기", grammar_ex_ko: "제목 아이디로부품찾기", grammar_en: "find_by_id [id]", grammar_ex_en: "find_by_id title" },
  { code: "document.querySelector", ko: "규칙으로부품찾기", synonyms_ko: ["화면선택자찾기", "첫요소선택"], en: "find_first_selector", synonyms_en: ["query_dom", "select_element"], role_ko: "CSS 규칙으로 화면 첫 요소 찾기", role_en: "Find first DOM element matching selector", grammar_ko: "[규칙] 규칙으로부품찾기", grammar_ex_ko: "버튼 규칙으로부품찾기", grammar_en: "find_first_selector [rule]", grammar_ex_en: "find_first_selector btn" },
  { code: "addEventListener", ko: "행동연결", synonyms_ko: ["클릭기다리기", "이벤트달기", "반응연결"], en: "on_event", synonyms_en: ["listen_action", "bind_click"], role_ko: "클릭·입력 같은 사용자 행동에 반응 연결", role_en: "Attach user action event listener", grammar_ko: "[부품]에 [행동] 행동연결", grammar_ex_ko: "버튼에 클릭 행동연결", grammar_en: "[el] on_event [action]", grammar_ex_en: "btn on_event click" },
  { code: "setTimeout", ko: "잠깐뒤실행", synonyms_ko: ["타이머한번", "시간뒤실행", "지연실행"], en: "delay_once", synonyms_en: ["wait_then_run", "timer_once"], role_ko: "정해진 시간 뒤에 한 번 실행", role_en: "Run once after delay", grammar_ko: "[밀리초] 뒤 잠깐뒤실행", grammar_ex_ko: "1000 잠깐뒤실행", grammar_en: "delay_once [ms]", grammar_ex_en: "delay_once 1000" },
  { code: "setInterval", ko: "주기반복", synonyms_ko: ["몇초마다실행", "계속타이머", "정기실행"], en: "repeat_every", synonyms_en: ["interval_timer", "tick_every"], role_ko: "정해진 간격마다 계속 반복 실행", role_en: "Run repeatedly on interval", grammar_ko: "[밀리초]마다 주기반복", grammar_ex_ko: "1000 주기반복", grammar_en: "repeat_every [ms]", grammar_ex_en: "repeat_every 1000" },
  { code: "JSON.parse", ko: "제이슨풀기", synonyms_ko: ["문자상자변환", "제이슨해석"], en: "unpack_json", synonyms_en: ["parse_json_text", "decode_json"], role_ko: "JSON 글자를 객체·목록 상자로 풀기", role_en: "Parse JSON string into object", grammar_ko: "[제이슨글자] 제이슨풀기", grammar_ex_ko: "응답글 제이슨풀기", grammar_en: "unpack_json [text]", grammar_ex_en: "unpack_json reply_text" },
  { code: "JSON.stringify", ko: "제이슨묶기", synonyms_ko: ["상자문자포장", "제이슨변환"], en: "pack_json", synonyms_en: ["stringify_json", "encode_json"], role_ko: "상자·목록을 저장·전송용 JSON 글자로 묶기", role_en: "Serialize object into JSON string", grammar_ko: "[상자] 제이슨묶기", grammar_ex_ko: "설정값 제이슨묶기", grammar_en: "pack_json [box]", grammar_ex_en: "pack_json settings" }
];

const CODE_BUNDLES_BY_CODE = new Map();
const CANONICAL_KO_BY_CODE = new Map();
const CANONICAL_EN_BY_CODE = new Map();
const SYNONYM_TO_OWNER_KO = new Map();
const SYNONYM_TO_OWNER_EN = new Map();

function initExclusiveBundleIndexes() {
  CODE_BUNDLES_BY_CODE.clear();
  CANONICAL_KO_BY_CODE.clear();
  CANONICAL_EN_BY_CODE.clear();
  SYNONYM_TO_OWNER_KO.clear();
  SYNONYM_TO_OWNER_EN.clear();

  for (const rawB of CODE_SYNONYM_BUNDLES) {
    const cleanSynsKo = [];
    const cleanSynsEn = [];
    if (rawB.ko) {
      CANONICAL_KO_BY_CODE.set(rawB.code, rawB.ko);
      if (!SYNONYM_TO_OWNER_KO.has(rawB.ko)) {
        SYNONYM_TO_OWNER_KO.set(rawB.ko, { code: rawB.code, canonical: rawB.ko, canonicalEn: rawB.en, isCanonical: true });
      }
    }
    if (rawB.en) {
      CANONICAL_EN_BY_CODE.set(rawB.code, rawB.en);
      const enLow = rawB.en.toLowerCase();
      if (!SYNONYM_TO_OWNER_EN.has(enLow)) {
        SYNONYM_TO_OWNER_EN.set(enLow, { code: rawB.code, canonical: rawB.en, canonicalKo: rawB.ko, isCanonical: true });
      }
    }
    for (const sKo of rawB.synonyms_ko || []) {
      const clean = String(sKo || "").trim();
      if (!clean || SYNONYM_TO_OWNER_KO.has(clean)) continue;
      SYNONYM_TO_OWNER_KO.set(clean, { code: rawB.code, canonical: rawB.ko, canonicalEn: rawB.en, isCanonical: false });
      cleanSynsKo.push(clean);
    }
    for (const sEn of rawB.synonyms_en || []) {
      const clean = String(sEn || "").trim();
      const low = clean.toLowerCase();
      if (!low || SYNONYM_TO_OWNER_EN.has(low)) continue;
      SYNONYM_TO_OWNER_EN.set(low, { code: rawB.code, canonical: rawB.en, canonicalKo: rawB.ko, isCanonical: false });
      cleanSynsEn.push(clean);
    }
    CODE_BUNDLES_BY_CODE.set(rawB.code, Object.assign({}, rawB, {
      synonyms_ko: cleanSynsKo,
      synonyms_en: cleanSynsEn
    }));
  }
}

function registerCartridgeBundlesIntoIndex(entries) {
  if (!entries || typeof entries !== "object") return;
  for (const [code, tr] of Object.entries(entries)) {
    if (!tr || typeof tr !== "object" || !code) continue;
    const harvestedKo = String(tr.ko || "").trim();
    const harvestedEn = String(tr.en || "").trim();
    const exclusive = CODE_BUNDLES_BY_CODE.get(code);
    const canonKo = exclusive && exclusive.ko
      ? exclusive.ko
      : (CANONICAL_KO_BY_CODE.get(code) || (isHarvestedGlossPhrase(harvestedKo, code) ? "" : harvestedKo));
    const canonEn = exclusive && exclusive.en
      ? exclusive.en
      : (CANONICAL_EN_BY_CODE.get(code) || (isHarvestedGlossPhrase(harvestedEn, code) ? "" : harvestedEn));
    if (canonKo && !CANONICAL_KO_BY_CODE.has(code)) CANONICAL_KO_BY_CODE.set(code, canonKo);
    if (canonEn && !CANONICAL_EN_BY_CODE.has(code)) CANONICAL_EN_BY_CODE.set(code, canonEn);

    if (canonKo && !SYNONYM_TO_OWNER_KO.has(canonKo)) {
      SYNONYM_TO_OWNER_KO.set(canonKo, { code, canonical: canonKo, canonicalEn: canonEn || code, isCanonical: true });
    }
    if (canonEn && !SYNONYM_TO_OWNER_EN.has(canonEn.toLowerCase())) {
      SYNONYM_TO_OWNER_EN.set(canonEn.toLowerCase(), { code, canonical: canonEn, canonicalKo: canonKo || code, isCanonical: true });
    }
    if (harvestedKo && harvestedKo !== canonKo && !SYNONYM_TO_OWNER_KO.has(harvestedKo)) {
      SYNONYM_TO_OWNER_KO.set(harvestedKo, { code, canonical: canonKo || code, canonicalEn: canonEn || code, isCanonical: false, glossOnly: true });
    }
    if (harvestedEn && harvestedEn.toLowerCase() !== String(canonEn || "").toLowerCase() && !SYNONYM_TO_OWNER_EN.has(harvestedEn.toLowerCase())) {
      SYNONYM_TO_OWNER_EN.set(harvestedEn.toLowerCase(), { code, canonical: canonEn || code, canonicalKo: canonKo || code, isCanonical: false, glossOnly: true });
    }
    const existing = CODE_BUNDLES_BY_CODE.get(code);
    const synKoArr = existing ? existing.synonyms_ko.slice() : [];
    const synEnArr = existing ? existing.synonyms_en.slice() : [];
    for (const sKo of tr.synonyms_ko || []) {
      const w = String(sKo || "").trim();
      if (!w) continue;
      const curOwner = SYNONYM_TO_OWNER_KO.get(w);
      if (!curOwner) {
        SYNONYM_TO_OWNER_KO.set(w, { code, canonical: canonKo, canonicalEn: canonEn, isCanonical: false });
        if (!synKoArr.includes(w)) synKoArr.push(w);
      } else if (curOwner.code === code && w !== canonKo && !synKoArr.includes(w)) {
        synKoArr.push(w);
      }
    }
    for (const sEn of tr.synonyms_en || []) {
      const w = String(sEn || "").trim();
      const low = w.toLowerCase();
      if (!low) continue;
      const curOwner = SYNONYM_TO_OWNER_EN.get(low);
      if (!curOwner) {
        SYNONYM_TO_OWNER_EN.set(low, { code, canonical: canonEn, canonicalKo: canonKo, isCanonical: false });
        if (!synEnArr.includes(w)) synEnArr.push(w);
      } else if (curOwner.code === code && low !== canonEn.toLowerCase() && !synEnArr.includes(w)) {
        synEnArr.push(w);
      }
    }
    CODE_BUNDLES_BY_CODE.set(code, {
      code,
      ko: canonKo,
      en: canonEn,
      synonyms_ko: synKoArr,
      synonyms_en: synEnArr,
      role_ko: (existing && existing.role_ko) || tr.role_ko || tr.category || "",
      role_en: (existing && existing.role_en) || tr.role_en || tr.category_en || "",
      grammar_ko: (existing && existing.grammar_ko) || tr.grammar_ko || "",
      grammar_ex_ko: (existing && existing.grammar_ex_ko) || tr.grammar_ex_ko || "",
      grammar_en: (existing && existing.grammar_en) || tr.grammar_en || "",
      grammar_ex_en: (existing && existing.grammar_ex_en) || tr.grammar_ex_en || ""
    });
  }
}

function getExclusiveBundleMeta(code, scope = currentLang, rawEntry = null, itemEntry = null) {
  const b = CODE_BUNDLES_BY_CODE.get(code);
  const src = rawEntry || itemEntry || {};
  const canonKo = (b && b.ko) || src.ko || "";
  const canonEn = (b && b.en) || src.en || "";
  const synKo = (b && b.synonyms_ko && b.synonyms_ko.length)
    ? b.synonyms_ko
    : (Array.isArray(src.synonyms_ko) ? src.synonyms_ko : []).filter((w) => {
        const ow = SYNONYM_TO_OWNER_KO.get(w);
        return (!ow || ow.code === code) && w !== canonKo;
      });
  const synEn = (b && b.synonyms_en && b.synonyms_en.length)
    ? b.synonyms_en
    : (Array.isArray(src.synonyms_en) ? src.synonyms_en : []).filter((w) => {
        const ow = SYNONYM_TO_OWNER_EN.get(String(w || "").toLowerCase());
        return (!ow || ow.code === code) && String(w || "").toLowerCase() !== canonEn.toLowerCase();
      });
  return {
    code,
    ko: canonKo,
    en: canonEn,
    synonyms_ko: synKo,
    synonyms_en: synEn,
    role_ko: (b && b.role_ko) || src.role_ko || src.category || "",
    role_en: (b && b.role_en) || src.role_en || src.category_en || "",
    grammar_ko: (b && b.grammar_ko) || src.grammar_ko || "",
    grammar_ex_ko: (b && b.grammar_ex_ko) || src.grammar_ex_ko || "",
    grammar_en: (b && b.grammar_en) || src.grammar_en || "",
    grammar_ex_en: (b && b.grammar_ex_en) || src.grammar_ex_en || ""
  };
}

initExclusiveBundleIndexes();

// Strictly disjoint 1:1 clusters (1 code per cluster, zero shared trigger words across different codes)
const KO_SYNONYM_CLUSTERS = Array.from(CODE_BUNDLES_BY_CODE.values()).map((b) => ({
  id: `ko_${b.code}`,
  labelKo: b.role_ko || b.ko || b.code,
  triggers: Array.from(new Set([b.ko, ...(b.synonyms_ko || [])].filter(Boolean))),
  codes: [b.code]
}));

const EN_SYNONYM_CLUSTERS = Array.from(CODE_BUNDLES_BY_CODE.values()).map((b) => ({
  id: `en_${b.code}`,
  labelEn: b.role_en || b.en || b.code,
  triggers: Array.from(new Set([b.en, ...(b.synonyms_en || [])].filter(Boolean))),
  codes: [b.code]
}));

if (typeof window !== "undefined") {
  window.CODE_SYNONYM_BUNDLES = CODE_SYNONYM_BUNDLES;
  window.CODE_BUNDLES_BY_CODE = CODE_BUNDLES_BY_CODE;
  window.CANONICAL_KO_BY_CODE = CANONICAL_KO_BY_CODE;
  window.CANONICAL_EN_BY_CODE = CANONICAL_EN_BY_CODE;
  window.SYNONYM_TO_OWNER_KO = SYNONYM_TO_OWNER_KO;
  window.SYNONYM_TO_OWNER_EN = SYNONYM_TO_OWNER_EN;
  window.getExclusiveBundleMeta = getExclusiveBundleMeta;
  window.KO_SYNONYM_CLUSTERS = KO_SYNONYM_CLUSTERS;
  window.EN_SYNONYM_CLUSTERS = EN_SYNONYM_CLUSTERS;
}

function computeSynonymClusterScore(queryStems, codeToken) {
  if (!queryStems || !queryStems.length || !codeToken) return 0;
  const codeL = codeToken.toLowerCase();
  let bestScore = 0;

  for (const cluster of [...KO_SYNONYM_CLUSTERS, ...EN_SYNONYM_CLUSTERS]) {
    let triggerQuality = 0;
    for (const qStem of queryStems) {
      if (!qStem || qStem.length < 2) continue;
      for (const trig of cluster.triggers) {
        const trigL = trig.toLowerCase();
        if (qStem === trigL) {
          triggerQuality = Math.max(triggerQuality, 100);
        } else if (trigL.length >= 2 && (qStem.includes(trigL) || trigL.startsWith(qStem))) {
          triggerQuality = Math.max(triggerQuality, 75);
        }
      }
    }
    if (triggerQuality === 0) continue;

    for (let idx = 0; idx < cluster.codes.length; idx++) {
      const targetCode = cluster.codes[idx];
      const targetL = targetCode.toLowerCase();
      let codeMatchTier = 0;
      if (codeToken === targetCode || codeL === targetL) {
        codeMatchTier = 3;
      } else if (codeL.endsWith("." + targetL) || targetL.endsWith("." + codeL)) {
        codeMatchTier = 2;
      }
      if (codeMatchTier > 0) {
        const score = 690 + (triggerQuality >= 100 ? 70 : 30) + (codeMatchTier === 3 ? 25 : 0) - idx * 8;
        if (score > bestScore) bestScore = score;
      }
    }
  }
  return bestScore;
}

function buildSemanticInvertedIndex(entriesOverride = null) {
  const idx = new Map();
  const sourceList = entriesOverride || (flatGlobalEntries && flatGlobalEntries.length > 0 ? flatGlobalEntries : []);

  const addIndexToken = (stem, codeToken, weight) => {
    if (!stem || stem.length < 2 || !codeToken) return;
    let bucket = idx.get(stem);
    if (!bucket) {
      bucket = new Map();
      idx.set(stem, bucket);
    }
    const prev = bucket.get(codeToken) || 0;
    if (weight > prev) bucket.set(codeToken, weight);
  };

  for (const item of sourceList) {
    const code = item.code || item.codeToken;
    if (!code) continue;
    const tr = item.tr || {};
    const fields = [
      { text: item.ko || item.koVal || "", w: 65 },
      { text: item.en || item.enVal || "", w: 55 },
      { text: item.desc || tr.desc || "", w: 45 },
      { text: item.desc_en || tr.desc_en || "", w: 45 },
      { text: item.usage || tr.usage || "", w: 32 },
      { text: item.usage_en || tr.usage_en || "", w: 32 },
      { text: item.result || tr.result || "", w: 28 },
      { text: item.result_en || tr.result_en || "", w: 28 },
      { text: item.category || tr.category || "", w: 30 },
      { text: item.category_en || tr.category_en || "", w: 28 }
    ];

    for (const f of fields) {
      if (!f.text) continue;
      const rawTokens = String(f.text).match(/[가-힣A-Za-z0-9_]+/g) || [];
      for (const tok of rawTokens) {
        const stems = extractBilingualStems(tok);
        for (const st of stems) {
          addIndexToken(st, code, f.w);
        }
      }
    }
  }

  // Also index current cartridge entries if flatGlobalEntries hasn't loaded yet
  if (idx.size === 0 && completionIndex && completionIndex.length > 0) {
    for (const row of completionIndex) {
      const tr = row.tr || {};
      const joined = [row.koVal, row.enVal, tr.desc, tr.desc_en, tr.usage, tr.result].filter(Boolean).join(" ");
      const rawTokens = joined.match(/[가-힣A-Za-z0-9_]+/g) || [];
      for (const tok of rawTokens) {
        for (const st of extractBilingualStems(tok)) {
          addIndexToken(st, row.codeToken, 50);
        }
      }
    }
    semanticIndexBuiltFromGlobal = false;
  } else if (!entriesOverride && sourceList.length > 0) {
    semanticIndexBuiltFromGlobal = true;
  }

  semanticInvertedIndex = idx;
  return semanticInvertedIndex;
}
if (typeof window !== "undefined") window.buildSemanticInvertedIndex = buildSemanticInvertedIndex;

function computeInvertedIndexScore(queryStems, codeToken) {
  if (!semanticInvertedIndex || semanticInvertedIndex.size === 0 || !codeToken) return 0;
  let totalWeight = 0;
  let matchedStems = 0;
  for (const st of queryStems) {
    if (!st || st.length < 2) continue;
    const bucket = semanticInvertedIndex.get(st);
    if (bucket && bucket.has(codeToken)) {
      totalWeight += bucket.get(codeToken);
      matchedStems += 1;
    }
  }
  if (matchedStems === 0) return 0;
  return Math.min(640, 420 + totalWeight + matchedStems * 25);
}

// --- User-Learned Personal Mapping Storage & Lookup ---
function ensureLearnedBuckets(rawObj) {
  const scopes = ["global", "python", "javascript", "typescript", "kotlin", "swift", "c", "java"];
  const clean = {};
  const src = (rawObj && rawObj.mappings) || rawObj || {};
  for (const sc of scopes) {
    clean[sc] = src && typeof src[sc] === "object" && !Array.isArray(src[sc]) ? { ...src[sc] } : {};
  }
  return clean;
}

async function loadUserLearnedMappings() {
  let loaded = null;
  if (typeof window !== "undefined" && window.pywebview && window.pywebview.api && window.pywebview.api.get_user_learned_mappings) {
    try {
      const res = await window.pywebview.api.get_user_learned_mappings();
      if (res && res.ok && res.mappings) loaded = res.mappings;
    } catch (_) {}
  }
  if (!loaded && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(USER_LEARNED_STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (_) {}
  }
  userLearnedMappings = ensureLearnedBuckets(loaded);
  if (typeof window !== "undefined") window.userLearnedMappings = userLearnedMappings;
  return userLearnedMappings;
}

async function saveUserLearnedMappings() {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(USER_LEARNED_STORAGE_KEY, JSON.stringify(userLearnedMappings));
    } catch (_) {}
  }
  if (typeof window !== "undefined" && window.pywebview && window.pywebview.api && window.pywebview.api.save_user_learned_mappings) {
    try {
      await window.pywebview.api.save_user_learned_mappings(userLearnedMappings);
    } catch (_) {}
  }
}

function lookupUserLearnedRecord(naturalWord, lang = currentLang) {
  if (!naturalWord) return null;
  const clean = String(naturalWord).trim().toLowerCase();
  if (!clean) return null;
  const scopesToCheck = [];
  if (lang && userLearnedMappings[lang]) scopesToCheck.push(userLearnedMappings[lang]);
  if (userLearnedMappings.global) scopesToCheck.push(userLearnedMappings.global);

  for (const bucket of scopesToCheck) {
    if (Object.prototype.hasOwnProperty.call(bucket, clean)) {
      return bucket[clean];
    }
  }
  const stems = extractBilingualStems(clean);
  for (const st of stems) {
    for (const bucket of scopesToCheck) {
      if (Object.prototype.hasOwnProperty.call(bucket, st)) {
        return bucket[st];
      }
    }
  }
  return null;
}

function lookupUserLearnedCode(naturalWord, lang = currentLang) {
  const rec = lookupUserLearnedRecord(naturalWord, lang);
  return rec && rec.code ? rec.code : null;
}

function recordUserLearnedMapping(rawQuery, codeToken, lang = currentLang) {
  const q = String(rawQuery || "").trim().toLowerCase();
  const code = String(codeToken || "").trim();
  if (!q || !code || q === code.toLowerCase()) return false;
  // Do not pollute single-word personal dictionary with multi-word sentence patterns
  if (
    q.length > 24 ||
    (typeof parseNaturalSentenceToCode === "function" &&
      (parseKoreanSentenceToCode(q, lang) || parseEnglishSentenceToCode(q, lang)))
  ) {
    return false;
  }

  const targetLang = ["python", "javascript", "typescript", "kotlin", "swift", "c", "java"].includes(lang) ? lang : currentLang;
  if (typeof isGrammarProtectedNatural === "function" && isGrammarProtectedNatural(q)) {
    const owner = (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.get(rawQuery.trim()))
      || (typeof SYNONYM_TO_OWNER_EN !== "undefined" && SYNONYM_TO_OWNER_EN.get(q));
    if (owner && owner.code && owner.code !== code) return false;
  }
  if (typeof isBundleCodeRunnableInLang === "function" && !isBundleCodeRunnableInLang(code, targetLang)) {
    return false;
  }
  userLearnedMappings = ensureLearnedBuckets(userLearnedMappings);

  const now = Date.now();
  const prevCount =
    (userLearnedMappings[targetLang][q] && userLearnedMappings[targetLang][q].count) ||
    (userLearnedMappings.global[q] && userLearnedMappings.global[q].count) ||
    0;

  const record = { code, rawQuery: rawQuery.trim(), count: prevCount + 1, updatedAt: now };
  userLearnedMappings[targetLang][q] = record;
  userLearnedMappings.global[q] = { ...record };

  // Also bind primary KO/EN stem if distinct so inflections work too
  const stems = extractBilingualStems(q).filter((s) => s !== q && s.length >= 2);
  if (stems.length > 0 && !userLearnedMappings[targetLang][stems[0]]) {
    userLearnedMappings[targetLang][stems[0]] = { ...record, derivedFrom: q };
  }

  if (typeof window !== "undefined") window.userLearnedMappings = userLearnedMappings;
  saveUserLearnedMappings();
  if (typeof renderLearnedMappingsUI === "function") renderLearnedMappingsUI();
  if (typeof updateMasks === "function" && editor) updateMasks();
  return true;
}

function removeUserLearnedMapping(scope, key) {
  if (userLearnedMappings[scope] && Object.prototype.hasOwnProperty.call(userLearnedMappings[scope], key)) {
    delete userLearnedMappings[scope][key];
    if (scope !== "global" && userLearnedMappings.global && userLearnedMappings.global[key]) {
      delete userLearnedMappings.global[key];
    }
    saveUserLearnedMappings();
    if (typeof renderLearnedMappingsUI === "function") renderLearnedMappingsUI();
  }
}

function clearUserLearnedMappings() {
  userLearnedMappings = ensureLearnedBuckets({});
  if (typeof window !== "undefined") window.userLearnedMappings = userLearnedMappings;
  saveUserLearnedMappings();
  if (typeof renderLearnedMappingsUI === "function") renderLearnedMappingsUI();
}
if (typeof window !== "undefined") {
  window.recordUserLearnedMapping = recordUserLearnedMapping;
  window.lookupUserLearnedCode = lookupUserLearnedCode;
  window.clearUserLearnedMappings = clearUserLearnedMappings;
}

// --- Feature 2: Symbol-Free Skeletons + 4 Korean Word-Order Sentence Patterns ---
function buildSymbolSkeletonForCode(codeToken, lang = currentLang) {
  const l = codegenLang(lang);
  const isBrace = l !== "python";

  if (codeToken === "print" || codeToken === "println" || codeToken === "printf" || codeToken === "console.log" || codeToken === "System.out.println") {
    const printLine = emitPrintCall(codeToken, '"${1:내용}"', l);
    const preview = emitPrintCall(codeToken, '"내용"', l);
    return { snippet: printLine, preview };
  }
  if (codeToken === "console.warn" || codeToken === "console.error") {
    const printLine = emitPrintCall(codeToken, '"${1:내용}"', l);
    const preview = emitPrintCall(codeToken, '"내용"', l);
    return { snippet: printLine, preview };
  }
  if (codeToken === "input" || codeToken === "prompt") {
    if (l === "javascript") return { snippet: 'prompt("${1:안내문구: }")', preview: 'prompt("안내문구: ")' };
    if (l === "python") return { snippet: 'input("${1:안내문구: }")', preview: 'input("안내문구: ")' };
    return { snippet: 'input("${1:안내문구: }")', preview: 'input("안내문구: ")' };
  }
  if (codeToken === "len" || codeToken === "length" || codeToken === "size") {
    return { snippet: emitLenExpr("${1:대상}", l), preview: emitLenExpr("대상", l) };
  }
  if (codeToken === "range") {
    return { snippet: "range(${1:횟수})", preview: "range(횟수)" };
  }
  if (codeToken === "sorted") {
    return { snippet: emitAggCall("sorted", "${1:목록}", l), preview: emitAggCall("sorted", "목록", l) };
  }
  if (codeToken === "filter") {
    return { snippet: emitFilterExpr("${2:목록}", "${1:조건}", l), preview: emitFilterExpr("목록", "조건", l) };
  }
  if (codeToken === "open") {
    return l === "python"
      ? { snippet: 'open("${1:result.txt}", "${2:w}", encoding="utf-8")', preview: 'open("result.txt", "w", encoding="utf-8")' }
      : { snippet: 'open("${1:파일}")', preview: 'open("파일")' };
  }
  if (codeToken === "if") {
    return l === "python"
      ? { snippet: "if ${1:조건}:\n    ${2:pass}", preview: "if 조건:\n    pass" }
      : l === "swift"
        ? { snippet: "if ${1:조건} {\n    ${2:}\n}", preview: "if 조건 {\n    ...\n}" }
        : { snippet: "if (${1:조건}) {\n    ${2:}\n}", preview: "if (조건) {\n    ...\n}" };
  }
  if (codeToken === "elif" || codeToken === "else if" || codeToken === "else") {
    if (codeToken === "elif" || codeToken === "else if") {
      const hdr = buildIfHeaderCode("${1:조건}", l, true);
      const prev = buildIfHeaderCode("조건", l, true);
      return { snippet: l === "python" ? `${hdr}\n    \${2:pass}` : `${hdr}\n    \${2:}\n}`, preview: prev };
    }
    return l === "python"
      ? { snippet: "else:\n    ${1:pass}", preview: "else:\n    pass" }
      : { snippet: "else {\n    ${1:}\n}", preview: "else {\n    ...\n}" };
  }
  if (codeToken === "for") {
    if (l === "python") return { snippet: `for \${1:item} in \${2:items}:\n    ${emitPrintCall("print", "item", "python")}`, preview: `for item in items:\n    ${emitPrintCall("print", "item", "python")}` };
    if (l === "javascript") return { snippet: "for (const ${1:item} of ${2:items}) {\n    ${3:console.log(item);}\n}", preview: "for (const item of items) { ... }" };
    if (l === "kotlin") return { snippet: "for (${1:item} in ${2:items}) {\n    ${3:println(item)}\n}", preview: "for (item in items) { ... }" };
    if (l === "swift") return { snippet: "for ${1:item} in ${2:items} {\n    ${3:print(item)}\n}", preview: "for item in items { ... }" };
    return { snippet: "for (int ${1:i} = 0; ${1:i} < ${2:5}; ${1:i}++) {\n    ${3:}\n}", preview: "for (int i = 0; i < 5; i++) { ... }" };
  }
  if (codeToken === "while") {
    return l === "python"
      ? { snippet: "while ${1:조건}:\n    ${2:pass}", preview: "while 조건:\n    pass" }
      : l === "swift"
        ? { snippet: "while ${1:조건} {\n    ${2:}\n}", preview: "while 조건 { ... }" }
        : { snippet: "while (${1:조건}) {\n    ${2:}\n}", preview: "while (조건) { ... }" };
  }
  if (codeToken === "def" || codeToken === "function" || codeToken === "fun" || codeToken === "func") {
    const hdr = buildFunctionHeaderCode("${1:기능이름}", ["${2:값}"], l);
    const prev = buildFunctionHeaderCode("기능이름", ["값"], l);
    return { snippet: l === "python" ? `${hdr}\n    \${3:return 값}` : `${hdr}\n    \${3:}\n}`, preview: prev };
  }
  if (codeToken === "return") {
    return l === "javascript" || l === "c" || l === "java"
      ? { snippet: "return ${1:결과};", preview: "return 결과;" }
      : { snippet: "return ${1:결과}", preview: "return 결과" };
  }
  return null;
}
if (typeof window !== "undefined") window.buildSymbolSkeletonForCode = buildSymbolSkeletonForCode;

const KO_NOUN_TO_IDENT = Object.assign(Object.create(null), {
  "점수": { single: "score", plural: "scores" },
  "성적": { single: "grade", plural: "grades" },
  "등급": { single: "rank", plural: "ranks" },
  "목록": { single: "items", plural: "items" },
  "리스트": { single: "items", plural: "items" },
  "배열": { single: "items", plural: "items" },
  "장바구니": { single: "cart", plural: "cart" },
  "사과": { single: "apple", plural: "apples" },
  "단어": { single: "word", plural: "words" },
  "단어들": { single: "words", plural: "words" },
  "점수목록": { single: "scores", plural: "scores" },
  "이름": { single: "name", plural: "names" },
  "나이": { single: "age", plural: "ages" },
  "숫자": { single: "num", plural: "numbers" },
  "수": { single: "num", plural: "numbers" },
  "값": { single: "value", plural: "values" },
  "결과": { single: "result", plural: "results" },
  "글자": { single: "text", plural: "texts" },
  "문자": { single: "text", plural: "texts" },
  "문장": { single: "text", plural: "texts" },
  "메시지": { single: "message", plural: "messages" },
  "인사": { single: "greeting", plural: "greetings" },
  "파일": { single: "file", plural: "files" },
  "데이터": { single: "data", plural: "data" },
  "사용자": { single: "user", plural: "users" },
  "유저": { single: "user", plural: "users" },
  "회원": { single: "member", plural: "members" },
  "학생": { single: "student", plural: "students" },
  "가격": { single: "price", plural: "prices" },
  "금액": { single: "amount", plural: "amounts" },
  "합계": { single: "total", plural: "totals" },
  "개수": { single: "count", plural: "counts" },
  "횟수": { single: "count", plural: "counts" },
  "시간": { single: "time", plural: "times" },
  "날짜": { single: "date", plural: "dates" },
  "한계": { single: "limit", plural: "limits" },
  "기준": { single: "limit", plural: "limits" },
  "평균": { single: "average", plural: "averages" },
  "목표": { single: "goal", plural: "goals" },
  "상태": { single: "status", plural: "statuses" },
  "순위": { single: "standing", plural: "standings" },
  "레벨": { single: "level", plural: "levels" },
  "체력": { single: "hp", plural: "hps" },
  "공격력": { single: "atk", plural: "atks" },
  "속도": { single: "speed", plural: "speeds" },
  "너비": { single: "width", plural: "widths" },
  "높이": { single: "height", plural: "heights" },
  "제목": { single: "title", plural: "titles" },
  "버튼": { single: "button", plural: "buttons" }
});

const IDENT_TO_KO_NOUN = Object.assign(Object.create(null), {
  score: "점수", scores: "점수들", grade: "성적", grades: "성적목록",
  rank: "등급", ranks: "등급목록", standing: "순위", level: "레벨",
  hp: "체력", atk: "공격력", speed: "속도", average: "평균", goal: "목표", status: "상태",
  items: "항목목록", item: "항목", list: "목록", cart: "장바구니", apple: "사과",
  word: "단어", words: "단어들",
  name: "이름", names: "이름들",
  age: "나이", num: "숫자", numbers: "숫자들", value: "값", values: "값모음",
  result: "결과", results: "결과목록", text: "글자", message: "메시지",
  greeting: "인사", file: "파일", files: "파일들", data: "데이터", user: "사용자", users: "사용자들",
  member: "회원", student: "학생", price: "가격", prices: "가격들", amount: "금액",
  total: "합계", count: "개수", time: "시간", date: "날짜",
  limit: "기준값", width: "가로너비", height: "세로높이", title: "제목", button: "누름버튼"
});

const KO_PARTICLE_ROLES = [
  { particle: "에다가", role: "dest" },
  { particle: "에서는", role: "source" },
  { particle: "중에서", role: "source" },
  { particle: "에서", role: "source" },
  { particle: "으로는", role: "instrument" },
  { particle: "으로", role: "instrument" },
  { particle: "에는", role: "dest" },
  { particle: "을", role: "object" },
  { particle: "를", role: "object" },
  { particle: "은", role: "topic" },
  { particle: "는", role: "topic" },
  { particle: "이", role: "subject" },
  { particle: "가", role: "subject" },
  { particle: "에", role: "dest" },
  { particle: "로", role: "instrument" },
  { particle: "의", role: "possess" }
];

const KO_PARTICLE_BY_FORM = (() => {
  const map = new Map();
  for (const row of KO_PARTICLE_ROLES) map.set(row.particle, row.role);
  return map;
})();

const KO_COND_ENDINGS = [
  "이라면", "이면", "라면", "다면", "으면", "면", "일때", "일 때", "경우라면", "경우에", "경우"
];

const KO_COMPARE_OPS = [
  {
    keys: [
      "이상이면", "이상이라면", "이상이거나", "이상이고", "이상이면서", "이상일때", "이상인", "이상", "크거나같"
    ],
    op: ">=",
    opJs: ">="
  },
  {
    keys: [
      "이하이면", "이하이라면", "이하라면", "이하이거나", "이하이고", "이하이면서", "이하일때", "이하인", "이하", "작거나같"
    ],
    op: "<=",
    opJs: "<="
  },
  {
    keys: [
      "초과면", "초과이면", "초과라면", "초과이라면", "초과이거나", "초과이고", "초과이면서", "초과인", "초과",
      "보다크", "보다큰", "크다면", "크면", "크거나", "크고", "크면서", "크다", "큰"
    ],
    op: ">",
    opJs: ">"
  },
  {
    keys: [
      "미만이면", "미만이라면", "미만라면", "미만이거나", "미만이고", "미만이면서", "미만인", "미만",
      "보다작", "보다작은", "작다면", "작으면", "작거나", "작고", "작면서", "작다", "작은"
    ],
    op: "<",
    opJs: "<"
  },
  {
    keys: [
      "같지않", "다르다면", "다르면", "다르거나", "다르고", "다름", "다르다", "다른",
      "아니라면", "아니면", "아니다", "아닌", "아니"
    ],
    op: "!=",
    opJs: "!=="
  },
  {
    keys: [
      "같다면", "같으면", "같거나", "같고", "같음", "같다", "같은",
      "일치하면", "일치한다면", "일치"
    ],
    op: "==",
    opJs: "==="
  }
];

const KO_INSTRUMENT_LITERALS = {
  쉼표: ",",
  콤마: ",",
  공백: " ",
  빈칸: " ",
  띄어쓰기: " ",
  줄바꿈: "\n",
  탭: "\t",
  슬래시: "/",
  점: ".",
  마침표: ".",
  콜론: ":",
  세미콜론: ";",
  하이픈: "-",
  언더바: "_"
};

const KO_ASSIGN_WORDS = new Set([
  "넣기", "담기", "대입", "대입하기", "집어넣기", "할당", "할당하기", "값넣기", "정하기", "설정하기", "저장하기", "저장"
]);

const KO_COMPOSE_OP_CODES = /^(?:print|console\.log|console\.warn|console\.error|println|printf|System\.out\.println|return|open|read|write|close|sort|sorted|reverse|filter|map|forEach|reduce|len|length|size|count|sum|max|min|abs|round|random|append|push|add|pop|insert|remove|clear|includes|split|join|replace|trim|strip|fetch|JSON\.parse|JSON\.stringify|break|continue|if|elif|else|else if|while|for|switch|case|default|input|prompt|def|function|fun|func|str|String|int|float|bool|list|Array|dict|set|class|import|try|except|catch|finally|async|await|document\.getElementById|document\.querySelector|addEventListener|setTimeout|setInterval|range)$/;

const KO_NO_PARTICLE_WORDS = new Set([
  "증가", "증가하기", "추가", "추가하기", "감소", "감소하기", "제거", "제거하기",
  "포함", "포함되어", "포함된", "비교", "설정", "설정하기", "바꾸기", "바꿔",
  "정렬", "정렬하기", "나누기", "합치기", "더하기", "빼기", "곱하기",
  "이상", "이하", "초과", "미만", "보다", "크다", "작다", "같다", "다르다", "아니다",
  "길이", "크기", "나이", "차이", "주석", "메모", "입력", "출력", "반환", "보다"
]);

function splitKoParticle(str) {
  const s = String(str || "").trim();
  if (!s) return { stem: "", particle: "", role: "" };
  if (
    KO_NO_PARTICLE_WORDS.has(s) ||
    Object.prototype.hasOwnProperty.call(KO_NOUN_TO_IDENT, s) ||
    matchKoCompareToken(s)
  ) {
    return { stem: s, particle: "", role: "" };
  }
  for (const row of KO_PARTICLE_ROLES) {
    if (s.length > row.particle.length && s.endsWith(row.particle)) {
      const stem = s.slice(0, s.length - row.particle.length).trim();
      if (stem) return { stem, particle: row.particle, role: row.role };
    }
  }
  return { stem: s, particle: "", role: "" };
}

function stripTrailingKoParticle(str) {
  return splitKoParticle(str).stem;
}

const KO_COMPARE_LOOSE_ENDINGS = [
  "이라면", "이거나", "이면서", "이고", "이면", "라면", "다면", "으면",
  "거나", "면서", "면", "일때", "인경우", "이다", "인", "은", "는", "다", "이", "으"
];

function matchKoCompareToken(token, loose = false) {
  const t = String(token || "").trim();
  if (!t) return null;
  const exact = (w) => {
    for (const row of KO_COMPARE_OPS) {
      if (row.keys.includes(w)) return row;
    }
    return null;
  };
  const direct = exact(t);
  if (direct || !loose) return direct;
  // Loose mode is only used right after a value token, e.g. "80 이상이" / "80 같으".
  const viaMyeon = exact(t + "면");
  if (viaMyeon) return viaMyeon;
  for (const suf of KO_COMPARE_LOOSE_ENDINGS) {
    if (t.length <= suf.length || !t.endsWith(suf)) continue;
    const root = t.slice(0, t.length - suf.length);
    const hit = exact(root) || exact(root + "다") || exact(root + "면") || exact(root + "으면");
    if (hit) return hit;
  }
  return null;
}

function koHangulHasBatchim(word) {
  const s = String(word || "");
  const last = s.charCodeAt(s.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) return ((last - 0xac00) % 28) !== 0;
  return /[0-9]$/.test(s);
}

function koObjectParticle(word) {
  return koHangulHasBatchim(word) ? "을" : "를";
}

function koSubjectParticle(word) {
  return koHangulHasBatchim(word) ? "이" : "가";
}

function attachKoObjectParticle(word) {
  const s = String(word || "").trim();
  if (!s) return s;
  if (/(?:을|를)$/.test(s)) return s;
  return s + koObjectParticle(s);
}

function attachKoSubjectParticle(word) {
  const s = String(word || "").trim();
  if (!s) return s;
  if (/(?:이|가)$/.test(s)) return s;
  return s + koSubjectParticle(s);
}

function koStemValue(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (KO_COND_ENDINGS.includes(s)) return "";
  if (matchKoCompareToken(s)) return s;
  const split = splitKoParticle(s);
  return split.stem || s;
}

function tokenizeKoWithRoles(text) {
  const raw = String(text || "").trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  for (const rawTok of raw) {
    const withM = rawTok.match(/^(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')(?:보다|이랑|과|와|랑)$/);
    const identCmpM = !withM && rawTok !== "보다" ? rawTok.match(/^([A-Za-z가-힣_][A-Za-z0-9_가-힣]*?)보다$/) : null;
    const t = withM ? withM[1] : identCmpM ? identCmpM[1] : rawTok;
    if (t === "보다") continue;
    const prevTok = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    const afterValue = Boolean(prevTok && !prevTok.particle && !prevTok.compare && prevTok.role !== "condEnd");
    if (KO_COND_ENDINGS.includes(t)) {
      tokens.push({ stem: t, particle: t, role: "condEnd", raw: t, compare: null });
      continue;
    }
    const standaloneRole = KO_PARTICLE_BY_FORM.get(t);
    if (standaloneRole && tokens.length > 0 && !tokens[tokens.length - 1].particle && !tokens[tokens.length - 1].compare) {
      const prev = tokens[tokens.length - 1];
      prev.particle = t;
      prev.role = standaloneRole;
      continue;
    }
    const cmpDirect = matchKoCompareToken(t);
    if (cmpDirect) {
      tokens.push({ stem: t, particle: "", role: "", raw: t, compare: cmpDirect });
      continue;
    }
    const split = splitKoParticle(t);
    const cmpStem = matchKoCompareToken(split.stem);
    if (cmpStem && !split.particle) {
      tokens.push({ stem: split.stem, particle: "", role: "", raw: t, compare: cmpStem });
      continue;
    }
    const cmpLoose = afterValue ? matchKoCompareToken(t, true) : null;
    if (cmpLoose) {
      tokens.push({ stem: t, particle: "", role: "", raw: t, compare: cmpLoose });
      continue;
    }
    tokens.push({
      stem: split.stem || t,
      particle: split.particle,
      role: split.role,
      raw: t,
      compare: null
    });
  }
  return tokens;
}

function fillKoRoleSlots(tokens) {
  const slots = {
    dest: null,
    source: null,
    object: null,
    subject: null,
    instrument: null,
    possess: null,
    compare: null,
    unscoped: []
  };
  for (const tok of tokens) {
    if (!tok || tok.role === "condEnd") continue;
    if (tok.compare) {
      slots.compare = tok.compare;
      continue;
    }
    if (tok.role === "dest") slots.dest = tok.stem;
    else if (tok.role === "source") slots.source = tok.stem;
    else if (tok.role === "object") slots.object = tok.stem;
    else if (tok.role === "subject" || tok.role === "topic") slots.subject = tok.stem;
    else if (tok.role === "instrument") slots.instrument = tok.stem;
    else if (tok.role === "possess") slots.possess = tok.stem;
    else if (tok.stem) slots.unscoped.push(tok.stem);
  }
  return slots;
}

function identFromKoSlot(stem, fallback = "", preferPlural = false) {
  const s = koStemValue(stem);
  if (!s) return fallback || "";
  if (/^-?\d+(\.\d+)?$/.test(s)) return fallback || "";
  const id = resolveKoVarName(s, preferPlural);
  if (id) return id;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
  const roman = sanitizeDbIdent(hangulToRomanFallback(s));
  if (roman) return roman;
  return fallback || s;
}

function splitUnscopedNounsAndNums(slots) {
  const nums = [];
  const nouns = [];
  if (slots.subject) nouns.push(slots.subject);
  for (const u of slots.unscoped || []) {
    const st = koStemValue(u);
    if (!st || matchKoCompareToken(st)) continue;
    if (/^-?\d+(\.\d+)?$/.test(st)) nums.push(st);
    else nouns.push(st);
  }
  return { nums, nouns };
}

function hasBalancedUserBrackets(raw) {
  const s = String(raw || "");
  let p = 0;
  let k = 0;
  let b = 0;
  let q = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";
    if (q) {
      if (ch === q && prev !== "\\") q = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { q = ch; continue; }
    if (ch === "(") p++;
    else if (ch === ")") { p--; if (p < 0) return false; }
    else if (ch === "[") k++;
    else if (ch === "]") { k--; if (k < 0) return false; }
    else if (ch === "{") b++;
    else if (ch === "}") { b--; if (b < 0) return false; }
  }
  return !q && p === 0 && k === 0 && b === 0;
}

function leftoverNaturalExpr(source, lang, ctx) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return leftoverNaturalExprFromSlots(source, lang, ctx);
  }
  const text = String(source || "").trim();
  if (!text) return "";
  if (!hasBalancedUserBrackets(text)) return "";
  if (/[가-힣]/.test(text)) {
    const toks = tokenizeKoWithRoles(text).filter((tok) => {
      const m = lookupKoTokenCode(tok);
      return !(m && KO_COMPOSE_OP_CODES.test(m));
    });
    return leftoverNaturalExprFromSlots(fillKoRoleSlots(toks), lang, ctx);
  }
  const ident = text.replace(/^(?:if|while|else\s+if)\s+/i, "").replace(/\s+then$/i, "").trim();
  if (!ident) return "";
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(ident) || /^-?\d+(\.\d+)?$/.test(ident)) return ident;
  const asIdent = resolveEnVarName(ident, false);
  return asIdent || ident;
}

function leftoverNaturalExprFromSlots(slots, lang, ctx) {
  if (!slots) return "";
  const l = codegenLang(lang);
  const parts = [];
  const seen = new Set();
  const pushIdent = (raw) => {
    const s = koStemValue(raw) || String(raw || "").trim();
    if (!s || seen.has(s)) return;
    if (matchKoCompareToken(s) || KO_COND_ENDINGS.includes(s)) return;
    const mappedTok = typeof lookupKoTokenCode === "function" ? (lookupKoTokenCode({ raw: s, stem: s }) || "") : "";
    if (mappedTok && KO_COMPOSE_OP_CODES.test(mappedTok)) return;
    seen.add(s);
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      parts.push(s);
      return;
    }
    if (s === "참" || /^true$/i.test(s) || mappedTok === "true" || mappedTok === "True") {
      parts.push(l === "python" ? "True" : "true");
      return;
    }
    if (s === "거짓" || /^false$/i.test(s) || mappedTok === "false" || mappedTok === "False") {
      parts.push(l === "python" ? "False" : "false");
      return;
    }
    if (s === "없음" || s === "빈값" || mappedTok === "None" || mappedTok === "null" || mappedTok === "nil" || mappedTok === "undefined") {
      parts.push(l === "python" ? "None" : l === "swift" ? "nil" : "null");
      return;
    }
    if (mappedTok === "and" || mappedTok === "&&") {
      parts.push(l === "python" ? "and" : "&&");
      return;
    }
    if (mappedTok === "or" || mappedTok === "||") {
      parts.push(l === "python" ? "or" : "||");
      return;
    }
    if (mappedTok === "not" || mappedTok === "!") {
      parts.push(l === "python" ? "not" : "!");
      return;
    }
    const id = identFromKoSlot(s, "", false);
    parts.push(id || s);
  };
  pushIdent(slots.subject);
  if (slots.object) {
    const obj = koStemValue(slots.object) || String(slots.object || "").trim();
    if (obj && !seen.has(obj)) {
      seen.add(obj);
      if (/^-?\d+(\.\d+)?$/.test(obj)) parts.push(obj);
      else parts.push(identFromKoSlot(obj, "", false) || formatKoLiteralOrExpr(obj, l, true, ctx));
    }
  }
  for (const u of slots.unscoped || []) {
    pushIdent(u);
  }
  if (!parts.length && slots.dest) pushIdent(slots.dest);
  if (!parts.length && slots.source) pushIdent(slots.source);
  if (!parts.length && slots.possess) pushIdent(slots.possess);
  return parts.filter(Boolean).join(" ");
}

function buildKoCompareExprFromSlots(slots, lang, ctx, defaultVarName = null) {
  if (!slots || !slots.compare) return null;
  const l = codegenLang(lang);
  const op = l === "javascript" ? slots.compare.opJs : slots.compare.op;
  const { nums, nouns } = splitUnscopedNounsAndNums(slots);
  let lhsRaw = null;
  let rhsRaw = null;
  if (nouns.length && nums.length) {
    lhsRaw = nouns[0];
    rhsRaw = nums[nums.length - 1];
  } else if (nums.length && !nouns.length) {
    lhsRaw = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || "value";
    rhsRaw = nums[0];
  } else if (nouns.length >= 2) {
    lhsRaw = nouns[0];
    rhsRaw = nouns[1];
  } else if (nouns.length === 1 && slots.object) {
    lhsRaw = nouns[0];
    rhsRaw = slots.object;
  } else {
    return null;
  }
  const lhsIsBareIdent = lhsRaw === defaultVarName || (ctx && lhsRaw === ctx.lastSubject);
  const lhsVar = lhsIsBareIdent && /^[A-Za-z_$]/.test(String(lhsRaw))
    ? lhsRaw
    : identFromKoSlot(lhsRaw, defaultVarName || "", false);
  const rhsVal = formatKoLiteralOrExpr(rhsRaw, l, true, ctx);
  if (ctx) ctx.lastSubject = lhsVar;
  return {
    expr: `${lhsVar} ${op} ${rhsVal}`,
    lhsVar,
    rhsVal,
    op,
    rhsOnly: `${op} ${rhsVal}`
  };
}

function isGrammarProtectedNatural(raw) {
  const w = String(raw || "").trim();
  if (!w) return false;
  if (typeof KO_GRAMMAR_VALID_WORDS !== "undefined" && KO_GRAMMAR_VALID_WORDS.has(w)) return true;
  if (typeof EN_GRAMMAR_VALID_WORDS !== "undefined" && EN_GRAMMAR_VALID_WORDS.has(w.toLowerCase())) return true;
  if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(w)) return true;
  if (typeof SYNONYM_TO_OWNER_EN !== "undefined" && SYNONYM_TO_OWNER_EN.has(w.toLowerCase())) return true;
  if (matchKoCompareToken(w)) return true;
  const split = splitKoParticle(w);
  if (split.particle) {
    if (typeof KO_GRAMMAR_VALID_WORDS !== "undefined" && KO_GRAMMAR_VALID_WORDS.has(split.stem)) return true;
    if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(split.stem)) return true;
  }
  return false;
}

function isRealCodeToken(code) {
  const c = String(code || "").trim();
  if (!c) return false;
  if (typeof CODE_BUNDLES_BY_CODE !== "undefined" && CODE_BUNDLES_BY_CODE.has(c)) return true;
  if (dictPack && dictPack.entries && Object.prototype.hasOwnProperty.call(dictPack.entries, c)) return true;
  return false;
}

function sanitizeMappedCode(code) {
  const c = String(code || "").trim();
  if (!c) return null;
  if (isRealCodeToken(c)) return c;
  if (typeof isHarvestedGlossPhrase === "function" && isHarvestedGlossPhrase(c, "")) return null;
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(c) && c.length < 18 && !/_/.test(c)) return c;
  return null;
}

function hangulToRomanFallback(word) {
  const cho = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
  const jung = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
  const jong = ["","k","k","k","n","n","n","t","l","l","l","l","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","t"];
  let out = "";
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const code = c - 0xac00;
      const ci = Math.floor(code / 588);
      const vi = Math.floor((code % 588) / 28);
      const ti = code % 28;
      out += cho[ci] + jung[vi] + jong[ti];
    } else if (/[A-Za-z0-9_]/.test(word[i])) {
      out += word[i];
    }
  }
  return out || "";
}

function sanitizeDbIdent(rawIdent) {
  const cleaned = String(rawIdent || "")
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return "";
  return /^[0-9]/.test(cleaned) ? "v_" + cleaned : cleaned;
}

function resolveKoVarName(rawTerm, preferPlural = false) {
  let base = stripTrailingKoParticle(rawTerm).replace(/^(?:변수|고정값|상수)\s+/, "").trim();
  if (!base) return "";
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) return base;
  if (base.endsWith("들") && base.length >= 2) {
    const root = base.slice(0, -1);
    if (KO_NOUN_TO_IDENT[root]) return KO_NOUN_TO_IDENT[root].plural;
  }
  if (KO_NOUN_TO_IDENT[base]) {
    return preferPlural ? KO_NOUN_TO_IDENT[base].plural : KO_NOUN_TO_IDENT[base].single;
  }
  const vocabHit = typeof getVocabEntry === "function" ? getVocabEntry(base, "ko") : null;
  if (vocabHit && Array.isArray(vocabHit.codes) && vocabHit.codes.length > 0) {
    const top = String(vocabHit.codes[0][0] || "");
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(top)) {
      return preferPlural && !top.endsWith("s") ? top + "s" : top;
    }
  }
  if (base.includes(" ")) {
    const parts = base.split(/\s+/).filter(Boolean).map((p) => resolveKoVarName(p, false));
    if (parts.every((p) => p && /^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) {
      const joined = sanitizeDbIdent(parts.join("_"));
      if (joined) return joined;
    }
  }
  return "";
}

function requireKoIdent(rawTerm, preferPlural = false, fallback = "") {
  return identFromKoSlot(rawTerm, fallback, preferPlural);
}

function quoteNaturalLiteral(rawVal) {
  return `"${String(rawVal || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isWholeLineQuotedString(code) {
  const t = String(code || "").trim().replace(/;+\s*$/, "");
  if (!t) return false;
  return /^(["'`])(?:\\.|(?!\1)[\s\S])*\1$/.test(t);
}

function looksLikeCodeLine(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/^(?:#|\/\/)/.test(t)) return false;
  if (/\b(?:webpackChunk|webpackJsonp)\b/.test(t)) return true;
  if (/=>/.test(t)) return true;
  if (/[{};]/.test(t) && /[A-Za-z_$]/.test(t)) return true;
  if (/[A-Za-z_$][\w$]*\s*\(/.test(t)) return true;
  if (/[A-Za-z_$][\w$]*\s*=/.test(t) && /[()[\]{}]/.test(t)) return true;
  if (/\b(?:function|def|class|return|const|let|var|val|import|export)\b/.test(t) && /[(){};=:]/.test(t)) return true;
  if (/^(?:if|elif|else if|else|for|while|def|class|try|except|finally|switch)\b/.test(t) && /[:{]\s*$/.test(t)) return true;
  return false;
}

function formatKoLiteralOrExpr(rawVal, lang = currentLang, forceStringIfUnknownKorean = true, ctx = null) {
  const original = String(rawVal || "").trim();
  const l = codegenLang(lang);
  if (!original) return '""';
  if (/^["'`].*["'`]$/.test(original)) return original;
  const v = koStemValue(original) || original;
  if (!v) return '""';
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (v === "참" || v === "true" || v === "True") return l === "python" ? "True" : "true";
  if (v === "거짓" || v === "false" || v === "False") return l === "python" ? "False" : "false";
  if (v === "없음" || v === "빈값" || v === "None" || v === "null" || v === "nil") {
    return l === "python" ? "None" : l === "swift" ? "nil" : "null";
  }
  const bare = stripTrailingKoParticle(v);
  if (KO_NOUN_TO_IDENT[bare]) return KO_NOUN_TO_IDENT[bare].single;
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(v)) {
    if (ctx && ctx.declaredVars && ctx.declaredVars.has(v)) return v;
    if (dictPack && dictPack.entries && Object.prototype.hasOwnProperty.call(dictPack.entries, v)) return v;
    const mappedIdent = typeof lookupNaturalWordToCode === "function" ? sanitizeMappedCode(lookupNaturalWordToCode(v)) : null;
    if (mappedIdent && mappedIdent === v) return v;
    if (forceStringIfUnknownKorean && (isHarvestedGlossPhrase(v, "") || (/^[A-Z]/.test(v) && !/[_.]/.test(v)))) {
      return quoteNaturalLiteral(v);
    }
    return v;
  }
  const resolved = resolveKoVarName(bare, false);
  if (resolved && ctx && ctx.declaredVars && ctx.declaredVars.has(resolved)) {
    return resolved;
  }
  if (resolved && KO_NOUN_TO_IDENT[bare]) return resolved;
  return quoteNaturalLiteral(v);
}

function langStatementSemi(lang) {
  const l = codegenLang(lang);
  return (l === "javascript" || l === "java" || l === "c") ? ";" : "";
}

function defaultPrintOpForLang(lang) {
  const l = codegenLang(lang);
  if (l === "javascript") return "console.log";
  if (l === "kotlin") return "println";
  if (l === "java") return "System.out.println";
  if (l === "c") return "printf";
  return "print";
}

function isGenericPrintOp(opCode) {
  return /^(?:print|println|printf|console\.log|System\.out\.println)$/.test(String(opCode || ""));
}

function adaptPrintOpToLang(opCode, lang) {
  if (opCode === "console.warn" || opCode === "console.error") return opCode;
  if (!opCode || isGenericPrintOp(opCode)) return defaultPrintOpForLang(lang);
  return opCode;
}

function adaptOpCodeToLang(opCode, lang) {
  const l = codegenLang(lang);
  const op = String(opCode || "");
  if (!op) return op;
  if (op === "console.warn" || op === "console.error") return op;
  if (isGenericPrintOp(op)) return defaultPrintOpForLang(l);
  if (op === "elif" && l !== "python") return "else if";
  if (op === "else if" && l === "python") return "elif";
  if (op === "append" || op === "push" || op === "add") {
    if (l === "javascript") return "push";
    if (l === "python" || l === "swift") return "append";
    return "add";
  }
  if (op === "trim" || op === "strip") return l === "python" ? "strip" : "trim";
  if (op === "def" || op === "function" || op === "fun" || op === "func") {
    if (l === "python") return "def";
    if (l === "javascript") return "function";
    if (l === "kotlin") return "fun";
    if (l === "swift") return "func";
    return op;
  }
  if (op === "and" || op === "&&") return l === "python" ? "and" : "&&";
  if (op === "or" || op === "||") return l === "python" ? "or" : "||";
  if (op === "not" || op === "!") return l === "python" ? "not" : "!";
  if (op === "True" || op === "true") return l === "python" ? "True" : "true";
  if (op === "False" || op === "false") return l === "python" ? "False" : "false";
  if (op === "None" || op === "null" || op === "nil" || op === "undefined") {
    if (l === "python") return "None";
    if (l === "swift") return "nil";
    return "null";
  }
  if (op === "input" || op === "prompt") return l === "javascript" ? "prompt" : "input";
  return op;
}

function cPrintfLine(args, dest = "stdout", ctx = null) {
  const a = String(args || "").trim();
  const prefix = dest === "stderr" ? "fprintf(stderr, " : "printf(";
  if (!a) return `${prefix}"\\n");`;
  if (/^".*"$/.test(a)) {
    const inner = a.slice(1, -1).replace(/\\n$/, "");
    return `${prefix}"${inner}\\n");`;
  }
  if (/^'.*'$/.test(a)) {
    const inner = a.slice(1, -1).replace(/"/g, '\\"');
    return `${prefix}"${inner}\\n");`;
  }
  if (/^-?\d+\.\d+$/.test(a)) return `${prefix}"%f\\n", ${a});`;
  if (/^-?\d+$/.test(a)) return `${prefix}"%d\\n", ${a});`;
  if ((ctx && ctx.lastInputVar && a === ctx.lastInputVar) || /^(?:name|text|str|msg|message|word|title|line|buf|input)$/i.test(a)) {
    return `${prefix}"%s\\n", ${a});`;
  }
  return `${prefix}"%d\\n", ${a});`;
}

// Per-code, per-language runnable audit for every canonical code in CODE_SYNONYM_BUNDLES.
// Value is either an explicit template/emitter kind for that language or null (forbidden in that language).
const RUNNABLE_BY_LANG = Object.assign(Object.create(null), {
  "=": { python: "{a} = {b}", javascript: "let {a} = {b};", kotlin: "var {a} = {b}", swift: "var {a} = {b}", java: "var {a} = {b};", c: "int {a} = {b};" },
  if: { python: "if {a}:", javascript: "if ({a}) {", kotlin: "if ({a}) {", swift: "if {a} {", java: "if ({a}) {", c: "if ({a}) {" },
  elif: { python: "elif {a}:", javascript: null, kotlin: null, swift: null, java: null, c: null },
  "else if": { python: null, javascript: "else if ({a}) {", kotlin: "else if ({a}) {", swift: "else if {a} {", java: "else if ({a}) {", c: "else if ({a}) {" },
  else: { python: "else:", javascript: "else {", kotlin: "else {", swift: "else {", java: "else {", c: "else {" },
  switch: { python: "match {a}:", javascript: "switch ({a}) {", kotlin: "when ({a}) {", swift: "switch {a} {", java: "switch ({a}) {", c: "switch ({a}) {" },
  case: { python: "case {a}:", javascript: "case {a}:", kotlin: "{a} ->", swift: "case {a}:", java: "case {a}:", c: "case {a}:" },
  default: { python: "case _:", javascript: "default:", kotlin: "else ->", swift: "default:", java: "default:", c: "default:" },
  for: { python: "for {i} in {a}:", javascript: "for (const {i} of {a}) {", kotlin: "for ({i} in {a}) {", swift: "for {i} in {a} {", java: "for (Object {i} : {a}) {", c: "for (int i = 0; i < (int)(sizeof {a} / sizeof {a}[0]); i++) {" },
  while: { python: "while {a}:", javascript: "while ({a}) {", kotlin: "while ({a}) {", swift: "while {a} {", java: "while ({a}) {", c: "while ({a}) {" },
  break: { python: "break", javascript: "break;", kotlin: "break", swift: "break", java: "break;", c: "break;" },
  continue: { python: "continue", javascript: "continue;", kotlin: "continue", swift: "continue", java: "continue;", c: "continue;" },
  def: { python: "def {a}({b}):", javascript: null, kotlin: null, swift: null, java: null, c: null },
  function: { python: null, javascript: "function {a}({b}) {", kotlin: null, swift: null, java: null, c: null },
  fun: { python: null, javascript: null, kotlin: "fun {a}({b}) {", swift: null, java: null, c: null },
  func: { python: null, javascript: null, kotlin: null, swift: "func {a}({b}) {", java: null, c: null },
  return: { python: "return {a}", javascript: "return {a};", kotlin: "return {a}", swift: "return {a}", java: "return {a};", c: "return {a};" },
  print: { python: "print({a})", javascript: "console.log({a});", kotlin: "println({a})", swift: "print({a})", java: "System.out.println({a});", c: "printf" },
  "console.log": { python: null, javascript: "console.log({a});", kotlin: null, swift: null, java: null, c: null },
  "console.warn": { python: null, javascript: "console.warn({a});", kotlin: null, swift: null, java: null, c: null },
  "console.error": { python: null, javascript: "console.error({a});", kotlin: null, swift: null, java: null, c: null },
  println: { python: null, javascript: null, kotlin: "println({a})", swift: null, java: null, c: null },
  printf: { python: null, javascript: null, kotlin: null, swift: null, java: null, c: "printf" },
  "System.out.println": { python: null, javascript: null, kotlin: null, swift: null, java: "System.out.println({a});", c: null },
  let: { python: null, javascript: "let {a} = {b};", kotlin: null, swift: "let {a} = {b}", java: null, c: null },
  const: { python: null, javascript: "const {a} = {b};", kotlin: null, swift: null, java: null, c: "const int {a} = {b};" },
  var: { python: null, javascript: "var {a} = {b};", kotlin: "var {a} = {b}", swift: "var {a} = {b}", java: "var {a} = {b};", c: null },
  val: { python: null, javascript: null, kotlin: "val {a} = {b}", swift: null, java: null, c: null },
  true: { python: null, javascript: "true", kotlin: "true", swift: "true", java: "true", c: "1" },
  True: { python: "True", javascript: null, kotlin: null, swift: null, java: null, c: null },
  false: { python: null, javascript: "false", kotlin: "false", swift: "false", java: "false", c: "0" },
  False: { python: "False", javascript: null, kotlin: null, swift: null, java: null, c: null },
  None: { python: "None", javascript: null, kotlin: null, swift: null, java: null, c: null },
  null: { python: null, javascript: "null", kotlin: "null", swift: null, java: "null", c: "NULL" },
  nil: { python: null, javascript: null, kotlin: null, swift: "nil", java: null, c: null },
  undefined: { python: null, javascript: "undefined", kotlin: null, swift: null, java: null, c: null },
  and: { python: "and", javascript: null, kotlin: null, swift: null, java: null, c: null },
  "&&": { python: null, javascript: "&&", kotlin: "&&", swift: "&&", java: "&&", c: "&&" },
  or: { python: "or", javascript: null, kotlin: null, swift: null, java: null, c: null },
  "||": { python: null, javascript: "||", kotlin: "||", swift: "||", java: "||", c: "||" },
  not: { python: "not", javascript: null, kotlin: null, swift: null, java: null, c: null },
  "!": { python: null, javascript: "!", kotlin: "!", swift: "!", java: "!", c: "!" },
  input: { python: "{a} = input({b})", javascript: "let {a} = prompt({b});", kotlin: "val {a} = readLine() ?: \"\"", swift: "let {a} = readLine() ?? \"\"", java: "String {a} = new java.util.Scanner(System.in).nextLine();", c: "char {a}[256];\nscanf(\"%255s\", {a});" },
  prompt: { python: null, javascript: "let {a} = prompt({b});", kotlin: null, swift: null, java: null, c: null },
  open: { python: "open({a}, \"r\", encoding=\"utf-8\")", javascript: "fs.openSync({a}, \"r\");", kotlin: "java.io.File({a})", swift: "FileHandle(forReadingAtPath: {a})", java: "java.nio.file.Path.of({a});", c: "fopen({a}, \"r\");" },
  read: { python: "open({a}, \"r\", encoding=\"utf-8\").read()", javascript: "fs.readFileSync({a}, \"utf8\");", kotlin: "java.io.File({a}).readText()", swift: "try? String(contentsOfFile: {a}, encoding: .utf8)", java: "java.nio.file.Files.readString(java.nio.file.Path.of({a}));", c: "fgets({a}, sizeof {a}, stdin);" },
  write: { python: "open(\"result.txt\", \"w\", encoding=\"utf-8\").write(str({a}))", javascript: "fs.writeFileSync(\"result.txt\", String({a}), \"utf8\");", kotlin: "java.io.File(\"result.txt\").writeText({a}.toString())", swift: "try? \"\\({a})\".write(toFile: \"result.txt\", atomically: true, encoding: .utf8)", java: "java.nio.file.Files.writeString(java.nio.file.Path.of(\"result.txt\"), String.valueOf({a}));", c: "fprintf(stdout, \"%s\\n\", {a});" },
  close: { python: "{a}.close()", javascript: "fs.closeSync({a});", kotlin: "{a}.close()", swift: "try? {a}.close()", java: "{a}.close();", c: "fclose({a});" },
  len: { python: "len({a})", javascript: "{a}.length", kotlin: "{a}.size", swift: "{a}.count", java: "{a}.length", c: "strlen({a})" },
  length: { python: null, javascript: "{a}.length", kotlin: null, swift: null, java: "{a}.length", c: null },
  size: { python: null, javascript: null, kotlin: "{a}.size", swift: null, java: "{a}.size()", c: null },
  count: { python: "{a}.count({b})", javascript: "{a}.filter(x => x === {b}).length", kotlin: "{a}.count { it == {b} }", swift: "{a}.count", java: "{a}.stream().filter(x -> java.util.Objects.equals(x, {b})).count()", c: null },
  range: { python: "range({a})", javascript: "Array.from({ length: {a} }, (_, i) => i)", kotlin: "(0 until {a})", swift: "(0..<{a})", java: "java.util.stream.IntStream.range(0, {a})", c: null },
  append: { python: "{a}.append({b})", javascript: "{a}.push({b});", kotlin: "{a}.add({b})", swift: "{a}.append({b})", java: "{a}.add({b});", c: null },
  push: { python: null, javascript: "{a}.push({b});", kotlin: null, swift: null, java: null, c: null },
  add: { python: null, javascript: "{a}.add({b});", kotlin: "{a}.add({b})", swift: null, java: "{a}.add({b});", c: null },
  pop: { python: "{a}.pop()", javascript: "{a}.pop();", kotlin: "{a}.removeLast()", swift: "{a}.popLast()", java: "{a}.remove({a}.size() - 1);", c: null },
  insert: { python: "{a}.insert({b}, {c})", javascript: "{a}.splice({b}, 0, {c});", kotlin: "{a}.add({b}, {c})", swift: "{a}.insert({c}, at: {b})", java: "{a}.add({b}, {c});", c: null },
  remove: { python: "{a}.remove({b})", javascript: "{a}.splice({a}.indexOf({b}), 1);", kotlin: "{a}.remove({b})", swift: "{a}.removeAll { $0 == {b} }", java: "{a}.remove({b});", c: null },
  clear: { python: "{a}.clear()", javascript: "{a}.length = 0;", kotlin: "{a}.clear()", swift: "{a}.removeAll()", java: "{a}.clear();", c: null },
  sort: { python: "{a}.sort()", javascript: "{a}.sort((a, b) => a - b);", kotlin: "{a}.sort()", swift: "{a}.sort()", java: "java.util.Collections.sort({a});", c: null },
  sorted: { python: "sorted({a})", javascript: "[...{a}].sort((a, b) => a - b);", kotlin: "{a}.sorted()", swift: "{a}.sorted()", java: "{a}.stream().sorted().toList();", c: null },
  reverse: { python: "{a}.reverse()", javascript: "{a}.reverse();", kotlin: "{a}.reverse()", swift: "{a}.reverse()", java: "java.util.Collections.reverse({a});", c: null },
  filter: { python: "[x for x in {a} if {b}]", javascript: "{a}.filter(x => {b});", kotlin: "{a}.filter { {b} }", swift: "{a}.filter { {b} }", java: "{a}.stream().filter(x -> {b}).toList();", c: null },
  map: { python: "[{b} for x in {a}]", javascript: "{a}.map(x => {b});", kotlin: "{a}.map { {b} }", swift: "{a}.map { {b} }", java: "{a}.stream().map(x -> {b}).toList();", c: null },
  forEach: { python: "for x in {a}:", javascript: "{a}.forEach(x => {b});", kotlin: "{a}.forEach { {b} }", swift: "{a}.forEach { {b} }", java: "{a}.forEach(x -> {b});", c: null },
  reduce: { python: "sum({a})", javascript: "{a}.reduce((acc, x) => acc + x, 0);", kotlin: "{a}.reduce { acc, x -> acc + x }", swift: "{a}.reduce(0, +)", java: "{a}.stream().reduce(0, Integer::sum);", c: null },
  includes: { python: "{b} in {a}", javascript: "{a}.includes({b})", kotlin: "{b} in {a}", swift: "{a}.contains({b})", java: "{a}.contains({b})", c: "strstr({a}, {b}) != NULL" },
  split: { python: "{a}.split({b})", javascript: "{a}.split({b});", kotlin: "{a}.split({b})", swift: "{a}.components(separatedBy: {b})", java: "{a}.split({b});", c: null },
  join: { python: "{b}.join({a})", javascript: "{a}.join({b});", kotlin: "{a}.joinToString({b})", swift: "{a}.joined(separator: {b})", java: "String.join({b}, {a});", c: null },
  replace: { python: "{a}.replace({b}, {c})", javascript: "{a}.replace({b}, {c});", kotlin: "{a}.replace({b}, {c})", swift: "{a}.replacingOccurrences(of: {b}, with: {c})", java: "{a}.replace({b}, {c});", c: null },
  trim: { python: "{a}.strip()", javascript: "{a}.trim();", kotlin: "{a}.trim()", swift: "{a}.trimmingCharacters(in: .whitespacesAndNewlines)", java: "{a}.trim();", c: null },
  strip: { python: "{a}.strip()", javascript: null, kotlin: null, swift: null, java: null, c: null },
  sum: { python: "sum({a})", javascript: "{a}.reduce((acc, x) => acc + x, 0);", kotlin: "{a}.sum()", swift: "{a}.reduce(0, +)", java: "{a}.stream().mapToInt(x -> x).sum();", c: null },
  max: { python: "max({a})", javascript: "Math.max(...{a});", kotlin: "{a}.maxOrNull()", swift: "{a}.max()", java: "{a}.stream().max(Integer::compareTo).orElse(0);", c: null },
  min: { python: "min({a})", javascript: "Math.min(...{a});", kotlin: "{a}.minOrNull()", swift: "{a}.min()", java: "{a}.stream().min(Integer::compareTo).orElse(0);", c: null },
  abs: { python: "abs({a})", javascript: "Math.abs({a});", kotlin: "kotlin.math.abs({a})", swift: "abs({a})", java: "Math.abs({a});", c: "abs({a});" },
  round: { python: "round({a})", javascript: "Math.round({a});", kotlin: "kotlin.math.round({a})", swift: "({a}).rounded()", java: "Math.round({a});", c: "round({a});" },
  random: { python: "random.random()", javascript: "Math.random();", kotlin: "kotlin.random.Random.nextDouble()", swift: "Double.random(in: 0..<1)", java: "Math.random();", c: "rand();" },
  str: { python: "str({a})", javascript: "String({a})", kotlin: "{a}.toString()", swift: "String({a})", java: "String.valueOf({a})", c: null },
  String: { python: null, javascript: "String({a})", kotlin: "{a}.toString()", swift: "String({a})", java: "String.valueOf({a})", c: null },
  int: { python: "int({a})", javascript: "parseInt({a}, 10)", kotlin: "{a}.toInt()", swift: "Int({a})", java: "Integer.parseInt(String.valueOf({a}))", c: "(int)({a})" },
  float: { python: "float({a})", javascript: "parseFloat({a})", kotlin: "{a}.toDouble()", swift: "Double({a})", java: "Double.parseDouble(String.valueOf({a}))", c: "(double)({a})" },
  bool: { python: "bool({a})", javascript: "Boolean({a})", kotlin: "({a} != null)", swift: "Bool({a})", java: "Boolean.valueOf({a})", c: "({a} != 0)" },
  list: { python: "[{a}]", javascript: "[{a}]", kotlin: "mutableListOf({a})", swift: "[{a}]", java: "java.util.List.of({a})", c: null },
  Array: { python: null, javascript: "[{a}]", kotlin: "arrayOf({a})", swift: "[{a}]", java: "new Object[]{{a}}", c: null },
  dict: { python: "{{a}}", javascript: "({ {a} })", kotlin: "mutableMapOf({a})", swift: "[{a}]", java: "java.util.Map.of({a})", c: null },
  set: { python: "set({a})", javascript: "new Set({a})", kotlin: "mutableSetOf({a})", swift: "Set({a})", java: "new java.util.HashSet<>({a})", c: null },
  class: { python: "class {a}:", javascript: "class {a} {", kotlin: "class {a} {", swift: "class {a} {", java: "class {a} {", c: "struct {a} {" },
  import: { python: "import {a}", javascript: "import {a} from \"{a}\";", kotlin: "import {a}", swift: "import {a}", java: "import {a};", c: "#include <{a}.h>" },
  try: { python: "try:", javascript: "try {", kotlin: "try {", swift: "do {", java: "try {", c: null },
  except: { python: "except Exception as err:", javascript: "catch (err) {", kotlin: "catch (err: Exception) {", swift: "catch {", java: "catch (Exception err) {", c: null },
  catch: { python: "except Exception as err:", javascript: "catch (err) {", kotlin: "catch (err: Exception) {", swift: "catch {", java: "catch (Exception err) {", c: null },
  finally: { python: "finally:", javascript: "finally {", kotlin: "finally {", swift: "defer {", java: "finally {", c: null },
  async: { python: "async def {a}():", javascript: "async function {a}() {", kotlin: "suspend fun {a}() {", swift: "func {a}() async {", java: null, c: null },
  await: { python: "await {a}", javascript: "await {a};", kotlin: "{a}", swift: "await {a}", java: null, c: null },
  fetch: { python: "urllib.request.urlopen({a})", javascript: "fetch({a});", kotlin: "java.net.URL({a}).readText()", swift: "URLSession.shared.dataTask(with: URL(string: {a})!)", java: "java.net.URI.create({a}).toURL();", c: null },
  "document.getElementById": { python: null, javascript: "document.getElementById({a});", kotlin: null, swift: null, java: null, c: null },
  "document.querySelector": { python: null, javascript: "document.querySelector({a});", kotlin: null, swift: null, java: null, c: null },
  addEventListener: { python: null, javascript: "{a}.addEventListener({b}, () => {});", kotlin: null, swift: null, java: null, c: null },
  setTimeout: { python: "time.sleep({a} / 1000)", javascript: "setTimeout(() => {}, {a});", kotlin: "Thread.sleep({a})", swift: "Thread.sleep(forTimeInterval: Double({a}) / 1000)", java: "Thread.sleep({a});", c: null },
  setInterval: { python: null, javascript: "setInterval(() => {}, {a});", kotlin: null, swift: null, java: null, c: null },
  "JSON.parse": { python: "json.loads({a})", javascript: "JSON.parse({a});", kotlin: null, swift: null, java: null, c: null },
  "JSON.stringify": { python: "json.dumps({a})", javascript: "JSON.stringify({a});", kotlin: null, swift: null, java: null, c: null }
});
for (const k of Object.keys(RUNNABLE_BY_LANG)) {
  const row = RUNNABLE_BY_LANG[k];
  if (row && !Object.prototype.hasOwnProperty.call(row, "typescript")) {
    row.typescript = row.javascript;
  }
}

function isBundleCodeRunnableInLang(codeToken, lang = currentLang) {
  const l = codegenLang(lang);
  const c = String(codeToken || "").trim();
  if (!c) return false;
  if (Object.prototype.hasOwnProperty.call(RUNNABLE_BY_LANG, c)) {
    return Boolean(RUNNABLE_BY_LANG[c] && RUNNABLE_BY_LANG[c][l]);
  }
  return true;
}

const FORBIDDEN_TOKEN_PATTERNS_BY_LANG = {
  python: [
    /\bprintln\s*\(/,
    /\bSystem\.out\.println\s*\(/,
    /\bconsole\.(?:log|warn|error)\s*\(/,
    /\bprintf\s*\(/,
    /^else\s+if\b/,
    /^(?:function|fun|func)\s+[A-Za-z_]/,
    /\.(?:push|includes|forEach|trim|splice)\s*\(/,
    /\.(?:length|size)\b(?!\s*\()/
  ],
  javascript: [
    /(?:^|[^A-Za-z0-9_.])print\s*\(/,
    /\bprintln\s*\(/,
    /\bSystem\.out\.println\s*\(/,
    /\bprintf\s*\(/,
    /(?:^|[^A-Za-z0-9_.])len\s*\(/,
    /^elif\b/,
    /^def\s+[A-Za-z_]/,
    /\.append\s*\(/,
    /\.strip\s*\(/
  ],
  kotlin: [
    /\bconsole\.(?:log|warn|error)\s*\(/,
    /\bprintf\s*\(/,
    /(?:^|[^A-Za-z0-9_.])len\s*\(/,
    /^elif\b/,
    /^def\s+[A-Za-z_]/,
    /\.push\s*\(/,
    /\.append\s*\(/,
    /\.includes\s*\(/,
    /\.strip\s*\(/
  ],
  swift: [
    /\bprintln\s*\(/,
    /\bSystem\.out\.println\s*\(/,
    /\bconsole\.(?:log|warn|error)\s*\(/,
    /\bprintf\s*\(/,
    /(?:^|[^A-Za-z0-9_.])len\s*\(/,
    /^elif\b/,
    /^def\s+[A-Za-z_]/,
    /\.push\s*\(/,
    /\.includes\s*\(/,
    /\.strip\s*\(/
  ],
  java: [
    /(?:^|[^A-Za-z0-9_.])println\s*\(/,
    /(?:^|[^A-Za-z0-9_.])print\s*\(/,
    /\bconsole\.(?:log|warn|error)\s*\(/,
    /(?:^|[^A-Za-z0-9_.])len\s*\(/,
    /^elif\b/,
    /^def\s+[A-Za-z_]/,
    /\.push\s*\(/,
    /\.append\s*\(/,
    /\.includes\s*\(/,
    /\.strip\s*\(/
  ],
  c: [
    /(?:^|[^A-Za-z0-9_.])println\s*\(/,
    /(?:^|[^A-Za-z0-9_.])print\s*\(/,
    /\bSystem\.out\.println\s*\(/,
    /\bconsole\.(?:log|warn|error)\s*\(/,
    /(?:^|[^A-Za-z0-9_.])len\s*\(/,
    /^elif\b/,
    /^def\s+[A-Za-z_]/
  ]
};
FORBIDDEN_TOKEN_PATTERNS_BY_LANG.typescript = FORBIDDEN_TOKEN_PATTERNS_BY_LANG.javascript;

function parenShapeOk(code, opensBlock = false, closesPrevBlock = false, lang = currentLang) {
  const s = String(code || "");
  if (!s.trim()) return false;
  const l = codegenLang(lang);
  let p = 0;
  let b = 0;
  let k = 0;
  let quote = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";
    if (quote) {
      if (ch === quote && prev !== "\\") quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") p++;
    else if (ch === ")") { p--; if (p < 0) return false; }
    else if (ch === "[") k++;
    else if (ch === "]") { k--; if (k < 0) return false; }
    else if (ch === "{") b++;
    else if (ch === "}") {
      b--;
      if (b < 0 && !(closesPrevBlock && i === 0)) return false;
    }
  }
  if (quote) return false;
  if (p !== 0 || k !== 0) return false;
  const trimmed = s.trim();
  if (/^(?:if|else\s+if|elif|while|for|switch|when)\s*\(\s*\)/.test(trimmed)) return false;
  if (/^(?:if|elif|while|for)\s*:\s*$/.test(trimmed)) return false;
  if (l === "python") {
    if (opensBlock && !trimmed.endsWith(":")) return false;
    if (b !== 0) return false;
  } else if (opensBlock) {
    const expectedNet = closesPrevBlock && trimmed.startsWith("}") ? 0 : 1;
    if (b !== expectedNet) return false;
  } else if (b !== 0) {
    return false;
  }
  return true;
}

function emitCallShape(opCode, args = {}, lang = currentLang, ctx = null) {
  const l = codegenLang(lang);
  const rawOp = String(opCode || "").trim();
  if (!rawOp) return null;
  const a = args.a !== undefined && args.a !== null ? String(args.a).trim() : "";
  const b = args.b !== undefined && args.b !== null ? String(args.b).trim() : "";
  const c = args.c !== undefined && args.c !== null ? String(args.c).trim() : "";
  const item = args.i !== undefined && args.i !== null && String(args.i).trim() ? String(args.i).trim() : "item";

  if (rawOp === "console.warn" || rawOp === "console.error") {
    if (l === "javascript") return { code: `${rawOp}(${a});`, opensBlock: false };
    return emitCallShape("print", { a }, l, ctx);
  }
  if (isGenericPrintOp(rawOp)) {
    const cell = RUNNABLE_BY_LANG.print[l];
    if (!cell) return null;
    if (cell === "printf") return { code: cPrintfLine(a, "stdout", ctx), opensBlock: false };
    return { code: cell.replace("{a}", a), opensBlock: false };
  }

  let lookupOp = rawOp;
  if (!RUNNABLE_BY_LANG[lookupOp] || !RUNNABLE_BY_LANG[lookupOp][l]) {
    const adapted = adaptOpCodeToLang(rawOp, l);
    if (RUNNABLE_BY_LANG[adapted] && RUNNABLE_BY_LANG[adapted][l]) {
      lookupOp = adapted;
    } else if ((rawOp === "push" || rawOp === "add") && RUNNABLE_BY_LANG.append[l]) {
      lookupOp = "append";
    } else if ((rawOp === "length" || rawOp === "size") && RUNNABLE_BY_LANG.len[l]) {
      lookupOp = "len";
    } else if (rawOp === "strip" && RUNNABLE_BY_LANG.trim[l]) {
      lookupOp = "trim";
    } else if (rawOp === "String" && RUNNABLE_BY_LANG.str[l]) {
      lookupOp = "str";
    } else if (rawOp === "prompt" && RUNNABLE_BY_LANG.input[l]) {
      lookupOp = "input";
    }
  }

  const row = RUNNABLE_BY_LANG[lookupOp];
  const tpl = row ? row[l] : null;
  if (!tpl) return null;

  if ((lookupOp === "if" || lookupOp === "elif" || lookupOp === "else if" || lookupOp === "while" || lookupOp === "switch") && !a) return null;
  if (lookupOp === "for" && !a) return null;
  if (/^(?:len|length|size|append|push|add|pop|insert|remove|clear|sort|sorted|reverse|filter|map|forEach|reduce|includes|split|join|replace|trim|strip|sum|max|min|abs|round|str|String|int|float|bool|set|close|open|read|write|fetch|await|JSON\.parse|JSON\.stringify|document\.getElementById|document\.querySelector|addEventListener|setTimeout|setInterval|range)$/.test(lookupOp) && !a) {
    return null;
  }
  if (/^(?:append|push|add|remove|includes|count)$/.test(lookupOp) && !(lookupOp === "count" && l === "swift") && !b) {
    return null;
  }
  if (lookupOp === "insert" && !c && !b) {
    return null;
  }

  if (lookupOp === "return" && !a) {
    return { code: `return${langStatementSemi(l)}`, opensBlock: false };
  }
  if (lookupOp === "split" && l === "python" && !b) {
    return { code: `${a}.split()`, opensBlock: false };
  }
  if (lookupOp === "filter") {
    const semi = (l === "javascript" || l === "java") ? langStatementSemi(l) : "";
    return { code: `${emitFilterExpr(a, b, l)}${semi}`, opensBlock: false };
  }
  if (lookupOp === "def" || lookupOp === "function" || lookupOp === "fun" || lookupOp === "func") {
    const fnName = a || "fn";
    return { code: buildFunctionHeaderCode(fnName, b ? b.split(/\s*,\s*/).filter(Boolean) : [], l), opensBlock: true };
  }

  const opensBlock = /^(?:if|elif|else if|else|switch|for|while|class|try|except|catch|finally|async)$/.test(lookupOp) || (lookupOp === "forEach" && l === "python");
  const closesPrevBlock = /^(?:elif|else if|else|except|catch|finally)$/.test(lookupOp) && !(lookupOp === "finally" && l === "swift");
  const filled = tpl
    .replace(/\{i\}/g, item)
    .replace(/\{a\}/g, a)
    .replace(/\{b\}/g, b || (lookupOp === "join" ? '""' : (lookupOp === "insert" ? "0" : "")))
    .replace(/\{c\}/g, c);
  return { code: filled, opensBlock, closesPrevBlock };
}

function commitRunnableLine(candidate, lang = currentLang) {
  if (!candidate) return null;
  const obj = typeof candidate === "string" ? { code: candidate, opensBlock: false, closesPrevBlock: false } : candidate;
  const code = String(obj.code || "");
  if (!code.trim()) return null;
  const l = codegenLang(lang);
  const forbiddenList = FORBIDDEN_TOKEN_PATTERNS_BY_LANG[l] || [];
  const subLines = code.split(/\r?\n/);
  for (const sub of subLines) {
    const t = sub.trim();
    if (!t) continue;
    for (const badRe of forbiddenList) {
      if (badRe.test(t)) return null;
    }
    if (/^(?:print|println|printf|console\.(?:log|warn|error)|System\.out\.println|len|append|push|insert|split|join|trim|strip)\s*;?$/.test(t)) {
      return null;
    }
    if (isWholeLineQuotedString(t)) return null;
  }
  if (subLines.length === 1) {
    if (!parenShapeOk(code, Boolean(obj.opensBlock), Boolean(obj.closesPrevBlock), l)) return null;
  } else {
    if (!parenShapeOk(code, false, false, l)) return null;
  }
  // Guardrail against space-joined romanized garbage or adjacent string literals
  const noStrings = code.replace(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g, "__STR__");
  if (!/^(?:#|\/\/)/.test(code.trim()) && /__STR__\s+__STR__/.test(noStrings)) {
    return null;
  }
  const condCheck = code.trim().match(/^(?:if|elif|else\s+if|while)\s*\((.+)\)\s*\{$|^(?:if|elif|while)\s+(.+?)\s*:\s*$/);
  if (condCheck) {
    const condExpr = (condCheck[1] || condCheck[2] || "").trim();
    const cleanCond = condExpr.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "_STR_");
    if (!condExpr) return null;
    if (!/^\s*(?:let|var|const)\s+/.test(cleanCond)) {
      if (/(?:^|[\s(])(?!(?:and|or|not|in|is|typeof|instanceof|new|await)\b)[A-Za-z0-9_$]+\s+(?!(?:and|or|not|in|is|typeof|instanceof|as|of|new|await)\b)[A-Za-z0-9_$]+(?=$|[\s)])/.test(cleanCond)) {
        return null;
      }
    }
  }
  return obj;
}

function emitPrintCall(opCode, exprCode, lang, ctx = null) {
  const l = codegenLang(lang);
  const args = (exprCode === undefined || exprCode === null) ? "" : exprCode;
  if (opCode === "console.warn" || opCode === "console.error") {
    if (l === "javascript") return `${opCode}(${args});`;
    const shapedErr = emitCallShape("print", { a: args }, l, ctx);
    return shapedErr ? shapedErr.code : `print(${args})`;
  }
  const shaped = emitCallShape("print", { a: args }, l, ctx);
  return shaped ? shaped.code : `print(${args})`;
}

function emitLenExpr(recv, lang) {
  const l = codegenLang(lang);
  const r = String(recv || "").trim();
  if (l === "python") return `len(${r})`;
  if (l === "javascript" || l === "java") return `${r}.length`;
  if (l === "kotlin") return `${r}.size`;
  if (l === "swift") return `${r}.count`;
  return `strlen(${r})`;
}

function emitListAddCall(recv, val, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const v = val || "";
  const r = String(recv || "").trim();
  if (!r) return "";
  if (l === "javascript") return `${r}.push(${v})${semi}`;
  if (l === "python" || l === "swift") return `${r}.append(${v})`;
  return `${r}.add(${v})${semi}`;
}

function emitJoinCall(recv, sep, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const r = String(recv || "").trim();
  const glue = (sep === undefined || sep === null || sep === "") ? '""' : sep;
  if (!r) return "";
  if (l === "python") return `${glue}.join(${r})`;
  if (l === "javascript" || l === "java") return `${r}.join(${glue})${semi}`;
  if (l === "kotlin") return `${r}.joinToString(${glue})`;
  if (l === "swift") return `${r}.joined(separator: ${glue})`;
  return r;
}

function emitIncludesExpr(recv, needle, lang) {
  const l = codegenLang(lang);
  const r = String(recv || "").trim();
  const n = needle || "";
  if (l === "python" || l === "kotlin") return r ? `${n} in ${r}` : n;
  if (l === "javascript") return r ? `${r}.includes(${n})` : n;
  if (l === "swift" || l === "java") return r ? `${r}.contains(${n})` : n;
  return r ? `strstr(${r}, ${n}) != NULL` : n;
}

function emitInsertCall(recv, idx, val, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const r = String(recv || "").trim();
  const i = (idx === undefined || idx === null || idx === "") ? "0" : idx;
  const v = val || "";
  if (!r) return "";
  if (l === "javascript") return `${r}.splice(${i}, 0, ${v})${semi}`;
  if (l === "python") return `${r}.insert(${i}, ${v})`;
  if (l === "swift") return `${r}.insert(${v}, at: ${i})`;
  if (l === "kotlin" || l === "java") return `${r}.add(${i}, ${v})${l === "java" ? ";" : ""}`;
  return r;
}

function emitTrimCall(recv, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const r = String(recv || "").trim();
  if (!r) return "";
  if (l === "python") return `${r}.strip()`;
  return `${r}.trim()${semi}`;
}

function emitFilterExpr(listVar, predExpr, lang) {
  const l = codegenLang(lang);
  const list = String(listVar || "").trim();
  let pred = String(predExpr || "").trim();
  if (l === "kotlin") pred = pred.replace(/\bx\b/g, "it");
  if (l === "swift") pred = pred.replace(/\bx\b/g, "$0");
  if (l === "python") return pred ? `[x for x in ${list} if ${pred}]` : `[x for x in ${list}]`;
  if (l === "javascript") return pred ? `${list}.filter(x => ${pred})` : `${list}.filter(x => x)`;
  if (l === "kotlin") return pred ? `${list}.filter { ${pred} }` : `${list}.filter { it }`;
  if (l === "swift") return pred ? `${list}.filter { ${pred} }` : `${list}.filter { $0 }`;
  if (l === "java") return `${list}.stream().filter(x -> ${pred || "true"}).toList()`;
  return list;
}

function emitAggCall(opCode, recv, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const r = String(recv || "").trim();
  const op = String(opCode || "");
  if (l === "python") return `${op}(${r})`;
  if (l === "javascript") {
    if (op === "sum") return `${r}.reduce((acc, x) => acc + x, 0)${semi}`;
    if (op === "max") return `Math.max(...${r})${semi}`;
    if (op === "min") return `Math.min(...${r})${semi}`;
    if (op === "sorted") return `[...${r}].sort((a, b) => a - b)${semi}`;
  }
  if (l === "kotlin") {
    if (op === "sum") return `${r}.sum()`;
    if (op === "max") return `${r}.maxOrNull()`;
    if (op === "min") return `${r}.minOrNull()`;
    if (op === "sorted") return `${r}.sorted()`;
  }
  if (l === "swift") {
    if (op === "sum") return `${r}.reduce(0, +)`;
    if (op === "max") return `${r}.max()`;
    if (op === "min") return `${r}.min()`;
    if (op === "sorted") return `${r}.sorted()`;
  }
  if (l === "java") {
    if (op === "sum") return `${r}.stream().mapToInt(x -> x).sum();`;
    if (op === "max") return `${r}.stream().max(Integer::compareTo).orElse(0);`;
    if (op === "min") return `${r}.stream().min(Integer::compareTo).orElse(0);`;
    if (op === "sorted") return `${r}.stream().sorted().toList();`;
  }
  return r;
}

function emitSplitCall(recv, sep, lang) {
  const l = codegenLang(lang);
  const semi = langStatementSemi(l);
  const r = String(recv || "").trim();
  const s = sep || "";
  if (!r) return "";
  if (l === "python") return s ? `${r}.split(${s})` : `${r}.split()`;
  return `${r}.split(${s})${semi}`;
}

function detectKoPrintOp(text) {
  const t = String(text || "");
  if (/(?:오류출력|에러출력|빨간경고)/.test(t)) return "console.error";
  if (/(?:경고출력|주의출력|노란경고)/.test(t)) return "console.warn";
  if (/(?:콘솔출력|로그출력|콘솔기록)/.test(t)) return "console.log";
  if (/(?:자바출력|시스템줄출력)/.test(t)) return "System.out.println";
  if (/(?:서식출력|양식출력|씨출력|형식맞춤출력)/.test(t)) return "printf";
  if (/(?:줄출력|한줄출력|프린트라인)/.test(t)) return "println";
  if (/(?:화면표시|보여주기|띄우기)/.test(t)) return "console.log";
  if (/(?:화면출력|출력|프린트|글자찍기|찍기|내보여주기|인쇄)/.test(t)) return "print";
  return null;
}

function detectEnPrintOp(text) {
  const t = String(text || "").toLowerCase();
  if (/\bconsole\.error\b|\berror_log\b/.test(t)) return "console.error";
  if (/\bconsole\.warn\b|\bwarn_log\b/.test(t)) return "console.warn";
  if (/\bconsole\.log\b|\bconsole_log\b|\blog_message\b|\bdebug_print\b/.test(t)) return "console.log";
  if (/\bprintln\b|\bprint_line\b/.test(t)) return "println";
  if (/\bprintf\b|\bformat_print\b/.test(t)) return "printf";
  if (/\bsystem\.out\.println\b|\bjava_println\b/.test(t)) return "System.out.println";
  if (/\bprint_out\b|\bprint_text\b|\bprint\b|\bshow\b|\bdisplay\b|\boutput\b/.test(t)) return "print";
  if (/\blog\b/.test(t)) return "console.log";
  return null;
}

function naturalPrintVerb(opCode, mode = "ko") {
  if (mode === "en") {
    if (opCode === "console.log") return "log";
    if (opCode === "console.warn") return "warn";
    if (opCode === "console.error") return "error";
    if (opCode === "println") return "print_line";
    if (opCode === "printf") return "format_print";
    if (opCode === "System.out.println") return "java_println";
    return "print";
  }
  if (opCode === "console.log") return "콘솔출력";
  if (opCode === "console.warn") return "경고출력";
  if (opCode === "console.error") return "오류출력";
  if (opCode === "println") return "줄출력";
  if (opCode === "printf") return "서식출력";
  if (opCode === "System.out.println") return "자바출력";
  return "출력";
}

function buildPrintStatement(exprCode, lang) {
  return emitPrintCall(defaultPrintOpForLang(lang), exprCode, lang);
}

function emitNamedOrDefaultPrint(text, exprCode, lang) {
  const named = detectKoPrintOp(text) || detectEnPrintOp(text);
  if (named) return emitPrintCall(named, exprCode, lang);
  return buildPrintStatement(exprCode, lang);
}

const SENTENCE_PATTERN_ICON = {
  comment: "note",
  else: "condition",
  function_def: "fn",
  pipeline: "spark",
  condition: "condition",
  elif: "condition",
  loop_count: "loop",
  loop_each: "loop",
  assign: "assign",
  condition_input: "input",
  input_assign: "input",
  return: "result",
  print: "print",
  file_save: "save",
  break: "stop",
  continue: "skip"
};

function attachSentenceIconKey(res) {
  if (!res) return res;
  if (!res.iconKey) {
    res.iconKey = SENTENCE_PATTERN_ICON[res.matchedPattern] || "note";
  }
  return res;
}

function buildAssignStatement(varName, rawValStr, lang, isNewDecl = true, isConst = false, ctx = null, mode = "ko") {
  const l = codegenLang(lang);
  const valTrim = String(rawValStr || "").trim();
  const formattedVal = mode === "en"
    ? formatEnLiteralOrExpr(valTrim, l, true, ctx)
    : formatKoLiteralOrExpr(valTrim, l, true, ctx);
  const isStr = /^".*"$/.test(formattedVal);
  const isFloat = /^-?\d+\.\d+$/.test(formattedVal);
  const isBool = /^(true|True|false|False)$/.test(formattedVal);

  if (ctx && ctx.declaredVars) {
    if (ctx.declaredVars.has(varName)) {
      isNewDecl = false;
    } else {
      ctx.declaredVars.add(varName);
    }
  }
  if (ctx) ctx.lastSubject = varName;

  if (l === "python") return `${varName} = ${formattedVal}`;
  if (l === "javascript") {
    if (!isNewDecl) return `${varName} = ${formattedVal};`;
    return `${isConst ? "const" : "let"} ${varName} = ${formattedVal};`;
  }
  if (l === "kotlin") {
    if (!isNewDecl) return `${varName} = ${formattedVal}`;
    return `${isConst ? "val" : "var"} ${varName} = ${formattedVal}`;
  }
  if (l === "swift") {
    if (!isNewDecl) return `${varName} = ${formattedVal}`;
    return `${isConst ? "let" : "var"} ${varName} = ${formattedVal}`;
  }
  if (l === "c") {
    const cType = isStr ? "char *" : isFloat ? "double " : isBool ? "int " : "int ";
    const prefix = isNewDecl ? (isConst ? "const " + cType : cType) : "";
    return `${prefix}${varName} = ${formattedVal};`;
  }
  if (l === "java") {
    const jType = isStr ? "String " : isFloat ? "double " : isBool ? "boolean " : "int ";
    const prefix = isNewDecl ? (isConst ? "final " + jType : jType) : "";
    return `${prefix}${varName} = ${formattedVal};`;
  }
  return `${varName} = ${formattedVal}`;
}

function stripKoValueWithParticle(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;
  if (
    Object.prototype.hasOwnProperty.call(KO_NOUN_TO_IDENT, s) ||
    KO_NO_PARTICLE_WORDS.has(s) ||
    matchKoCompareToken(s)
  ) {
    return s;
  }
  const litM = s.match(/^(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')(?:보다|이랑|과|와|랑)$/);
  if (litM) return litM[1];
  const cmpParticleM = s.match(/^(.+?)(?:보다|이랑)$/);
  if (cmpParticleM && cmpParticleM[1].trim()) return cmpParticleM[1].trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*[과와랑]$/.test(s) || /^[가-힣0-9_]{2,}[과와랑]$/.test(s)) {
    const trimmed = s.slice(0, -1);
    if (trimmed) return trimmed;
  }
  return s;
}

function splitKoreanConditionalClauseAndAction(trimmed) {
  let s = String(trimmed || "").trim();
  if (!s) return null;
  let isElif = false;
  let hasIfKeyword = false;
  if (/^(?:아니고\s*만약|아니면\s*만약)\s+/.test(s)) {
    isElif = true;
    hasIfKeyword = true;
    s = s.replace(/^(?:아니고\s*만약|아니면\s*만약)\s+/, "").trim();
  } else if (/^(?:만약|만일)\s+|^if\s+/i.test(s)) {
    hasIfKeyword = true;
    s = s.replace(/^(?:(?:만약|만일)\s+|if\s+)/i, "").trim();
  }
  if (!s) return null;
  // Preserve input-condition Pattern 0 ("받는다면 / 입력된다면 / 입력받으면 / 들어오면")
  if (/^(?:.+?\s+)?(?:받는다면|입력된다면|입력받으면|들어오면)(?:\s+.*)?$/.test(s)) {
    return null;
  }

  // 1) Prefer splitting cleanly at an explicit comparison/condition predicate ending so nouns like "화면" never split on "면".
  const predEndRe = /^(.+?(?:이상|이하|초과|미만|포함되어|포함|들어있|같지\s*않|같|다르|일치|크|작|아니|없|있))(?:\s*(?:이다|다))?(이라면|이면|라면|다면|으면|면|일때|일\s*때|경우라면|경우에|경우)(?=$|\s+)(.*)$/;
  let m = s.match(predEndRe);
  if (m) {
    return {
      isElif,
      hasIfKeyword,
      condBody: m[1].trim(),
      ending: m[2].trim(),
      actionStr: (m[3] || "").trim()
    };
  }

  // 2) Multi-char conditional endings anywhere (e.g. "점수가 80이라면", "완료일때")
  const genEndRe = /^(.+?)(이라면|이면|라면|다면|으면|일때|일\s*때|경우라면|경우에|경우)(?=$|\s+)(.*)$/;
  m = s.match(genEndRe);
  if (m) {
    return {
      isElif,
      hasIfKeyword,
      condBody: m[1].trim(),
      ending: m[2].trim(),
      actionStr: (m[3] || "").trim()
    };
  }

  // 3) Single-char "면" only when "만약/if" introduces the clause
  if (hasIfKeyword) {
    const bareMyeonM = s.match(/^(.+?)(?<=[가-힣A-Za-z0-9_])면(?=$|\s+)(.*)$/);
    if (bareMyeonM) {
      return {
        isElif,
        hasIfKeyword,
        condBody: bareMyeonM[1].trim(),
        ending: "면",
        actionStr: (bareMyeonM[2] || "").trim()
      };
    }
  }
  return null;
}

function koCompareTokenToOp(rawOpWord, l) {
  const w = String(rawOpWord || "").trim();
  if (/^(?:이상|크거나\s*같)/.test(w)) return { op: ">=", opJs: ">=" };
  if (/^(?:이하|작거나\s*같)/.test(w)) return { op: "<=", opJs: "<=" };
  if (/^(?:초과|크)/.test(w)) return { op: ">", opJs: ">" };
  if (/^(?:미만|작)/.test(w)) return { op: "<", opJs: "<" };
  if (/^(?:다르|같지\s*않|아니)/.test(w)) return { op: "!=", opJs: "!==" };
  if (/^(?:같|일치)/.test(w)) return { op: "==", opJs: "===" };
  return null;
}

function parseSingleKoreanComparison(condText, lang, defaultVarName = null, ctx = null) {
  let c = String(condText || "").trim();
  if (!c) return null;
  const l = codegenLang(lang);
  const resolvedDefaultVar = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || "value";
  const eqOp = l === "javascript" ? "===" : "==";

  const tokens = tokenizeKoWithRoles(c);
  const slots = fillKoRoleSlots(tokens);

  // 1) Negated membership: "목록에 사과가 없다면 / 들어있지 않다면 / 포함되지 않다면"
  if (/(?:들어있|포함되어\s*있|포함)\S*\s*지?\s*않|없(?:다|음|으)?$|않(?:다|음|으)?$/.test(c) && (slots.dest || slots.source)) {
    const boxRaw = slots.dest || slots.source;
    const needleRaw =
      slots.object ||
      slots.subject ||
      (slots.unscoped.find((u) => !/(?:포함|들어있|있|없|않|되어)/.test(u)) || "");
    if (boxRaw && needleRaw) {
      const targetVar = requireKoIdent(boxRaw, false, leftoverNaturalExpr(boxRaw, l, ctx));
      const needle = formatKoLiteralOrExpr(needleRaw, l, true, ctx);
      if (ctx) ctx.lastSubject = targetVar;
      if (l === "python") return { expr: `${needle} not in ${targetVar}`, opTextKo: "미포함", lhsVar: targetVar };
      if (l === "javascript") return { expr: `!${targetVar}.includes(${needle})`, opTextKo: "미포함", lhsVar: targetVar };
      if (l === "kotlin") return { expr: `${needle} !in ${targetVar}`, opTextKo: "미포함", lhsVar: targetVar };
      if (l === "swift" || l === "java") return { expr: `!${targetVar}.contains(${needle})`, opTextKo: "미포함", lhsVar: targetVar };
      return { expr: `strstr(${targetVar}, ${needle}) == NULL`, opTextKo: "미포함", lhsVar: targetVar };
    }
  }

  // 2) Positive membership: "목록에 사과가 포함되어 있다면 / 포함이면"
  if (/(?:포함|들어있|있)/.test(c) && (slots.dest || slots.source)) {
    const boxRaw = slots.dest || slots.source;
    const needleRaw =
      slots.object ||
      slots.subject ||
      (slots.unscoped.find((u) => !/(?:포함|들어있|있|되어)/.test(u)) || "");
    if (boxRaw && needleRaw) {
      const targetVar = requireKoIdent(boxRaw, false, leftoverNaturalExpr(boxRaw, l, ctx));
      const needle = formatKoLiteralOrExpr(needleRaw, l, true, ctx);
      if (ctx) ctx.lastSubject = targetVar;
      if (l === "python" || l === "kotlin") return { expr: `${needle} in ${targetVar}`, opTextKo: "포함", lhsVar: targetVar };
      if (l === "javascript") return { expr: `${targetVar}.includes(${needle})`, opTextKo: "포함", lhsVar: targetVar };
      if (l === "swift" || l === "java") return { expr: `${targetVar}.contains(${needle})`, opTextKo: "포함", lhsVar: targetVar };
      return { expr: `strstr(${targetVar}, ${needle}) != NULL`, opTextKo: "포함", lhsVar: targetVar };
    }
  }

  // 3) Explicit LHS + RHS + Korean/symbolic comparison
  const opRules = [
    { re: /^(.+?)\s+((?!보다\b)\S+?)(?:\s*보다)?\s*(?:이상|크거나\s*같)(?:이라면|이?면|라면|다면|다|음|을|이|인)?$/, op: ">=", opJs: ">=" },
    { re: /^(.+?)\s+((?!보다\b)\S+?)(?:\s*보다)?\s*(?:이하|작거나\s*같)(?:이라면|이?면|라면|다면|다|음|을|이|인)?$/, op: "<=", opJs: "<=" },
    { re: /^(.+?)\s+((?!보다\b)\S+?)(?:\s*보다\s*(?:크|큰|클)(?:다면|다|으면|면|으)?|\s*초과(?:이라면|이?면|라면|다면|다|음|을|이|인)?|보다\s*(?:크|큰|클)(?:다면|다|으면|면|으)?)$/, op: ">", opJs: ">" },
    { re: /^(.+?)\s+((?!보다\b)\S+?)(?:\s*보다\s*(?:작|작은|작을)(?:다면|다|으면|면|으)?|\s*미만(?:이라면|이?면|라면|다면|다|음|을|이|인)?|보다\s*(?:작|작은|작을)(?:다면|다|으면|면|으)?)$/, op: "<", opJs: "<" },
    { re: /^(.+?)\s+((?!보다\b)\S+?)\s*(?:같지\s*않|다르|아니)(?:다면|다|라면|으면|면|으|ㄴ|인)?$/, op: "!=", opJs: "!==" },
    { re: /^(.+?)\s+((?!보다\b)\S+?)\s*(?:같|일치)(?:다면|다|음|으면|면|은|으)?$/, op: "==", opJs: "===" },
    { re: /^(.+?)\s*(>=|<=|===|!==|==|!=|>|<)\s*(.+)$/, op: null, opJs: null }
  ];

  for (const rule of opRules) {
    const m = c.match(rule.re);
    if (m) {
      const lhsRaw = m[1];
      const op = rule.op === null ? m[2] : rule.op;
      const rhsRaw = rule.op === null ? m[3] : m[2];
      const lhsVar = requireKoIdent(lhsRaw, false, leftoverNaturalExpr(lhsRaw, l, ctx) || resolvedDefaultVar);
      const rhsVal = formatKoLiteralOrExpr(stripKoValueWithParticle(rhsRaw), l, true, ctx);
      const finalOp = l === "javascript" ? (rule.opJs || op) : op;
      if (ctx) ctx.lastSubject = lhsVar;
      return { expr: `${lhsVar} ${finalOp} ${rhsVal}`, rhsOnly: `${finalOp} ${rhsVal}`, op: finalOp, lhsVar, rhsVal };
    }
  }

  // 4) Predicate-only (LHS omitted, e.g., "80 이상", "80보다 크", "20보다 작"): inherits resolvedDefaultVar
  const predRules = [
    { re: /^((?!보다\b)\S+?)(?:\s*보다)?\s*(?:이상|크거나\s*같)(?:이라면|이?면|라면|다면|다|음|을|이|인)?$/, op: ">=", opJs: ">=" },
    { re: /^((?!보다\b)\S+?)(?:\s*보다)?\s*(?:이하|작거나\s*같)(?:이라면|이?면|라면|다면|다|음|을|이|인)?$/, op: "<=", opJs: "<=" },
    { re: /^((?!보다\b)\S+?)(?:\s*보다\s*(?:크|큰|클)(?:다면|다|으면|면|으)?|\s*초과(?:이라면|이?면|라면|다면|다|음|을|이|인)?|보다\s*(?:크|큰|클)(?:다면|다|으면|면|으)?)$/, op: ">", opJs: ">" },
    { re: /^((?!보다\b)\S+?)(?:\s*보다\s*(?:작|작은|작을)(?:다면|다|으면|면|으)?|\s*미만(?:이라면|이?면|라면|다면|다|음|을|이|인)?|보다\s*(?:작|작은|작을)(?:다면|다|으면|면|으)?)$/, op: "<", opJs: "<" },
    { re: /^((?!보다\b)\S+?)\s*(?:같지\s*않|다르|아니)(?:다면|다|라면|으면|면|으|ㄴ|인)?$/, op: "!=", opJs: "!==" },
    { re: /^((?!보다\b)\S+?)\s*(?:같|일치)(?:다면|다|음|으면|면|은|으)?$/, op: "==", opJs: "===" }
  ];
  for (const r of predRules) {
    const m = c.match(r.re);
    if (m) {
      const rhsVal = formatKoLiteralOrExpr(stripKoValueWithParticle(m[1]), l, true, ctx);
      const finalOp = l === "javascript" ? (r.opJs || r.op) : r.op;
      if (ctx) ctx.lastSubject = resolvedDefaultVar;
      return { expr: `${resolvedDefaultVar} ${finalOp} ${rhsVal}`, rhsOnly: `${finalOp} ${rhsVal}`, op: finalOp, lhsVar: resolvedDefaultVar, rhsVal };
    }
  }

  // 5) Slot-based comparison fallback
  const slotCmp = buildKoCompareExprFromSlots(slots, l, ctx, resolvedDefaultVar);
  if (slotCmp) {
    return { expr: slotCmp.expr, rhsOnly: slotCmp.rhsOnly, op: slotCmp.op, lhsVar: slotCmp.lhsVar, rhsVal: slotCmp.rhsVal };
  }

  // 6) Implicit equality: "점수가 80", "상태가 완료", "값이 참" (e.g. from "만약 점수가 80이라면")
  if (tokens.length === 2 && (tokens[0].role === "subject" || tokens[0].role === "topic")) {
    const lhsVar = requireKoIdent(tokens[0].stem, false, resolvedDefaultVar);
    const rhsVal = formatKoLiteralOrExpr(stripKoValueWithParticle(tokens[1].raw || tokens[1].stem), l, true, ctx);
    if (lhsVar && rhsVal) {
      if (ctx) ctx.lastSubject = lhsVar;
      return { expr: `${lhsVar} ${eqOp} ${rhsVal}`, rhsOnly: `${eqOp} ${rhsVal}`, op: eqOp, lhsVar, rhsVal };
    }
  }

  // 7) Unary negation or single boolean/identifier condition
  if (/^(?:부정|느낌표부정)\s+(\S+)$/.test(c)) {
    const negTok = c.replace(/^(?:부정|느낌표부정)\s+/, "").trim();
    const negVar = requireKoIdent(negTok, false, leftoverNaturalExpr(negTok, l, ctx));
    if (negVar) {
      if (ctx) ctx.lastSubject = negVar;
      return { expr: l === "python" ? `not ${negVar}` : `!${negVar}`, lhsVar: negVar };
    }
  }
  if (tokens.length === 1) {
    const single = leftoverNaturalExpr(c, l, ctx) || identFromKoSlot(c, "");
    if (single && !/\s/.test(single)) {
      if (ctx) ctx.lastSubject = single;
      return { expr: single, lhsVar: single };
    }
  }
  return null;
}

function parseKoreanConditionClause(condText, lang, defaultVarName = null, ctx = null) {
  let c = String(condText || "").trim();
  c = c.replace(/^(?:만약|만일|아니고\s*만약|아니면\s*만약)\s+|^if\s+/i, "").trim();
  if (!c) return null;
  const l = codegenLang(lang);
  const resolvedDefaultVar = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || "value";
  const andOp = l === "python" ? "and" : "&&";
  const orOp = l === "python" ? "or" : "||";

  // 1) Merged single-operator comparators FIRST ("80보다 크거나 같" -> >=, "80보다 작거나 같" -> <=)
  if (/(?:크거나\s*같|작거나\s*같)(?:다면|다|으면|면|으|음)?$/.test(c)) {
    const singleMerged = parseSingleKoreanComparison(c, l, resolvedDefaultVar, ctx);
    if (singleMerged) return singleMerged;
  }

  // 2) Shared-LHS + Shared-RHS compound comparator (e.g., "점수가 80보다 크거나 작" -> score > 80 or score < 80)
  const sharedCmpM = c.match(/^(?:(.+?)\s+)?((?!보다\b)\S+?)(?:\s*(?:보다|와|과|랑))?\s*(크거나|작거나|이상이거나|이하이거나|초과이거나|미만이거나|같거나|다르거나|크고|작고|이상이고|이하이고|초과이고|미만이고|같고|다르고)\s+(크(?:다면|다|면|으)?|작(?:다면|다|면|으)?|이상|이하|초과|미만|같(?:다면|다|으|음)?|다르(?:다면|다|면)?)$/);
  if (sharedCmpM) {
    const op1Row = koCompareTokenToOp(sharedCmpM[3], l);
    const op2Row = koCompareTokenToOp(sharedCmpM[4], l);
    if (op1Row && op2Row) {
      const lhsVar = sharedCmpM[1]
        ? requireKoIdent(sharedCmpM[1], false, leftoverNaturalExpr(sharedCmpM[1], l, ctx) || resolvedDefaultVar)
        : resolvedDefaultVar;
      const rhsVal = formatKoLiteralOrExpr(stripKoValueWithParticle(sharedCmpM[2]), l, true, ctx);
      const op1 = l === "javascript" ? op1Row.opJs : op1Row.op;
      const op2 = l === "javascript" ? op2Row.opJs : op2Row.op;
      const logicOp = /거나$/.test(sharedCmpM[3]) ? orOp : andOp;
      if (ctx) ctx.lastSubject = lhsVar;
      return {
        expr: `${lhsVar} ${op1} ${rhsVal} ${logicOp} ${lhsVar} ${op2} ${rhsVal}`,
        lhsVar,
        rhsVal
      };
    }
  }

  // 3) Multi-clause compound condition splitting (AND / OR, preserving "크거나 같" / "작거나 같")
  const normConn = c
    .replace(/\s+(그리고|모두참)\s+/g, "\x01AND\x01")
    .replace(/\s+(또는|혹은|하나라도참)\s+/g, "\x01OR\x01")
    .replace(/\s+(&&|\|\|)\s+/g, (_, sym) => (sym === "&&" ? "\x01AND\x01" : "\x01OR\x01"))
    .replace(/((?:크|작|같|다르|아니|없|있)(?:지\s*않)?|이상|이하|초과|미만|포함)(이?거나(?!\s*같)|이?고|이?면서)\s+/g, (_, pred, conn) => {
      const tag = /거나$/.test(conn) ? "\x01OR\x01" : "\x01AND\x01";
      return `${pred}${tag}`;
    });

  if (normConn.includes("\x01AND\x01") || normConn.includes("\x01OR\x01")) {
    const parts = normConn.split(/(\x01AND\x01|\x01OR\x01)/);
    let curLhs = resolvedDefaultVar;
    const exprParts = [];
    let firstLhs = null;
    let validAll = true;
    for (const part of parts) {
      if (part === "\x01AND\x01") {
        exprParts.push(andOp);
      } else if (part === "\x01OR\x01") {
        exprParts.push(orOp);
      } else {
        const sub = parseSingleKoreanComparison(part.trim(), l, curLhs, ctx);
        if (!sub || !sub.expr) {
          validAll = false;
          break;
        }
        if (!firstLhs && sub.lhsVar) firstLhs = sub.lhsVar;
        if (sub.lhsVar) curLhs = sub.lhsVar;
        exprParts.push(sub.expr);
      }
    }
    if (validAll && exprParts.length >= 3) {
      return {
        expr: exprParts.join(" "),
        lhsVar: firstLhs || curLhs
      };
    }
  }

  // 4) Single condition clause
  return parseSingleKoreanComparison(c, l, defaultVarName, ctx);
}

// ============================================================================
// Natural Sentence Synonym Normalizer (Exclusive 1:N -> Single Canonical Word)
// ============================================================================

function normalizeActionSynonymToken(word, mode = "ko") {
  const clean = String(word || "").trim();
  if (!clean) return clean;
  if (mode === "en") {
    const low = clean.toLowerCase();
    const hit = SYNONYM_TO_OWNER_EN.get(low);
    return (hit && hit.canonical) ? hit.canonical : clean;
  }
  const hit = SYNONYM_TO_OWNER_KO.get(clean);
  if (hit && hit.canonical) {
    // Preserve special clause endings for "받는다면"/"입력된다면" if inside a condition header
    return hit.canonical;
  }
  return clean;
}

function normalizeNaturalLineToCanonical(lineText, mode = "ko", opts = {}) {
  const str = String(lineText || "");
  if (!str.trim()) return str;
  if (/^\s*(?:#|\/\/|주석\s|메모\s|note\b|comment\b)/i.test(str)) return str;
  const preserveConditionalEndings = opts.preserveConditionalEndings !== false;

  const indentM = str.match(/^(\s*)/);
  const indent = indentM ? indentM[1] : "";
  const body = str.slice(indent.length);

  if (mode === "en") {
    const out = body.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (tok) => {
      const hit = SYNONYM_TO_OWNER_EN.get(tok.toLowerCase());
      return (hit && hit.canonical) ? hit.canonical : tok;
    });
    return indent + out;
  }

  const parts = body.split(/(\s+)/);
  const normalized = parts.map((part, idx) => {
    if (!part || /^\s+$/.test(part)) return part;
    if (preserveConditionalEndings && idx === parts.length - 1 && /(?:받는다면|입력된다면|조건이면|일때)$/.test(part)) {
      return part;
    }
    const directHit = SYNONYM_TO_OWNER_KO.get(part);
    if (directHit && directHit.canonical) {
      return directHit.canonical;
    }
    // Check particle-attached token (e.g., "점수에", "목록을") only if stem is an exclusive keyword synonym (never strip action verbs naively)
    const bare = stripTrailingKoParticle(part);
    if (bare && bare !== part) {
      const bareHit = SYNONYM_TO_OWNER_KO.get(bare);
      if (bareHit && bareHit.canonical && bareHit.canonical !== bare) {
        return bareHit.canonical + part.slice(bare.length);
      }
    }
    return part;
  });
  return indent + normalized.join("");
}
if (typeof window !== "undefined") window.normalizeNaturalLineToCanonical = normalizeNaturalLineToCanonical;

function buildKoInputStatement(varName, promptRaw, lang, ctx = null, isNewDecl = true) {
  const l = codegenLang(lang);
  const prompt = formatKoLiteralOrExpr(promptRaw || "입력", l, true, ctx);
  if (ctx && ctx.declaredVars) ctx.declaredVars.add(varName);
  if (ctx) {
    ctx.lastInputVar = varName;
    ctx.lastSubject = varName;
  }
  if (l === "python") return `${varName} = input(${prompt})`;
  if (l === "javascript") return `${isNewDecl ? "let " : ""}${varName} = prompt(${prompt});`;
  if (l === "kotlin") return `${isNewDecl ? "val " : ""}${varName} = readLine() ?: ""`;
  if (l === "swift") return `${isNewDecl ? "let " : ""}${varName} = readLine() ?? ""`;
  if (l === "java") return `${isNewDecl ? "String " : ""}${varName} = new java.util.Scanner(System.in).nextLine();`;
  return `char ${varName}[256];\nscanf("%255s", ${varName});`;
}

function koPrintArgFromSlots(slots, lang, ctx, fallback = "") {
  if (slots && slots.object) return formatKoLiteralOrExpr(slots.object, lang, true, ctx);
  const parts = splitUnscopedNounsAndNums(slots || {});
  if (parts.nums.length && !parts.nouns.length) return formatKoLiteralOrExpr(parts.nums[0], lang, true, ctx);
  if (parts.nouns.length === 1 && !parts.nums.length) return formatKoLiteralOrExpr(parts.nouns[0], lang, true, ctx);
  if (parts.nums.length) return formatKoLiteralOrExpr(parts.nums[parts.nums.length - 1], lang, true, ctx);
  if (slots && slots.subject) return formatKoLiteralOrExpr(slots.subject, lang, true, ctx);
  if (parts.nouns.length) return formatKoLiteralOrExpr(parts.nouns[parts.nouns.length - 1], lang, true, ctx);
  return fallback;
}

function buildKoreanActionStatement(actionRaw, lang, defaultTargetVar = null, ctx = null) {
  const actRaw = String(actionRaw || "").trim();
  const act = normalizeNaturalLineToCanonical(actRaw, "ko", { preserveConditionalEndings: false }).trim();
  const l = codegenLang(lang);
  if (!act) return buildPrintStatement(defaultTargetVar || '""', l);
  const payloadSlotsOf = (payload) => fillKoRoleSlots(tokenizeKoWithRoles(payload));

  // Return (supports single value OR multi-token values like "80 참 반환")
  const retM = act.match(/^(.+?)\s*(?:반환|돌려주기|결과돌려주기|값내보내기|돌려줘|리턴)(?:하기|해줘|해)?$/);
  if (retM) {
    const payloadSlots = payloadSlotsOf(retM[1]);
    const payload = payloadSlots.object || retM[1].trim();
    const rawParts = String(payload).includes(",")
      ? String(payload).split(",").map((s) => s.trim()).filter(Boolean)
      : String(payload).split(/\s+/).filter(Boolean);
    if (rawParts.length > 1) {
      const fmtParts = rawParts.map((p) => formatKoLiteralOrExpr(p, l, false, ctx));
      if (l === "python") return `return ${fmtParts.join(", ")}`;
      if (l === "javascript") return `return [${fmtParts.join(", ")}];`;
      if (l === "kotlin") return `return listOf(${fmtParts.join(", ")})`;
      if (l === "swift") return `return (${fmtParts.join(", ")})`;
      if (l === "java") return `return new Object[]{${fmtParts.join(", ")}};`;
      return `return ${fmtParts[fmtParts.length - 1]};`;
    }
    const val = formatKoLiteralOrExpr(payload, l, false, ctx);
    return (l === "javascript" || l === "c" || l === "java") ? `return ${val};` : `return ${val}`;
  }

  // Assign ("점수에 80 넣기", "점수를 80으로 바꾸기")
  const actLast = act.split(/\s+/).pop();
  const assignM = (KO_ASSIGN_WORDS.has(actLast) || KO_ASSIGN_WORDS.has(stripTrailingKoParticle(actLast || "")) || /(?:바꾸기|바꿔|설정하기|설정|변경하기|변경|정해)$/.test(actLast || ""))
    ? act.match(/^(.+?)(?:에다가|에다|에는|에|을|를|은|는)\s+(.+?)\s*(?:넣기|담기|대입하기|집어넣기|할당하기|값넣기|대입|할당|저장하기|저장|정하기|설정하기|설정|바꾸기|바꿔|변경하기|변경|정해)$/)
    : null;
  if (assignM) {
    const assignSlots = payloadSlotsOf(`${assignM[1]} ${assignM[2]}`);
    const dest = assignSlots.dest || assignSlots.object || assignSlots.subject || assignM[1];
    const valRaw = String(assignSlots.object && assignSlots.dest ? assignSlots.object : assignM[2]).replace(/(?:으로|로)$/, "").trim();
    return buildAssignStatement(requireKoIdent(dest, false, "value"), valRaw, l, false, false, ctx, "ko");
  }

  // Explicit Console / Print / Warn / Error variants (keep the chosen operator)
  const warnM = act.match(/^(.+?)\s*(?:경고출력|주의출력|노란경고)(?:하기|해줘|해)?$/);
  if (warnM) {
    const argExpr = koPrintArgFromSlots(payloadSlotsOf(warnM[1]), l, ctx, formatKoLiteralOrExpr(warnM[1], l, true, ctx));
    return emitPrintCall("console.warn", argExpr, l);
  }
  const errM = act.match(/^(.+?)\s*(?:오류출력|에러출력|빨간경고)(?:하기|해줘|해)?$/);
  if (errM) {
    const argExpr = koPrintArgFromSlots(payloadSlotsOf(errM[1]), l, ctx, formatKoLiteralOrExpr(errM[1], l, true, ctx));
    return emitPrintCall("console.error", argExpr, l);
  }
  const outM = act.match(/^(.+?)\s+(?:콘솔출력|화면출력|줄출력|서식출력|자바출력|출력|띄우기|보여주기|보여줘|표시|찍기|찍어|인쇄|로그출력|화면표시)(?:하기|해줘|해)?$/);
  if (outM) {
    const argExpr = koPrintArgFromSlots(payloadSlotsOf(outM[1]), l, ctx, formatKoLiteralOrExpr(outM[1], l, true, ctx));
    return emitNamedOrDefaultPrint(act, argExpr, l);
  }
  if (/^(?:콘솔출력|화면출력|줄출력|서식출력|자바출력|출력|띄우기|보여주기|보여줘|표시|찍기|찍어)(?:하기|해줘|해)?$/.test(act)) {
    return emitNamedOrDefaultPrint(act, defaultTargetVar || "", l);
  }

  // File save
  if (/(?:파일저장|파일에저장|파일쓰기|내용쓰기|기록남기기|저장소쓰기)/.test(act)) {
    const dataVar = defaultTargetVar || "result";
    if (l === "python") return `open("result.txt", "w", encoding="utf-8").write(str(${dataVar}))`;
    if (l === "javascript") return `fs.writeFileSync("result.txt", String(${dataVar}), "utf8");`;
    if (l === "kotlin") return `java.io.File("result.txt").writeText(${dataVar}.toString())`;
    if (l === "swift") return `try? "\\(${dataVar})".write(toFile: "result.txt", atomically: true, encoding: .utf8)`;
    if (l === "java") return `java.nio.file.Files.writeString(java.nio.file.Path.of("result.txt"), String.valueOf(${dataVar}));`;
    return `fprintf(fopen("result.txt", "w"), "%s\\n", "saved");`;
  }

  const koFallback = commitRunnableLine(buildPrintStatement(formatKoLiteralOrExpr(act, l, true, ctx), l), l);
  return koFallback ? koFallback.code : null;
}

function buildIfHeaderCode(condExpr, lang, isElif = false) {
  const l = codegenLang(lang);
  if (l === "python") return `${isElif ? "elif" : "if"} ${condExpr}:`;
  if (l === "swift") return `${isElif ? "else if" : "if"} ${condExpr} {`;
  return `${isElif ? "else if" : "if"} (${condExpr}) {`;
}

function buildIfBlockCode(condExpr, bodyLine, lang) {
  const l = codegenLang(lang);
  if (l === "python") return `if ${condExpr}:\n    ${bodyLine}`;
  if (l === "swift") return `if ${condExpr} {\n    ${bodyLine}\n}`;
  return `if (${condExpr}) {\n    ${bodyLine}\n}`;
}

function buildForEachHeaderCode(itemVar, listVar, lang) {
  const l = codegenLang(lang);
  if (l === "python") return `for ${itemVar} in ${listVar}:`;
  if (l === "javascript") return `for (const ${itemVar} of ${listVar}) {`;
  if (l === "kotlin") return `for (${itemVar} in ${listVar}) {`;
  if (l === "swift") return `for ${itemVar} in ${listVar} {`;
  if (l === "java") return `for (Object ${itemVar} : ${listVar}) {`;
  return `for (int i = 0; i < (int)(sizeof ${listVar} / sizeof ${listVar}[0]); i++) {`;
}

function buildForEachBlockCode(itemVar, listVar, bodyLine, lang) {
  const l = codegenLang(lang);
  if (l === "python") return `for ${itemVar} in ${listVar}:\n    ${bodyLine}`;
  if (l === "javascript") return `for (const ${itemVar} of ${listVar}) {\n    ${bodyLine}\n}`;
  if (l === "kotlin") return `for (${itemVar} in ${listVar}) {\n    ${bodyLine}\n}`;
  if (l === "swift") return `for ${itemVar} in ${listVar} {\n    ${bodyLine}\n}`;
  if (l === "java") return `for (Object ${itemVar} : ${listVar}) {\n    ${bodyLine}\n}`;
  return `for (int i = 0; i < (int)(sizeof ${listVar} / sizeof ${listVar}[0]); i++) {\n    ${bodyLine}\n}`;
}

function buildRepeatHeaderCode(countNum, lang) {
  const l = codegenLang(lang);
  if (l === "python") return `for i in range(${countNum}):`;
  if (l === "kotlin") return `repeat(${countNum}) {`;
  if (l === "swift") return `for _ in 0..<${countNum} {`;
  if (l === "javascript") return `for (let i = 0; i < ${countNum}; i++) {`;
  return `for (int i = 0; i < ${countNum}; i++) {`;
}

function buildRepeatCountBlockCode(countNum, bodyLine, lang) {
  const l = codegenLang(lang);
  if (l === "python") return `for i in range(${countNum}):\n    ${bodyLine}`;
  if (l === "kotlin") return `repeat(${countNum}) {\n    ${bodyLine}\n}`;
  if (l === "swift") return `for _ in 0..<${countNum} {\n    ${bodyLine}\n}`;
  if (l === "javascript") return `for (let i = 0; i < ${countNum}; i++) {\n    ${bodyLine}\n}`;
  return `for (int i = 0; i < ${countNum}; i++) {\n    ${bodyLine}\n}`;
}

function buildFunctionHeaderCode(fnName, paramsList, lang) {
  const l = codegenLang(lang);
  const paramsStr = paramsList.join(", ");
  if (l === "python") return `def ${fnName}(${paramsStr}):`;
  if (l === "javascript") return `function ${fnName}(${paramsStr}) {`;
  if (l === "kotlin") return `fun ${fnName}(${paramsStr}) {`;
  if (l === "swift") return `func ${fnName}(${paramsStr}) {`;
  if (l === "java") return `static void ${fnName}(${paramsStr}) {`;
  return `void ${fnName}(${paramsStr}) {`;
}

function parseKoreanSentenceToCode(rawLine, lang = currentLang, ctx = null) {
  const rawTrimmed = String(rawLine || "").trim();
  if (!rawTrimmed || rawTrimmed.length < 2) return null;
  if (/^(?:#|\/\/)/.test(rawTrimmed)) {
    return {
      matchedPattern: "comment",
      titleKo: "주석",
      code: rawTrimmed,
      snippet: rawTrimmed,
      opensBlock: false,
      descriptionKo: "설명 메모 줄입니다."
    };
  }
  const memoM = rawTrimmed.match(/^(?:주석|메모)\s+(.+)$/);
  if (memoM) {
    const cmtPrefix = codegenLang(lang) === "python" ? "# " : "// ";
    const code = cmtPrefix + memoM[1].trim();
    return { matchedPattern: "comment", titleKo: "주석", code, snippet: code, opensBlock: false, descriptionKo: "주석 메모" };
  }
  const trimmed = normalizeNaturalLineToCanonical(rawTrimmed, "ko", { preserveConditionalEndings: true }).trim();
  if (!/[가-힣]/.test(trimmed)) return null;
  const l = codegenLang(lang);

  // Else branch: "아니면" / "그외" / "그 외에는" / "그렇지 않으면"
  if (/^(?:아니면|그외|그\s*외(?:에는|엔)?|그밖에|그밖에는|그렇지\s*않으면|나머지\s*경우)$/.test(trimmed)) {
    const code = l === "python" ? "else:" : "else {";
    return {
      matchedPattern: "else",
      titleKo: "② 조건 (그 외)",
      code,
      snippet: code,
      opensBlock: true,
      closesPrevBlock: true,
      descriptionKo: "앞의 조건이 맞지 않을 때 실행하는 분기입니다."
    };
  }

  // Function header: "기능 [이름] 재료 [매개변수...]" or "기능 [이름]"
  const fnM = trimmed.match(/^(?:기능|함수)\s+([A-Za-z0-9_가-힣]+)(?:\s+(?:재료|입력값)\s+(.+))?$/);
  if (fnM) {
    const fnName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(fnM[1]) ? fnM[1] : requireKoIdent(fnM[1], false, "fn");
    const paramsRaw = (fnM[2] || "").trim();
    const paramsList = paramsRaw
      ? paramsRaw.split(/[\s,]+/).filter(Boolean).map((p) => {
          const pv = requireKoIdent(p, false, "arg");
          if (ctx && ctx.declaredVars) ctx.declaredVars.add(pv);
          return pv;
        })
      : [];
    const code = buildFunctionHeaderCode(fnName, paramsList, l);
    return {
      matchedPattern: "function_def",
      titleKo: "기능 정의",
      code,
      snippet: code,
      opensBlock: true,
      descriptionKo: `'${fnName}' 기능을 정의합니다.`
    };
  }

  // Pattern ③: Pipeline "[대상](에서)? [조건] 골라서 [동작1] [동작2]..."
  const pipeM = trimmed.match(/^(.+?)\s+(?:골라내기|골라서|고르기|고르고|골라|걸러내기|걸러서|걸러내고|추려내기|추려서|필터링해서|필터)\s*(.*)$/);
  if (pipeM) {
    const leftClause = pipeM[1].trim();
    const rightClause = (pipeM[2] || "").trim();

    let targetRaw = "";
    let predRaw = leftClause;
    const leftTokens = tokenizeKoWithRoles(leftClause);
    const leftSlots = fillKoRoleSlots(leftTokens);
    if (leftSlots.source) {
      targetRaw = leftSlots.source;
      predRaw = leftTokens.filter((tok) => tok.role !== "source").map((tok) => tok.raw).join(" ").trim() || leftClause;
    } else {
      const fromM = leftClause.match(/^(\S+?)(?:에서|중에서)\s+(.+)$/);
      if (fromM) {
        targetRaw = fromM[1];
        predRaw = fromM[2];
      } else {
        const spaceIdx = leftClause.search(/\s+/);
        if (spaceIdx > 0) {
          targetRaw = leftClause.slice(0, spaceIdx);
          predRaw = leftClause.slice(spaceIdx).trim();
        }
      }
    }

    const listVar = requireKoIdent(targetRaw, true, leftoverNaturalExpr(targetRaw, l, ctx));
    const itemVar = l === "kotlin" ? "it" : l === "swift" ? "$0" : "x";
    const parsedPred = parseKoreanConditionClause(predRaw, l, itemVar, ctx) || {
      expr: leftoverNaturalExpr(predRaw, l, ctx) || itemVar,
      rhsOnly: ""
    };

    const doSort = /(?:정렬|오름차순|순서대로)/.test(rightClause);
    const doDesc = /내림차순/.test(rightClause);
    const doSave = /(?:파일저장|파일에저장|파일쓰기|저장)/.test(rightClause);
    const namedPrintOp = detectKoPrintOp(rightClause) || detectEnPrintOp(rightClause);
    const doPrint = Boolean(namedPrintOp);
    const doSum = /(?:합계|총합|더하기)/.test(rightClause);
    const pipelinePrintLine = () => {
      if (namedPrintOp) return emitPrintCall(namedPrintOp, "result", l);
      if (doPrint || (!doSave && rightClause === "")) return buildPrintStatement("result", l);
      return null;
    };

    const lines = [];
    if (l === "python") {
      let expr = `[x for x in ${listVar} if ${parsedPred.expr}]`;
      if (doDesc) expr = `sorted(${expr}, reverse=True)`;
      else if (doSort) expr = `sorted(${expr})`;
      if (doSum) expr = `sum(${expr})`;
      lines.push(`result = ${expr}`);
      if (doSave) {
        lines.push('with open("result.txt", "w", encoding="utf-8") as f:');
        lines.push('    f.write("\\n".join(map(str, result)) if isinstance(result, list) else str(result))');
      }
      const pLine = pipelinePrintLine();
      if (pLine) lines.push(pLine);
    } else if (l === "javascript") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sort((a, b) => b - a)";
      else if (doSort) expr += ".sort((a, b) => a - b)";
      if (doSum) expr += ".reduce((acc, x) => acc + x, 0)";
      lines.push(`const result = ${expr};`);
      if (doSave) {
        lines.push('fs.writeFileSync("result.txt", Array.isArray(result) ? result.join("\\n") : String(result), "utf8");');
      }
      const pLine = pipelinePrintLine();
      if (pLine) lines.push(pLine);
    } else if (l === "kotlin") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sortedDescending()";
      else if (doSort) expr += ".sorted()";
      if (doSum) expr += ".sum()";
      lines.push(`val result = ${expr}`);
      if (doSave) {
        lines.push('java.io.File("result.txt").writeText(result.toString())');
      }
      const pLineKt = pipelinePrintLine();
      if (pLineKt) lines.push(pLineKt);
    } else if (l === "swift") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sorted(by: >)";
      else if (doSort) expr += ".sorted()";
      if (doSum) expr += ".reduce(0, +)";
      lines.push(`let result = ${expr}`);
      if (doSave) {
        lines.push('try? "\\(result)".write(toFile: "result.txt", atomically: true, encoding: .utf8)');
      }
      const pLineSw = pipelinePrintLine();
      if (pLineSw) lines.push(pLineSw);
    } else if (l === "java") {
      let expr = `${listVar}.stream().filter(x -> ${parsedPred.expr})`;
      if (doDesc) expr += ".sorted(java.util.Comparator.reverseOrder())";
      else if (doSort) expr += ".sorted()";
      lines.push(`var result = ${expr}.toList();`);
      if (doSave) {
        lines.push('java.nio.file.Files.writeString(java.nio.file.Path.of("result.txt"), result.toString());');
      }
      const pLineJv = pipelinePrintLine();
      if (pLineJv) lines.push(pLineJv);
    } else if (l === "c") {
      lines.push(`int count = (int)(sizeof ${listVar} / sizeof ${listVar}[0]);`);
      if (doDesc) lines.push(`qsort(${listVar}, count, sizeof ${listVar}[0], cmp_desc);`);
      else if (doSort) lines.push(`qsort(${listVar}, count, sizeof ${listVar}[0], cmp_asc);`);
      if (doSave) lines.push('FILE *fp = fopen("result.txt", "w");');
      lines.push(`for (int i = 0; i < count; i++) {`);
      lines.push(`    if (${parsedPred.rhsOnly ? `${listVar}[i] ${parsedPred.rhsOnly}` : (parsedPred.expr || listVar)}) {`);
      if (doSave) lines.push(`        fprintf(fp, "%d\\n", ${listVar}[i]);`);
      else lines.push(`        printf("%d\\n", ${listVar}[i]);`);
      lines.push("    }");
      lines.push("}");
      if (doSave) lines.push("fclose(fp);");
    }

    if (ctx && ctx.declaredVars) ctx.declaredVars.add("result");
    const code = lines.join("\n");
    return {
      matchedPattern: "pipeline",
      titleKo: "③ 연속 작업 (골라서 처리)",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: "조건으로 골라낸 뒤 정렬·저장·출력을 한 번에 연결하는 코드입니다."
    };
  }

  // Pattern ②: Condition "[만약|아니고만약|아니면만약]? [대상] [조건](이면|라면|다면|으면|면) [동작?]"
  const condSplit = splitKoreanConditionalClauseAndAction(trimmed);
  const hasExplicitCmpSignal =
    condSplit &&
    /(?:이상|이하|초과|미만|같|다르|아니|포함|들어있|크거|작거|보다|없|있|(?:^|\s)(?:크|작)$|>=|<=|==|!=|>|<)/.test(
      condSplit.condBody
    );
  if (condSplit && (condSplit.hasIfKeyword || hasExplicitCmpSignal)) {
    const parsedCond = parseKoreanConditionClause(condSplit.condBody, l, null, ctx);
    if (parsedCond && parsedCond.expr) {
      const actionStr = condSplit.actionStr;
      const isElif = condSplit.isElif;
      if (!actionStr && ctx && ctx.allowBlockHeaders) {
        const hdr = buildIfHeaderCode(parsedCond.expr, l, isElif);
        return {
          matchedPattern: isElif ? "elif" : "condition",
          titleKo: "② 조건 (블록 시작)",
          code: hdr,
          snippet: hdr,
          opensBlock: true,
          closesPrevBlock: isElif,
          descriptionKo: "조건 검사를 시작합니다."
        };
      }
      const actionLine = buildKoreanActionStatement(actionStr, l, parsedCond.lhsVar, ctx);
      if (!actionLine) return null;
      const code = buildIfBlockCode(parsedCond.expr, actionLine, l);
      return {
        matchedPattern: "condition",
        titleKo: "② 조건 (만약 ~이면)",
        code,
        snippet: code,
        opensBlock: false,
        descriptionKo: "조건을 검사하고 참일 때 실행할 동작을 완성합니다."
      };
    }
  }

  // Pattern ④-C: While "[조건] 동안 [동작?]"
  const whileM = trimmed.match(/^(.+?)\s+동안(?:\s*반복(?:하기|해서|하며|하고)?)?\s*(.*)$/);
  if (whileM) {
    const parsedWhile = parseKoreanConditionClause(whileM[1], l, null, ctx);
    if (parsedWhile && parsedWhile.expr) {
      const bodyRaw = (whileM[2] || "").trim();
      if (!bodyRaw && ctx && ctx.allowBlockHeaders) {
        const hdr = l === "python" ? `while ${parsedWhile.expr}:` : l === "swift" ? `while ${parsedWhile.expr} {` : `while (${parsedWhile.expr}) {`;
        return {
          matchedPattern: "loop_count",
          titleKo: "④ 반복 (조건 동안)",
          code: hdr,
          snippet: hdr,
          opensBlock: true,
          descriptionKo: "조건이 참인 동안 반복합니다."
        };
      }
      const bodyLine = buildKoreanActionStatement(bodyRaw, l, parsedWhile.lhsVar, ctx);
      if (!bodyLine) return null;
      const code = l === "python"
        ? `while ${parsedWhile.expr}:\n    ${bodyLine}`
        : l === "swift"
          ? `while ${parsedWhile.expr} {\n    ${bodyLine}\n}`
          : `while (${parsedWhile.expr}) {\n    ${bodyLine}\n}`;
      return {
        matchedPattern: "loop_count",
        titleKo: "④ 반복 (조건 동안)",
        code,
        snippet: code,
        opensBlock: false,
        descriptionKo: "조건이 참인 동안 반복하는 코드를 완성합니다."
      };
    }
  }

  // Pattern ④-B: Count Loop "[숫자]번 반복 [동작?]"
  const countLoopM = trimmed.match(/^(\d+)\s*(?:번|회)\s*반복(?:하기|해서|하며|하고)?\s*(.*)$/);
  if (countLoopM) {
    const countNum = countLoopM[1];
    const bodyRaw = (countLoopM[2] || "").trim();
    if (!bodyRaw && ctx && ctx.allowBlockHeaders) {
      const hdr = buildRepeatHeaderCode(countNum, l);
      return {
        matchedPattern: "loop_count",
        titleKo: "④ 반복 (블록 시작)",
        code: hdr,
        snippet: hdr,
        opensBlock: true,
        descriptionKo: `${countNum}번 반복 루프를 시작합니다.`
      };
    }
    const bodyLine = buildKoreanActionStatement(bodyRaw, l, "i", ctx);
    if (!bodyLine) return null;
    const code = buildRepeatCountBlockCode(countNum, bodyLine, l);
    return {
      matchedPattern: "loop_count",
      titleKo: "④ 반복 (횟수 반복)",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: `${countNum}번 반복 실행하는 루프 뼈대를 완성합니다.`
    };
  }

  // Pattern ④-A: For-each Loop "[목록](에서)? 하나씩 [동작?]"
  const eachLoopM = trimmed.match(/^(.+?)(?:에서)?\s+하나씩\s*(?:꺼내서|꺼내며)?\s*(.*)$/);
  if (eachLoopM) {
    const eachSlots = fillKoRoleSlots(tokenizeKoWithRoles(eachLoopM[1]));
    const listRaw = eachSlots.source || eachSlots.dest || eachLoopM[1];
    const listVar = requireKoIdent(listRaw, true, leftoverNaturalExpr(listRaw, l, ctx));
    const itemNouns = splitUnscopedNounsAndNums(eachSlots).nouns;
    const itemVar = itemNouns.length >= 2 ? identFromKoSlot(itemNouns[0], "item", false) : "item";
    if (ctx && ctx.declaredVars) ctx.declaredVars.add(itemVar);
    const rawTail = (eachLoopM[2] || "").trim();
    const bodyRaw = /^(?:반복(?:하기|해서|하며|하고|해)?)$/.test(rawTail) ? "" : rawTail;
    if (!bodyRaw && ctx && ctx.allowBlockHeaders) {
      const hdr = buildForEachHeaderCode(itemVar, listVar, l);
      return {
        matchedPattern: "loop_each",
        titleKo: "④ 반복 (블록 시작)",
        code: hdr,
        snippet: hdr,
        opensBlock: true,
        descriptionKo: `'${listVar}' 목록 반복을 시작합니다.`
      };
    }
    const bodyLine = buildKoreanActionStatement(bodyRaw || "출력", l, itemVar, ctx);
    if (!bodyLine) return null;
    const code = buildForEachBlockCode(itemVar, listVar, bodyLine, l);
    return {
      matchedPattern: "loop_each",
      titleKo: "④ 반복 (목록 하나씩)",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: `'${listVar}' 목록에서 하나씩 꺼내 반복하는 코드를 완성합니다.`
    };
  }

  // Pattern ①-B: Arithmetic compound update "[대상](에|에서|을|를) [값](으로|로)? (더하기|증가|빼기|감소|곱하기|나누기)"
  const arithM = trimmed.match(/^(.+?)(?:에다가|에다|에서|에는|에|을|를|은|는)\s+(.+?)\s*(더하기|더해|더하고|증가하기|증가|빼기|빼고|빼|감소하기|감소|곱하기|곱해|곱하고|나누기|나눠|나누고)(?:하기|해줘|해)?$/);
  if (arithM) {
    const lhsRaw = arithM[1].trim();
    const rhsRaw = arithM[2].replace(/(?:으로|로)$/, "").trim();
    const verbWord = arithM[3];
    const isSplitVerb = /^나누|^나눠/.test(verbWord);
    const isDelimRhs =
      Object.prototype.hasOwnProperty.call(KO_INSTRUMENT_LITERALS, rhsRaw) ||
      /^["'`]/.test(rhsRaw) ||
      /^(?:글자|문자|문자열|문장)$/.test(lhsRaw);
    if (!(isSplitVerb && isDelimRhs)) {
      const arithOp =
        /^(?:더하|더해|더하고|증가)/.test(verbWord) ? "+=" :
        /^(?:빼|감소)/.test(verbWord) ? "-=" :
        /^곱/.test(verbWord) ? "*=" : "/=";
      const lhsVar = requireKoIdent(lhsRaw, false, leftoverNaturalExpr(lhsRaw, l, ctx) || "value");
      const rhsVal = formatKoLiteralOrExpr(rhsRaw, l, true, ctx);
      if (ctx) ctx.lastSubject = lhsVar;
      const code = `${lhsVar} ${arithOp} ${rhsVal}${langStatementSemi(l)}`;
      return {
        matchedPattern: "assign",
        titleKo: "① 값 변경 (산술 연산)",
        code,
        snippet: code,
        opensBlock: false,
        descriptionKo: `'${lhsVar}' 값을 ${arithOp} ${rhsVal}만큼 변경합니다.`
      };
    }
  }

  // Pattern ①: Assignment "[고정값|상수|변수]? [이름](에|을/를|은/는) [값](으로/로)? 넣기/담기/바꾸기/설정/정하기"
  const lineLast = trimmed.split(/\s+/).pop();
  const isAssignEnd =
    KO_ASSIGN_WORDS.has(lineLast) ||
    KO_ASSIGN_WORDS.has(stripTrailingKoParticle(lineLast || "")) ||
    /(?:바꾸기|바꿔|설정하기|설정|변경하기|변경|정해)$/.test(lineLast || "");
  const assignM = isAssignEnd
    ? trimmed.match(/^(?:(고정값|상수|변수)\s+)?(.+?)(?:에다가|에다|에는|에|을|를|은|는)\s+(.+?)\s*(?:넣기|담기|대입하기|집어넣기|할당하기|값넣기|대입|할당|정하기|설정하기|설정|바꾸기|바꿔|변경하기|변경|정해)$/)
    : null;
  if (assignM) {
    const isConst = assignM[1] === "고정값" || assignM[1] === "상수";
    const assignSlots = fillKoRoleSlots(tokenizeKoWithRoles(`${assignM[2]} ${assignM[3]}`));
    const varName = requireKoIdent(assignSlots.dest || assignM[2], false, "value");
    const valRaw = String(assignSlots.object && assignSlots.dest ? assignSlots.object : assignM[3])
      .replace(/(?:으로|로)$/, "")
      .trim();
    const isReassignVerb = /(?:바꾸기|바꿔|설정하기|설정|변경하기|변경)$/.test(lineLast || "");
    const code = buildAssignStatement(varName, valRaw, l, !isReassignVerb, isConst, ctx, "ko");
    return {
      matchedPattern: "assign",
      titleKo: "① 값 담기 (변수 상자)",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: `'${varName}' 상자에 값을 담는 코드를 완성합니다.`
    };
  }

  // Pattern ①-C: Bare topic assignment "[이름](은|는) [리터럴/값]" (e.g. "점수는 80")
  const topicAssignM = trimmed.match(/^([A-Za-z_가-힣][A-Za-z0-9_가-힣]*)(?:은|는)\s+(.+?)$/);
  if (topicAssignM && !/\s/.test(topicAssignM[2].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "_STR_"))) {
    const rhsTok = topicAssignM[2].trim();
    if (!/(?:출력|반환|추가|제거|정렬|나누기|합치기|넣기|담기|더하기|빼기|곱하기|입력)/.test(rhsTok)) {
      const varName = requireKoIdent(topicAssignM[1], false, "value");
      const code = buildAssignStatement(varName, rhsTok, l, true, false, ctx, "ko");
      return {
        matchedPattern: "assign",
        titleKo: "① 값 담기 (변수 상자)",
        code,
        snippet: code,
        opensBlock: false,
        descriptionKo: `'${varName}'에 값을 담습니다.`
      };
    }
  }

  // Standalone single-line actions & natural input conditions:
  // Pattern 0: "[만약]? [값](을/를/이/가)? (받는다면|입력된다면|입력받으면|들어오면)"
  const recvCondM = trimmed.match(/^(?:(?:만약|만일)\s+)?(.+?)(?:을|를|이|가)?\s+(?:받는다면|입력된다면|입력받으면|들어오면)(?:\s+(.+))?$/);
  if (recvCondM) {
    const expectedVal = formatKoLiteralOrExpr(recvCondM[1], l, true, ctx);
    const inputVar = (ctx && ctx.lastInputVar) || "value";
    const eqOp = l === "javascript" ? "===" : "==";
    const condExpr = `${inputVar} ${eqOp} ${expectedVal}`;
    const actionTail = (recvCondM[2] || "").trim();
    if (!actionTail && ctx && ctx.allowBlockHeaders) {
      const hdr = buildIfHeaderCode(condExpr, l, false);
      return {
        matchedPattern: "condition_input",
        titleKo: "② 입력 조건 분기",
        code: hdr,
        snippet: hdr,
        opensBlock: true,
        descriptionKo: `'${inputVar}' 입력 값이 ${expectedVal}와(과) 같을 때 실행합니다.`
      };
    }
    const actionLine = actionTail
      ? buildKoreanActionStatement(actionTail, l, inputVar, ctx)
      : buildPrintStatement(expectedVal, l);
    if (!actionLine) return null;
    const code = buildIfBlockCode(condExpr, actionLine, l);
    return {
      matchedPattern: "condition_input",
      titleKo: "② 입력 조건 분기",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: `'${inputVar}' 입력 값이 ${expectedVal}일 때 실행하는 조건문입니다.`
    };
  }

  // Pattern 0-B: "[이름]에? [안내문](을/를)? (입력하고|입력받기|입력받아|입력)"
  const inputActM = trimmed.match(/^(?:(.+?)(?:에다가|에다|에는|에)\s+)?(.+?)(?:을|를|이|가)?\s*(?:입력하고|입력받기|입력받아|입력하기|입력)$/);
  if (inputActM) {
    const inSlots = fillKoRoleSlots(tokenizeKoWithRoles(trimmed.replace(/(?:입력하고|입력받기|입력받아|입력하기|입력)$/, "")));
    const objCandidate = inSlots.object ? String(inSlots.object).trim() : "";
    const objIsNamedVar = Boolean(objCandidate && !/^-?\d/.test(objCandidate) && !/^["'`]/.test(objCandidate));
    const varName = inSlots.dest
      ? requireKoIdent(inSlots.dest, false, "value")
      : (inputActM[1] ? requireKoIdent(inputActM[1], false, "value") : (objIsNamedVar ? requireKoIdent(objCandidate, false, "value") : "value"));
    const promptRaw = inSlots.dest || inputActM[1]
      ? (inSlots.object || (inputActM[2] || "").trim() || "입력")
      : (objIsNamedVar ? quoteNaturalLiteral(objCandidate) : (inSlots.object || (inputActM[2] || "").trim() || "입력"));
    if (ctx) {
      if (ctx.declaredVars) ctx.declaredVars.add(varName);
      ctx.lastInputVar = varName;
      ctx.lastSubject = varName;
    }
    const isNew = !(ctx && ctx.emittedVars && ctx.emittedVars.has(varName));
    if (ctx && !ctx.emittedVars) ctx.emittedVars = new Set();
    if (ctx && ctx.emittedVars) ctx.emittedVars.add(varName);
    const code = buildKoInputStatement(varName, promptRaw, l, ctx, isNew);
    return {
      matchedPattern: "input_assign",
      titleKo: "값 입력 저장",
      code,
      snippet: code,
      opensBlock: false,
      descriptionKo: `'${varName}'에 입력을 받아 저장합니다.`
    };
  }

  // Standalone single-line actions: Return / Print / Save (for multi-line blocks!)
  const retOnlyM = trimmed.match(/^(.+?)\s*(?:반환|돌려주기|결과돌려주기|값내보내기|돌려줘|리턴)(?:하기|해줘|해)?$/);
  if (retOnlyM) {
    const code = buildKoreanActionStatement(trimmed, l, null, ctx);
    if (!code) return null;
    return { matchedPattern: "return", titleKo: "결과 반환", code, snippet: code, opensBlock: false, descriptionKo: "결과 값을 돌려줍니다." };
  }
  const outOnlyM = trimmed.match(/^(.+?)\s+(?:콘솔출력|화면출력|줄출력|서식출력|자바출력|경고출력|오류출력|출력|띄우기|보여주기|보여줘|표시|찍기|찍어|인쇄|로그출력|화면표시)(?:하기|해줘|해)?$/);
  if (outOnlyM) {
    const code = buildKoreanActionStatement(trimmed, l, null, ctx);
    if (!code) return null;
    return { matchedPattern: "print", titleKo: "화면 출력", code, snippet: code, opensBlock: false, descriptionKo: "화면에 출력합니다." };
  }
  if (/^(?:.*?\s+)?(?:파일저장|파일에저장|파일쓰기|내용쓰기|기록남기기|저장소쓰기)$/.test(trimmed)) {
    const code = buildKoreanActionStatement(trimmed, l, "result", ctx);
    if (!code) return null;
    return { matchedPattern: "file_save", titleKo: "파일 저장", code, snippet: code, opensBlock: false, descriptionKo: "파일에 저장합니다." };
  }

  // Standalone loop break / continue
  if (/^(?:반복탈출|즉시멈춤|빠져나가기|루프종료|그만두기)$/.test(trimmed)) {
    const bCode = (l === "javascript" || l === "c" || l === "java") ? "break;" : "break";
    return { matchedPattern: "break", titleKo: "반복 탈출", code: bCode, snippet: bCode, opensBlock: false, descriptionKo: "반복문을 즉시 빠져나옵니다." };
  }
  if (/^(?:다음차례|이번건넘기|건너뛰기|계속진행)$/.test(trimmed)) {
    const cCode = (l === "javascript" || l === "c" || l === "java") ? "continue;" : "continue";
    return { matchedPattern: "continue", titleKo: "다음 차례", code: cCode, snippet: cCode, opensBlock: false, descriptionKo: "이번 반복을 건너뛰고 다음 차례로 넘어갑니다." };
  }

  return null;
}
if (typeof window !== "undefined") window.parseKoreanSentenceToCode = parseKoreanSentenceToCode;

// --- Feature 3: Code Chunk Recognizer -> Natural Korean Sentence Summarizer ---
function humanizeConditionExpr(exprRaw) {
  let s = String(exprRaw || "").trim();
  s = s.replace(/\s*===\s*|\s*==\s*/g, "와(과) 같으면 ").replace(/\s*!==\s*|\s*!=\s*/g, "와(과) 다르면 ");
  const cmp = s.match(/^(.+?)\s*(>=|<=|>|<|===|==|!==|!=)\s*(.+)$/);
  if (cmp) {
    const left = cmp[1].trim();
    const op = cmp[2];
    const right = cmp[3].trim();
    const opWord =
      op === ">=" ? "이상" :
      op === "<=" ? "이하" :
      op === ">" ? "초과(큼)" :
      op === "<" ? "미만(작음)" :
      (op === "==" || op === "===") ? "같" : "다르";
    return `'${left}'이(가) ${right} ${opWord}`;
  }
  const incM = s.match(/^(.+?)\.(?:includes|contains)\((.+)\)$/);
  if (incM) return `'${incM[1].trim()}' 안에 ${incM[2].trim()}이(가) 포함`;
  const inM = s.match(/^(.+?)\s+in\s+(.+)$/);
  if (inM) return `'${inM[2].trim()}' 안에 ${inM[1].trim()}이(가) 포함`;
  return `'${s}'`;
}

function summarizeCodeLineToKorean(rawLine, lang = currentLang) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed) return null;
  if (/^(#|\/\/|\/\*|\*|\*\/|[{}()\[\];]+$)/.test(trimmed)) return null;

  // 1. Pipeline chunk (comprehension + filter/sort, or .filter().sort() / .stream().filter())
  const pyPipe = trimmed.match(/^(?:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?(sorted\s*\(\s*)?\[.+?\s+for\s+\w+\s+in\s+([A-Za-z_][A-Za-z0-9_.]*)\s+if\s+(.+?)\]/);
  if (pyPipe) {
    const dest = pyPipe[1] ? `'${pyPipe[1]}'에 ` : "";
    const hasSort = Boolean(pyPipe[2]);
    const src = pyPipe[3];
    const condKo = humanizeConditionExpr(pyPipe[4]);
    return {
      categoryKo: "연속 작업",
      iconKey: "spark",
      sentenceKo: `[연속 작업] '${src}'에서 ${condKo}인 것만 골라${hasSort ? " 순서대로 정렬한 뒤 " : " "}${dest}담습니다.`
    };
  }
  const chainFilterM = trimmed.match(/(?:const|let|var|val)?\s*(?:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\.stream\(\))?\.filter\s*[({]\s*([^)}]+)[)}]/);
  if (chainFilterM) {
    const dest = chainFilterM[1] ? `'${chainFilterM[1]}'에 ` : "";
    const src = chainFilterM[2];
    const hasSort = /\.sort/.test(trimmed);
    const hasSave = /writeFileSync|writeText|writeString|\.write\(/.test(trimmed);
    const parts = [`'${src}'에서 조건(${chainFilterM[3].trim()})에 맞는 값만 골라`];
    if (hasSort) parts.push("정렬하고");
    if (hasSave) parts.push("파일에 저장하며");
    parts.push(`${dest}처리합니다.`);
    return { categoryKo: "연속 작업", iconKey: "spark", sentenceKo: `[연속 작업] ${parts.join(" ")}` };
  }

  // 2. File Save / Write chunk
  if (/(?:\bwith\s+open|\bfopen)\s*\([^)]*["']w["']|\.(?:write|writelines|writeText|writeFileSync|writeString)\s*\(|\bfprintf\s*\(/.test(trimmed)) {
    const fileM = trimmed.match(/(?:open|fopen|File|Path\.of|writeFileSync|toFile:)\s*\(?\s*(["'][^"']+["'])/);
    const fname = fileM ? fileM[1] : "파일";
    return {
      categoryKo: "파일 저장",
      iconKey: "save",
      sentenceKo: `[파일 저장] ${fname} 파일에 결과를 기록하여 저장합니다.`
    };
  }

  // 3. File Read chunk
  if (/(?:\bwith\s+open|\bfopen)\s*\([^)]*["']r["']|\.(?:read|readlines|readFileSync|readString)\s*\(/.test(trimmed)) {
    const fileM = trimmed.match(/(?:open|fopen|readFileSync|readString)\s*\(\s*(["'][^"']+["'])/);
    const fname = fileM ? fileM[1] : "파일";
    return {
      categoryKo: "파일 읽기",
      iconKey: "file",
      sentenceKo: `[파일 읽기] ${fname} 파일을 열어 안에 든 내용을 읽어옵니다.`
    };
  }

  // 4. Function Definition chunk
  const fnM = trimmed.match(/^(?:async\s+)?(?:def|function|fun|func)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
  if (fnM) {
    const pText = fnM[2].trim();
    return {
      categoryKo: "기능 정의",
      iconKey: "fn",
      sentenceKo: pText
        ? `[기능 정의] '${pText}' 재료를 받아 일하는 '${fnM[1]}' 기능을 만듭니다.`
        : `[기능 정의] '${fnM[1]}' 새 기능을 만듭니다.`
    };
  }

  // 5. Condition chunk (if / elif / else if / guard / else)
  const ifM = trimmed.match(/^(?:else\s+if|elif|if|guard)\s*\(?\s*(.+?)\s*(?:\)\s*\{|\{\s*|:\s*)$/);
  if (ifM) {
    const condExpr = ifM[1].replace(/\s*else$/, "").trim();
    const condKo = humanizeConditionExpr(condExpr);
    return {
      categoryKo: "조건",
      iconKey: "condition",
      sentenceKo: `[조건] 만약 ${condKo}이면 아래 동작을 실행합니다.`
    };
  }
  if (/^else\s*[:{]?/.test(trimmed)) {
    return { categoryKo: "조건(그 외)", iconKey: "condition", sentenceKo: "[그 외] 앞의 조건이 맞지 않을 때 대신 실행합니다." };
  }

  // 6. Loop chunk (range / repeat / C-for / for-each / while)
  const rangeM = trimmed.match(/^for\s+\w+\s+in\s+range\s*\(\s*([^)]+)\)\s*:/) || trimmed.match(/^repeat\s*\(\s*([^)]+)\s*\)\s*\{/) || trimmed.match(/^for\s+\w+\s+in\s+0\.\.<\s*([^\s{]+)\s*\{/);
  if (rangeM) {
    return { categoryKo: "반복", iconKey: "loop", sentenceKo: `[반복] 아래 동작을 ${rangeM[1].trim()}번 되풀이합니다.` };
  }
  const cForM = trimmed.match(/^for\s*\(\s*(?:let|var|int)?\s*\w+\s*=\s*\d+\s*;\s*\w+\s*<\s*([^;]+);/);
  if (cForM) {
    return { categoryKo: "반복", iconKey: "loop", sentenceKo: `[반복] 아래 동작을 ${cForM[1].trim()}번 되풀이합니다.` };
  }
  const eachM = trimmed.match(/^for\s*\(?(?:(?:const|let|var)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+(?:in|of|:)\s+([A-Za-z_][A-Za-z0-9_.]*)\)?\s*[:{]?/);
  if (eachM) {
    return { categoryKo: "반복", iconKey: "loop", sentenceKo: `[반복] '${eachM[2]}' 목록에서 하나씩 '${eachM[1]}'(으)로 꺼내며 반복합니다.` };
  }
  const whileM = trimmed.match(/^while\s*\(?\s*(.+?)\s*\)?\s*[:{]/);
  if (whileM) {
    return { categoryKo: "조건 반복", iconKey: "loop", sentenceKo: `[조건 반복] ${humanizeConditionExpr(whileM[1])}인 동안 계속 반복합니다.` };
  }

  // 7. Output / Print chunk
  const printM = trimmed.match(/^(?:console\.(?:log|warn|error)|System\.out\.println|println|printf|print)\s*\((.*)\)\s*;?$/);
  if (printM) {
    const arg = printM[1].trim();
    return { categoryKo: "화면 출력", iconKey: "print", sentenceKo: `[화면 출력] ${arg || "내용"}을(를) 화면에 보여줍니다.` };
  }

  // 8. Return chunk
  const retM = trimmed.match(/^return\b\s*(.*?);?$/);
  if (retM) {
    return { categoryKo: "결과 반환", iconKey: "result", sentenceKo: `[결과 반환] ${retM[1] || "작업"} 결과를 돌려주고 끝냅니다.` };
  }

  // 9. Variable assignment chunk
  const assignM = trimmed.match(/^(?:(?:const|let|var|val|int|double|float|String|boolean|bool|char\s*\*)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);?$/);
  if (assignM && !/^==/.test(assignM[2])) {
    return { categoryKo: "값 담기", iconKey: "assign", sentenceKo: `[값 담기] '${assignM[1]}' 상자에 ${assignM[2].trim()} 값을 담습니다.` };
  }

  return null;
}

function summarizeFullCodeToKorean(rawCode, lang = currentLang) {
  const lines = String(rawCode || "").split(/\r?\n/);
  const summaries = [];
  for (let i = 0; i < lines.length; i++) {
    const info = summarizeCodeLineToKorean(lines[i], lang);
    if (info) {
      summaries.push({
        lineNumber: i + 1,
        rawLine: lines[i].trim(),
        categoryKo: info.categoryKo,
        iconKey: info.iconKey || "note",
        sentenceKo: info.sentenceKo
      });
    }
  }
  return summaries;
}
if (typeof window !== "undefined") {
  window.summarizeCodeLineToKorean = summarizeCodeLineToKorean;
  window.summarizeFullCodeToKorean = summarizeFullCodeToKorean;
}

// ============================================================================
// English Parity Engine: Word-Order Composer + Code Summarizer
// ============================================================================

const EN_GRAMMAR_VALID_WORDS = new Set([
  "if", "else", "elif", "otherwise", "then", "when", "where", "unless",
  "put", "store", "set", "assign", "let", "make", "constant", "const", "var", "variable",
  "into", "to", "in", "of", "from", "with", "using", "by", "as", "on", "at",
  "is", "are", "be", "equals", "equal", "at", "least", "most", "greater", "above", "over",
  "less", "below", "under", "than", "not", "or", "and", "the", "a", "an",
  "contains", "includes", "filter", "pick", "select", "choose", "sort", "sorted",
  "ascending", "descending", "order", "sum", "total", "save", "file", "write",
  "print", "show", "display", "output", "return", "give", "back",
  "for", "each", "every", "loop", "repeat", "times", "do",
  "define", "create", "function", "func", "method", "params", "note",
  "true", "false", "null", "none", "nil", "empty", "item", "items",
  "i", "j", "k", "n", "x", "y", "z", "a", "b", "c", "f"
]);

const KO_GRAMMAR_VALID_WORDS = new Set([
  "만약", "만일", "조건이면", "받는다면", "입력된다면", "입력받으면", "들어오면",
  "아니고", "아니고만약", "아니면만약", "아니면", "그밖에", "그렇지않으면", "나머지경우", "안맞으면",
  "그외", "그렇지", "않으면", "않다면", "없다면", "없으면", "없다", "있다면", "있으면",
  "이상", "이상이면", "이상이라면", "이상일때", "이상이거나", "이상이고", "이상이면서", "이상인",
  "이하", "이하이면", "이하라면", "이하이라면", "이하이거나", "이하이고", "이하이면서", "이하인",
  "초과", "초과면", "초과이면", "초과라면", "초과이라면", "초과이거나", "초과이고", "초과인",
  "미만", "미만이면", "미만이라면", "미만이거나", "미만이고", "미만인",
  "보다", "크다", "큰", "크면", "크다면", "크거나", "크고", "크면서", "클때",
  "작다", "작은", "작으면", "작다면", "작거나", "작고", "작면서", "작을때",
  "같다", "같음", "같으면", "같다면", "같거나", "같고", "같은", "같지",
  "다르다", "다름", "다르면", "다르다면", "다르거나", "다르고", "다른",
  "아니다", "아니라면", "아닌", "일치", "포함", "포함확인", "포함이면", "포함이라면", "포함되어", "포함된", "들어있",
  "경우라면", "일경우", "외에는",
  "넣기", "담기", "대입", "대입하기", "집어넣기", "할당", "할당하기", "값넣기", "정하기", "설정", "설정하기", "바꾸기", "바꿔",
  "골라내기", "골라서", "고르기", "고르고", "골라", "걸러서", "걸러내기", "걸러내고", "추려서", "추려내기", "필터", "필터링해서",
  "정렬", "정렬하기", "정렬해", "새로정렬", "정렬하고", "줄세우기", "오름차순", "내림차순", "순서대로", "뒤집기",
  "총합", "합계", "더하기", "더해", "빼기", "빼", "곱하기", "곱해", "나누기", "나눠", "증가", "증가하기", "감소", "감소하기", "최대값", "최소값", "절댓값", "반올림", "랜덤뽑기",
  "길이", "글자길이", "크기", "개수세기", "숫자범위",
  "파일열기", "내용읽기", "파일저장", "파일에저장", "파일쓰기", "파일닫기", "저장", "저장하기",
  "출력", "출력하기", "출력해", "콘솔출력", "화면출력", "줄출력", "서식출력", "자바출력", "경고출력", "오류출력",
  "띄우기", "보여주기", "보여줘", "표시", "찍기", "인쇄", "로그출력", "화면표시",
  "반환", "반환하기", "반환해", "돌려주기", "돌려줘", "결과돌려주기", "값내보내기", "리턴",
  "입력받기", "입력", "입력하고", "입력하기", "입력받아", "창입력",
  "반복", "반복하기", "반복해서", "반복하며", "반복하고", "반복탈출", "다음차례", "동안", "번", "회", "하나씩", "꺼내서", "꺼내며",
  "끝에추가", "추가", "추가하기", "밀어넣기", "더해넣기", "꺼내지우기", "끼워넣기", "제거", "제거하기", "삭제하기", "지우기", "싹비우기", "해", "해줘",
  "하나씩바꾸기", "모두실행", "합쳐줄이기", "합치기", "쪼개기", "이어붙이기", "바꿔치기", "여백깎기", "양끝다듬기",
  "기능", "함수", "함수정의", "함수선언", "코틀린함수", "스위프트함수", "재료", "입력값",
  "변수선언", "상수선언", "자유변수", "고정값", "상수", "변수",
  "글자상자", "문자열형", "정수형", "소수형", "논리형", "목록", "배열", "사전", "중복없는모음", "설계도", "도구불러오기",
  "시도", "오류잡기", "에러받기", "마무리항상", "기다림없이", "도착기다리기", "웹요청하기",
  "아이디로부품찾기", "규칙으로부품찾기", "행동연결", "잠깐뒤실행", "주기반복", "제이슨풀기", "제이슨묶기",
  "경우분기", "경우", "기본값분기", "그리고", "모두참", "또는", "하나라도참", "부정", "느낌표부정",
  "참", "파이썬참", "거짓", "파이썬거짓", "값없음", "빈상자", "스위프트없음", "미정의", "없음", "빈값",
  "일때", "때", "경우에", "이면", "라면", "면", "에서", "중에서", "에", "에다가", "에다", "에는", "으로", "로",
  "을", "를", "은", "는", "이", "가", "의", "와", "과", "주석", "메모"
]);

function stripLeadingEnArticles(str) {
  return String(str || "")
    .trim()
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();
}

function resolveEnVarName(rawTerm, preferPlural = false) {
  let clean = stripLeadingEnArticles(rawTerm).replace(/^(?:variable|constant|const|var|let)\s+/i, "").trim();
  if (!clean) return "";
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(clean)) return clean;
  const parts = clean.split(/[\s\-]+/).filter(Boolean).map((p) => p.replace(/[^A-Za-z0-9_]/g, ""));
  const joined = sanitizeDbIdent(parts.join("_"));
  return joined || "";
}

function formatEnLiteralOrExpr(rawVal, lang = currentLang, forceStringIfUnknownWord = true, ctx = null) {
  const v = String(rawVal || "").trim();
  const l = codegenLang(lang);
  if (!v) return '""';
  if (/^["'`].*["'`]$/.test(v)) return v;
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  if (/^true$/i.test(v)) return l === "python" ? "True" : "true";
  if (/^false$/i.test(v)) return l === "python" ? "False" : "false";
  if (/^(?:none|null|nil|empty|nothing)$/i.test(v)) {
    return l === "python" ? "None" : l === "swift" ? "nil" : "null";
  }
  const cleanIdent = resolveEnVarName(v, false);
  if (ctx && ctx.declaredVars && ctx.declaredVars.has(cleanIdent)) {
    return cleanIdent;
  }
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(v)) {
    return v;
  }
  if (!forceStringIfUnknownWord) return v;
  if (ctx && ctx.preferVarIdent) return cleanIdent || v;
  return `"${v}"`;
}

function enComparePhraseToOp(phrase, lang) {
  const l = codegenLang(lang);
  const norm = String(phrase || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (norm === "__gte__" || norm === "greater than or equal to" || norm === "at least" || norm === ">=") return ">=";
  if (norm === "__lte__" || norm === "less than or equal to" || norm === "at most" || norm === "<=") return "<=";
  if (norm === "greater than" || norm === "above" || norm === "over" || norm === ">") return ">";
  if (norm === "less than" || norm === "below" || norm === "under" || norm === "<") return "<";
  if (norm === "not equal to" || norm === "does not equal" || norm === "!=" || norm === "!==") return l === "javascript" ? "!==" : "!=";
  if (norm === "equal to" || norm === "equals" || norm === "==" || norm === "===") return l === "javascript" ? "===" : "==";
  return null;
}

function parseSingleEnglishComparison(condText, lang, defaultVarName = null, ctx = null) {
  let c = String(condText || "").trim();
  c = c.replace(/^(?:else\s+if|if)\s+/i, "").trim();
  const l = codegenLang(lang);
  const fallbackLhs = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || "value";

  // Membership: "[target] does not contain/include [needle]" or "[target] contains/includes/has [needle]"
  const notContainM = c.match(/^(.+?)\s+(?:does\s+not\s+(?:contain|include|have)|excludes)\s+(.+)$/i);
  if (notContainM && notContainM[1] && notContainM[2]) {
    const targetVar = resolveEnVarName(notContainM[1], false);
    const needle = formatEnLiteralOrExpr(notContainM[2], l, true, ctx);
    if (ctx && targetVar) ctx.lastSubject = targetVar;
    if (l === "python") return { expr: `${needle} not in ${targetVar}`, lhsVar: targetVar };
    if (l === "kotlin") return { expr: `${needle} !in ${targetVar}`, lhsVar: targetVar };
    if (l === "javascript") return { expr: `!${targetVar}.includes(${needle})`, lhsVar: targetVar };
    if (l === "swift" || l === "java") return { expr: `!${targetVar}.contains(${needle})`, lhsVar: targetVar };
    return { expr: `strstr(${targetVar}, ${needle}) == NULL`, lhsVar: targetVar };
  }
  const containM = c.match(/^(.+?)\s+(?:contains|includes|has)\s+(.+)$/i);
  if (containM && containM[1] && containM[2]) {
    const targetVar = resolveEnVarName(containM[1], false);
    const needle = formatEnLiteralOrExpr(containM[2], l, true, ctx);
    if (ctx && targetVar) ctx.lastSubject = targetVar;
    if (l === "python" || l === "kotlin") return { expr: `${needle} in ${targetVar}`, lhsVar: targetVar };
    if (l === "javascript") return { expr: `${targetVar}.includes(${needle})`, lhsVar: targetVar };
    if (l === "swift" || l === "java") return { expr: `${targetVar}.contains(${needle})`, lhsVar: targetVar };
    return { expr: `strstr(${targetVar}, ${needle}) != NULL`, lhsVar: targetVar };
  }
  const notInM = c.match(/^(.+?)\s+is\s+not\s+in\s+(.+)$/i);
  if (notInM && notInM[1] && notInM[2]) {
    const needle = formatEnLiteralOrExpr(notInM[1], l, true, ctx);
    const targetVar = resolveEnVarName(notInM[2], false);
    if (ctx && targetVar) ctx.lastSubject = targetVar;
    if (l === "python") return { expr: `${needle} not in ${targetVar}`, lhsVar: targetVar };
    if (l === "kotlin") return { expr: `${needle} !in ${targetVar}`, lhsVar: targetVar };
    if (l === "javascript") return { expr: `!${targetVar}.includes(${needle})`, lhsVar: targetVar };
    if (l === "swift" || l === "java") return { expr: `!${targetVar}.contains(${needle})`, lhsVar: targetVar };
    return { expr: `strstr(${targetVar}, ${needle}) == NULL`, lhsVar: targetVar };
  }
  const inM = c.match(/^(.+?)\s+is\s+in\s+(.+)$/i);
  if (inM && inM[1] && inM[2]) {
    const needle = formatEnLiteralOrExpr(inM[1], l, true, ctx);
    const targetVar = resolveEnVarName(inM[2], false);
    if (ctx && targetVar) ctx.lastSubject = targetVar;
    if (l === "python" || l === "kotlin") return { expr: `${needle} in ${targetVar}`, lhsVar: targetVar };
    if (l === "javascript") return { expr: `${targetVar}.includes(${needle})`, lhsVar: targetVar };
    if (l === "swift" || l === "java") return { expr: `${targetVar}.contains(${needle})`, lhsVar: targetVar };
    return { expr: `strstr(${targetVar}, ${needle}) != NULL`, lhsVar: targetVar };
  }

  // Predicate only first (no LHS), e.g., "at least 80", "is greater than 80", "less than 20"
  const predRules = [
    { re: /^(?:is\s+greater\s+than\s+or\s+equal\s+to|greater\s+than\s+or\s+equal\s+to|is\s+at\s+least|at\s+least)\s+(.+)$/i, op: ">=", opJs: ">=" },
    { re: /^(?:is\s+less\s+than\s+or\s+equal\s+to|less\s+than\s+or\s+equal\s+to|is\s+at\s+most|at\s+most)\s+(.+)$/i, op: "<=", opJs: "<=" },
    { re: /^(?:is\s+greater\s+than|greater\s+than|is\s+above|above|is\s+over|over)\s+(.+)$/i, op: ">", opJs: ">" },
    { re: /^(?:is\s+less\s+than|less\s+than|is\s+below|below|is\s+under|under)\s+(.+)$/i, op: "<", opJs: "<" },
    { re: /^(?:is\s+not\s+equal\s+to|not\s+equal\s+to|does\s+not\s+equal|is\s+not)\s+(.+)$/i, op: "!=", opJs: "!==" },
    { re: /^(?:is\s+equal\s+to|equal\s+to|equals|is)\s+(.+)$/i, op: "==", opJs: "===" },
    { re: /^(>=|<=|===|!==|==|!=|>|<)\s*(.+)$/, op: null, opJs: null }
  ];
  for (const r of predRules) {
    const m = c.match(r.re);
    if (m) {
      const op = r.op === null ? m[1] : r.op;
      const rhsRaw = r.op === null ? m[2] : m[1];
      const rhsVal = formatEnLiteralOrExpr(rhsRaw, l, false, ctx);
      const finalOp = l === "javascript" ? (r.opJs || op) : op;
      if (ctx) ctx.lastSubject = fallbackLhs;
      return { expr: `${fallbackLhs} ${finalOp} ${rhsVal}`, rhsOnly: `${finalOp} ${rhsVal}`, op, lhsVar: fallbackLhs, rhsVal };
    }
  }

  const opRules = [
    { re: /^(.+?)\s+(?:is\s+greater\s+than\s+or\s+equal\s+to|greater\s+than\s+or\s+equal\s+to|is\s+at\s+least|at\s+least)\s+(.+)$/i, op: ">=", opJs: ">=" },
    { re: /^(.+?)\s+(?:is\s+less\s+than\s+or\s+equal\s+to|less\s+than\s+or\s+equal\s+to|is\s+at\s+most|at\s+most)\s+(.+)$/i, op: "<=", opJs: "<=" },
    { re: /^(.+?)\s+(?:is\s+greater\s+than|greater\s+than|is\s+above|above|is\s+over)\s+(.+)$/i, op: ">", opJs: ">" },
    { re: /^(.+?)\s+(?:is\s+less\s+than|less\s+than|is\s+below|below|is\s+under)\s+(.+)$/i, op: "<", opJs: "<" },
    { re: /^(.+?)\s+(?:is\s+not\s+equal\s+to|not\s+equal\s+to|is\s+not|does\s+not\s+equal)\s+(.+)$/i, op: "!=", opJs: "!==" },
    { re: /^(.+?)\s+(?:is\s+equal\s+to|equal\s+to|equals|is)\s+(.+)$/i, op: "==", opJs: "===" },
    { re: /^(.+?)\s*(>=|<=|===|!==|==|!=|>|<)\s*(.+)$/, op: null, opJs: null }
  ];

  for (const rule of opRules) {
    const m = c.match(rule.re);
    if (m) {
      const lhsVar = resolveEnVarName(m[1], false);
      const op = rule.op === null ? m[2] : rule.op;
      const rhsRaw = rule.op === null ? m[3] : m[2];
      const rhsVal = formatEnLiteralOrExpr(rhsRaw, l, false, ctx);
      const finalOp = l === "javascript" ? (rule.opJs || op) : op;
      if (ctx && lhsVar) ctx.lastSubject = lhsVar;
      return { expr: `${lhsVar} ${finalOp} ${rhsVal}`, rhsOnly: `${finalOp} ${rhsVal}`, op, lhsVar, rhsVal };
    }
  }

  const leftover = leftoverNaturalExpr(c, l, ctx);
  if (leftover) {
    if (ctx) ctx.lastSubject = leftover;
    return { expr: leftover, lhsVar: leftover };
  }
  return null;
}

function parseEnglishConditionClause(condText, lang, defaultVarName = null, ctx = null) {
  let c = String(condText || "").trim();
  c = c.replace(/^(?:else\s+if|if)\s+/i, "").trim();
  if (!c) return null;
  const l = codegenLang(lang);
  const fallbackLhs = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || "value";

  // Protect quoted strings and "greater/less than or equal to" before splitting on and/or
  const quoted = [];
  let cProt = c.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, (m) => {
    const id = quoted.length;
    quoted.push(m);
    return `\0Q${id}\0`;
  });
  cProt = cProt
    .replace(/\bgreater\s+than\s+or\s+equal\s+to\b/gi, "__GTE__")
    .replace(/\bless\s+than\s+or\s+equal\s+to\b/gi, "__LTE__");

  const restoreEnTokens = (s) => String(s || "")
    .replace(/__GTE__/g, "greater than or equal to")
    .replace(/__LTE__/g, "less than or equal to")
    .replace(/\0Q(\d+)\0/g, (_, idx) => quoted[Number(idx)] || "");

  // Shared LHS & RHS compound predicate: "[lhs is] greater than or less than 80"
  const enSharedOp = "(?:__GTE__|__LTE__|at\\s+least|at\\s+most|greater\\s+than|above|over|less\\s+than|below|under|not\\s+equal\\s+to|equal\\s+to|equals|>=|<=|>|<|==|!=)";
  const predSharedRe = new RegExp(`^(?:is\\s+)?(${enSharedOp})\\s+(or|and)\\s+(?:is\\s+)?(${enSharedOp})\\s+(.+)$`, "i");
  const lhsSharedRe = new RegExp(`^(.+?)\\s+(?:is\\s+)?(${enSharedOp})\\s+(or|and)\\s+(?:is\\s+)?(${enSharedOp})\\s+(.+)$`, "i");

  const predSharedM = cProt.match(predSharedRe);
  if (predSharedM) {
    const op1 = enComparePhraseToOp(predSharedM[1], l);
    const conn = predSharedM[2].toLowerCase() === "and" ? (l === "python" ? "and" : "&&") : (l === "python" ? "or" : "||");
    const op2 = enComparePhraseToOp(predSharedM[3], l);
    const rhsVal = formatEnLiteralOrExpr(restoreEnTokens(predSharedM[4]), l, false, ctx);
    if (op1 && op2) {
      if (ctx) ctx.lastSubject = fallbackLhs;
      return { expr: `${fallbackLhs} ${op1} ${rhsVal} ${conn} ${fallbackLhs} ${op2} ${rhsVal}`, op: op1, lhsVar: fallbackLhs, rhsVal };
    }
  }
  const lhsSharedM = cProt.match(lhsSharedRe);
  if (lhsSharedM) {
    const lhsVar = resolveEnVarName(restoreEnTokens(lhsSharedM[1]), false);
    const op1 = enComparePhraseToOp(lhsSharedM[2], l);
    const conn = lhsSharedM[3].toLowerCase() === "and" ? (l === "python" ? "and" : "&&") : (l === "python" ? "or" : "||");
    const op2 = enComparePhraseToOp(lhsSharedM[4], l);
    const rhsVal = formatEnLiteralOrExpr(restoreEnTokens(lhsSharedM[5]), l, false, ctx);
    if (lhsVar && op1 && op2) {
      if (ctx) ctx.lastSubject = lhsVar;
      return { expr: `${lhsVar} ${op1} ${rhsVal} ${conn} ${lhsVar} ${op2} ${rhsVal}`, op: op1, lhsVar, rhsVal };
    }
  }

  // Split multi-clause conditions on top-level and / or / && / ||
  const splitParts = [];
  const splitConns = [];
  const splitRe = /\s+(and|or)\s+|\s*(&&|\|\|)\s*/gi;
  let lastIdx = 0;
  let sm;
  while ((sm = splitRe.exec(cProt)) !== null) {
    splitParts.push(restoreEnTokens(cProt.slice(lastIdx, sm.index)));
    const rawConn = (sm[1] || sm[2] || "").toLowerCase();
    splitConns.push((rawConn === "and" || rawConn === "&&") ? "and" : "or");
    lastIdx = splitRe.lastIndex;
  }
  if (splitConns.length > 0) {
    splitParts.push(restoreEnTokens(cProt.slice(lastIdx)));
    if (splitParts.every((p) => p.trim().length > 0)) {
      const exprs = [];
      let curLhs = defaultVarName || (ctx && (ctx.lastSubject || ctx.lastInputVar)) || null;
      let firstLhs = null;
      let allOk = true;
      for (const part of splitParts) {
        const subTrim = part.trim();
        const subParsed = subTrim.length < c.length
          ? parseEnglishConditionClause(subTrim, l, curLhs, ctx)
          : parseSingleEnglishComparison(subTrim, l, curLhs, ctx);
        if (!subParsed || !subParsed.expr) {
          allOk = false;
          break;
        }
        if (subParsed.lhsVar) {
          curLhs = subParsed.lhsVar;
          if (!firstLhs) firstLhs = subParsed.lhsVar;
        }
        exprs.push(subParsed.expr);
      }
      if (allOk && exprs.length === splitParts.length) {
        let joined = exprs[0];
        for (let i = 0; i < splitConns.length; i++) {
          const opWord = l === "python" ? splitConns[i] : (splitConns[i] === "and" ? "&&" : "||");
          joined += ` ${opWord} ${exprs[i + 1]}`;
        }
        const finalLhs = firstLhs || curLhs || fallbackLhs;
        if (ctx && finalLhs) ctx.lastSubject = finalLhs;
        return { expr: joined, lhsVar: finalLhs };
      }
    }
  }

  return parseSingleEnglishComparison(c, l, defaultVarName, ctx);
}

function buildEnglishActionStatement(actionRaw, lang, defaultTargetVar = null, ctx = null) {
  const act = String(actionRaw || "").trim();
  const l = codegenLang(lang);
  if (!act) return buildPrintStatement(defaultTargetVar || '""', l);

  // Return
  const retM = act.match(/^return\s+(.+)$/i);
  if (retM) {
    const val = formatEnLiteralOrExpr(retM[1], l, false, ctx);
    return (l === "javascript" || l === "c" || l === "java") ? `return ${val};` : `return ${val}`;
  }

  // Print / Display / Show — keep the named operator (print vs console.log)
  const printM = act.match(/^(?:print|show|display|output|log|console\.log)\s+(.+)$/i);
  if (printM) {
    const argExpr = formatEnLiteralOrExpr(printM[1], l, true, ctx);
    return emitNamedOrDefaultPrint(act, argExpr, l);
  }
  if (/^(?:print|show|display|output|log)$/i.test(act)) {
    return emitNamedOrDefaultPrint(act, defaultTargetVar || "", l);
  }

  // Put/Set Assign
  const putM = act.match(/^(?:put|store|assign)\s+(.+?)\s+(?:into|in|to)\s+(.+)$/i);
  if (putM) {
    return buildAssignStatement(resolveEnVarName(putM[2], false), putM[1], l, false, false, ctx, "en");
  }
  const setM = act.match(/^(?:set|let|make)\s+(.+?)\s+(?:to|be|equal)\s+(.+)$/i);
  if (setM) {
    return buildAssignStatement(resolveEnVarName(setM[1], false), setM[2], l, false, false, ctx, "en");
  }

  // Save to file
  if (/^(?:save\b.*\bfile|write\b.*\bfile|save\s+file)/i.test(act)) {
    const dataVar = defaultTargetVar || "result";
    if (l === "python") return `open("result.txt", "w", encoding="utf-8").write(str(${dataVar}))`;
    if (l === "javascript") return `fs.writeFileSync("result.txt", String(${dataVar}), "utf8");`;
    if (l === "kotlin") return `java.io.File("result.txt").writeText(${dataVar}.toString())`;
    if (l === "swift") return `try? "\\(${dataVar})".write(toFile: "result.txt", atomically: true, encoding: .utf8)`;
    if (l === "java") return `java.nio.file.Files.writeString(java.nio.file.Path.of("result.txt"), String.valueOf(${dataVar}));`;
    return `fprintf(fopen("result.txt", "w"), "%s\\n", "saved");`;
  }

  const enFallback = commitRunnableLine(buildPrintStatement(formatEnLiteralOrExpr(act, l, true, ctx), l), l);
  return enFallback ? enFallback.code : null;
}

function parseEnglishSentenceToCode(rawLine, lang = currentLang, ctx = null) {
  const rawTrimmed = String(rawLine || "").trim();
  if (!rawTrimmed || rawTrimmed.length < 2) return null;
  if (/^(?:#|\/\/)/.test(rawTrimmed)) {
    return { matchedPattern: "comment", titleEn: "Comment", code: rawTrimmed, snippet: rawTrimmed, opensBlock: false, descriptionEn: "Comment line." };
  }
  const noteM = rawTrimmed.match(/^(?:note|comment)\s*[: ]?\s+(.+)$/i);
  if (noteM) {
    const cmtPrefix = codegenLang(lang) === "python" ? "# " : "// ";
    const code = cmtPrefix + noteM[1].trim();
    return { matchedPattern: "comment", titleEn: "Comment", code, snippet: code, opensBlock: false, descriptionEn: "Comment line." };
  }
  const trimmed = normalizeNaturalLineToCanonical(rawTrimmed, "en").trim();
  if (!/[A-Za-z]/.test(trimmed) || /[가-힣]/.test(trimmed)) return null;
  const l = codegenLang(lang);

  // Else branch: "else" / "otherwise"
  if (/^(?:else|otherwise)$/i.test(trimmed)) {
    const code = l === "python" ? "else:" : "else {";
    return {
      matchedPattern: "else",
      titleEn: "② Condition (Else)",
      code,
      snippet: code,
      opensBlock: true,
      closesPrevBlock: true,
      descriptionEn: "Fallback branch when the previous condition is false."
    };
  }

  // Function definition: "define/create/make function NAME [with PARAMS]"
  const fnM = trimmed.match(/^(?:define|create|make)\s+function\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:with|using)\s+(.+))?$/i);
  if (fnM) {
    const fnName = fnM[1];
    const paramsRaw = (fnM[2] || "").trim();
    const paramsList = paramsRaw
      ? paramsRaw.split(/[\s,]+|\band\b/i).map((x) => x.trim()).filter(Boolean).map((p) => {
          const pv = resolveEnVarName(p, false);
          if (ctx && ctx.declaredVars) ctx.declaredVars.add(pv);
          return pv;
        })
      : [];
    const code = buildFunctionHeaderCode(fnName, paramsList, l);
    return {
      matchedPattern: "function_def",
      titleEn: "Define Function",
      code,
      snippet: code,
      opensBlock: true,
      descriptionEn: `Defines function '${fnName}'.`
    };
  }

  // Pattern ③: Pipeline "from [LIST] filter/pick [PRED] then/and [ACTIONS]" OR "filter [LIST] where [PRED] then/and [ACTIONS]"
  const pipeM =
    trimmed.match(/^from\s+(\S+)\s+(?:filter|pick|select)\s+(.+?)(?:\s+(?:then|and)\s+(.*))?$/i) ||
    trimmed.match(/^(?:filter|pick|select)\s+(?:from\s+)?(\S+)\s+where\s+(.+?)(?:\s+(?:then|and)\s+(.*))?$/i);
  if (pipeM) {
    const listVar = resolveEnVarName(pipeM[1], true);
    const predRaw = (pipeM[2] || "").trim();
    const rightClause = (pipeM[3] || "").trim();
    const itemVar = l === "kotlin" ? "it" : l === "swift" ? "$0" : "x";
    const parsedPred = parseEnglishConditionClause(predRaw, l, itemVar, ctx) || {
      expr: leftoverNaturalExpr(predRaw, l, ctx) || itemVar,
      rhsOnly: ""
    };

    const doDesc = /descending|desc\b/i.test(rightClause);
    const doSort = /\bsort\b|order|ascending/i.test(rightClause);
    const doSave = /\bsave\b|write\s+file|to\s+file/i.test(rightClause);
    const namedPrintOp = detectKoPrintOp(rightClause) || detectEnPrintOp(rightClause);
    const doPrint = Boolean(namedPrintOp);
    const doSum = /\bsum\b|\btotal\b/i.test(rightClause);
    const pipelinePrintLine = () => {
      if (namedPrintOp) return emitPrintCall(namedPrintOp, "result", l);
      if (doPrint || (!doSave && rightClause === "")) return buildPrintStatement("result", l);
      return null;
    };

    const lines = [];
    if (l === "python") {
      let expr = `[x for x in ${listVar} if ${parsedPred.expr}]`;
      if (doDesc) expr = `sorted(${expr}, reverse=True)`;
      else if (doSort) expr = `sorted(${expr})`;
      if (doSum) expr = `sum(${expr})`;
      lines.push(`result = ${expr}`);
      if (doSave) {
        lines.push('with open("result.txt", "w", encoding="utf-8") as f:');
        lines.push('    f.write("\\n".join(map(str, result)) if isinstance(result, list) else str(result))');
      }
      const pLine = pipelinePrintLine();
      if (pLine) lines.push(pLine);
    } else if (l === "javascript") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sort((a, b) => b - a)";
      else if (doSort) expr += ".sort((a, b) => a - b)";
      if (doSum) expr += ".reduce((acc, x) => acc + x, 0)";
      lines.push(`const result = ${expr};`);
      if (doSave) {
        lines.push('fs.writeFileSync("result.txt", Array.isArray(result) ? result.join("\\n") : String(result), "utf8");');
      }
      const pLine = pipelinePrintLine();
      if (pLine) lines.push(pLine);
    } else if (l === "kotlin") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sortedDescending()";
      else if (doSort) expr += ".sorted()";
      if (doSum) expr += ".sum()";
      lines.push(`val result = ${expr}`);
      if (doSave) {
        lines.push('java.io.File("result.txt").writeText(result.toString())');
      }
      const pLineKt = pipelinePrintLine();
      if (pLineKt) lines.push(pLineKt);
    } else if (l === "swift") {
      let expr = emitFilterExpr(listVar, parsedPred.expr, l);
      if (doDesc) expr += ".sorted(by: >)";
      else if (doSort) expr += ".sorted()";
      if (doSum) expr += ".reduce(0, +)";
      lines.push(`let result = ${expr}`);
      if (doSave) {
        lines.push('try? "\\(result)".write(toFile: "result.txt", atomically: true, encoding: .utf8)');
      }
      const pLineSw = pipelinePrintLine();
      if (pLineSw) lines.push(pLineSw);
    } else if (l === "java") {
      let expr = `${listVar}.stream().filter(x -> ${parsedPred.expr})`;
      if (doDesc) expr += ".sorted(java.util.Comparator.reverseOrder())";
      else if (doSort) expr += ".sorted()";
      lines.push(`var result = ${expr}.toList();`);
      if (doSave) {
        lines.push('java.nio.file.Files.writeString(java.nio.file.Path.of("result.txt"), result.toString());');
      }
      const pLineJv = pipelinePrintLine();
      if (pLineJv) lines.push(pLineJv);
    } else if (l === "c") {
      lines.push(`int count = (int)(sizeof ${listVar} / sizeof ${listVar}[0]);`);
      if (doDesc) lines.push(`qsort(${listVar}, count, sizeof ${listVar}[0], cmp_desc);`);
      else if (doSort) lines.push(`qsort(${listVar}, count, sizeof ${listVar}[0], cmp_asc);`);
      if (doSave) lines.push('FILE *fp = fopen("result.txt", "w");');
      lines.push(`for (int i = 0; i < count; i++) {`);
      lines.push(`    if (${parsedPred.rhsOnly ? `${listVar}[i] ${parsedPred.rhsOnly}` : (parsedPred.expr || listVar)}) {`);
      if (doSave) lines.push(`        fprintf(fp, "%d\\n", ${listVar}[i]);`);
      else lines.push(`        printf("%d\\n", ${listVar}[i]);`);
      lines.push("    }");
      lines.push("}");
      if (doSave) lines.push("fclose(fp);");
    }

    if (ctx && ctx.declaredVars) ctx.declaredVars.add("result");
    const code = lines.join("\n");
    return {
      matchedPattern: "pipeline",
      titleEn: "③ Pipeline (Filter -> Action)",
      code,
      snippet: code,
      opensBlock: false,
      descriptionEn: "Filters items matching a condition, then sorts, saves, or prints."
    };
  }

  // Pattern ②: Condition "[else ]if [COND] [then ACTION]"
  const isElif = /^else\s+if\s+/i.test(trimmed);
  const condThenM = trimmed.match(/^(?:else\s+)?if\s+(.+?)\s+then(?:\s+(.*))?$/i);
  const condNoThenM = !condThenM ? trimmed.match(/^(?:else\s+)?if\s+(.+)$/i) : null;
  if (condThenM || condNoThenM) {
    const condRaw = condThenM ? condThenM[1] : condNoThenM[1];
    const actionStr = condThenM ? (condThenM[2] || "").trim() : "";
    const parsedCond = parseEnglishConditionClause(condRaw, l, null, ctx);
    if (parsedCond && parsedCond.expr) {
      if (!actionStr && ctx && ctx.allowBlockHeaders) {
        const hdr = buildIfHeaderCode(parsedCond.expr, l, isElif);
        return {
          matchedPattern: isElif ? "elif" : "condition",
          titleEn: "② Condition (Block Start)",
          code: hdr,
          snippet: hdr,
          opensBlock: true,
          closesPrevBlock: isElif,
          descriptionEn: "Starts a conditional block."
        };
      }
      const actionLine = buildEnglishActionStatement(actionStr, l, parsedCond.lhsVar, ctx);
      if (!actionLine) return null;
      const code = buildIfBlockCode(parsedCond.expr, actionLine, l);
      return {
        matchedPattern: "condition",
        titleEn: "② Condition (If ... Then)",
        code,
        snippet: code,
        opensBlock: false,
        descriptionEn: "Checks a condition and runs the action when true."
      };
    }
  }

  // Pattern ④-B: Count Loop "repeat N times [do] [ACTION]"
  const countLoopM = trimmed.match(/^repeat\s+(\d+)\s+times(?:\s+(?:do|to|and))?(?:\s+(.*))?$/i);
  if (countLoopM) {
    const countNum = countLoopM[1];
    const bodyRaw = (countLoopM[2] || "").trim();
    if (!bodyRaw && ctx && ctx.allowBlockHeaders) {
      const hdr = buildRepeatHeaderCode(countNum, l);
      return { matchedPattern: "loop_count", titleEn: "④ Repeat Loop", code: hdr, snippet: hdr, opensBlock: true, descriptionEn: `Starts a loop running ${countNum} times.` };
    }
    const bodyLine = buildEnglishActionStatement(bodyRaw, l, "i", ctx);
    if (!bodyLine) return null;
    const code = buildRepeatCountBlockCode(countNum, bodyLine, l);
    return {
      matchedPattern: "loop_count",
      titleEn: "④ Repeat N Times",
      code,
      snippet: code,
      opensBlock: false,
      descriptionEn: `Repeats the action ${countNum} times.`
    };
  }

  // Pattern ④-A: For-each Loop "for each [ITEM] in [LIST] [do] [ACTION]"
  const eachM =
    trimmed.match(/^(?:for\s+each|each)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:in|of|from)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:do|then|and))?(?:\s+(.*))?$/i) ||
    trimmed.match(/^for\s+each\s+(?:in|from)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:do|then|and))?(?:\s+(.*))?$/i);
  if (eachM) {
    const hasExplicitItem = eachM.length === 4;
    const itemVar = hasExplicitItem ? resolveEnVarName(eachM[1], false) : "item";
    const listVar = resolveEnVarName(hasExplicitItem ? eachM[2] : eachM[1], true);
    const bodyRaw = (hasExplicitItem ? (eachM[3] || "") : (eachM[2] || "")).trim();
    if (ctx && ctx.declaredVars) ctx.declaredVars.add(itemVar);
    if (!bodyRaw && ctx && ctx.allowBlockHeaders) {
      const hdr = buildForEachHeaderCode(itemVar, listVar, l);
      return { matchedPattern: "loop_each", titleEn: "④ For-Each Loop", code: hdr, snippet: hdr, opensBlock: true, descriptionEn: `Loops over '${listVar}'.` };
    }
    const bodyLine = buildEnglishActionStatement(bodyRaw || `print ${itemVar}`, l, itemVar, ctx);
    if (!bodyLine) return null;
    const code = buildForEachBlockCode(itemVar, listVar, bodyLine, l);
    return {
      matchedPattern: "loop_each",
      titleEn: "④ For-Each Loop",
      code,
      snippet: code,
      opensBlock: false,
      descriptionEn: `Processes each item in '${listVar}'.`
    };
  }

  // Pattern ①: Assignment "put/store [VAL] into/in [NAME]" or "set/let [constant] [NAME] to/be [VAL]"
  const putM = trimmed.match(/^(?:put|store|assign)\s+(.+?)\s+(?:into|in|to)\s+(.+)$/i);
  if (putM) {
    const varName = resolveEnVarName(putM[2], false);
    const code = buildAssignStatement(varName, putM[1], l, true, false, ctx, "en");
    return {
      matchedPattern: "assign",
      titleEn: "① Store Value",
      code,
      snippet: code,
      opensBlock: false,
      descriptionEn: `Stores value in '${varName}'.`
    };
  }
  const setM = trimmed.match(/^(?:set|let|make)\s+(constant\s+)?(.+?)\s+(?:to|be|equals?)\s+(.+)$/i);
  if (setM) {
    const isConst = Boolean(setM[1]);
    const varName = resolveEnVarName(setM[2], false);
    const code = buildAssignStatement(varName, setM[3], l, true, isConst, ctx, "en");
    return {
      matchedPattern: "assign",
      titleEn: isConst ? "① Constant Box" : "① Store Value",
      code,
      snippet: code,
      opensBlock: false,
      descriptionEn: `Sets '${varName}' to the given value.`
    };
  }

  // Standalone single-line actions: Return / Print / Save
  if (/^return\s+.+$/i.test(trimmed)) {
    const code = buildEnglishActionStatement(trimmed, l, null, ctx);
    if (!code) return null;
    return { matchedPattern: "return", titleEn: "Return", code, snippet: code, opensBlock: false, descriptionEn: "Returns a value." };
  }
  if (/^(?:print|show|display|output|log)\s+.+$/i.test(trimmed)) {
    const code = buildEnglishActionStatement(trimmed, l, null, ctx);
    if (!code) return null;
    return { matchedPattern: "print", titleEn: "Print", code, snippet: code, opensBlock: false, descriptionEn: "Prints output." };
  }
  if (/^(?:save\b.*\bfile|write\b.*\bfile)/i.test(trimmed)) {
    const code = buildEnglishActionStatement(trimmed, l, "result", ctx);
    if (!code) return null;
    return { matchedPattern: "file_save", titleEn: "Save File", code, snippet: code, opensBlock: false, descriptionEn: "Saves data to file." };
  }

  return null;
}

function parseNaturalSentenceToCode(rawLine, lang = currentLang, mode = displayMode, ctx = null) {
  const parsed = mode === "en"
    ? (parseEnglishSentenceToCode(rawLine, lang, ctx) || parseKoreanSentenceToCode(rawLine, lang, ctx))
    : (parseKoreanSentenceToCode(rawLine, lang, ctx) || parseEnglishSentenceToCode(rawLine, lang, ctx));
  return attachSentenceIconKey(parsed);
}

function humanizeConditionExprEn(exprRaw) {
  let s = String(exprRaw || "").trim();
  const cmp = s.match(/^(.+?)\s*(>=|<=|>|<|===|==|!==|!=)\s*(.+)$/);
  if (cmp) {
    const left = cmp[1].trim();
    const op = cmp[2];
    const right = cmp[3].trim();
    const opWord =
      op === ">=" ? "is at least" :
      op === "<=" ? "is at most" :
      op === ">" ? "is greater than" :
      op === "<" ? "is less than" :
      (op === "==" || op === "===") ? "equals" : "does not equal";
    return `'${left}' ${opWord} ${right}`;
  }
  const incM = s.match(/^(.+?)\.(?:includes|contains)\((.+)\)$/);
  if (incM) return `'${incM[1].trim()}' contains ${incM[2].trim()}`;
  const inM = s.match(/^(.+?)\s+in\s+(.+)$/);
  if (inM) return `'${inM[2].trim()}' contains ${inM[1].trim()}`;
  return `'${s}'`;
}

function summarizeCodeLineToEnglish(rawLine, lang = currentLang) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed || /^(#|\/\/|\/\*|\*|\*\/|[{}()\[\];]+$)/.test(trimmed)) return null;

  const pyPipe = trimmed.match(/^(?:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?(sorted\s*\(\s*)?\[.+?\s+for\s+\w+\s+in\s+([A-Za-z_][A-Za-z0-9_.]*)\s+if\s+(.+?)\]/);
  if (pyPipe) {
    const dest = pyPipe[1] ? `into '${pyPipe[1]}'` : "";
    const hasSort = Boolean(pyPipe[2]);
    return {
      categoryEn: "Pipeline",
      iconKey: "spark",
      sentenceEn: `[Pipeline] Filter '${pyPipe[3]}' where ${humanizeConditionExprEn(pyPipe[4])}${hasSort ? ", sort" : ""} and store ${dest}.`
    };
  }
  const chainFilterM = trimmed.match(/(?:const|let|var|val)?\s*(?:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\.stream\(\))?\.filter\s*[({]\s*([^)}]+)[)}]/);
  if (chainFilterM) {
    const hasSort = /\.sort/.test(trimmed);
    const hasSave = /writeFileSync|writeText|writeString|\.write\(/.test(trimmed);
    return {
      categoryEn: "Pipeline",
      iconKey: "spark",
      sentenceEn: `[Pipeline] Filter '${chainFilterM[2]}' (${chainFilterM[3].trim()})${hasSort ? ", sort" : ""}${hasSave ? ", save to file" : ""}.`
    };
  }
  if (/(?:\bwith\s+open|\bfopen)\s*\([^)]*["']w["']|\.(?:write|writelines|writeText|writeFileSync|writeString)\s*\(|\bfprintf\s*\(/.test(trimmed)) {
    return { categoryEn: "Save File", iconKey: "save", sentenceEn: "[Save File] Write results to output file." };
  }
  const fnM = trimmed.match(/^(?:async\s+)?(?:def|function|fun|func)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
  if (fnM) {
    const pText = fnM[2].trim();
    return {
      categoryEn: "Function",
      iconKey: "fn",
      sentenceEn: pText ? `[Function] Define '${fnM[1]}' taking (${pText}).` : `[Function] Define '${fnM[1]}'.`
    };
  }
  const ifM = trimmed.match(/^(?:else\s+if|elif|if|guard)\s*\(?\s*(.+?)\s*(?:\)\s*\{|\{\s*|:\s*)$/);
  if (ifM) {
    return { categoryEn: "Condition", iconKey: "condition", sentenceEn: `[Condition] Check if ${humanizeConditionExprEn(ifM[1].replace(/\s*else$/, "").trim())}.` };
  }
  if (/^(?:\}\s*)?else\s*[:{]?/.test(trimmed)) {
    return { categoryEn: "Else", iconKey: "condition", sentenceEn: "[Otherwise] Run when the previous condition is false." };
  }
  const rangeM = trimmed.match(/^for\s+\w+\s+in\s+range\s*\(\s*([^)]+)\)\s*:/) || trimmed.match(/^repeat\s*\(\s*([^)]+)\s*\)\s*\{/) || trimmed.match(/^for\s+\w+\s+in\s+0\.\.<\s*([^\s{]+)\s*\{/);
  if (rangeM) {
    return { categoryEn: "Repeat Loop", iconKey: "loop", sentenceEn: `[Repeat] Repeat the block ${rangeM[1].trim()} times.` };
  }
  const cForM = trimmed.match(/^for\s*\(\s*(?:let|var|int)?\s*\w+\s*=\s*\d+\s*;\s*\w+\s*<\s*([^;]+);/);
  if (cForM) {
    return { categoryEn: "Repeat Loop", iconKey: "loop", sentenceEn: `[Repeat] Repeat the block ${cForM[1].trim()} times.` };
  }
  const eachM = trimmed.match(/^for\s*\(?(?:(?:const|let|var)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+(?:in|of|:)\s+([A-Za-z_][A-Za-z0-9_.]*)\)?\s*[:{]?/);
  if (eachM) {
    return { categoryEn: "For-Each Loop", iconKey: "loop", sentenceEn: `[Loop] For each '${eachM[1]}' in '${eachM[2]}'.` };
  }
  const whileM = trimmed.match(/^while\s*\(?\s*(.+?)\s*\)?\s*[:{]/);
  if (whileM) {
    return { categoryEn: "While Loop", iconKey: "loop", sentenceEn: `[While] Keep looping while ${humanizeConditionExprEn(whileM[1])}.` };
  }
  const printM = trimmed.match(/^(?:console\.(?:log|warn|error)|System\.out\.println|println|printf|print)\s*\((.*)\)\s*;?$/);
  if (printM) {
    return { categoryEn: "Print", iconKey: "print", sentenceEn: `[Print] Display ${printM[1].trim() || "output"} on screen.` };
  }
  const retM = trimmed.match(/^return\b\s*(.*?);?$/);
  if (retM) {
    return { categoryEn: "Return", iconKey: "result", sentenceEn: `[Return] Send back ${retM[1] || "result"}.` };
  }
  const assignM = trimmed.match(/^(?:(?:const|let|var|val|int|double|float|String|boolean|bool|char\s*\*)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);?$/);
  if (assignM && !/^==/.test(assignM[2])) {
    return { categoryEn: "Assign", iconKey: "assign", sentenceEn: `[Assign] Store ${assignM[2].trim()} in '${assignM[1]}'.` };
  }
  return null;
}

function summarizeFullCodeToEnglish(rawCode, lang = currentLang) {
  const lines = String(rawCode || "").split(/\r?\n/);
  const summaries = [];
  for (let i = 0; i < lines.length; i++) {
    const info = summarizeCodeLineToEnglish(lines[i], lang);
    if (info) {
      summaries.push({
        lineNumber: i + 1,
        rawLine: lines[i].trim(),
        categoryEn: info.categoryEn,
        iconKey: info.iconKey || "note",
        sentenceEn: info.sentenceEn
      });
    }
  }
  return summaries;
}

function summarizeCodeLineToNatural(rawLine, lang = currentLang, mode = displayMode) {
  if (mode === "en") return summarizeCodeLineToEnglish(rawLine, lang);
  return summarizeCodeLineToKorean(rawLine, lang);
}

// ============================================================================
// Strict Offline POS Vocabulary DB Validation Engine
// ============================================================================

function splitCompoundIdentParts(token) {
  const camelSpaced = String(token || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return camelSpaced.split(/[_\s]+/).filter(Boolean);
}

function isRegisteredSingleEnglishSubword(w) {
  const lw = String(w || "").toLowerCase();
  if (!lw) return true;
  if (/^\d+$/.test(lw)) return true;
  if (EN_GRAMMAR_VALID_WORDS.has(lw)) return true;
  if (typeof SYNONYM_TO_OWNER_EN !== "undefined" && SYNONYM_TO_OWNER_EN.has(lw)) return true;
  if (typeof KO_SUBWORD_GLOSS !== "undefined" && KO_SUBWORD_GLOSS[lw]) return true;
  if (vocabLexicon.en && Object.prototype.hasOwnProperty.call(vocabLexicon.en, lw)) return true;
  if (dictPack && dictPack.entries && (Object.prototype.hasOwnProperty.call(dictPack.entries, w) || Object.prototype.hasOwnProperty.call(dictPack.entries, lw))) return true;
  if (dictPack && dictPack.maps && dictPack.maps.en_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.en_to_code, lw)) return true;
  if (lookupUserLearnedRecord(lw, currentLang)) return true;
  const stems = extractEnglishStems(lw);
  for (const st of stems) {
    if (EN_GRAMMAR_VALID_WORDS.has(st)) return true;
    if (typeof SYNONYM_TO_OWNER_EN !== "undefined" && SYNONYM_TO_OWNER_EN.has(st)) return true;
    if (vocabLexicon.en && Object.prototype.hasOwnProperty.call(vocabLexicon.en, st)) return true;
    if (lookupUserLearnedRecord(st, currentLang)) return true;
  }
  return false;
}

function isRegisteredDbWord(rawWord, mode = "ko") {
  const w = String(rawWord || "").trim();
  if (!w) return true;
  if (/^-?\d+(\.\d+)?$/.test(w)) return true;
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(w)) return true; // Incomplete IME composition Jamo

  // Check Korean characters
  if (/[가-힣]/.test(w)) {
    if (KO_GRAMMAR_VALID_WORDS.has(w) || KO_NOUN_TO_IDENT[w]) return true;
    if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(w)) return true;
    if (typeof REVERSE_KO_SUBWORD_GLOSS !== "undefined" && REVERSE_KO_SUBWORD_GLOSS.has(w)) return true;
    if (vocabLexicon.ko && Object.prototype.hasOwnProperty.call(vocabLexicon.ko, w)) return true;
    if (dictPack && dictPack.maps && dictPack.maps.ko_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.ko_to_code, w)) return true;
    if (lookupUserLearnedRecord(w, currentLang)) return true;

    const bare = stripTrailingKoParticle(w);
    if (bare && bare !== w) {
      if (/^-?\d+(\.\d+)?$/.test(bare)) return true;
      if (KO_GRAMMAR_VALID_WORDS.has(bare) || KO_NOUN_TO_IDENT[bare]) return true;
      if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(bare)) return true;
      if (typeof REVERSE_KO_SUBWORD_GLOSS !== "undefined" && REVERSE_KO_SUBWORD_GLOSS.has(bare)) return true;
      if (matchKoCompareToken(bare, true) || matchKoCompareToken(w, true)) return true;
    }

    const stems = extractKoreanStems(w);
    if (matchKoCompareToken(w, true)) return true;
    for (const st of stems) {
      if (KO_GRAMMAR_VALID_WORDS.has(st) || KO_NOUN_TO_IDENT[st]) return true;
      if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(st)) return true;
      if (vocabLexicon.ko && Object.prototype.hasOwnProperty.call(vocabLexicon.ko, st)) return true;
      if (dictPack && dictPack.maps && dictPack.maps.ko_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.ko_to_code, st)) return true;
      if (lookupUserLearnedRecord(st, currentLang)) return true;
    }

    // Also allow pure compound of 2+ registered Korean nouns (e.g. "최소점수")
    for (let splitAt = 2; splitAt <= w.length - 2; splitAt++) {
      const left = w.slice(0, splitAt);
      const right = stripTrailingKoParticle(w.slice(splitAt));
      if (
        (KO_NOUN_TO_IDENT[left] || (vocabLexicon.ko && vocabLexicon.ko[left])) &&
        (KO_NOUN_TO_IDENT[right] || KO_GRAMMAR_VALID_WORDS.has(right) || (vocabLexicon.ko && vocabLexicon.ko[right]))
      ) {
        return true;
      }
    }
    return false;
  }

  // ASCII identifier / English word
  if (isRegisteredSingleEnglishSubword(w)) return true;
  const parts = splitCompoundIdentParts(w);
  if (parts.length >= 2 && parts.every((p) => isRegisteredSingleEnglishSubword(p))) {
    return true;
  }
  return false;
}

function validateNaturalLineTokens(lineText, mode = "ko", rawKeptSet = null) {
  const trimmed = String(lineText || "").trim();
  if (!trimmed) return { ok: true, unknownWords: [], isComment: false, isRawKept: false };
  if (rawKeptSet && rawKeptSet.has(trimmed)) {
    return { ok: true, unknownWords: [], isComment: false, isRawKept: true };
  }
  if (/^(?:#|\/\/|주석\s|메모\s|note\b|comment\b)/i.test(trimmed)) {
    return { ok: true, unknownWords: [], isComment: true, isRawKept: false };
  }
  // If lexicon has not loaded yet, do not falsely reject valid words
  const targetLex = mode === "en" ? vocabLexicon.en : vocabLexicon.ko;
  if (!targetLex) return { ok: true, unknownWords: [], isComment: false, isRawKept: false };

  const protectedIntervals = getProtectedIntervalsForLine(lineText, currentLang);
  const tokenRe = /[가-힣]+|[A-Za-z_][A-Za-z0-9_]*/g;
  const unknownWords = [];
  let m;
  while ((m = tokenRe.exec(lineText)) !== null) {
    const word = m[0];
    const startIdx = m.index;
    const endIdx = startIdx + word.length;
    if (isOffsetInsideIntervals(startIdx, protectedIntervals)) continue;
    if (!isRegisteredDbWord(word, mode)) {
      unknownWords.push({
        word,
        startCol: startIdx + 1,
        endCol: endIdx + 1
      });
    }
  }
  return {
    ok: unknownWords.length === 0,
    unknownWords,
    isComment: false,
    isRawKept: false
  };
}

// ============================================================================
// Dual-Buffer Engine: Raw Code <-> Symbol-Free Natural Text
// ============================================================================

// Strictly disjoint subword gloss dictionary (1 key <-> 1 unique natural word, null prototype)
const KO_SUBWORD_GLOSS = Object.assign(Object.create(null), {
  client: "클라이언트", owner: "소유자", path: "경로", paths: "경로목록",
  has: "보유확인", get: "값꺼내기", delete: "삭제", del: "지움",
  dispose: "해제정리", prune: "가지치기",
  listener: "수신기", listeners: "수신기목록", custom: "사용자맞춤", ctx: "작업문맥",
  context: "실행환경", new: "새로생성", old: "예전값", prev: "직전값", next: "다음값", cur: "이번값",
  current: "현재상태", hot: "즉시반영", accept: "수락", update: "갱신", updated: "갱신됨",
  err: "에러값", error: "오류정보", errors: "오류목록", mod: "기능모듈", module: "모듈파일",
  modules: "모듈모음", export: "밖으로내보내기",
  constructor: "생성틀", this: "현재객체", self: "자기자신", window: "브라우저창", doc: "문서참조",
  document: "웹문서", el: "화면요소", elem: "노드원소", element: "태그요소", elements: "요소모음",
  style: "꾸미기스타일", styles: "스타일모음", color: "색상", width: "가로너비", height: "세로높이",
  canvas: "그림판캔버스", chart: "그래프차트", instance: "실체객체",
  stock: "주식종목", stocks: "종목목록", val_arg: "인자값",
  idx: "순서번호", index: "색인위치", arr: "칸배열", array: "배열",
  label: "이름표라벨", type: "자료유형", key: "검색키", keys: "키목록",
  event: "사건이벤트", ev: "발생이벤트", callback: "뒤이어실행함수", cb: "콜백함수", fn: "단위기능", func_ref: "실행함수",
  handler: "이벤트처리기", state: "화면상태", config: "환경설정", opts: "세부옵션", options: "선택옵션",
  res: "처리결과", req: "네트워크요청", response: "서버응답", resp: "응답패킷",
  msg: "전달문구", html: "웹뼈대HTML", dom: "화면트리DOM",
  node: "트리노드", child: "자식요소", children: "자식목록", parent: "상위부모", render: "화면그리기",
  draw: "도형그리기", init: "초기준비", load: "읽어불러오기", save: "보관저장",
  json: "제이슨자료",
  find: "위치찾기", contains: "포함여부검사",
  slice: "부분자르기",
  query: "조건조회", selector: "CSS선택자", create: "만들어내기", click: "마우스클릭",
  change: "값바뀜", submit: "양식제출", btn: "작은버튼", button: "누름버튼",
  div: "화면구획", span: "인라인영역", script: "실행스크립트", href: "이동링크", src: "원본소스",
  target: "목표대상", id: "고유아이디", deps: "필요도구", url: "웹주소URL", ws: "웹소켓",
  send: "메시지전송", queue: "작업대기열", timer: "초시계타이머",
  now: "지금시각",
  line: "한줄", lines: "여러줄", row: "가로행", rows: "행목록", col: "세로열", cols: "열목록",
  body: "본문영역", head: "머리영역", header: "상단헤더", footer: "하단바닥글", modal: "안내팝업창",
  table: "격자표", tbody: "표본문", tr: "표한줄", td: "표한칸", th: "표머리칸",
  form: "입력양식", search: "단어검색", info: "참고정보", warn: "주의알림", log: "실행기록",
  parse: "구문해석", stringify: "문자열포장", check: "상태점검", valid: "올바름확인",
  start: "시작지점", end: "끝지점", stop: "멈춤", reset: "초기복원", empty: "비어있는상태",
  first: "첫번째항목", last: "마지막항목", flag: "상태깃발", active: "작동중", enabled: "켜짐",
  disabled: "꺼짐", visible: "화면에보임", hidden: "화면숨김", ok: "정상완료", fail: "실패상태",
  format: "출력서식", to: "대상방향", from: "출발원본", wait: "기다림", retry: "다시시도",
  promise: "비동기약속", resolve: "약속성공", reject: "약속거절", then: "성공다음단계",
  throw: "오류던지기", typeof: "자료종류확인", instanceof: "틀소속확인",
  void: "결과없음형", static: "공통정적", public: "전체공개", private: "내부전용", protected: "자식허용",
  extends: "기능물려받기", implements: "규칙구현", super: "상위설계도", import_meta: "모듈위치정보",
  portfolio: "포트폴리오", candle: "봉차트", candles: "봉차트목록", volume: "거래량", ticker: "종목코드",
  buy: "매수", sell: "매도", profit: "수익금", loss: "손실금", yield_rate: "수익률",
  moving: "이동선", signal: "매매신호", indicator: "보조지표", rsi: "상대강도지수", macd: "추세지표",
  ema: "지수평균", sma: "단순평균", tax: "세금", fee: "수수료", balance: "잔고",
  cash: "보유현금", asset: "자산", assets: "자산목록", trade: "거래내역", order: "주문요청",
  panel: "조작패널", tab: "문서탭", editor: "편집기", preview: "미리보기", status: "상태",
  level: "단계레벨", hp: "체력", atk: "공격력", speed: "속도", goal: "목표", rank: "등급",
  avg: "평균값", average: "평균수치", standing: "순위"
});

const REVERSE_KO_SUBWORD_GLOSS = new Map();
for (const [k, v] of Object.entries(KO_SUBWORD_GLOSS)) {
  if (v && !REVERSE_KO_SUBWORD_GLOSS.has(v)) {
    REVERSE_KO_SUBWORD_GLOSS.set(v, k);
  }
}

function buildCodeIdentToNaturalMap(mode) {
  const m = mode === "en" ? "en" : "ko";
  if (codeIdentToNatCache[m]) return codeIdentToNatCache[m];
  const map = new Map();

  // Strictly canonical mappings ONLY — zero reverse-scanning of raw vocabLexicon
  const canonSrc = m === "en" ? CANONICAL_EN_BY_CODE : CANONICAL_KO_BY_CODE;
  for (const [codeTok, natWord] of canonSrc.entries()) {
    if (natWord && /^[A-Za-z_][A-Za-z0-9_]*$/.test(codeTok)) {
      const ck = codeTok.toLowerCase();
      if (!map.has(ck)) map.set(ck, natWord);
    }
  }
  const dictMap = dictPack && dictPack.maps && (m === "en" ? dictPack.maps.code_to_en : dictPack.maps.code_to_ko);
  if (dictMap) {
    for (const [codeTok, natWord] of Object.entries(dictMap)) {
      if (natWord && /^[A-Za-z_][A-Za-z0-9_]*$/.test(codeTok)) {
        const ck = codeTok.toLowerCase();
        if (!map.has(ck)) map.set(ck, natWord);
      }
    }
  }
  if (m === "ko") {
    for (const [engIdent, koNoun] of Object.entries(IDENT_TO_KO_NOUN)) {
      const ck = engIdent.toLowerCase();
      if (koNoun && !map.has(ck)) map.set(ck, koNoun);
    }
  }

  codeIdentToNatCache[m] = map;
  return map;
}

function isSimpleDecompileOperand(expr) {
  const t = String(expr || "").trim();
  if (!t) return true;
  return /^(?:[A-Za-z_$][\w$.]*|-?\d+(?:\.\d+)?|"[^"\\]*"|'[^'\\]*')$/.test(t);
}

function toNaturalVarLabel(rawVar, mode) {
  const v = String(rawVar || "").trim();
  if (!v) return "";
  if (mode === "ko") {
    if (IDENT_TO_KO_NOUN[v]) return IDENT_TO_KO_NOUN[v];
    const lower = v.toLowerCase();
    if (KO_SUBWORD_GLOSS[lower]) return KO_SUBWORD_GLOSS[lower];
    const natMap = buildCodeIdentToNaturalMap("ko");
    if (natMap.has(lower)) return natMap.get(lower);
    const parts = splitCompoundIdentParts(v);
    if (parts.length > 1) {
      return parts.map((p) => {
        const pl = p.toLowerCase();
        if (IDENT_TO_KO_NOUN[p]) return IDENT_TO_KO_NOUN[p];
        if (KO_SUBWORD_GLOSS[pl]) return KO_SUBWORD_GLOSS[pl];
        if (natMap.has(pl)) return natMap.get(pl);
        return /^[A-Z]+$/.test(p) || p.length <= 3 ? p.toUpperCase() : p;
      }).join(" ");
    }
  }
  return v;
}

function stripSyntaxNoiseForNatural(str) {
  return String(str || "")
    .replace(/[`"'<>]/g, " ")
    .replace(/[{}\[\]()]/g, " ")
    .replace(/[;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function naturalizeCodeExprToPhrase(exprRaw, mode = "ko") {
  let s = String(exprRaw || "").trim();
  if (!s) return "";
  const isEn = mode === "en";

  // Unwrap template interpolations `${x}` into readable space-separated expressions
  s = s.replace(/\$\{([^}]+)\}/g, (_, inner) => " " + naturalizeCodeExprToPhrase(inner, mode) + " ");

  // Handle PowerShell / Shell env vars & `$var`
  s = s.replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, (_, k) =>
    isEn ? ` env ${k} ` : ` 환경변수 ${k} `
  );
  s = s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, v) =>
    isEn ? ` ${splitCompoundIdentParts(v).join(" ")} ` : ` ${toNaturalVarLabel(v, "ko")} `
  );

  // Handle DOCTYPE and HTML/XML tag chunks cleanly without leaving `<` or `>`
  s = s.replace(/<!DOCTYPE\s+([^>]+)>/gi, (_, docType) =>
    isEn ? ` doctype ${stripSyntaxNoiseForNatural(docType)} ` : ` 문서선언 ${stripSyntaxNoiseForNatural(docType)} `
  );
  s = s.replace(/<\/([A-Za-z][A-Za-z0-9-]*)\s*>/g, (_, tag) =>
    isEn ? ` end ${tag} ` : ` ${KO_SUBWORD_GLOSS[tag.toLowerCase()] || tag} 닫기 `
  );
  s = s.replace(/<([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g, (_, tag, attrs) => {
    const cleanTag = isEn ? tag : (KO_SUBWORD_GLOSS[tag.toLowerCase()] || tag);
    const cleanAttrs = stripSyntaxNoiseForNatural(attrs).replace(/=/g, " ");
    return ` ${cleanTag} ${cleanAttrs} `;
  });

  // Protect URL protocols before replacing `:` and `/`
  s = s.replace(/https?:\/\/([A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+)/gi, (_, rest) =>
    (isEn ? " url " : " 웹주소 ") + rest.replace(/[:/?=&]/g, " ")
  );

  // Replace multi-char JS/code operators with readable natural connectors
  const hadTernary = /\?[^?]/.test(s);
  s = s
    .replace(/=>/g, isEn ? " maps to " : " 화살표실행 ")
    .replace(/\?\?/g, isEn ? " or default " : " 없으면대신 ")
    .replace(/===/g, isEn ? " equals " : " 같음 ")
    .replace(/==/g, isEn ? " equals " : " 같음 ")
    .replace(/!==/g, isEn ? " is not " : " 다름 ")
    .replace(/!=/g, isEn ? " is not " : " 다름 ")
    .replace(/>=/g, isEn ? " at least " : " 이상 ")
    .replace(/<=/g, isEn ? " at most " : " 이하 ")
    .replace(/&&/g, isEn ? " and " : " 그리고 ")
    .replace(/\|\|/g, isEn ? " or " : " 또는 ")
    .replace(/\+\+/g, isEn ? " increment " : " 1증가 ")
    .replace(/--/g, isEn ? " decrement " : " 1감소 ")
    .replace(/\?\./g, " ")
    .replace(/\.\.\./g, isEn ? " spread " : " 펼치기 ")
    .replace(/!(?!=)/g, isEn ? " not " : " 아닌 ")
    .replace(/\s*\?\s*/g, isEn ? " if true " : " 참이면 ")
    .replace(/\s*:\s*/g, hadTernary ? (isEn ? " else " : " 아니면 ") : " ")
    .replace(/[`"'{}()\[\];,|\\]/g, " ")
    .replace(/(?<![0-9])\.(?![0-9])/g, " ");

  const tokens = s.split(/\s+/).filter(Boolean);
  const out = [];
  for (let tok of tokens) {
    // Strip remaining operator/punctuation noise except standalone math operators
    tok = tok.replace(/^[<>:]+|[<>:;]+$/g, "");
    if (!tok) continue;
    if (tok === "=") { out.push(isEn ? "to" : "값은"); continue; }
    if (tok === "+") { out.push(isEn ? "plus" : "더하기"); continue; }
    if (tok === "-") { out.push(isEn ? "minus" : "빼기"); continue; }
    if (tok === "*") { out.push(isEn ? "times" : "곱하기"); continue; }
    if (tok === "/") { out.push(isEn ? "divided by" : "나누기"); continue; }
    if (tok === "%") { out.push(isEn ? "mod" : "나머지"); continue; }
    if (tok === ">") { out.push(isEn ? "greater than" : "초과"); continue; }
    if (tok === "<") { out.push(isEn ? "less than" : "미만"); continue; }
    if (/^(?:True|true)$/.test(tok)) { out.push(isEn ? "true" : "참"); continue; }
    if (/^(?:False|false)$/.test(tok)) { out.push(isEn ? "false" : "거짓"); continue; }
    if (/^(?:None|null|nil|undefined)$/.test(tok)) { out.push(isEn ? "none" : "없음"); continue; }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
      out.push(isEn ? splitCompoundIdentParts(tok).join(" ") : toNaturalVarLabel(tok, "ko"));
      continue;
    }
    out.push(tok);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function splitTopLevelLogicalExpr(exprRaw) {
  const s = String(exprRaw || "").trim();
  let depth = 0;
  let quote = "";
  for (const sep of ["||", " or ", "&&", " and "]) {
    depth = 0;
    quote = "";
    for (let i = 0; i <= s.length - sep.length; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === quote && s[i - 1] !== "\\") quote = "";
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if (ch === "(" || ch === "[" || ch === "{") { depth++; continue; }
      if (ch === ")" || ch === "]" || ch === "}") { depth--; continue; }
      if (depth === 0 && s.slice(i, i + sep.length) === sep) {
        return {
          left: s.slice(0, i).trim(),
          right: s.slice(i + sep.length).trim(),
          isOr: sep === "||" || sep === " or "
        };
      }
    }
  }
  return null;
}

function decompileConditionExprToNatural(exprRaw, mode) {
  const s = String(exprRaw || "").trim();
  if (!s) return null;
  const logical = splitTopLevelLogicalExpr(s);
  if (logical && logical.left && logical.right) {
    const lNat = decompileConditionExprToNatural(logical.left, mode) || naturalizeCodeExprToPhrase(logical.left, mode);
    const rNat = decompileConditionExprToNatural(logical.right, mode) || naturalizeCodeExprToPhrase(logical.right, mode);
    if (lNat && rNat) {
      const joinWord = mode === "en" ? (logical.isOr ? " or " : " and ") : (logical.isOr ? " 또는 " : " 그리고 ");
      return `${lNat}${joinWord}${rNat}`;
    }
  }
  const incM = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(?:includes|contains)\((.+)\)$/);
  if (incM && !/[()]/.test(incM[2])) {
    const target = toNaturalVarLabel(incM[1], mode);
    const needle = incM[2].trim().replace(/^["']|["']$/g, "");
    return mode === "en" ? `${target} contains ${needle}` : `${target}에 ${needle} 포함`;
  }
  const inM = s.match(/^(.+?)\s+in\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (inM && !/[()&|]/.test(inM[1])) {
    const needle = inM[1].trim().replace(/^["']|["']$/g, "");
    const target = toNaturalVarLabel(inM[2], mode);
    return mode === "en" ? `${target} contains ${needle}` : `${target}에 ${needle} 포함`;
  }
  const cmp = s.match(/^(.+?)\s*(>=|<=|>|<|===|==|!==|!=)\s*(.+)$/);
  if (cmp && !/[()&|{}]/.test(cmp[1]) && !/[()&|{}]/.test(cmp[3])) {
    const lhs = toNaturalVarLabel(cmp[1].trim(), mode);
    const op = cmp[2];
    const rhsRaw = cmp[3].trim();
    const rhs = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rhsRaw) ? toNaturalVarLabel(rhsRaw, mode) : stripSyntaxNoiseForNatural(rhsRaw);
    if (mode === "en") {
      const opEn =
        op === ">=" ? "is at least" :
        op === "<=" ? "is at most" :
        op === ">" ? "is greater than" :
        op === "<" ? "is less than" :
        (op === "==" || op === "===") ? "equals" : "is not";
      return `${lhs} ${opEn} ${rhs}`;
    }
    const opKo =
      op === ">=" ? "이상" :
      op === "<=" ? "이하" :
      op === ">" ? "초과" :
      op === "<" ? "미만" :
      (op === "==" || op === "===") ? "같으면" : "다르면";
    return `${attachKoSubjectParticle(lhs)} ${rhs} ${opKo}`;
  }
  return null;
}

function decompileLiteralToNatural(exprRaw, mode) {
  const t = String(exprRaw || "").trim();
  if (/^(?:True|true)$/.test(t)) return mode === "en" ? "true" : "참";
  if (/^(?:False|false)$/.test(t)) return mode === "en" ? "false" : "거짓";
  if (/^(?:None|null|nil|undefined)$/.test(t)) return mode === "en" ? "none" : "없음";
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  const qM = t.match(/^(["'])(.*)\1$/);
  if (qM) {
    const inner = qM[2];
    if (/^[A-Za-z가-힣0-9_]+$/.test(inner)) {
      return inner;
    }
    return stripSyntaxNoiseForNatural(inner) || inner;
  }
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
    return toNaturalVarLabel(t, mode);
  }
  return null;
}

function stripSimpleTsAnnotations(line) {
  let s = String(line || "");
  if (/^(?:interface|type)\s+[A-Za-z_$]/.test(s)) return s;
  // Strip ": <Type>" from const/let/var declarations before "="
  s = s.replace(
    /^((?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$.<>\[\]\s|&?,{}]*(?:\[\])*\s*=/,
    "$1 ="
  );
  // Strip parameter & return types from TS function declarations
  if (/^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+/.test(s)) {
    s = s.replace(
      /^((?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*[A-Za-z_$][\w$.<>\[\]\s|&?,{}]*(?:\[\])*)?\s*(\{?)$/,
      (_, head, params, brace) => {
        const cleanParams = params
          .split(",")
          .map((p) => p.trim().replace(/\s*\??\s*:\s*[^=]+(?==|$)/, "").trim())
          .filter(Boolean)
          .join(", ");
        return `${head}(${cleanParams}) ${brace}`.trim();
      }
    );
  }
  return s;
}

function decompileCodeLineToNatural(rawLine, lang, mode) {
  const indentMatch = String(rawLine || "").match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "";
  const rawTrimmed = String(rawLine || "").trim();
  const trimmed = String(lang || "").toLowerCase() === "typescript"
    ? stripSimpleTsAnnotations(rawTrimmed)
    : rawTrimmed;

  if (!trimmed) return { text: "", isRawKept: false, opensBrace: false };

  // Standalone closing delimiters: preserve 1:1 line slot with indent only (no {}, [], (), ;)
  if (/^[}\])]+[,;]?$/.test(trimmed)) {
    return { text: indent, isRawKept: false, isCloserOnly: true, opensBrace: false };
  }

  // Comments & block comment boundaries (strip raw code delimiters)
  if (/^(?:\/\*|\*\/|\*)\s*$/.test(trimmed)) {
    return { text: indent + (mode === "en" ? "note divider" : "주석 구분선"), isRawKept: false, opensBrace: false };
  }
  if (/^(?:#include\b|#define\b)/.test(trimmed)) {
    const incClean = naturalizeCodeExprToPhrase(trimmed.replace(/^#(?:include|define)\s*/, ""), mode);
    return {
      text: indent + (mode === "en" ? `include header ${incClean}` : `헤더 ${incClean} 포함`),
      isRawKept: false,
      opensBrace: false
    };
  }
  // Unwrap any legacy saved `# [Natural: ...]` or `// [Natural: ...]` placeholder directly
  const legacyNatM = trimmed.match(/^(?:#|\/\/+)\s*\[Natural:\s*(.+?)\]\s*$/i);
  if (legacyNatM) {
    return {
      text: indent + legacyNatM[1].trim(),
      isRawKept: false,
      opensBrace: false
    };
  }
  const cmtBodyM = trimmed.match(/^(?:#|\/\/+|\/\*+|\*|<!--)\s*(.*?)(?:\*\/|-->)?$/);
  if (cmtBodyM) {
    const cleanedCmt = stripSyntaxNoiseForNatural(cmtBodyM[1]);
    return {
      text: indent + (mode === "en" ? `note ${cleanedCmt || "line"}` : `주석 ${cleanedCmt || "설명"}`),
      isRawKept: false,
      opensBrace: false
    };
  }

  const opensBrace = /[{(\[]\s*$/.test(trimmed) && !/^(?:#|\/\/)/.test(trimmed);

  // Import / Export statements
  const impNamedM = trimmed.match(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?$/);
  if (impNamedM) {
    const names = impNamedM[1].split(",").map((s) => toNaturalVarLabel(s.trim().replace(/\s+as\s+/, " "), mode)).filter(Boolean).join(" ");
    const mod = stripSyntaxNoiseForNatural(impNamedM[2]);
    return {
      text: indent + (mode === "en" ? `import ${names} from ${mod}` : `${mod}에서 ${names} 가져오기`),
      isRawKept: false,
      opensBrace: false
    };
  }
  const impSimpleM = trimmed.match(/^import\s+(?:([A-Za-z0-9_*,\s]+)\s+from\s+)?["']?([^"';]+)["']?;?$/);
  if (impSimpleM) {
    const mod = stripSyntaxNoiseForNatural(impSimpleM[2]);
    const spec = impSimpleM[1] ? stripSyntaxNoiseForNatural(impSimpleM[1]) + " " : "";
    return {
      text: indent + (mode === "en" ? `import ${spec}${mod}` : `${mod} 모듈 ${spec}불러오기`.trim()),
      isRawKept: false,
      opensBrace: false
    };
  }
  const pyFromImpM = trimmed.match(/^from\s+([^\s]+)\s+import\s+(.+)$/);
  if (pyFromImpM) {
    const mod = stripSyntaxNoiseForNatural(pyFromImpM[1]);
    const names = stripSyntaxNoiseForNatural(pyFromImpM[2]);
    return {
      text: indent + (mode === "en" ? `from ${mod} import ${names}` : `${mod}에서 ${names} 가져오기`),
      isRawKept: false,
      opensBrace: false
    };
  }

  // Handle "} else {" or "} else if (...) {" cleanly
  const cleanElseStart = trimmed.replace(/^\}\s*/, "");

  // Class / Interface / Struct headers
  const clsM = cleanElseStart.match(/^(?:export\s+(?:default\s+)?)?(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?(?:class|interface|struct)\s+([A-Za-z_][A-Za-z0-9_]*)(.*)$/);
  if (clsM) {
    const restNat = naturalizeCodeExprToPhrase(clsM[2], mode);
    return {
      text: indent + (mode === "en" ? `define class ${clsM[1]} ${restNat}`.trim() : `클래스 ${clsM[1]} ${restNat} 정의`.trim()),
      isRawKept: false,
      opensBrace
    };
  }

  // Constructor header
  const ctorM = cleanElseStart.match(/^constructor\s*\(([^)]*)\)\s*\{?$/);
  if (ctorM) {
    const params = ctorM[1].split(",").map((p) => toNaturalVarLabel(p.trim(), mode)).filter(Boolean);
    return {
      text: indent + (mode === "en"
        ? (params.length ? `constructor with ${params.join(" ")}` : "constructor")
        : (params.length ? `생성자 재료 ${params.join(" ")}` : "생성자 시작")),
      isRawKept: false,
      opensBrace: true
    };
  }

  // 1. Simple untyped function definition (Python / JS / simple Kotlin/Swift)
  const fnM = cleanElseStart.match(/^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:def|function|fun|func)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*[:{]\s*$/);
  if (fnM && !/[:=]/.test(fnM[2])) {
    const fnName = fnM[1];
    const params = fnM[2].split(",").map((p) => p.trim()).filter(Boolean);
    if (mode === "en") {
      return {
        text: indent + (params.length ? `define function ${fnName} with ${params.join(" ")}` : `define function ${fnName}`),
        isRawKept: false,
        opensBrace
      };
    }
    return {
      text: indent + (params.length ? `기능 ${fnName} 재료 ${params.join(" ")}` : `기능 ${fnName}`),
      isRawKept: false,
      opensBrace
    };
  }

  // Typed / class method header e.g. `static void main(...) {`, `async send(payload) {`, `dispose(cb) {`
  const methodHdrM = cleanElseStart.match(/^(?:public\s+|private\s+|protected\s+|static\s+|async\s+|override\s+|void\s+|int\s+|fun\s+|func\s+)*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*[A-Za-z_<>?\[\]]+\s*)?[:{]\s*$/);
  if (methodHdrM && !/^(?:if|for|while|switch|catch|else)$/.test(methodHdrM[1])) {
    const mName = toNaturalVarLabel(methodHdrM[1], mode);
    const pNat = naturalizeCodeExprToPhrase(methodHdrM[2], mode);
    return {
      text: indent + (mode === "en" ? `method ${mName}${pNat ? " with " + pNat : ""}` : `메서드 ${mName}${pNat ? " 재료 " + pNat : ""}`),
      isRawKept: false,
      opensBrace: true
    };
  }

  // 2. Else / Catch / Finally / Try
  if (/^else\s*[:{]\s*$/.test(cleanElseStart)) {
    return { text: indent + (mode === "en" ? "otherwise" : "아니면"), isRawKept: false, opensBrace };
  }
  if (/^try\s*[:{]\s*$/.test(cleanElseStart)) {
    return { text: indent + (mode === "en" ? "try block" : "예외 시도 시작"), isRawKept: false, opensBrace };
  }
  const catchM = cleanElseStart.match(/^(?:catch|except)\s*\(?([^:{)]*)\)?\s*[:{]\s*$/);
  if (catchM) {
    const errNat = naturalizeCodeExprToPhrase(catchM[1], mode);
    return {
      text: indent + (mode === "en" ? `on error ${errNat}`.trim() : `오류 발생시 ${errNat}`.trim()),
      isRawKept: false,
      opensBrace
    };
  }

  // 3. Elif / Else If / If block header
  const ifM = cleanElseStart.match(/^(else\s+if|elif|if)\s*\(?\s*(.+?)\s*(?:\)\s*\{|\{\s*|:\s*)$/);
  if (ifM) {
    const isElif = /^elif|^else\s+if/i.test(ifM[1]);
    const condNat = decompileConditionExprToNatural(ifM[2], mode);
    if (condNat) {
      if (mode === "en") {
        return { text: indent + `${isElif ? "else if" : "if"} ${condNat}`, isRawKept: false, opensBrace };
      }
      const koSuffix = /(?:같으면|다르면)$/.test(condNat) ? "" : "이면";
      return { text: indent + `${isElif ? "아니고 만약" : "만약"} ${condNat}${koSuffix}`, isRawKept: false, opensBrace };
    }
    const complexCond = naturalizeCodeExprToPhrase(ifM[2], mode);
    return {
      text: indent + (mode === "en"
        ? `${isElif ? "else if" : "if"} ${complexCond}`
        : `${isElif ? "아니고 만약" : "만약"} ${complexCond}이면`),
      isRawKept: false,
      opensBrace
    };
  }

  // 4. Loops (exact 4-pattern + general real-world loops)
  const rangeM =
    cleanElseStart.match(/^for\s+\w+\s+in\s+range\s*\(\s*(\d+)\s*\)\s*:$/) ||
    cleanElseStart.match(/^repeat\s*\(\s*(\d+)\s*\)\s*\{$/) ||
    cleanElseStart.match(/^for\s+\w+\s+in\s+0\.\.<\s*(\d+)\s*\{$/) ||
    cleanElseStart.match(/^for\s*\(\s*(?:let|var|int)\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\d+)\s*;\s*\w+\+\+\s*\)\s*\{$/);
  if (rangeM) {
    return {
      text: indent + (mode === "en" ? `repeat ${rangeM[1]} times` : `${rangeM[1]}번 반복`),
      isRawKept: false,
      opensBrace
    };
  }
  const eachM = cleanElseStart.match(/^for\s*\(?(?:(?:const|let|var)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+(?:in|of|:)\s+([A-Za-z_][A-Za-z0-9_]*)\)?\s*[:{]$/);
  if (eachM) {
    const listNat = toNaturalVarLabel(eachM[2], mode);
    return {
      text: indent + (mode === "en" ? `for each ${eachM[1]} in ${listNat}` : `${listNat}에서 하나씩`),
      isRawKept: false,
      opensBrace
    };
  }
  const genForM = cleanElseStart.match(/^(for|while)\s*\(?(.*?)\)?\s*[:{]\s*$/);
  if (genForM) {
    const isWhile = genForM[1].toLowerCase() === "while";
    const condNat = isWhile ? decompileConditionExprToNatural(genForM[2], mode) : null;
    if (isWhile && condNat && mode !== "en") {
      const koSuffix = /(?:같으면|다르면)$/.test(condNat) ? "" : "이면";
      return {
        text: indent + `${condNat}${koSuffix} 동안`,
        isRawKept: false,
        opensBrace
      };
    }
    if (isWhile && condNat && mode === "en") {
      return {
        text: indent + `while ${condNat}`,
        isRawKept: false,
        opensBrace
      };
    }
    const loopExprNat = naturalizeCodeExprToPhrase(genForM[2], mode);
    return {
      text: indent + (mode === "en"
        ? `${isWhile ? "while" : "loop"} ${loopExprNat}`
        : `${isWhile ? "조건동안 반복" : "반복"} ${loopExprNat}`),
      isRawKept: false,
      opensBrace
    };
  }

  // 5. Print statement — keep print vs console.log (and siblings) distinct
  const printM = cleanElseStart.match(/^(console\.(?:log|warn|error)|System\.out\.println|println|printf|print)\s*\((.*)\)\s*;?$/);
  if (printM) {
    const opCode = printM[1];
    let innerArg = (printM[2] || "").trim();
    if (opCode === "printf" && innerArg) {
      const fmtValM = innerArg.match(/^"(?:\\.|[^"])*"\s*,\s*(.+)$/);
      if (fmtValM) {
        innerArg = fmtValM[1].trim();
      } else {
        const fmtOnlyM = innerArg.match(/^"((?:\\.|[^"])*)"$/);
        if (fmtOnlyM) {
          innerArg = `"${fmtOnlyM[1].replace(/\\n$/, "")}"`;
        }
      }
    }
    const verb = naturalPrintVerb(opCode, mode);
    if (!innerArg) {
      return { text: indent + verb, isRawKept: false, opensBrace };
    }
    const simplePrintArg = !/[()[\]{}]/.test(innerArg) && !/(?:&&|\|\||=>|[<>]=?|===?|!==?)/.test(innerArg);
    if (simplePrintArg) {
      const litNat = decompileLiteralToNatural(innerArg, mode);
      if (litNat !== null) {
        return {
          text: indent + (mode === "en" ? `${verb} ${litNat}` : `${attachKoObjectParticle(litNat)} ${verb}`),
          isRawKept: false,
          opensBrace
        };
      }
    }
    const complexPrint = naturalizeCodeExprToPhrase(innerArg, mode);
    return {
      text: indent + (mode === "en" ? `${verb} ${complexPrint}` : `${complexPrint} ${verb}`),
      isRawKept: false,
      opensBrace
    };
  }

  // 6. Return statement
  const retM = cleanElseStart.match(/^return\b(?:\s+(.+?))?;?$/);
  if (retM) {
    const retVal = (retM[1] || "").trim();
    if (!retVal) {
      return { text: indent + (mode === "en" ? "return" : "반환 종료"), isRawKept: false, opensBrace: false };
    }
    if (!/[()]/.test(retVal)) {
      const litNat = decompileLiteralToNatural(retVal, mode);
      if (litNat !== null) {
        return {
          text: indent + (mode === "en" ? `return ${litNat}` : `${attachKoObjectParticle(litNat)} 반환`),
          isRawKept: false,
          opensBrace
        };
      }
    }
    const retNat = naturalizeCodeExprToPhrase(retVal, mode);
    return {
      text: indent + (mode === "en" ? `return ${retNat}` : `${retNat} 반환`),
      isRawKept: false,
      opensBrace
    };
  }

  // 7. Variable / Constant Assignment (simple 4-pattern exact + property/complex fallback)
  const assignM = cleanElseStart.match(/^(?:(const|let|var|val|int|double|float|String|boolean|bool)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);?$/);
  if (assignM && !/^=/.test(assignM[3]) && !/[(){\[]/.test(assignM[3])) {
    const isConst = assignM[1] === "const" || assignM[1] === "val";
    const varNat = toNaturalVarLabel(assignM[2], mode);
    const valNat = decompileLiteralToNatural(assignM[3], mode);
    if (valNat !== null) {
      if (mode === "en") {
        return {
          text: indent + (isConst ? `set constant ${varNat} to ${valNat}` : `put ${valNat} into ${varNat}`),
          isRawKept: false,
          opensBrace: false
        };
      }
      return {
        text: indent + `${isConst ? "고정값 " : ""}${varNat}에 ${attachKoObjectParticle(valNat)} 넣기`,
        isRawKept: false,
        opensBrace: false
      };
    }
  }

  const propAssignM = !/^\s*</.test(cleanElseStart)
    ? cleanElseStart.match(/^(?:(?:const|let|var|val)\s+)?(.+?)\s*=\s*(.+?);?$/)
    : null;
  if (propAssignM && !/^[=<>]/.test(propAssignM[2]) && !/[=<>!]$/.test(propAssignM[1])) {
    const lhsNat = naturalizeCodeExprToPhrase(propAssignM[1], mode);
    const rhsNat = naturalizeCodeExprToPhrase(propAssignM[2], mode);
    if (lhsNat) {
      return {
        text: indent + (mode === "en" ? `set ${lhsNat} to ${rhsNat}`.trim() : `${lhsNat}에 ${rhsNat} 담기`.trim()),
        isRawKept: false,
        opensBrace
      };
    }
  }

  // Tier 2 Universal Method Call & Catch-All Phrase Synthesizer (symbol-free!)
  const callM = cleanElseStart.match(/^([A-Za-z_$][A-Za-z0-9_$.]*)\.(set|get|has|delete|push|append|add|remove|insert|split|join|includes|count|addEventListener)\((.*)\);?$/);
  if (callM) {
    const objNat = naturalizeCodeExprToPhrase(callM[1], mode);
    const methodName = callM[2];
    const argsRaw = callM[3] || "";
    const argsNat = naturalizeCodeExprToPhrase(argsRaw, mode);
    if (mode === "en") {
      const verb = methodName === "set" ? "set in" : methodName === "delete" ? "delete from" : methodName;
      return { text: indent + `${verb} ${objNat} ${argsNat}`.trim(), isRawKept: false, opensBrace };
    }
    const argLit = isSimpleDecompileOperand(argsRaw.trim()) ? decompileLiteralToNatural(argsRaw.trim(), mode) : null;
    const argWord = argLit !== null ? argLit : argsNat;
    const argObj = argWord ? attachKoObjectParticle(argWord) : "";
    if (methodName === "append") return { text: indent + `${objNat}에 ${argObj} 끝에추가`.trim(), isRawKept: false, opensBrace };
    if (methodName === "push") return { text: indent + `${objNat}에 ${argObj} 밀어넣기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "add") return { text: indent + `${objNat}에 ${argObj} 더해넣기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "remove") return { text: indent + `${objNat}에서 ${argObj} 지우기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "count") return { text: indent + `${objNat}에서 ${argObj} 개수세기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "includes" || methodName === "has") return { text: indent + `${objNat}에 ${argWord} 포함확인`.trim(), isRawKept: false, opensBrace };
    if (methodName === "split") return { text: indent + `${attachKoObjectParticle(objNat)} ${argWord}로 쪼개기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "join") return { text: indent + `${attachKoObjectParticle(objNat)} ${argWord}로 이어붙이기`.trim(), isRawKept: false, opensBrace };
    if (methodName === "insert") {
      const parts = argsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const idxNat = decompileLiteralToNatural(parts[0], mode) || parts[0];
        const valNat = decompileLiteralToNatural(parts[1], mode) || parts[1];
        return { text: indent + `${objNat}의 ${idxNat}에 ${attachKoObjectParticle(valNat)} 끼워넣기`, isRawKept: false, opensBrace };
      }
      return { text: indent + `${objNat} ${argWord} 끼워넣기`.trim(), isRawKept: false, opensBrace };
    }
    const koVerb =
      methodName === "set" ? "설정" :
      methodName === "get" ? "조회" :
      methodName === "delete" ? "삭제" :
      methodName === "addEventListener" ? "이벤트연결" : "추가";
    return { text: indent + `${objNat} ${argsNat} ${koVerb}`.replace(/\s+/g, " ").trim(), isRawKept: false, opensBrace };
  }

  const univ = naturalizeCodeExprToPhrase(cleanElseStart, mode);
  const fallbackText = univ || stripSyntaxNoiseForNatural(cleanElseStart) || (mode === "en" ? "empty step" : "빈 구문");
  return {
    text: indent + fallbackText,
    isRawKept: false,
    opensBrace
  };
}

function decompileCodeToNaturalText(rawCode, lang = currentLang, mode = displayMode) {
  const lines = String(rawCode || "").split(/\r?\n/);
  if (mode !== "ko" && mode !== "en") {
    return {
      text: String(rawCode || ""),
      rawKeptLines: new Set(),
      rawKeptFlags: lines.map(() => false),
      rawLines: lines,
      naturalLines: lines,
      matchedOpener: lines.map(() => -1),
      usedVocab: true
    };
  }
  const outLines = new Array(lines.length);
  const matchedOpener = new Array(lines.length).fill(-1);
  const openerStack = [];
  const rawKeptLines = new Set();
  const rawKeptFlags = new Array(lines.length).fill(false);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const res = decompileCodeLineToNatural(rawLine, lang, mode);
    const natLine = res ? res.text : rawLine;
    outLines[i] = natLine;

    if (res && res.isCloserOnly) {
      if (openerStack.length > 0) {
        matchedOpener[i] = openerStack.pop();
      }
      // Also handle `} else {` lines that closed a block and opened a new one on same line
    } else if (/^\}\s*(?:else|catch|finally)\b/.test(trimmed)) {
      if (openerStack.length > 0) openerStack.pop();
      if (res && res.opensBrace) openerStack.push(i);
    } else if (res && res.opensBrace) {
      openerStack.push(i);
    }

    const keptAsCode = Boolean(trimmed) && Boolean(res && res.isRawKept);
    rawKeptFlags[i] = keptAsCode;
    if (keptAsCode) {
      rawKeptLines.add(natLine.trim());
    }
  }

  return {
    text: outLines.join("\n"),
    rawKeptLines,
    rawKeptFlags,
    rawLines: lines,
    naturalLines: outLines,
    matchedOpener,
    usedVocab: Boolean(vocabLexicon && vocabLexicon[mode] && Object.keys(vocabLexicon[mode]).length > 0)
  };
}

function alignEditorLinesToBaseline(editorLines, baseline) {
  const m = editorLines.length;
  const matchedIdx = new Array(m).fill(-1);
  if (!baseline || !Array.isArray(baseline.naturalLines)) return matchedIdx;
  const baseNat = baseline.naturalLines;
  const n = baseNat.length;
  if (n === 0 || m === 0) return matchedIdx;

  // 1. Common prefix
  let p = 0;
  while (p < m && p < n) {
    const eLine = editorLines[p];
    const bLine = baseNat[p];
    if (eLine === bLine || (!eLine.trim() && !bLine.trim() && baseline.matchedOpener && baseline.matchedOpener[p] >= 0)) {
      matchedIdx[p] = p;
      p++;
    } else {
      break;
    }
  }

  // 2. Common suffix above prefix
  let eEnd = m - 1;
  let bEnd = n - 1;
  while (eEnd >= p && bEnd >= p) {
    const eLine = editorLines[eEnd];
    const bLine = baseNat[bEnd];
    if (eLine === bLine || (!eLine.trim() && !bLine.trim() && baseline.matchedOpener && baseline.matchedOpener[bEnd] >= 0)) {
      matchedIdx[eEnd] = bEnd;
      eEnd--;
      bEnd--;
    } else {
      break;
    }
  }

  // 3. Forward contiguous anchor match in middle slice [p .. eEnd] vs [p .. bEnd]
  if (p <= eEnd && p <= bEnd) {
    const posByKey = new Map();
    for (let j = p; j <= bEnd; j++) {
      const kt = baseNat[j].trim();
      if (!kt) continue;
      if (!posByKey.has(kt)) posByKey.set(kt, []);
      posByKey.get(kt).push(j);
    }
    let cursorJ = p;
    const anchors = [[p - 1, p - 1]];
    for (let i = p; i <= eEnd; i++) {
      const kt = editorLines[i].trim();
      if (!kt) continue;
      const list = posByKey.get(kt);
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        if (list[k] >= cursorJ) {
          matchedIdx[i] = list[k];
          cursorJ = list[k] + 1;
          anchors.push([i, list[k]]);
          break;
        }
      }
    }
    anchors.push([eEnd + 1, bEnd + 1]);

    // 4. Fill equal-length blank/closer runs between adjacent matched anchors
    for (let a = 0; a < anchors.length - 1; a++) {
      const [i0, j0] = anchors[a];
      const [i1, j1] = anchors[a + 1];
      if (i1 - i0 === j1 - j0 && i1 - i0 > 1) {
        for (let step = 1; step < i1 - i0; step++) {
          const ei = i0 + step;
          const bj = j0 + step;
          if (!editorLines[ei].trim() && !baseNat[bj].trim()) {
            matchedIdx[ei] = bj;
          }
        }
      }
    }
  }

  // 5. Remaining equal-content match so unedited imported lines keep original raw
  // Skip whitespace-only lines so closing-brace placeholders are never paired arbitrarily across blocks.
  const usedBase = new Set();
  for (let i = 0; i < m; i++) {
    if (matchedIdx[i] >= 0) usedBase.add(matchedIdx[i]);
  }
  const leftoverByKey = new Map();
  for (let j = 0; j < n; j++) {
    if (usedBase.has(j)) continue;
    const k = String(baseNat[j] || "").replace(/[ \t]+$/g, "");
    if (!k.trim()) continue;
    if (!leftoverByKey.has(k)) leftoverByKey.set(k, []);
    leftoverByKey.get(k).push(j);
  }
  for (let i = 0; i < m; i++) {
    if (matchedIdx[i] >= 0) continue;
    const k = String(editorLines[i] || "").replace(/[ \t]+$/g, "");
    if (!k.trim()) continue;
    const list = leftoverByKey.get(k);
    if (!list || !list.length) continue;
    matchedIdx[i] = list.shift();
  }

  return matchedIdx;
}

function normalizeNaturalText(s) {
  return String(s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+$/gm, "");
}

function naturalLineArraysEqual(aLines, bLines) {
  const trimTrailingEmpties = (arr) => {
    const out = Array.isArray(arr) ? arr.slice() : [];
    while (out.length > 0 && String(out[out.length - 1]) === "") out.pop();
    return out;
  };
  const a = trimTrailingEmpties(aLines).map((ln) => String(ln).replace(/[ \t]+$/g, ""));
  const b = trimTrailingEmpties(bLines).map((ln) => String(ln).replace(/[ \t]+$/g, ""));
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function editorMatchesStoredNatural(tab, mode, natText) {
  if (!tab) return false;
  const norm = normalizeNaturalText(natText);
  if (tab.naturalCache && tab.naturalCache[mode] !== undefined) {
    if (norm === normalizeNaturalText(tab.naturalCache[mode])) return true;
  }
  const base = tab.dualBaseline && tab.dualBaseline[mode];
  if (base && Array.isArray(base.naturalLines) && norm === normalizeNaturalText(base.naturalLines.join("\n"))) return true;
  return false;
}

function looksLikeRawSource(text, mode) {
  if (mode !== "ko" && mode !== "en") return false;
  const src = String(text || "");
  if (!src.trim()) return false;

  const head = src.slice(0, 16000);
  if (/webpackChunk|webpackJsonp|<!DOCTYPE\s+html/i.test(head)) return true;
  if (/<\/?(?:html|head|body|div|span|script|style|meta|link|section|table|form|button|input|main|header|footer|h[1-6]|p|a|ul|li)\b[^>]*>/i.test(head)) {
    return true;
  }

  const stripped = stripCommentsAndStringsForDetection(head);
  const lines = stripped.split(/\r?\n/);
  let hangulCodeLines = 0;
  let codeyLines = 0;
  let nonempty = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    nonempty += 1;
    if (/[가-힣]/.test(t)) hangulCodeLines += 1;
    if (
      /[{};()=]/.test(t) &&
      /[A-Za-z_$]/.test(t) &&
      !/^[가-힣0-9\s_]+$/.test(t)
    ) {
      codeyLines += 1;
    }
  }

  const hasJsTs = /\bfunction\b|=>|\b(?:const|let|var|import|export|async|await)\b|\b(?:console|document|window)\.[A-Za-z_$]/.test(stripped);
  const hasPy = /(?:^|\n)\s*(?:def|class|elif|from\s+\S+\s+import|import\s+\S+)\b|(?:^|\n)\s*(?:if|for|while|try|except|with)\b[^\n]*:\s*(?:\n|$)|\bprint\s*\(/.test(stripped);
  const hasCJava = /#\s*include\s*[<"]|\b(?:public|private|protected|static)\s+(?:class|interface|void|int|String|final)\b|\bint\s+main\s*\(|\bSystem\.out\.|\bprintf\s*\(/.test(stripped);
  const hasKtSw = /\b(?:fun|val|func|guard\s+let|data\s+class|override\s+func|mutating\s+func)\b/.test(stripped);
  const hasPsShell = /\$[A-Za-z_][\w:]*\s*=|\b(?:New-Item|Join-Path|Set-Location|Get-ChildItem|Out-Null)\b/.test(stripped);
  const hasPunct = /[{};=():]/.test(stripped);

  if (hasPy || hasCJava || hasKtSw || hasPsShell) return true;
  if (hasJsTs && hasPunct) return true;
  if (nonempty > 0 && codeyLines / nonempty >= 0.35 && hangulCodeLines / nonempty <= 0.35) return true;
  if (nonempty > 0 && hangulCodeLines / nonempty > 0.35) return false;
  if (nonempty > 0 && nonempty <= 3 && codeyLines > 0) return true;
  return false;
}

function splicePastedRawSourceIntoTab(tab, model, pasteRange, pastedRaw) {
  if (!tab || !model || !pasteRange) {
    adoptExternalRawSource(tab, pastedRaw);
    return;
  }
  const base = tab.dualBaseline && tab.dualBaseline[displayMode];
  const natLines = model.getValue().split(/\r?\n/);
  const startLn = Math.max(1, pasteRange.startLineNumber);
  const endLn = Math.min(natLines.length, pasteRange.endLineNumber);
  const preCount = startLn - 1;
  const postStartIdx = endLn;

  const compileSliceRaw = (sliceLines, offsetIdx) => {
    if (!sliceLines.length) return "";
    if (base && Array.isArray(base.naturalLines) && Array.isArray(base.rawLines)) {
      const aligned = alignEditorLinesToBaseline(natLines, base);
      const out = [];
      for (let i = 0; i < sliceLines.length; i++) {
        const globalIdx = offsetIdx + i;
        const bIdx = aligned[globalIdx];
        if (bIdx >= 0 && bIdx < base.rawLines.length) {
          out.push(base.rawLines[bIdx]);
        } else {
          const compiled = compileNaturalTextToCode(sliceLines[i], tab.language || currentLang, displayMode, tab.rawKeptSet, null);
          out.push(compiled ? compiled.rawCode : sliceLines[i]);
        }
      }
      return out.join("\n");
    }
    const compiled = compileNaturalTextToCode(sliceLines.join("\n"), tab.language || currentLang, displayMode, tab.rawKeptSet, null);
    return compiled ? compiled.rawCode : sliceLines.join("\n");
  };

  const beforeRaw = compileSliceRaw(natLines.slice(0, preCount), 0);
  const afterRaw = compileSliceRaw(natLines.slice(postStartIdx), postStartIdx);
  const parts = [];
  if (beforeRaw.trim()) parts.push(beforeRaw);
  parts.push(String(pastedRaw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (afterRaw.trim()) parts.push(afterRaw);
  adoptExternalRawSource(tab, parts.join("\n"));
}

function adoptExternalRawSource(tab, rawText) {
  if (!tab) return;
  tab.rawCode = rawText;
  tab.content = rawText;
  tab.userEditedNatural = false;
  tab.isDirty = true;
  tab.naturalCache = {};
  tab.naturalCompiledSig = {};
  tab.dualBaseline = {};
  tab.dirtyNaturalLines = new Set();
  const detected = detectTabLanguage(tab);
  if (detected) tab.language = detected;

  const paint = () => {
    if (!editor || getActiveTab() !== tab) {
      isSwitchingTab = false;
      return;
    }
    if (displayMode !== "ko" && displayMode !== "en") {
      isSwitchingTab = false;
      return;
    }
    try {
      syncEditorModelLanguage();
      editor.setValue(getEditorBufferForMode(tab, displayMode));
      adoptEditorNaturalCache(tab, displayMode);
    } finally {
      isSwitchingTab = false;
    }
    updateLangMatchDot();
    if (typeof refreshAllViews === "function") refreshAllViews();
    if (typeof scheduleSaveWorkspaceState === "function") scheduleSaveWorkspaceState(600);
  };

  isSwitchingTab = true;
  if (detected && detected !== currentLang) {
    currentLang = detected;
    window.currentLang = detected;
    const langSelect = document.getElementById("lang-select");
    if (langSelect) langSelect.value = detected;
    Promise.resolve(loadLanguageCartridge(detected))
      .then(() => {
        if (displayMode === "ko" || displayMode === "en") return loadVocabLexicon(displayMode);
        return null;
      })
      .then(paint, paint);
    return;
  }
  paint();
}

function adoptEditorNaturalCache(tab, mode) {
  if (!tab || !editor || (mode !== "ko" && mode !== "en")) return;
  if (!tab.naturalCache) tab.naturalCache = {};
  tab.naturalCache[mode] = editor.getValue();
  if (mode === displayMode && getActiveTab() === tab) {
    syncNaturalEditorToRawBuffer({ commit: false });
  }
}

function lookupKoTokenCode(tok) {
  const raw = (tok && (tok.raw || tok.stem)) || "";
  const stem = (tok && tok.stem) || raw;
  const owner = SYNONYM_TO_OWNER_KO.get(raw) || SYNONYM_TO_OWNER_KO.get(stem);
  let directCode = (owner && !owner.glossOnly) ? owner.code : null;
  if (!directCode) {
    directCode = lookupNaturalWordToCode(raw) || lookupNaturalWordToCode(stem);
  }
  return sanitizeMappedCode(directCode);
}

function formatKoInstrument(raw, lang, ctx) {
  const stem = koStemValue(raw);
  if (Object.prototype.hasOwnProperty.call(KO_INSTRUMENT_LITERALS, stem)) {
    return quoteNaturalLiteral(KO_INSTRUMENT_LITERALS[stem]);
  }
  return formatKoLiteralOrExpr(stem, lang, true, ctx);
}

function koReceiverFromSlots(slots, fallback = "", preferPlural = true) {
  if (slots.dest) return identFromKoSlot(slots.dest, fallback, preferPlural);
  if (slots.source) return identFromKoSlot(slots.source, fallback, preferPlural);
  if (slots.possess) return identFromKoSlot(slots.possess, fallback, preferPlural);
  const { nouns } = splitUnscopedNounsAndNums(slots);
  if (nouns.length) return identFromKoSlot(nouns[0], fallback, preferPlural);
  const leftover = leftoverNaturalExprFromSlots(slots, "python", null);
  return leftover || fallback || "";
}

function koObjectExprFromSlots(slots, lang, ctx, receiverConsumedNoun = false) {
  if (slots.object) return formatKoLiteralOrExpr(slots.object, lang, true, ctx);
  const { nums, nouns } = splitUnscopedNounsAndNums(slots);
  if (nums.length) return formatKoLiteralOrExpr(nums[nums.length - 1], lang, true, ctx);
  const start = (receiverConsumedNoun && !slots.dest && !slots.source && !slots.possess) ? 1 : 0;
  if (nouns.length > start) return formatKoLiteralOrExpr(nouns[nouns.length - 1], lang, true, ctx);
  return null;
}

const KO_ACTION_ALIAS_MAP = {
  "추가": "append",
  "추가하기": "append",
  "추가해": "append",
  "제거": "remove",
  "제거하기": "remove",
  "제거해": "remove",
  "삭제하기": "remove",
  "정렬하기": "sort",
  "정렬해": "sort",
  "나누기": "split",
  "나눠": "split",
  "합치기": "join",
  "합쳐": "join",
  "반환하기": "return",
  "반환해": "return",
  "돌려주기": "return",
  "돌려줘": "return",
  "출력하기": "print",
  "출력해": "print",
  "보여주기": "print",
  "보여줘": "print",
  "찍어": "print",
  "입력받기": "input",
  "입력받아": "input"
};

function composeKoreanTokensToCode(trimmed, lang, ctx) {
  const l = codegenLang(lang);
  const isBraceLang = l !== "python";
  const semi = (isBraceLang && l !== "kotlin" && l !== "swift") ? ";" : "";
  const tokens = tokenizeKoWithRoles(trimmed);
  if (!tokens.length) return null;

  let opCode = null;
  let containerOp = null;
  let assignWanted = false;
  const CONTAINER_OPS = /^(?:list|Array|dict|set)$/;
  const valueTokens = [];
  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti];
    if (!tok || tok.role === "condEnd") continue;
    if (KO_ASSIGN_WORDS.has(tok.raw) || KO_ASSIGN_WORDS.has(tok.stem)) {
      assignWanted = true;
      continue;
    }
    const mapped = KO_ACTION_ALIAS_MAP[tok.raw] || KO_ACTION_ALIAS_MAP[tok.stem] || lookupKoTokenCode(tok);
    const isNounBox = tok.stem && KO_NOUN_TO_IDENT[tok.stem];
    if (mapped && KO_COMPOSE_OP_CODES.test(mapped)) {
      if (CONTAINER_OPS.test(mapped) && (tok.particle || isNounBox || tokens.length > 1)) {
        containerOp = mapped;
        valueTokens.push(tok);
        continue;
      }
      if (!opCode || CONTAINER_OPS.test(opCode)) {
        if (opCode && CONTAINER_OPS.test(opCode)) {
          // earlier container word was actually the target noun ("목록")
        }
        opCode = mapped;
        continue;
      }
    }
    valueTokens.push(tok);
  }
  if (!opCode && containerOp && tokens.length === 1) opCode = containerOp;
  const slots = fillKoRoleSlots(valueTokens);
  const { nums, nouns } = splitUnscopedNounsAndNums(slots);
  if (opCode) opCode = adaptOpCodeToLang(opCode, l);

  if (assignWanted && (slots.dest || nouns.length)) {
    const destVar = identFromKoSlot(slots.dest || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), false);
    const valRaw = slots.object || (nums.length ? nums[nums.length - 1] : (nouns.length > 1 ? nouns[1] : leftoverNaturalExprFromSlots(slots, l, ctx)));
    if (ctx && ctx.declaredVars) ctx.declaredVars.add(destVar);
    return { code: buildAssignStatement(destVar, valRaw, l, true, false, ctx, "ko"), opensBlock: false };
  }

  if (opCode === "break" || opCode === "continue" || opCode === "else" || opCode === "try" || opCode === "except" || opCode === "catch" || opCode === "finally") {
    return commitRunnableLine(emitCallShape(opCode, {}, l, ctx), l);
  }
  if (opCode === "if" || opCode === "elif" || opCode === "else if" || opCode === "while" || opCode === "switch") {
    const leftover = leftoverNaturalExprFromSlots(slots, l, ctx);
    const cmp = buildKoCompareExprFromSlots(slots, l, ctx, leftover || (ctx && ctx.lastSubject) || "");
    const expr = cmp ? cmp.expr : leftover;
    if (!String(expr || "").trim()) return null;
    return commitRunnableLine(emitCallShape(opCode, { a: expr }, l, ctx), l);
  }
  if (opCode === "case" || opCode === "default") {
    const val = koPrintArgFromSlots(slots, l, ctx, leftoverNaturalExprFromSlots(slots, l, ctx));
    return commitRunnableLine(emitCallShape(opCode, { a: val }, l, ctx), l);
  }
  if (opCode === "return") {
    const val = koPrintArgFromSlots(slots, l, ctx, leftoverNaturalExprFromSlots(slots, l, ctx));
    const cleanVal = (!val || val === '""') ? "" : val;
    return commitRunnableLine(emitCallShape("return", { a: cleanVal }, l, ctx), l);
  }
  if (opCode === "print" || opCode === "println" || opCode === "printf" || opCode === "console.log" || opCode === "console.warn" || opCode === "console.error" || opCode === "System.out.println") {
    const arg = koPrintArgFromSlots(slots, l, ctx, leftoverNaturalExprFromSlots(slots, l, ctx));
    return commitRunnableLine(emitCallShape(opCode, { a: arg }, l, ctx), l);
  }
  if (opCode === "input" || opCode === "prompt") {
    const destVar = identFromKoSlot(slots.dest || nouns[0] || "", leftoverNaturalExprFromSlots(slots, l, ctx), false);
    if (!destVar) return null;
    const promptRaw = slots.object || (nouns.length && slots.dest ? nouns[nouns.length - 1] : leftoverNaturalExprFromSlots(slots, l, ctx));
    return commitRunnableLine({ code: buildKoInputStatement(destVar, promptRaw, l, ctx, true), opensBlock: false }, l);
  }
  if (opCode === "for") {
    const listStem = slots.source || slots.dest || nouns[nouns.length - 1] || "";
    const listVar = listStem ? identFromKoSlot(listStem, leftoverNaturalExprFromSlots(slots, l, ctx), true) : leftoverNaturalExprFromSlots(slots, l, ctx);
    const itemVar = nouns.length >= 2 ? identFromKoSlot(nouns[0], "item", false) : "item";
    if (!listVar) return null;
    return commitRunnableLine(emitCallShape("for", { a: listVar, i: itemVar }, l, ctx), l);
  }
  if (opCode === "append" || opCode === "push" || opCode === "add") {
    const recv = koReceiverFromSlots(slots, leftoverNaturalExprFromSlots(slots, l, ctx), true);
    const val = koObjectExprFromSlots(slots, l, ctx, true) || leftoverNaturalExprFromSlots(slots, l, ctx);
    return commitRunnableLine(emitCallShape("append", { a: recv, b: val }, l, ctx), l);
  }
  if (opCode === "remove" || opCode === "count") {
    const recv = identFromKoSlot(slots.source || slots.dest || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), true);
    const val = koObjectExprFromSlots(slots, l, ctx, true) || leftoverNaturalExprFromSlots(slots, l, ctx);
    return commitRunnableLine(emitCallShape(opCode, { a: recv, b: val }, l, ctx), l);
  }
  if (opCode === "insert") {
    const listVar = identFromKoSlot(slots.possess || slots.source || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), true);
    const destStem = slots.dest ? koStemValue(slots.dest) : "";
    const idx = destStem && /^-?\d+(\.\d+)?$/.test(destStem) ? destStem : (nums[0] || "");
    const val = slots.object ? formatKoLiteralOrExpr(slots.object, l, true, ctx) : (nums.length > 1 ? nums[nums.length - 1] : (koObjectExprFromSlots(slots, l, ctx, true) || leftoverNaturalExprFromSlots(slots, l, ctx)));
    return commitRunnableLine(emitCallShape("insert", { a: listVar, b: idx, c: val }, l, ctx), l);
  }
  if (opCode === "includes") {
    const recv = identFromKoSlot(slots.dest || slots.source || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), true);
    const val = slots.object || slots.subject || (nouns.length > 1 ? nouns[nouns.length - 1] : (nums[0] || leftoverNaturalExprFromSlots(slots, l, ctx)));
    const needle = val ? formatKoLiteralOrExpr(val, l, true, ctx) : leftoverNaturalExprFromSlots(slots, l, ctx);
    return commitRunnableLine(emitCallShape("includes", { a: recv, b: needle }, l, ctx), l);
  }
  if (opCode === "split" || opCode === "join") {
    const recv = identFromKoSlot(slots.object || slots.dest || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), opCode === "join");
    const inst = slots.instrument ? formatKoInstrument(slots.instrument, l, ctx) : leftoverNaturalExprFromSlots(slots, l, ctx);
    return commitRunnableLine(emitCallShape(opCode, { a: recv, b: inst }, l, ctx), l);
  }
  if (opCode === "pop" || opCode === "clear" || opCode === "sort" || opCode === "reverse" || opCode === "trim" || opCode === "strip") {
    const recv = koReceiverFromSlots(slots, leftoverNaturalExprFromSlots(slots, l, ctx), true);
    return commitRunnableLine(emitCallShape(opCode, { a: recv }, l, ctx), l);
  }
  if (opCode === "filter") {
    const listVar = identFromKoSlot(slots.source || nouns[0], leftoverNaturalExprFromSlots(slots, l, ctx), true);
    if (!listVar) return null;
    const predSlots = {
      dest: null,
      source: null,
      object: slots.object,
      subject: slots.subject,
      instrument: null,
      possess: null,
      compare: slots.compare,
      unscoped: slots.source ? slots.unscoped : slots.unscoped.slice(1)
    };
    const leftoverPred = leftoverNaturalExprFromSlots(predSlots, l, ctx);
    const pred = buildKoCompareExprFromSlots(predSlots, l, ctx, leftoverPred) || (leftoverPred ? { expr: leftoverPred } : null);
    return commitRunnableLine(emitCallShape("filter", { a: listVar, b: (pred && pred.expr) || "" }, l, ctx), l);
  }
  if (opCode === "len" || opCode === "length" || opCode === "size") {
    const recv = koReceiverFromSlots(slots, leftoverNaturalExprFromSlots(slots, l, ctx), true);
    return commitRunnableLine(emitCallShape("len", { a: recv }, l, ctx), l);
  }
  if (opCode === "sum" || opCode === "max" || opCode === "min" || opCode === "sorted" || opCode === "abs" || opCode === "round") {
    const recv = koReceiverFromSlots(slots, leftoverNaturalExprFromSlots(slots, l, ctx), true) || nums[0] || "";
    return commitRunnableLine(emitCallShape(opCode, { a: recv }, l, ctx), l);
  }
  if (opCode === "random") {
    return commitRunnableLine(emitCallShape("random", {}, l, ctx), l);
  }
  if (opCode === "def" || opCode === "function" || opCode === "fun" || opCode === "func") {
    const fnName = identFromKoSlot(nouns[0] || slots.dest, leftoverNaturalExprFromSlots(slots, l, ctx), false);
    if (!fnName) return null;
    return commitRunnableLine(emitCallShape(opCode, { a: fnName, b: "" }, l, ctx), l);
  }
  if (opCode === "replace") {
    const recv = identFromKoSlot(slots.source || slots.dest || nouns[0], "", false);
    const oldVal = nouns[1] ? formatKoLiteralOrExpr(nouns[1], l, true, ctx) : "";
    const newVal = nouns[2] ? formatKoLiteralOrExpr(nouns[2], l, true, ctx) : (slots.object ? formatKoLiteralOrExpr(slots.object, l, true, ctx) : "");
    return commitRunnableLine(emitCallShape("replace", { a: recv, b: oldVal, c: newVal }, l, ctx), l);
  }
  if (opCode && Object.prototype.hasOwnProperty.call(RUNNABLE_BY_LANG, opCode)) {
    const recv = koReceiverFromSlots(slots, leftoverNaturalExprFromSlots(slots, l, ctx), false) || nums[0] || "";
    const rest = koObjectExprFromSlots(slots, l, ctx, true) || "";
    return commitRunnableLine(emitCallShape(opCode, { a: recv, b: rest }, l, ctx), l);
  }
  return null;
}

function composeNaturalTokensToCode(trimmed, lang = currentLang, mode = displayMode, ctx = null) {
  const l = codegenLang(lang);
  const isBraceLang = l !== "python";
  const semi = (isBraceLang && l !== "kotlin" && l !== "swift") ? ";" : "";
  const rawTokens = String(trimmed || "").trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return null;

  const isKo = mode !== "en";
  if (isKo) {
    const assembled = composeKoreanTokensToCode(trimmed, l, ctx);
    if (assembled && assembled.code) return assembled;
  }
  let opCode = null;
  const argExprs = [];
  let destVar = null;
  const KO_ASSIGN_WORDS = new Set(["넣기", "담기", "대입", "대입하기", "집어넣기", "할당", "할당하기", "값넣기", "정하기", "설정하기"]);
  const EN_ASSIGN_WORDS = new Set(["put", "store", "set", "assign"]);
  const assignWanted = rawTokens.some((t) => {
    const stem = isKo ? stripTrailingKoParticle(t) : t;
    return isKo ? (KO_ASSIGN_WORDS.has(t) || KO_ASSIGN_WORDS.has(stem)) : EN_ASSIGN_WORDS.has(String(t).toLowerCase());
  });
  const OP_CODES = KO_COMPOSE_OP_CODES;
  const condOps = {
    "이상": ">=", "이하": "<=", "초과": ">", "미만": "<",
    "같음": l === "javascript" ? "===" : "==",
    "같다": l === "javascript" ? "===" : "==",
    "다름": l === "javascript" ? "!==" : "!=",
    "그리고": l === "python" ? "and" : "&&",
    "또는": l === "python" ? "or" : "||"
  };

  for (const rawTok of rawTokens) {
    const split = isKo ? splitKoParticle(rawTok) : { stem: rawTok, particle: "", role: "" };
    const bare = split.stem || rawTok;

    if (isKo && KO_COND_ENDINGS.includes(rawTok)) continue;
    if (isKo && ["을", "를", "은", "는", "이", "가", "의", "와", "과"].includes(rawTok)) continue;

    const cmp = isKo ? (matchKoCompareToken(rawTok) || matchKoCompareToken(bare)) : null;
    if (cmp) {
      argExprs.push(l === "javascript" ? cmp.opJs : cmp.op);
      continue;
    }
    if (condOps[rawTok] || condOps[bare]) {
      argExprs.push(condOps[rawTok] || condOps[bare]);
      continue;
    }

    if (isKo && (KO_ASSIGN_WORDS.has(rawTok) || KO_ASSIGN_WORDS.has(bare))) {
      continue;
    }
    if (!isKo && EN_ASSIGN_WORDS.has(String(rawTok).toLowerCase())) {
      continue;
    }

    if (isKo && split.role === "dest") {
      destVar = requireKoIdent(bare, false, "value");
      if (assignWanted) continue;
    }

    const owner = isKo
      ? (SYNONYM_TO_OWNER_KO.get(rawTok) || SYNONYM_TO_OWNER_KO.get(bare))
      : SYNONYM_TO_OWNER_EN.get(String(rawTok).toLowerCase());
    let directCode = (owner && !owner.glossOnly) ? owner.code : null;
    if (!directCode) {
      directCode = lookupNaturalWordToCode(rawTok) || lookupNaturalWordToCode(bare);
    }
    directCode = sanitizeMappedCode(directCode);

    if (directCode && !opCode && OP_CODES.test(directCode)) {
      opCode = directCode;
      continue;
    }

    const litSrc = (isKo && split.role === "object") ? bare : (bare || rawTok);
    if (/^-?\d+(\.\d+)?$/.test(rawTok) || /^["'`].*["'`]$/.test(rawTok)) {
      argExprs.push(rawTok);
    } else if (directCode && /^(?:true|True|false|False|None|null|nil|undefined)$/.test(directCode)) {
      argExprs.push(isKo ? formatKoLiteralOrExpr(litSrc, l, true, ctx) : formatEnLiteralOrExpr(litSrc, l, true, ctx));
    } else {
      argExprs.push(isKo ? formatKoLiteralOrExpr(litSrc, l, true, ctx) : formatEnLiteralOrExpr(litSrc, l, true, ctx));
    }
  }

  if (opCode) opCode = adaptOpCodeToLang(opCode, l);

  if (destVar && assignWanted) {
    const valRaw = argExprs.length ? argExprs.join(" ") : leftoverNaturalExpr(trimmed, l, ctx);
    if (ctx && ctx.declaredVars) ctx.declaredVars.add(destVar);
    return { code: buildAssignStatement(destVar, valRaw, l, true, false, ctx, isKo ? "ko" : "en"), opensBlock: false };
  }

  if (opCode === "break" || opCode === "continue" || opCode === "else" || opCode === "try" || opCode === "except" || opCode === "catch" || opCode === "finally") {
    return commitRunnableLine(emitCallShape(opCode, {}, l, ctx), l);
  }
  if (opCode === "return") {
    if (argExprs.length === 0) return commitRunnableLine(emitCallShape("return", { a: "" }, l, ctx), l);
    if (argExprs.length === 1) return commitRunnableLine(emitCallShape("return", { a: argExprs[0] }, l, ctx), l);
    const tupleOrArr = l === "python" ? argExprs.join(", ") : l === "javascript" ? `[${argExprs.join(", ")}]` : argExprs.join(", ");
    return commitRunnableLine(emitCallShape("return", { a: tupleOrArr }, l, ctx), l);
  }
  if (opCode === "print" || opCode === "println" || opCode === "printf" || opCode === "console.log" || opCode === "console.warn" || opCode === "console.error" || opCode === "System.out.println") {
    const joinedArgs = argExprs.length ? argExprs.join(", ") : leftoverNaturalExpr(trimmed, l, ctx);
    return commitRunnableLine(emitCallShape(opCode, { a: joinedArgs }, l, ctx), l);
  }
  if (opCode === "if" || opCode === "elif" || opCode === "else if" || opCode === "while" || opCode === "switch") {
    const expr = argExprs.length ? argExprs.join(" ") : leftoverNaturalExpr(trimmed, l, ctx);
    if (!String(expr || "").trim()) return null;
    return commitRunnableLine(emitCallShape(opCode, { a: expr }, l, ctx), l);
  }
  if (opCode === "case" || opCode === "default") {
    return commitRunnableLine(emitCallShape(opCode, { a: argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx) }, l, ctx), l);
  }
  if (opCode === "for") {
    const listVar = argExprs[argExprs.length - 1] || leftoverNaturalExpr(trimmed, l, ctx);
    const itemVar = argExprs.length >= 2 ? argExprs[0] : "item";
    if (!listVar) return null;
    return commitRunnableLine(emitCallShape("for", { a: listVar, i: itemVar }, l, ctx), l);
  }
  if (opCode === "len" || opCode === "length" || opCode === "size") {
    const recv = argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx);
    if (!recv) return null;
    return commitRunnableLine(emitCallShape("len", { a: recv }, l, ctx), l);
  }
  if (opCode === "sum" || opCode === "max" || opCode === "min" || opCode === "sorted" || opCode === "abs" || opCode === "round") {
    const recv = argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx);
    if (!recv) return null;
    return commitRunnableLine(emitCallShape(opCode, { a: recv }, l, ctx), l);
  }
  if (opCode === "random") {
    return commitRunnableLine(emitCallShape("random", {}, l, ctx), l);
  }
  if (opCode === "filter") {
    const listVar = argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx);
    if (!listVar) return null;
    return commitRunnableLine(emitCallShape("filter", { a: listVar, b: argExprs.slice(1).join(" ") }, l, ctx), l);
  }
  if (opCode === "input" || opCode === "prompt") {
    const destVar = argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx);
    if (!destVar) return null;
    return commitRunnableLine({ code: buildKoInputStatement(destVar, argExprs[1] || "", l, ctx, true), opensBlock: false }, l);
  }
  if (opCode === "def" || opCode === "function" || opCode === "fun" || opCode === "func") {
    const fnName = argExprs[0];
    if (!fnName) return null;
    return commitRunnableLine(emitCallShape(opCode, { a: fnName, b: argExprs.slice(1).join(", ") }, l, ctx), l);
  }
  if (opCode) {
    const target = argExprs[0] || leftoverNaturalExpr(trimmed, l, ctx);
    const rest = argExprs.slice(1).join(", ");
    if (opCode === "insert") {
      const parts = argExprs.slice(1);
      return commitRunnableLine(emitCallShape("insert", { a: target, b: parts[0], c: parts[1] }, l, ctx), l);
    }
    if (opCode === "replace") {
      const parts = argExprs.slice(1);
      return commitRunnableLine(emitCallShape("replace", { a: target, b: parts[0], c: parts[1] }, l, ctx), l);
    }
    if (Object.prototype.hasOwnProperty.call(RUNNABLE_BY_LANG, opCode)) {
      return commitRunnableLine(emitCallShape(opCode, { a: target, b: rest }, l, ctx), l);
    }
    if (!target) return null;
    if (!isBundleCodeRunnableInLang(opCode, l)) return null;
    return commitRunnableLine({ code: `${opCode}(${argExprs.join(", ")})${semi}`, opensBlock: false }, l);
  }

  if (!opCode && rawTokens.length === 1) {
    const rawMapped = sanitizeMappedCode(lookupNaturalWordToCode(rawTokens[0]));
    const mapped = adaptOpCodeToLang(rawMapped, l);
    if (mapped && (isGenericPrintOp(mapped) || mapped === "console.warn" || mapped === "console.error")) {
      return commitRunnableLine(emitCallShape(mapped, { a: "" }, l, ctx), l);
    }
    if (mapped && Object.prototype.hasOwnProperty.call(RUNNABLE_BY_LANG, mapped)) {
      const shaped = emitCallShape(mapped, {}, l, ctx);
      return shaped ? commitRunnableLine(shaped, l) : null;
    }
    if (mapped && isRealCodeToken(mapped) && isBundleCodeRunnableInLang(mapped, l)) {
      return commitRunnableLine({ code: `${mapped}${semi}`, opensBlock: false }, l);
    }
  }

  if (!opCode && argExprs.length === 2) {
    const firstTok = isKo ? stripTrailingKoParticle(rawTokens[0]) : rawTokens[0];
    const secondTok = isKo ? stripTrailingKoParticle(rawTokens[1]) : rawTokens[1];
    const looksUnparsedKoVerbOrOp = isKo && /(?:다면|으면|라면|이면|보다|거나|하고|하기|해줘|더하기|빼기|곱하기|나누기|바꾸기|설정|증가|감소|추가|제거|삭제|정렬|합치기|반복|출력|반환|보여줘|입력받|같다|다르|작다|크다)$/.test(rawTokens[1]);
    const rhsIsOperatorOnly = /^(?:>=|<=|===|!==|==|!=|>|<|\&\&|\|\||and|or)$/i.test(String(argExprs[1] || "").trim());
    const lhs = (!looksUnparsedKoVerbOrOp && !rhsIsOperatorOnly)
      ? (isKo ? resolveKoVarName(firstTok, false) : resolveEnVarName(firstTok, false))
      : "";
    if (lhs && (!isKo || !KO_GRAMMAR_VALID_WORDS.has(secondTok))) {
      if (ctx && ctx.declaredVars) ctx.declaredVars.add(lhs);
      return commitRunnableLine({ code: `${lhs} = ${argExprs[1]}${semi}`, opensBlock: false, matchedPattern: "bare_fallback" }, l);
    }
  }
  if (argExprs.length >= 2) {
    return null;
  }
  if (argExprs.length === 1) {
    if (isWholeLineQuotedString(argExprs[0])) return null;
    return commitRunnableLine({ code: `${argExprs[0]}${semi}`, opensBlock: false }, l);
  }
  return null;
}

function applyUserNaturalLine(trimmed, lang, mode, ctx, options = {}) {
  const l = codegenLang(lang);
  const isBraceLang = l !== "python";
  const rawParsed = parseNaturalSentenceToCode(trimmed, l, mode, ctx);
  if (rawParsed && rawParsed.matchedPattern === "comment" && rawParsed.code) return rawParsed;
  const parsed = commitRunnableLine(rawParsed, l);
  if (parsed && parsed.code) return parsed;
  const composed = commitRunnableLine(composeNaturalTokensToCode(trimmed, l, mode, ctx), l);
  if (composed && composed.code) {
    if (!(options && options.isPairedBaselineLine && composed.matchedPattern === "bare_fallback")) {
      return composed;
    }
  }
  const rawMapped = sanitizeMappedCode(lookupNaturalWordToCode(trimmed)) || (isRealCodeToken(trimmed) ? trimmed : null);
  const mapped = adaptOpCodeToLang(rawMapped, l);
  if (!mapped) return null;
  if (isGenericPrintOp(mapped) || mapped === "console.warn" || mapped === "console.error") {
    return commitRunnableLine(emitCallShape(mapped, { a: "" }, l, ctx), l);
  }
  if (Object.prototype.hasOwnProperty.call(RUNNABLE_BY_LANG, mapped)) {
    return commitRunnableLine(emitCallShape(mapped, {}, l, ctx), l);
  }
  if (isBundleCodeRunnableInLang(mapped, l)) {
    const semi = isBraceLang && l !== "kotlin" && l !== "swift" ? ";" : "";
    return commitRunnableLine({ code: `${mapped}${semi}`, opensBlock: false }, l);
  }
  return null;
}

function isBaselineRawLineValidForLang(rawLine, targetLang) {
  const t = String(rawLine || "").trim();
  if (!t || /^(?:#|\/\/|\/\*|\*|\*\/|[{}()\[\];]+$)/.test(t)) return true;
  const tl = codegenLang(targetLang);
  const forbidden = FORBIDDEN_TOKEN_PATTERNS_BY_LANG[tl] || [];
  for (const re of forbidden) {
    if (re.test(t)) return false;
  }
  if (tl === "c" && /^\s*(?:var|val|let)\s+[A-Za-z_]/.test(t)) return false;
  if (tl !== "python" && tl !== "swift" && /^\s*(?:else\s+)?if\s+(?!\().+\{\s*$/.test(t)) return false;
  if (
    (tl === "c" || tl === "java") &&
    !/[{};:]$/.test(t) &&
    !/^(?:#|\/\/|\/\*|\*|public\b|private\b|protected\b|class\b|interface\b|enum\b|@)/.test(t) &&
    (/(?:^|[^A-Za-z0-9_.])(?:System\.out\.println|println|printf|print|return|break|continue)\b/.test(t) ||
      /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:[^=]|$)/.test(t)) &&
    !/[,(=+\-*\/&|?:]\s*$/.test(t)
  ) {
    return false;
  }
  return true;
}

function compileNaturalTextToCode(naturalText, lang = currentLang, mode = displayMode, rawKeptSet = null, baseline = null) {
  const l = codegenLang(lang);
  if (baseline && baseline.lang && codegenLang(baseline.lang) !== l) {
    baseline = null;
  }
  const isBraceLang = l !== "python";
  const lines = String(naturalText || "").split(/\r?\n/);
  const compiledLines = [];
  const lineMap = new Map();
  const rawLineToNaturalLine = new Map();
  let curRawLineNum = 1;
  const pushCompiledChunk = (text, natLineNum) => {
    compiledLines.push(text);
    const span = String(text).split(/\r?\n/).length;
    for (let s = 0; s < span; s++) {
      if (natLineNum > 0) {
        rawLineToNaturalLine.set(curRawLineNum, natLineNum);
      }
      curRawLineNum++;
    }
  };
  const diagnostics = [];
  const dirtyLineIndices = new Set();
  const blockStack = []; // { indent: number, openerLine: number }
  const ctx = {
    declaredVars: new Set(),
    allowBlockHeaders: true,
    lastSubject: null
  };
  const baseRawKept = baseline && Array.isArray(baseline.rawKeptFlags) ? baseline.rawKeptFlags : [];
  const lineOrigin = new Array(lines.length);
  const allBaselineLinesValid = Boolean(
    baseline &&
    Array.isArray(baseline.rawLines) &&
    baseline.rawLines.every((rLn) => isBaselineRawLineValidForLang(rLn, l))
  );
  if (baseline && allBaselineLinesValid && Array.isArray(baseline.naturalLines) && baseline.sourceRaw != null && naturalLineArraysEqual(lines, baseline.naturalLines)) {
    const baseRawLines = Array.isArray(baseline.rawLines) ? baseline.rawLines : [];
    for (let i = 0; i < lines.length; i++) {
      rawLineToNaturalLine.set(i + 1, i + 1);
      lineOrigin[i] = { origin: "decomp", rawIndex: i };
      if (!lines[i].trim()) continue;
      lineMap.set(i + 1, {
        rawLine: String(baseRawLines[i] || "").trim(),
        isBaselineKept: true,
        isRawKept: Boolean(baseRawKept[i]),
        ok: true,
        unknownWords: []
      });
    }
    return {
      rawCode: String(baseline.sourceRaw),
      lineMap,
      rawLineToNaturalLine,
      diagnostics,
      dirtyLineIndices: new Set(),
      lineOrigin
    };
  }

  const matchedBaseIdx = alignEditorLinesToBaseline(lines, baseline);
  const alignedBaseSet = new Set();
  for (let i = 0; i < matchedBaseIdx.length; i++) {
    if (matchedBaseIdx[i] >= 0) alignedBaseSet.add(matchedBaseIdx[i]);
  }

  const pairedBaseIdx = new Array(lines.length).fill(-1);
  if (baseline && Array.isArray(baseline.naturalLines) && Array.isArray(baseline.rawLines)) {
    const baseCount = baseline.naturalLines.length;
    let runStart = 0;
    while (runStart < lines.length) {
      if (matchedBaseIdx[runStart] >= 0) {
        runStart++;
        continue;
      }
      let runEnd = runStart;
      while (runEnd + 1 < lines.length && matchedBaseIdx[runEnd + 1] < 0) runEnd++;
      let prevB = -1;
      for (let k = runStart - 1; k >= 0; k--) {
        if (matchedBaseIdx[k] >= 0) {
          prevB = matchedBaseIdx[k];
          break;
        }
      }
      let nextB = baseCount;
      for (let k = runEnd + 1; k < lines.length; k++) {
        if (matchedBaseIdx[k] >= 0) {
          nextB = matchedBaseIdx[k];
          break;
        }
      }
      const freeBase = [];
      for (let j = prevB + 1; j < nextB; j++) {
        if (!alignedBaseSet.has(j)) freeBase.push(j);
      }
      const runLen = runEnd - runStart + 1;
      if (freeBase.length === runLen) {
        for (let k = 0; k < runLen; k++) pairedBaseIdx[runStart + k] = freeBase[k];
      }
      runStart = runEnd + 1;
    }
  }

  const closeBlocksDownTo = (targetIndent, forElse = false) => {
    while (blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1];
      if (forElse && top.indent === targetIndent) {
        blockStack.pop();
        return "else_merged";
      }
      if (targetIndent <= top.indent) {
        blockStack.pop();
        if (isBraceLang) {
          pushCompiledChunk(" ".repeat(top.indent) + "}", top.openerLine || 0);
        }
      } else {
        break;
      }
    }
    return null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const baseIdx = matchedBaseIdx[idx];

    // Baseline-protected line: untouched decompiled real-world code line
    if (
      baseIdx >= 0 &&
      baseline &&
      baseline.rawLines &&
      baseIdx < baseline.rawLines.length &&
      isBaselineRawLineValidForLang(baseline.rawLines[baseIdx], l)
    ) {
      const origRawLine = baseline.rawLines[baseIdx];
      const openerIdx = baseline.matchedOpener ? baseline.matchedOpener[baseIdx] : -1;
      const isCloserLine = openerIdx >= 0 || /^[}\])]+[,;]?$/.test(origRawLine.trim());

      // If closer's opener was edited or removed by user, skip orphan closer
      if (openerIdx >= 0 && !alignedBaseSet.has(openerIdx)) {
        lineMap.set(lineNum, { rawLine: "", isBaselineKept: true, ok: true, unknownWords: [] });
        continue;
      }

      if (origRawLine.trim() || isCloserLine) {
        const rawIndentM = origRawLine.match(/^(\s*)/);
        const rawIndentLen = rawIndentM ? rawIndentM[1].length : 0;
        if (!/^\}\s*else\b/.test(origRawLine.trim())) {
          closeBlocksDownTo(rawIndentLen, false);
        }
      }
      pushCompiledChunk(origRawLine, lineNum);
      lineOrigin[idx] = { origin: "decomp", rawIndex: baseIdx };
      lineMap.set(lineNum, {
        rawLine: origRawLine.trim(),
        isBaselineKept: true,
        isRawKept: Boolean(baseRawKept[baseIdx]),
        ok: true,
        unknownWords: []
      });
      continue;
    }

    const rawNatural = lines[idx];
    const indentM = rawNatural.match(/^(\s*)/);
    const indentStr = indentM ? indentM[1] : "";
    const indentLen = indentStr.length;
    const trimmed = rawNatural.trim();
    const pairIdx = pairedBaseIdx[idx];
    lineOrigin[idx] = { origin: "user", rawIndex: pairIdx };
    if (trimmed) dirtyLineIndices.add(idx);

    if (!trimmed) {
      pushCompiledChunk("", lineNum);
      lineMap.set(lineNum, { rawLine: "", isRawKept: false, ok: true, unknownWords: [] });
      continue;
    }

    const keepPairedRawLine = () => {
      if (pairIdx < 0) return "";
      const origRawLine = String(baseline.rawLines[pairIdx] || "");
      alignedBaseSet.add(pairIdx);
      const origTrim = origRawLine.trim();
      if (origTrim && !/^\}\s*else\b/.test(origTrim)) {
        const origIndentM = origRawLine.match(/^(\s*)/);
        closeBlocksDownTo(origIndentM ? origIndentM[1].length : 0, false);
      }
      pushCompiledChunk(origRawLine, lineNum);
      return origTrim;
    };
    const markFailedLine = (unknownWords) => {
      const keptRaw = keepPairedRawLine();
      lineMap.set(lineNum, {
        rawLine: keptRaw,
        isRawKept: false,
        ok: false,
        failed: true,
        unknownWords: unknownWords || []
      });
    };

    // Edited raw-kept line: the view already showed code, so the edit is code.
    const outsideQuotes = trimmed.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "");
    const editedAsCode = mode === "ko" ? !/[가-힣]/.test(outsideQuotes) : looksLikeCodeLine(trimmed);
    if (pairIdx >= 0 && baseRawKept[pairIdx] && editedAsCode) {
      alignedBaseSet.add(pairIdx);
      closeBlocksDownTo(indentLen, false);
      pushCompiledChunk(rawNatural, lineNum);
      lineMap.set(lineNum, { rawLine: trimmed, isRawKept: true, ok: true, unknownWords: [] });
      continue;
    }

    if (!/^(?:#|\/\/|주석\s|메모\s|note\b|comment\b)/i.test(trimmed) && !hasBalancedUserBrackets(trimmed)) {
      markFailedLine([]);
      continue;
    }

    // Check rawKept passthrough first
    if (rawKeptSet && rawKeptSet.has(trimmed)) {
      closeBlocksDownTo(indentLen, false);
      pushCompiledChunk(rawNatural, lineNum);
      if (isBraceLang && trimmed.endsWith("{") && !trimmed.startsWith("//") && !trimmed.startsWith("#")) {
        blockStack.push({ indent: indentLen, openerLine: lineNum });
      }
      lineMap.set(lineNum, { rawLine: rawNatural, isRawKept: true, ok: true, unknownWords: [] });
      continue;
    }

    // Validate against strict DB lexicon for user-edited / typed natural lines
    const validation = validateNaturalLineTokens(rawNatural, mode, rawKeptSet);
    if (!validation.ok) {
      for (const u of validation.unknownWords) {
        diagnostics.push({
          lineNumber: lineNum,
          startCol: u.startCol,
          endCol: u.endCol,
          word: u.word,
          message:
            mode === "en"
              ? `Unregistered word '${u.word}' (Only words in Vocab DB are allowed)`
              : `DB 미등록 단어 '${u.word}' (사전 DB에 등재된 단어만 사용 가능)`
        });
      }
    }

    const applied = applyUserNaturalLine(trimmed, l, mode, ctx, { isPairedBaselineLine: pairIdx >= 0 });
    if (!applied || !applied.code) {
      markFailedLine(validation.ok ? [] : validation.unknownWords);
      continue;
    }

    const mergedElse = applied.closesPrevBlock
      ? closeBlocksDownTo(indentLen, true)
      : (applied.matchedPattern !== "comment" ? closeBlocksDownTo(indentLen, false) : null);
    let emitText = applied.code;
    if (mergedElse === "else_merged" && isBraceLang) {
      emitText = emitText.replace(/^(else\b)/, "} $1");
    }
    const indentedOut = emitText
      .split("\n")
      .map((subLn) => indentStr + subLn)
      .join("\n");
    pushCompiledChunk(indentedOut, lineNum);
    if (isBraceLang && applied.opensBlock) {
      blockStack.push({ indent: indentLen, openerLine: lineNum });
    }
    lineMap.set(lineNum, {
      rawLine: applied.code.split("\n")[0],
      fullCompiled: indentedOut,
      isRawKept: false,
      ok: true,
      unknownWords: []
    });
  }

  closeBlocksDownTo(-1, false);

  return {
    rawCode: compiledLines.join("\n"),
    lineMap,
    rawLineToNaturalLine,
    diagnostics,
    dirtyLineIndices,
    lineOrigin
  };
}

if (typeof window !== "undefined") {
  window.summarizeCodeLineToKorean = summarizeCodeLineToKorean;
  window.summarizeFullCodeToKorean = summarizeFullCodeToKorean;
  window.summarizeCodeLineToEnglish = summarizeCodeLineToEnglish;
  window.summarizeFullCodeToEnglish = summarizeFullCodeToEnglish;
  window.parseEnglishSentenceToCode = parseEnglishSentenceToCode;
  window.parseNaturalSentenceToCode = parseNaturalSentenceToCode;
  window.isRegisteredDbWord = isRegisteredDbWord;
  window.validateNaturalLineTokens = validateNaturalLineTokens;
  window.decompileCodeToNaturalText = decompileCodeToNaturalText;
  window.compileNaturalTextToCode = compileNaturalTextToCode;
  window.composeNaturalTokensToCode = composeNaturalTokensToCode;
  window.lookupNaturalWordToCode = lookupNaturalWordToCode;
  window.emitPrintCall = emitPrintCall;
  window.emitCallShape = emitCallShape;
  window.parenShapeOk = parenShapeOk;
  window.commitRunnableLine = commitRunnableLine;
  window.RUNNABLE_BY_LANG = RUNNABLE_BY_LANG;
  window.detectKoPrintOp = detectKoPrintOp;
  window.detectEnPrintOp = detectEnPrintOp;
  window.naturalPrintVerb = naturalPrintVerb;
  window.decompileCodeLineToNatural = decompileCodeLineToNatural;
  window.isWholeLineQuotedString = isWholeLineQuotedString;
  window.looksLikeCodeLine = looksLikeCodeLine;
}

function syncEditorModelLanguage() {
  if (!editor || !window.monaco || !monaco.editor) return;
  const model = editor.getModel();
  if (!model) return;
  const targetLang = displayMode === "raw" ? currentLang : "plaintext";
  if (model.getLanguageId && model.getLanguageId() !== targetLang) {
    monaco.editor.setModelLanguage(model, targetLang);
  } else if (!model.getLanguageId) {
    monaco.editor.setModelLanguage(model, targetLang);
  }
}

function appendNaturalTokenDecorations(lineNumber, lineText, isBaselineLine, newDecorations) {
  const protectedIntervals = getProtectedIntervalsForLine(lineText, currentLang);
  const tokenRe = /[가-힣]+|[A-Za-z_][A-Za-z0-9_]*/g;
  let m;
  while ((m = tokenRe.exec(lineText)) !== null) {
    const word = m[0];
    const startIdx = m.index;
    const endIdx = startIdx + word.length;
    if (isOffsetInsideIntervals(startIdx, protectedIntervals)) continue;
    const isRecognized = isBaselineLine
      ? (/[가-힣]/.test(word) || isRegisteredDbWord(word, displayMode))
      : isRegisteredDbWord(word, displayMode);
    if (isRecognized) {
      newDecorations.push({
        range: new monaco.Range(lineNumber, startIdx + 1, lineNumber, endIdx + 1),
        options: { inlineClassName: "tran-natural-code-token" }
      });
    }
  }
}

function updateMasks() {
  if (!editor) return;
  const model = editor.getModel();
  if (!model) return;

  // Raw mode: clear all natural diagnostics & visual masks
  if (displayMode === "raw") {
    currentRawLineMap = new Map();
    currentNaturalDiagnostics = [];
    activeDecorations = editor.deltaDecorations(activeDecorations, []);
    window.activeDecorations = activeDecorations;
    return;
  }

  const activeTab = getActiveTab();
  const rawKeptSet = (activeTab && activeTab.rawKeptSet) || null;
  const lineCount = model.getLineCount();
  const visibleRanges = editor.getVisibleRanges();
  const scanRanges = [];

  if (visibleRanges && visibleRanges.length > 0) {
    for (const r of visibleRanges) {
      const start = Math.max(1, r.startLineNumber - 80);
      const end = Math.min(lineCount, r.endLineNumber + 80);
      if (scanRanges.length > 0 && start <= scanRanges[scanRanges.length - 1].end) {
        scanRanges[scanRanges.length - 1].end = Math.max(scanRanges[scanRanges.length - 1].end, end);
      } else {
        scanRanges.push({ start, end });
      }
    }
  } else {
    scanRanges.push({ start: 1, end: Math.min(lineCount, 300) });
  }

  const newDecorations = [];
  const unknownHintPrefix = displayMode === "en" ? "   Not in DB: " : "   DB 미등록: ";
  const rawKeptLabel = displayMode === "en" ? "   [Raw Kept]" : "   [원문 유지]";

  for (const rangeSpan of scanRanges) {
    for (let lineNumber = rangeSpan.start; lineNumber <= rangeSpan.end; lineNumber++) {
      const lineText = model.getLineContent(lineNumber);
      if (!lineText.trim()) continue;

      const lineInfo = currentRawLineMap.get(lineNumber);
      const isNaturalComment = /^(?:#|\/\/|주석\s|메모\s|note\b|comment\b)/i.test(lineText.trim());
      if (isNaturalComment) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, lineText.length + 1),
          options: { inlineClassName: "tran-natural-comment-line" }
        });
        continue;
      }

      if (lineInfo && lineInfo.isBaselineKept && lineInfo.isRawKept) {
        const endCol = lineText.length + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
          options: {
            after: {
              content: rawKeptLabel,
              inlineClassName: "tran-raw-kept-hint"
            }
          }
        });
        continue;
      }

      if (lineInfo && lineInfo.isBaselineKept) {
        appendNaturalTokenDecorations(lineNumber, lineText, true, newDecorations);
        if (showInlineSentenceSummary && lineInfo.rawLine) {
          const endCol = lineText.length + 1;
          newDecorations.push({
            range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
            options: {
              after: {
                content: "   ➔ " + lineInfo.rawLine,
                inlineClassName: "tran-compiled-ok-hint"
              }
            }
          });
        }
        continue;
      }
      const validation = validateNaturalLineTokens(lineText, displayMode, rawKeptSet);

      if (validation.isRawKept || (lineInfo && lineInfo.isRawKept)) {
        const endCol = lineText.length + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
          options: {
            after: {
              content: rawKeptLabel,
              inlineClassName: "tran-raw-kept-hint"
            }
          }
        });
        continue;
      }

      appendNaturalTokenDecorations(lineNumber, lineText, false, newDecorations);

      if (!validation.ok && validation.unknownWords.length > 0) {
        for (const u of validation.unknownWords) {
          newDecorations.push({
            range: new monaco.Range(lineNumber, u.startCol, lineNumber, u.endCol),
            options: {
              inlineClassName: "tran-db-unknown-word",
              hoverMessage: {
                value:
                  displayMode === "en"
                    ? `**Unregistered word:** \`${u.word}\` is not in the Vocab DB.`
                    : `**미등록 단어:** \`${u.word}\` 은(는) 단어 DB에 등재되지 않아 코드로 변환할 수 없습니다.`
              }
            }
          });
        }
        const endCol = lineText.length + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
          options: {
            after: {
              content: unknownHintPrefix + validation.unknownWords.map((u) => u.word).join(", "),
              inlineClassName: "tran-db-error-hint"
            }
          }
        });
        continue;
      }

      if (lineInfo && lineInfo.failed) {
        const endCol = lineText.length + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
          options: {
            after: {
              content: displayMode === "en" ? "   [Not converted to code]" : "   [코드로 변환 안 됨]",
              inlineClassName: "tran-db-error-hint"
            }
          }
        });
        continue;
      }

      if (showInlineSentenceSummary && lineInfo && lineInfo.rawLine) {
        const endCol = lineText.length + 1;
        newDecorations.push({
          range: new monaco.Range(lineNumber, endCol, lineNumber, endCol),
          options: {
            after: {
              content: "   ➔ " + lineInfo.rawLine,
              inlineClassName: "tran-compiled-ok-hint"
            }
          }
        });
      }
    }
  }

  activeDecorations = editor.deltaDecorations(activeDecorations, newDecorations);
  window.activeDecorations = activeDecorations;
}

// ============================================================================
// ENGINE 2: Single-Pass Atomic Bidirectional Input Engine (Natural -> Code)
// ============================================================================

const DELIMITER_REGEX = /^[\s\(\)\[\]\{\}:;,\.\+\-\*\/=<>!]+$/;

function lookupNaturalWordToCode(naturalWord) {
  if (!naturalWord) return null;
  const raw = String(naturalWord).trim();
  if (!raw) return null;
  const grammarProtected = isGrammarProtectedNatural(raw);
  const low = raw.toLowerCase();

  const fromOwner = (owner) => {
    if (!owner || owner.glossOnly) return null;
    return sanitizeMappedCode(owner.code);
  };

  // 1. Exclusive synonym / grammar owner maps (never gloss-only descriptions)
  if (typeof SYNONYM_TO_OWNER_KO !== "undefined" && SYNONYM_TO_OWNER_KO.has(raw)) {
    const mapped = fromOwner(SYNONYM_TO_OWNER_KO.get(raw));
    if (mapped) return mapped;
  }
  if (typeof SYNONYM_TO_OWNER_EN !== "undefined" && SYNONYM_TO_OWNER_EN.has(low)) {
    const mapped = fromOwner(SYNONYM_TO_OWNER_EN.get(low));
    if (mapped) return mapped;
  }

  // 2. Strict 1:1 dictionary reverse indices
  if (dictPack && dictPack.maps) {
    if (dictPack.maps.ko_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.ko_to_code, raw)) {
      const mapped = sanitizeMappedCode(dictPack.maps.ko_to_code[raw]);
      if (mapped) return mapped;
    }
    if (dictPack.maps.en_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.en_to_code, raw)) {
      const mapped = sanitizeMappedCode(dictPack.maps.en_to_code[raw]);
      if (mapped) return mapped;
    }
    if (dictPack.maps.en_to_code && Object.prototype.hasOwnProperty.call(dictPack.maps.en_to_code, low)) {
      const mapped = sanitizeMappedCode(dictPack.maps.en_to_code[low]);
      if (mapped) return mapped;
    }
  }

  // 3. Identity: the typed token is itself a real code token
  if (isRealCodeToken(raw)) return raw;
  if (raw !== low && isRealCodeToken(low)) return low;

  // 4. User-learned last — grammar words (만약, if, 출력, …) always win
  if (!grammarProtected) {
    const learnedCode = sanitizeMappedCode(lookupUserLearnedCode(raw, currentLang));
    if (learnedCode) return learnedCode;
  }
  return null;
}

function tryConvertNaturalWordBeforeDelimiter(change) {
  // Dual-Buffer Engine: in KO/EN natural modes, keep symbol-free natural text in the editor
  // and let syncNaturalEditorToRawBuffer() compile background tab.rawCode cleanly.
  if (displayMode === "ko" || displayMode === "en") return;

  const model = editor.getModel();
  if (!model) return;

  const insertedText = change.text;
  if (!insertedText || !DELIMITER_REGEX.test(insertedText)) return;

  const lineNumber = change.range.startLineNumber;
  const lineContent = model.getLineContent(lineNumber);

  // If user pressed Enter at the end of a line matching a Korean word-order sentence pattern, convert full sentence
  if (insertedText.includes("\n")) {
    const leadingIndent = lineContent.match(/^\s*/)[0] || "";
    const composed = parseKoreanSentenceToCode(lineContent.trim(), currentLang);
    if (composed && composed.code) {
      const indentedCode = composed.code.split("\n").map((ln, idx) => (idx === 0 ? ln : leadingIndent + ln)).join("\n");
      isInternalReplacement = true;
      try {
        editor.executeEdits("tran-sentence-composer", [{
          range: new monaco.Range(lineNumber, leadingIndent.length + 1, lineNumber, lineContent.length + 1),
          text: indentedCode,
          forceMoveMarkers: true
        }]);
        logConsole(`한국어 어순 문장 변환 (${composed.titleKo}): "${lineContent.trim()}"`, "conv");
      } finally {
        isInternalReplacement = false;
      }
      return;
    }
  }

  // While actively typing a multi-word Korean sentence (before completion), avoid prematurely breaking sentence keywords on Space
  if (/^\s+$/.test(insertedText) && /(?:^만약\b|에\s|에서\s|골라서|하나씩|번\s*반복)/.test(lineContent.trim())) {
    return;
  }

  // Protect strings and comments from accidental natural word conversion
  const protectedIntervals = getProtectedIntervalsForLine(lineContent, currentLang);

  // Scan all tokens on the line (including functions/arguments inside parentheses)
  const tokenRegex = /[A-Za-z0-9_가-힣ぁ-んァ-ン一-龥]+/g;
  const edits = [];
  const convertedPairs = [];
  let match;

  while ((match = tokenRegex.exec(lineContent)) !== null) {
    const token = match[0];
    const startOffset = match.index;
    const endOffset = startOffset + token.length;

    if (isOffsetInsideIntervals(startOffset, protectedIntervals)) {
      continue;
    }

    const matchedCode = lookupNaturalWordToCode(token);
    if (!matchedCode || matchedCode === token) {
      continue;
    }

    edits.push({
      range: new monaco.Range(lineNumber, startOffset + 1, lineNumber, endOffset + 1),
      text: matchedCode,
      forceMoveMarkers: true
    });
    convertedPairs.push(`"${token}" ➔ "${matchedCode}"`);
  }

  if (edits.length === 0) return;

  // Atomic Single-Pass Replacement across the line (including inside parentheses)
  isInternalReplacement = true;
  try {
    editor.executeEdits("tran-bidirectional-input", edits);
    logConsole(
      `쌍방향 입력 변환: ${convertedPairs.join(", ")}`,
      "conv"
    );
  } finally {
    isInternalReplacement = false;
  }
}

function extractHangulChoseongString(str) {
  if (!str) return "";
  const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += initials[Math.floor((code - 0xac00) / 588)] || str[i];
    } else {
      out += str[i];
    }
  }
  return out;
}

function rebuildCompletionIndex() {
  completionIndex = [];
  hoverMdCache.clear();
  const entries = (dictPack && dictPack.entries) || {};
  for (const [codeToken, tr] of Object.entries(entries)) {
    const koVal = (tr.ko || "").trim();
    const enVal = (tr.en || "").trim();
    completionIndex.push({
      codeToken,
      tr,
      koVal,
      enVal,
      codeL: codeToken.toLowerCase(),
      koL: koVal.toLowerCase(),
      enL: enVal.toLowerCase(),
      koChoseong: extractHangulChoseongString(koVal)
    });
  }
  // Pre-sort once per dictionary load
  const collKo = new Intl.Collator("ko-KR", { sensitivity: "base" });
  const collEn = new Intl.Collator("en", { sensitivity: "base" });
  const order = completionIndex.map((_, i) => i);
  completionOrderKo = order.slice().sort((a, b) => {
    const ra = completionIndex[a], rb = completionIndex[b];
    return collKo.compare(ra.koVal || ra.enVal || ra.codeToken, rb.koVal || rb.enVal || rb.codeToken) ||
      collEn.compare(ra.codeToken, rb.codeToken);
  });
  completionOrderEn = order.slice().sort((a, b) => {
    const ra = completionIndex[a], rb = completionIndex[b];
    return collEn.compare(ra.enVal || ra.codeToken, rb.enVal || rb.codeToken) ||
      collEn.compare(ra.codeToken, rb.codeToken);
  });
  if (!semanticIndexBuiltFromGlobal || !semanticInvertedIndex || semanticInvertedIndex.size === 0) {
    buildSemanticInvertedIndex();
  }
}

let completionOrderKo = [];
let completionOrderEn = [];
const COMPLETION_TOP_CAP = 200;
const COMPLETION_REST_CAP = 80;

function registerDictionaryCompletions() {
  if (!window.monaco || !monaco.languages) return;
  if (completionDisposable) {
    completionDisposable.dispose();
  }
  if (!completionCommandRegistered && monaco.editor && monaco.editor.registerCommand) {
    completionCommandRegistered = true;
    monaco.editor.registerCommand("tran.recordLearnedMapping", function (_, rawQuery, codeToken, lang) {
      if (rawQuery && codeToken) {
        recordUserLearnedMapping(rawQuery, codeToken, lang || currentLang);
      }
    });
  }
  configureMonacoNaturalWordPatterns();
  if (!completionIndex.length) {
    rebuildCompletionIndex();
  }

  const targetLang = displayMode === "raw" ? currentLang : "plaintext";
  completionDisposable = monaco.languages.registerCompletionItemProvider(targetLang, {
    provideCompletionItems: function (model, position) {
      const wordInfo = getNaturalWordUntilPosition(model, position);
      const typedRaw = wordInfo.word || "";
      const typedToken = typedRaw.trim().toLowerCase();
      const lineText = model.getLineContent(position.lineNumber) || "";
      const lineBeforeCursor = lineText.slice(0, Math.max(0, position.column - 1));
      const trimmedBeforeCursor = lineBeforeCursor.trimStart();
      const leadingSpacesLen = lineBeforeCursor.length - trimmedBeforeCursor.length;
      const charAfterCursor = lineText[position.column - 1] || "";

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn
      };

      const hideKo = uiLang === "en" && displayMode !== "ko";
      const isNaturalBufferMode = displayMode === "ko" || displayMode === "en";
      const useEnglishPrimary = displayMode === "en" || (displayMode !== "ko" && (hideKo || targetLocale === "none"));
      const suggestions = [];

      // Feature 2: Natural word-order sentence pattern completion (KO or EN)
      const composed = parseNaturalSentenceToCode(trimmedBeforeCursor, currentLang, displayMode);
      if (composed && composed.code) {
        const baseIndent = lineBeforeCursor.slice(0, leadingSpacesLen);
        if (isNaturalBufferMode) {
          suggestions.push({
            label: `${composed.titleEn || composed.titleKo}: ${trimmedBeforeCursor} ➔ ${composed.code.split("\n")[0]}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: trimmedBeforeCursor,
            sortText: "00000",
            filterText: trimmedBeforeCursor,
            detail: displayMode === "en"
              ? `[Natural Grammar Valid] Compiles to: ${composed.code.split("\n")[0]}`
              : `[자연어 어순 검증됨] 변환될 코드: ${composed.code.split("\n")[0]}`,
            documentation: { value: "```" + currentLang + "\n" + composed.code + "\n```" },
            preselect: true,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: leadingSpacesLen + 1,
              endColumn: position.column
            }
          });
        } else {
          const indentedSnippet = composed.snippet.split("\n").map((ln, i) => (i === 0 ? ln : baseIndent + ln)).join("\n");
          suggestions.push({
            label: `${composed.titleKo || composed.titleEn} ➔ ${composed.code.split("\n")[0]}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: indentedSnippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: "00000",
            filterText: trimmedBeforeCursor,
            detail: `[${composed.titleKo || composed.titleEn}] ${composed.descriptionKo || composed.descriptionEn || ""}`,
            documentation: { value: "```" + currentLang + "\n" + composed.code + "\n```" },
            preselect: true,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: leadingSpacesLen + 1,
              endColumn: position.column
            }
          });
        }
      }

      const queryStems = typedToken ? extractBilingualStems(typedToken) : [];
      const learnedRec = typedToken ? lookupUserLearnedRecord(typedToken, currentLang) : null;
      const learnedCodeL = learnedRec && learnedRec.code ? learnedRec.code.toLowerCase() : "";

      // O(1) lookup against offline POS Vocab DB for boost & registered-word hints
      const activeVocabMode = displayMode === "en" ? "en" : "ko";
      const vocabHit = typedToken ? (getVocabEntry(typedRaw.trim(), activeVocabMode) || getVocabEntry(queryStems[1] || "", activeVocabMode)) : null;
      const vocabBoostMap = new Map();
      if (vocabHit && Array.isArray(vocabHit.codes)) {
        vocabHit.codes.forEach(([cTok, cScore]) => {
          vocabBoostMap.set(String(cTok).toLowerCase(), Number(cScore) || 50);
        });
      }

      const candidates = [];
      const index = completionIndex.length ? completionIndex : [];
      const order = useEnglishPrimary ? completionOrderEn : completionOrderKo;
      const total = order.length === index.length ? order.length : index.length;
      const directSynOwner = typedToken
        ? (SYNONYM_TO_OWNER_KO.get(typedRaw.trim()) || SYNONYM_TO_OWNER_EN.get(typedToken) || null)
        : null;
      const effectiveLearnedCodeL = (directSynOwner && !directSynOwner.glossOnly) ? "" : learnedCodeL;

      for (let k = 0; k < total; k++) {
        const row = order.length === index.length ? index[order[k]] : index[k];
        if (!isNaturalBufferMode && typeof isBundleCodeRunnableInLang === "function" && !isBundleCodeRunnableInLang(row.codeToken, currentLang)) {
          continue;
        }
        // Always output ONE canonical natural word in natural mode ("일정 단어")
        const canonicalNat = useEnglishPrimary
          ? (CANONICAL_EN_BY_CODE.get(row.codeToken) || row.enVal || row.codeToken)
          : (CANONICAL_KO_BY_CODE.get(row.codeToken) || row.koVal || row.enVal || row.codeToken);
        const primaryNatural = canonicalNat;
        const primaryL = canonicalNat.toLowerCase();
        const bundleMeta = CODE_BUNDLES_BY_CODE.get(row.codeToken);
        const synList = bundleMeta ? (useEnglishPrimary ? bundleMeta.synonyms_en : bundleMeta.synonyms_ko) : [];

        let score = 0;
        let reasonTag = "";

        if (!typedToken) {
          score = 100;
        } else if (directSynOwner && !directSynOwner.glossOnly && directSynOwner.code === row.codeToken) {
          score = directSynOwner.isCanonical ? 2600 : 2400;
          reasonTag = displayMode === "en"
            ? (directSynOwner.isCanonical ? "Canonical" : `Synonym ➔ ${canonicalNat}`)
            : (directSynOwner.isCanonical ? "고정 대표어" : `유의어 ➔ ${canonicalNat}`);
        } else if (effectiveLearnedCodeL && row.codeL === effectiveLearnedCodeL) {
          score = 2500;
          reasonTag = displayMode === "en" ? "◆ Learned #1" : "◆ 내 학습 1순위";
        } else if (primaryL === typedToken || row.enL === typedToken || row.codeL === typedToken || (!hideKo && row.koL === typedToken)) {
          score = 1000 - row.codeToken.length;
        } else if (synList && synList.some((s) => s.toLowerCase().startsWith(typedToken))) {
          score = 920 - row.codeToken.length;
          const matchedSyn = synList.find((s) => s.toLowerCase().startsWith(typedToken));
          reasonTag = displayMode === "en" ? `Synonym (${matchedSyn})` : `유의어 (${matchedSyn} ➔ ${canonicalNat})`;
        } else if (primaryL.startsWith(typedToken) || row.enL.startsWith(typedToken) || row.codeL.startsWith(typedToken) || (!hideKo && (row.koL.startsWith(typedToken) || (row.koChoseong && row.koChoseong.startsWith(typedToken))))) {
          score = 840 - row.codeToken.length;
        } else {
          const synScore = computeSynonymClusterScore(queryStems, row.codeToken);
          if (synScore > 0) {
            score = synScore;
            reasonTag = displayMode === "en" ? "Exclusive Match" : "연관 묶음 추천";
          } else if (vocabBoostMap.has(row.codeL)) {
            score = 650 + Math.min(80, vocabBoostMap.get(row.codeL));
            reasonTag = displayMode === "en" ? `Vocab DB (${vocabHit.pos})` : `단어DB (${vocabHit.pos})`;
          } else if (row.codeL.startsWith(typedToken)) {
            score = 540;
          } else {
            const invScore = computeInvertedIndexScore(queryStems, row.codeToken);
            if (invScore > 0) {
              score = invScore;
              reasonTag = displayMode === "en" ? "Description Match" : "설명 키워드 추천";
            }
          }
        }

        if (score <= 0) continue;

        candidates.push({
          row,
          primaryNatural,
          synList,
          score,
          reasonTag,
          orderIdx: k
        });
      }

      candidates.sort((a, b) => b.score - a.score || a.orderIdx - b.orderIdx);
      const topSlice = candidates.slice(0, COMPLETION_REST_CAP);
      const offsetIdx = suggestions.length;

      if (isNaturalBufferMode && vocabHit) {
        const topLinkedCode = vocabHit.codes && vocabHit.codes[0] ? vocabHit.codes[0][0] : (vocabHit.varIdent || "var");
        suggestions.push({
          label: `[Vocab DB · ${vocabHit.pos}] ${vocabHit.word} (➔ ${vocabHit.varIdent || topLinkedCode})`,
          kind: monaco.languages.CompletionItemKind.Text,
          insertText: isNaturalBufferMode ? vocabHit.word : (topLinkedCode || vocabHit.word),
          sortText: "00001",
          filterText: `${typedRaw} ${vocabHit.word}`,
          detail: displayMode === "en"
            ? `DB Registered (${vocabHit.pos}) · var: ${vocabHit.varIdent || vocabHit.word} · top code: ${topLinkedCode}`
            : `DB 등재 단어 (${vocabHit.pos}) · 변수명: ${vocabHit.varIdent || vocabHit.word} · 연관 코드: ${topLinkedCode}`,
          range: range
        });
      }

      for (let i = 0; i < topSlice.length; i++) {
        const c = topSlice[i];
        const row = c.row;
        const skel = (isNaturalBufferMode || charAfterCursor === "(") ? null : buildSymbolSkeletonForCode(row.codeToken, currentLang);
        const filterParts = hideKo
          ? [typedRaw, c.primaryNatural, row.enVal, row.codeToken, ...(c.synList || [])]
          : [typedRaw, c.primaryNatural, row.koVal, row.enVal, row.codeToken, ...(c.synList || [])];

        const prefixLabel = c.reasonTag ? `[${c.reasonTag}] ` : "";
        const labelSuffix = skel ? `  [기호 자동: ${skel.preview.split("\n")[0]}]` : "";

        suggestions.push({
          label: `${prefixLabel}${c.primaryNatural} (${row.codeToken})${labelSuffix}`,
          kind: isNaturalBufferMode
            ? monaco.languages.CompletionItemKind.Text
            : (skel ? monaco.languages.CompletionItemKind.Snippet : monaco.languages.CompletionItemKind.Keyword),
          insertText: isNaturalBufferMode
            ? (naturalInsertForDictEntry(row.codeToken, row.tr, displayMode) || shortNaturalForCode(row.codeToken, displayMode) || c.primaryNatural)
            : (skel ? skel.snippet : adaptOpCodeToLang(row.codeToken, currentLang)),
          insertTextRules: (!isNaturalBufferMode && skel) ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          sortText: String(i + offsetIdx + 2).padStart(5, "0"),
          filterText: filterParts.filter(Boolean).join(" "),
          detail: hideKo
            ? `[1:1 Match] ${row.enVal} ➔ ${row.codeToken}`
            : `[${c.reasonTag || "1:1 자연어 사전"}] ${row.koVal} (${row.enVal}) ➔ ${row.codeToken}`,
          command: typedRaw
            ? { id: "tran.recordLearnedMapping", title: "Record Learned Word", arguments: [typedRaw, row.codeToken, currentLang] }
            : undefined,
          preselect: offsetIdx === 0 && i === 0,
          _codeToken: row.codeToken,
          _tr: row.tr,
          range: range
        });
      }

      return { suggestions, incomplete: candidates.length > COMPLETION_REST_CAP };
    },
    resolveCompletionItem: function (item) {
      if (item && item._codeToken && !item.documentation) {
        item.documentation = {
          value: hoverMarkdownForCode(item._codeToken) || formatWordHoverMarkdown(item._codeToken, {
            code: item._codeToken,
            entry: item._tr,
            scope: currentLang
          }),
          supportHtml: true,
          isTrusted: true
        };
      }
      return item;
    }
  });
}

// ============================================================================
// Event Wiring & UI Controls
// ============================================================================

function languageFromFileName(name) {
  const nameToInspect = String(name || "").toLowerCase();
  if (!nameToInspect) return null;
  if (nameToInspect.endsWith(".c") || nameToInspect.endsWith(".h")) return "c";
  if (nameToInspect.endsWith(".java")) return "java";
  if (nameToInspect.endsWith(".py")) return "python";
  if (
    nameToInspect.endsWith(".ts") ||
    nameToInspect.endsWith(".tsx") ||
    nameToInspect.endsWith(".mts") ||
    nameToInspect.endsWith(".cts")
  ) {
    return "typescript";
  }
  if (
    nameToInspect.endsWith(".js") ||
    nameToInspect.endsWith(".mjs") ||
    nameToInspect.endsWith(".cjs") ||
    nameToInspect.endsWith(".jsx")
  ) {
    return "javascript";
  }
  if (nameToInspect.endsWith(".kt") || nameToInspect.endsWith(".kts")) return "kotlin";
  if (nameToInspect.endsWith(".swift")) return "swift";
  return null;
}

function applyExtensionLanguage(tab) {
  if (!tab) return null;
  const fromExt = languageFromFileName(tab.path || tab.name);
  if (fromExt) {
    tab.language = fromExt;
    return fromExt;
  }
  return tab.language || null;
}

const AMBIGUOUS_IDENTIFIER_WORDS = new Set([
  "result", "res", "ret", "data", "value", "values", "val", "item", "items",
  "index", "idx", "pos", "count", "name", "text", "str", "num", "line", "lines",
  "key", "keys", "node", "size", "length", "width", "height", "start", "end",
  "min", "max", "sum", "temp", "tmp", "obj", "arr", "msg", "err", "error",
  "info", "flag", "ok", "id", "main", "test", "demo", "app", "user", "file",
  "path", "url", "time", "date", "state", "mode", "code", "status", "config",
  "options", "args", "kwargs", "self", "this", "new", "get", "set", "add",
  "run", "init", "open", "close", "read", "write", "send", "load", "save",
  "update", "delete", "create", "check", "find", "show", "hide", "log", "out",
  "in", "to", "from", "of", "by", "on", "at", "is", "as", "or", "and", "not",
  "do", "go", "fn", "cb", "el", "ev", "ex", "db", "io", "ui", "api", "arg",
]);

let langExclusivityIndex = Object.create(null);

function buildLanguageExclusivityIndex() {
  const index = Object.create(null);
  const scopes = ["c", "java", "python", "javascript", "typescript", "kotlin", "swift"];
  const commonEntries = (allCartridgesCache.common && allCartridgesCache.common.entries) || {};
  const commonTokens = new Set();

  for (const [codeKey, tr] of Object.entries(commonEntries)) {
    if (codeKey) commonTokens.add(codeKey.trim());
    if (tr && typeof tr === "object") {
      if (tr.ko) commonTokens.add(String(tr.ko).trim());
      if (tr.en) commonTokens.add(String(tr.en).trim());
    }
  }

  const koNounSkip = new Set();
  if (typeof KO_NOUN_TO_IDENT !== "undefined" && KO_NOUN_TO_IDENT) {
    for (const val of Object.values(KO_NOUN_TO_IDENT)) {
      if (typeof val === "string") {
        koNounSkip.add(val.trim().toLowerCase());
      } else if (val && typeof val === "object") {
        if (val.single) koNounSkip.add(String(val.single).trim().toLowerCase());
        if (val.plural) koNounSkip.add(String(val.plural).trim().toLowerCase());
      }
    }
  }

  const addToken = (rawToken, lang) => {
    if (!rawToken || typeof rawToken !== "string") return;
    const tok = rawToken.trim();
    const lowerTok = tok.toLowerCase();
    if (tok.length < 2 || commonTokens.has(tok)) return;
    if (AMBIGUOUS_IDENTIFIER_WORDS.has(lowerTok) || koNounSkip.has(lowerTok)) return;
    if (!index[tok]) {
      index[tok] = new Set();
    }
    index[tok].add(lang);
  };

  for (const lang of scopes) {
    const entries = (allCartridgesCache[lang] && allCartridgesCache[lang].entries) || {};
    for (const [codeKey, tr] of Object.entries(entries)) {
      addToken(codeKey, lang);
      if (tr && typeof tr === "object") {
        if (tr.ko && /[가-힣]/.test(tr.ko)) {
          addToken(String(tr.ko), lang);
        }
        if (tr.en && tr.en !== codeKey && String(tr.en).includes("_")) {
          addToken(String(tr.en), lang);
        }
      }
    }
  }

  langExclusivityIndex = index;
  return langExclusivityIndex;
}

function stripCommentsAndStringsForDetection(src) {
  if (!src) return "";
  return src.replace(
    /(^[ \t]*#[ \t]*(?:include|define|ifdef|ifndef|endif|pragma)\b.*)|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/.*|#.*$/gm,
    (match, cppDirective) => (cppDirective ? cppDirective : " ")
  );
}

function markTabNaturalEdited(tab = getActiveTab()) {
  if (!tab) return;
  tab.userEditedNatural = true;
  tab.isDirty = true;
}

function resetTabNaturalEditState(tab, { clearDirty = false } = {}) {
  if (!tab) return;
  tab.userEditedNatural = false;
  if (clearDirty) tab.isDirty = false;
}

function getTabRawCode(tab) {
  if (!tab) return "";
  return tab.rawCode !== undefined ? tab.rawCode : (tab.content ?? "");
}

function getActiveRawCode() {
  if (displayMode === "raw" && editor) {
    return editor.getValue();
  }
  const activeTab = getActiveTab();
  if ((displayMode === "ko" || displayMode === "en") && editor && activeTab && !isSwitchingTab) {
    if (!activeTab.userEditedNatural) {
      return getTabRawCode(activeTab);
    }
    const preview = syncNaturalEditorToRawBuffer({ commit: false });
    if (preview && typeof preview.rawCode === "string") {
      return preview.rawCode;
    }
  }
  if (activeTab) {
    return getTabRawCode(activeTab);
  }
  return editor ? editor.getValue() : "";
}
if (typeof window !== "undefined") window.getActiveRawCode = getActiveRawCode;

function syncNaturalEditorToRawBuffer({ commit = true } = {}) {
  if (!editor) return null;
  if (displayMode !== "ko" && displayMode !== "en") {
    const activeTab = getActiveTab();
    const raw = editor.getValue();
    if (activeTab && commit && raw !== getTabRawCode(activeTab)) {
      activeTab.rawCode = raw;
      activeTab.content = raw;
      activeTab.isDirty = true;
      activeTab.naturalCache = {};
      activeTab.naturalCompiledSig = {};
      activeTab.dualBaseline = {};
    }
    currentRawLineMap = new Map();
    currentNaturalDiagnostics = [];
    return { rawCode: raw, lineMap: currentRawLineMap, diagnostics: currentNaturalDiagnostics };
  }

  const activeTab = getActiveTab();
  const natText = editor.getValue();
  const baseline = (activeTab && activeTab.dualBaseline && activeTab.dualBaseline[displayMode]) || null;
  if (!activeTab || !baseline) {
    currentRawLineMap = new Map();
    currentNaturalDiagnostics = [];
    if (activeTab) activeTab.lineOrigin = [];
    return {
      rawCode: activeTab ? getTabRawCode(activeTab) : "",
      lineMap: currentRawLineMap,
      diagnostics: currentNaturalDiagnostics
    };
  }
  const rawKeptSet = activeTab.rawKeptSet || null;
  const compiled = compileNaturalTextToCode(natText, currentLang, displayMode, rawKeptSet, baseline);

  currentRawLineMap = compiled.lineMap;
  currentNaturalDiagnostics = compiled.diagnostics;
  activeTab.lineOrigin = compiled.lineOrigin || [];
  activeTab.rawLineToNaturalLine = compiled.rawLineToNaturalLine || new Map();

  // Guardrail: never overwrite rawCode unless the user actually edited the natural buffer.
  if (!activeTab.userEditedNatural) {
    if (typeof window !== "undefined") {
      window.currentNaturalDiagnostics = currentNaturalDiagnostics;
      window.currentRawLineMap = currentRawLineMap;
    }
    return {
      rawCode: getTabRawCode(activeTab),
      lineMap: currentRawLineMap,
      diagnostics: currentNaturalDiagnostics,
      dirtyLineIndices: compiled.dirtyLineIndices,
      lineOrigin: compiled.lineOrigin
    };
  }

  if (commit) {
    activeTab.rawCode = compiled.rawCode;
    activeTab.content = compiled.rawCode;
    activeTab.isDirty = true;
    if (!activeTab.naturalCache) activeTab.naturalCache = {};
    if (!activeTab.naturalCompiledSig) activeTab.naturalCompiledSig = {};
    activeTab.naturalCache[displayMode] = natText;
    activeTab.naturalCompiledSig[displayMode] = compiled.rawCode;
    activeTab.dirtyNaturalLines = compiled.dirtyLineIndices || new Set();
  }

  if (typeof window !== "undefined") {
    window.currentNaturalDiagnostics = currentNaturalDiagnostics;
    window.currentRawLineMap = currentRawLineMap;
  }
  return compiled;
}

function getEditorBufferForMode(tab, mode = displayMode) {
  const raw = getTabRawCode(tab);
  if (mode !== "ko" && mode !== "en") {
    return raw;
  }
  if (!tab.naturalCache) tab.naturalCache = {};
  if (!tab.naturalCompiledSig) tab.naturalCompiledSig = {};
  if (!tab.rawKeptSetByMode) tab.rawKeptSetByMode = {};
  if (!tab.dualBaseline) tab.dualBaseline = {};

  const tabCodegenLang = codegenLang((tab && tab.language) || currentLang);
  if (
    tab.naturalCache[mode] !== undefined &&
    tab.naturalCompiledSig[mode] === raw &&
    tab.dualBaseline[mode] &&
    tab.dualBaseline[mode].lang === tabCodegenLang
  ) {
    tab.rawKeptSet = tab.rawKeptSetByMode[mode] || new Set();
    return tab.naturalCache[mode];
  }

  const dec = decompileCodeToNaturalText(raw, (tab && tab.language) || currentLang, mode);
  tab.rawKeptSet = dec.rawKeptLines;
  tab.rawKeptSetByMode[mode] = dec.rawKeptLines;
  tab.dualBaseline[mode] = {
    lang: tabCodegenLang,
    sourceRaw: raw,
    rawLines: dec.rawLines,
    naturalLines: dec.naturalLines,
    rawKeptFlags: dec.rawKeptFlags,
    matchedOpener: dec.matchedOpener,
    usedVocab: dec.usedVocab
  };
  tab.naturalCache[mode] = dec.text;
  tab.naturalCompiledSig[mode] = raw;
  tab.userEditedNatural = false;
  tab.dirtyNaturalLines = new Set();
  return dec.text;
}

async function switchDisplayMode(newMode, persist = true) {
  clearRuntimeErrorMarkers();
  const targetMode = newMode === "raw" || newMode === "en" || newMode === "ko" ? newMode : "ko";
  const activeTab = getActiveTab();

  // Flush current editor buffer before leaving previous mode
  let langChanged = false;
  if (editor && activeTab && !isSwitchingTab) {
    if (displayMode === "raw") {
      const raw = editor.getValue();
      const rawChanged = raw !== getTabRawCode(activeTab);
      if (rawChanged) {
        activeTab.rawCode = raw;
        activeTab.content = raw;
        activeTab.isDirty = true;
        activeTab.naturalCache = {};
        activeTab.naturalCompiledSig = {};
        activeTab.dualBaseline = {};
        const det = detectTabLanguageDetailed(activeTab);
        if (det && det.syntaxScore >= 8 && det.language && det.language !== currentLang) {
          activeTab.language = det.language;
          currentLang = det.language;
          window.currentLang = det.language;
          const langSelect = document.getElementById("lang-select");
          if (langSelect) langSelect.value = det.language;
          langChanged = true;
        }
      }
    } else if (activeTab.userEditedNatural) {
      syncNaturalEditorToRawBuffer({ commit: true });
    }
    if (targetMode === "raw") {
      resetTabNaturalEditState(activeTab);
    }
  }

  displayMode = targetMode;
  window.displayMode = targetMode;
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-mode") === targetMode);
  });

  if (langChanged) {
    await loadLanguageCartridge(currentLang);
  }
  if ((targetMode === "ko" || targetMode === "en") && (!vocabLexicon[targetMode] || Object.keys(vocabLexicon[targetMode]).length === 0)) {
    await loadVocabLexicon(targetMode);
  }

  if (editor && activeTab) {
    isSwitchingTab = true;
    try {
      syncEditorModelLanguage();
      const nextText = getEditorBufferForMode(activeTab, targetMode);
      editor.setValue(nextText);
      adoptEditorNaturalCache(activeTab, targetMode);
    } finally {
      isSwitchingTab = false;
    }
    if (targetMode !== "ko" && targetMode !== "en") {
      currentRawLineMap = new Map();
      currentNaturalDiagnostics = [];
    }
    registerDictionaryCompletions();
    registerDictionaryHover();
    refreshAllViews();
  }

  if (persist) {
    saveWorkspaceState();
  }
}
if (typeof window !== "undefined") window.switchDisplayMode = switchDisplayMode;

function detectTabLanguageDetailed(tab) {
  const fromExt = languageFromFileName(tab && (tab.path || tab.name));

  const activeTab = getActiveTab();
  const isCurrentActiveTab = activeTab && tab && activeTab.id === tab.id;
  let sample = "";
  if (isCurrentActiveTab && displayMode === "raw" && editor && editor.getModel()) {
    const model = editor.getModel();
    const maxLine = Math.min(80, model.getLineCount());
    sample = model.getValueInRange(new monaco.Range(1, 1, maxLine, 300)).slice(0, 4000);
  } else if (tab) {
    sample = getTabRawCode(tab).slice(0, 4000);
  }

  const scores = { c: 0, java: 0, python: 0, javascript: 0, typescript: 0, kotlin: 0, swift: 0 };
  const syntax = { c: 0, java: 0, python: 0, javascript: 0, typescript: 0, kotlin: 0, swift: 0 };
  const addSyn = (lg, pts) => {
    scores[lg] += pts;
    syntax[lg] += pts;
  };

  const cleaned = stripCommentsAndStringsForDetection(sample);
  if (cleaned.trim().length > 0) {
    // 1. Language-specific syntax signatures
    if (/#[ \t]*include[ \t]*[<"][^>"]+[>"]/.test(cleaned)) addSyn("c", 8);
    if (/#[ \t]*define[ \t]+[A-Za-z_][A-Za-z0-9_]*/.test(cleaned)) addSyn("c", 6);
    if (/\b(?:int|void|char)[ \t]+main[ \t]*\(/.test(cleaned)) addSyn("c", 8);
    if (/\b(?:printf|scanf|fprintf|sscanf|snprintf|malloc|calloc|realloc|free)[ \t]*\(/.test(cleaned)) addSyn("c", 6);
    if (/\btypedef[ \t]+struct\b|\bstruct[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\{|\b(?:FILE|size_t)[ \t]*\*|\b[a-z_][a-z0-9_]*->[a-z_][a-z0-9_]*/.test(cleaned)) addSyn("c", 7);

    if (/\bpublic[ \t]+static[ \t]+void[ \t]+main[ \t]*\(/.test(cleaned)) addSyn("java", 10);
    if (/\bpublic[ \t]+(?:class|interface|enum|record)[ \t]+[A-Za-z_]/.test(cleaned)) addSyn("java", 8);
    if (/\bSystem\.(?:out|err)\.print(?:ln|f)?[ \t]*\(|\bimport[ \t]+java\.[a-z0-9_.*]+;/.test(cleaned)) addSyn("java", 8);
    if (/@Override\b|\bpackage[ \t]+[a-z0-9_.]+;|\b(?:ArrayList|HashMap|HashSet|LinkedList|StringBuilder)</.test(cleaned)) addSyn("java", 7);

    if (/\bdef[ \t]+[a-zA-Z_][a-zA-Z0-9_]*[ \t]*\([^)]*\)[ \t]*(?:->[^:{]+)?[ \t]*:/.test(cleaned)) addSyn("python", 8);
    if (/\belif\b[^:{]*:|\bfrom[ \t]+[a-zA-Z_][a-zA-Z0-9_.]*[ \t]+import\b/.test(cleaned)) addSyn("python", 8);
    if (/\bclass[ \t]+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?[ \t]*:|\bfor[ \t]+[a-zA-Z_][a-zA-Z0-9_, \t]*[ \t]+in[ \t]+[^({;]+:/.test(cleaned)) addSyn("python", 7);
    if (/\b(?:except|finally)[ \t]*(?:[A-Za-z_][A-Za-z0-9_, ()]*)?:|\bif[ \t]+__name__[ \t]*==|\blambda[ \t]+[a-zA-Z_][a-zA-Z0-9_, \t]*:/.test(cleaned)) addSyn("python", 6);
    if (/^[ \t]*(?:if|elif|while|for|with|match)\b[^;{}\n]*:[ \t]*$/m.test(cleaned)) addSyn("python", 8);
    if (/^[ \t]*(?:else|try|finally|except\b[^:\n]*)[ \t]*:[ \t]*$/m.test(cleaned)) addSyn("python", 7);
    if (/\b(?:True|False|None)\b/.test(cleaned)) addSyn("python", 4);
    if (/^[ \t]*(?:print|len|range|input)\s*\([^;\n]*\)[ \t]*$/m.test(cleaned)) addSyn("python", 4);

    if (/\bconsole\.(?:log|warn|error|info|dir|table)[ \t]*\(|\b(?:document|window)\.[a-zA-Z_$]/.test(cleaned)) addSyn("javascript", 8);
    if (/\b(?:async[ \t]+)?function[ \t]+[a-zA-Z_$][a-zA-Z0-9_$]*[ \t]*\(|\bexport[ \t]+(?:default|const|function|async)\b/.test(cleaned)) addSyn("javascript", 8);
    if (/\bconst[ \t]+[a-zA-Z_$][a-zA-Z0-9_$]*[ \t]*=|(?:===|!==)|=>[ \t]*\{|\brequire[ \t]*\(/.test(cleaned)) addSyn("javascript", 6);
    if (/\bwebpackChunk|\bwebpackJsonp\b|\bfunction\s*\(/.test(cleaned)) addSyn("javascript", 8);

    // TypeScript signatures
    let tsSyn = 0;
    if (/\binterface[ \t]+[A-Za-z_$][\w$]*[ \t]*(?:<[^>]*>)?[ \t]*(?:extends[^{]*)?\{/.test(cleaned)) tsSyn += 8;
    if (/\btype[ \t]+[A-Za-z_$][\w$]*[ \t]*(?:<[^>]*>)?[ \t]*=/.test(cleaned)) tsSyn += 8;
    if (/\b(?:let|const|var)[ \t]+[A-Za-z_$][\w$]*[ \t]*:[ \t]*[A-Za-z_$\[{(]/.test(cleaned)) tsSyn += 8;
    if (/\)[ \t]*:[ \t]*(?:string|number|boolean|void|any|unknown|never|Promise<)/.test(cleaned)) tsSyn += 8;
    if (/\b(?:readonly|keyof|satisfies)\b|\bas[ \t]+const\b|\b(?:Partial|Record|Pick|Omit|Readonly|ReturnType|Awaited)</.test(cleaned)) tsSyn += 8;
    if (/\b(?:import|export)[ \t]+type\b/.test(cleaned)) tsSyn += 8;
    if (/\benum[ \t]+[A-Za-z_]\w*[ \t]*\{/.test(cleaned)) tsSyn += 8;
    if (tsSyn > 0) {
      addSyn("typescript", tsSyn + syntax.javascript);
    }

    if (/\bfun[ \t]+(?:[A-Za-z_][A-Za-z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*[ \t]*\(/.test(cleaned)) addSyn("kotlin", 8);
    if (/\b(?:companion[ \t]+object|data[ \t]+class|sealed[ \t]+(?:class|interface)|lateinit[ \t]+var)\b/.test(cleaned)) addSyn("kotlin", 8);
    if (/\bval[ \t]+[a-zA-Z_][a-zA-Z0-9_]*[ \t]*(?::[ \t]*[A-Za-z0-9_<>?]+)?[ \t]*=|\bprintln[ \t]*\(|\b(?:listOf|mutableListOf|mapOf|mutableMapOf)\b/.test(cleaned)) addSyn("kotlin", 7);

    if (/\bfunc[ \t]+[a-zA-Z_][a-zA-Z0-9_]*[ \t]*\(/.test(cleaned)) addSyn("swift", 8);
    if (/\bguard[ \t]+let\b|\bmutating[ \t]+func\b|\bimport[ \t]+(?:Foundation|UIKit|SwiftUI|Combine)\b|@(?:State|Published|Binding|Observable)\b/.test(cleaned)) addSyn("swift", 8);
    if (/\bif[ \t]+let[ \t]+[a-zA-Z_]|\)[ \t]*->[ \t]*[A-Za-z_\[({][^{]*\{/.test(cleaned)) addSyn("swift", 7);

    // Brace / Colon mutual exclusion penalty
    const hasPyColonBlock = /^[ \t]*(?:def|class|if|elif|else|for|while|try|except|finally|with|match)\b[^;{}\n]*:[ \t]*$/m.test(cleaned);
    const hasBracesOrSemi = /[{}]/.test(cleaned) || /;[ \t]*$/m.test(cleaned);
    if (hasPyColonBlock && !hasBracesOrSemi) {
      for (const bl of ["javascript", "typescript", "java", "c", "kotlin", "swift"]) {
        scores[bl] -= 6;
      }
    }
    if (/\{/.test(cleaned) && /;[ \t]*$/m.test(cleaned)) {
      scores.python -= 6;
    }

    // 2. Exclusivity-weighted non-shared tokens (skipping LHS assignment variable names)
    const lhsAssigned = new Set();
    const lhsRe = /^[ \t]*([A-Za-z_]\w*)[ \t]*=(?!=)/gm;
    let lm;
    while ((lm = lhsRe.exec(cleaned)) !== null) {
      lhsAssigned.add(lm[1]);
    }

    const dottedMatches = cleaned.match(/[A-Za-z가-힣_][A-Za-z0-9_가-힣]*(?:\.[A-Za-z가-힣_][A-Za-z0-9_가-힣]*)+/g) || [];
    const wordMatches = cleaned.match(/[A-Za-z가-힣_][A-Za-z0-9_가-힣]*/g) || [];
    const seenTokens = new Set();
    let scannedCount = 0;

    for (const tok of [...dottedMatches, ...wordMatches]) {
      if (tok.length < 2 || seenTokens.has(tok) || lhsAssigned.has(tok)) continue;
      seenTokens.add(tok);
      scannedCount += 1;
      if (scannedCount > 250) break;

      const langSet = langExclusivityIndex[tok];
      if (!langSet) continue;
      if (langSet.size === 1) {
        const [onlyLang] = langSet;
        if (scores[onlyLang] !== undefined) scores[onlyLang] += 2;
      } else if (langSet.size === 2) {
        for (const l of langSet) {
          if (scores[l] !== undefined) scores[l] += 0.75;
        }
      }
    }

    let bestLang = null;
    let maxScore = -Infinity;
    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestLang = lang;
      }
    }

    const declaredLang = fromExt || (tab && tab.language) || "";
    let finalLang = declaredLang || currentLang || "python";
    if (bestLang && maxScore >= 4) {
      if (fromExt && scores[fromExt] === maxScore) {
        finalLang = fromExt;
      } else if (
        bestLang === "javascript" &&
        (fromExt === "typescript" || (!fromExt && tab && tab.language === "typescript"))
      ) {
        finalLang = "typescript";
      } else if (declaredLang && bestLang !== declaredLang) {
        if (syntax[bestLang] > 0 && maxScore >= 6) {
          finalLang = bestLang;
        }
      } else {
        finalLang = bestLang;
      }
    }
    return {
      language: finalLang,
      syntaxScore: syntax[finalLang] || 0,
      maxScore: Number.isFinite(maxScore) ? maxScore : 0,
      scores,
      fromExt
    };
  }

  const fallback = fromExt || (tab && tab.language) || currentLang || "python";
  return { language: fallback, syntaxScore: 0, maxScore: 0, scores, fromExt };
}

function detectTabLanguage(tab) {
  return detectTabLanguageDetailed(tab).language;
}

function updateLangMatchDot() {
  const dot = document.getElementById("lang-match-dot");
  const badge = document.getElementById("detected-lang-badge");
  if (!dot) return;
  const activeTab = getActiveTab();
  if (!activeTab) {
    dot.className = "lang-match-dot match";
    if (badge) {
      badge.className = "detected-lang-badge match";
      badge.textContent = currentLang.toUpperCase();
    }
    return;
  }
  const detected = detectTabLanguage(activeTab);
  const isMatch = detected === currentLang;
  dot.classList.remove("match", "mismatch");
  dot.classList.add(isMatch ? "match" : "mismatch");
  dot.title = isMatch
    ? (uiLang === "ko" ? `코드 언어 일치 (${currentLang.toUpperCase()})` : `Code Language Matches (${currentLang.toUpperCase()})`)
    : (uiLang === "ko" ? `코드 언어 불일치 (감지됨: ${detected.toUpperCase()}, 선택됨: ${currentLang.toUpperCase()})` : `Code Language Mismatch (Detected: ${detected.toUpperCase()}, Selected: ${currentLang.toUpperCase()})`);

  if (badge) {
    badge.className = `detected-lang-badge ${isMatch ? "match" : "mismatch"}`;
    badge.textContent = isMatch
      ? detected.toUpperCase()
      : (uiLang === "ko" ? `감지: ${detected.toUpperCase()}` : `Detected: ${detected.toUpperCase()}`);
  }
  updateRunButtonLabel();
}

function refreshAllViews() {
  if (!editor) return;
  const rawCode = getActiveRawCode();
  const rawPanel = document.getElementById("fullscreen-raw-view");
  if (rawPanel && !rawPanel.classList.contains("hidden")) {
    const pre = document.getElementById("raw-code-preview");
    if (pre) pre.textContent = rawCode;
  }
  const sentencePanel = document.getElementById("fullscreen-sentence-view");
  if (sentencePanel && !sentencePanel.classList.contains("hidden")) {
    renderSentenceSummaryPanel();
  }
  updateMasks();
  updateLangMatchDot();
}

let typingMaskRaf = null;
let langDotTimer = null;

function scheduleMaskUpdate() {
  if (typingMaskRaf) return;
  if (typeof document !== "undefined" && document.hidden) {
    typingMaskRaf = setTimeout(() => {
      typingMaskRaf = null;
      updateMasks();
    }, 16);
    return;
  }
  typingMaskRaf = requestAnimationFrame(() => {
    typingMaskRaf = null;
    updateMasks();
  });
}

function scheduleLangMatchDotUpdate(delayMs = 400) {
  if (langDotTimer) clearTimeout(langDotTimer);
  langDotTimer = setTimeout(() => {
    langDotTimer = null;
    updateLangMatchDot();
  }, delayMs);
}

function refreshViewsWhileTyping() {
  if (!editor) return;
  const rawPanel = document.getElementById("fullscreen-raw-view");
  if (rawPanel && !rawPanel.classList.contains("hidden")) {
    const pre = document.getElementById("raw-code-preview");
    if (pre) pre.textContent = getActiveRawCode();
  }
  scheduleMaskUpdate();
  scheduleLangMatchDotUpdate();
}

// ============================================================================
// Multi-Tab Management & Persistent Workspace Session Engine
// ============================================================================

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId) || null;
}

function getDefaultFileNameForLang(lang, index) {
  const extMap = { python: "py", javascript: "js", typescript: "ts", kotlin: "kt", swift: "swift", c: "c", java: "java" };
  const ext = extMap[lang] || "py";
  return index <= 1 ? `untitled.${ext}` : `untitled_${index}.${ext}`;
}

function reorderTabs(fromTabId, toTabId, insertAfter = false) {
  if (!fromTabId || !toTabId || fromTabId === toTabId) return false;
  const fromIdx = tabs.findIndex((t) => t.id === fromTabId);
  const toIdx = tabs.findIndex((t) => t.id === toTabId);
  if (fromIdx === -1 || toIdx === -1) return false;

  const [movedTab] = tabs.splice(fromIdx, 1);
  let targetIdx = tabs.findIndex((t) => t.id === toTabId);
  if (insertAfter) {
    targetIdx += 1;
  }
  tabs.splice(targetIdx, 0, movedTab);
  renderTabs();
  saveWorkspaceState();
  return true;
}
window.reorderTabs = reorderTabs;

function initTabBarEdgeScroll() {
  const listEl = document.getElementById("tab-list");
  if (!listEl || listEl.dataset.edgeScrollBound === "1") return;
  listEl.dataset.edgeScrollBound = "1";
  const EDGE = 28;
  const SPEED = 2;
  let dir = 0;
  let raf = 0;
  const tick = () => {
    if (dir === 0) {
      raf = 0;
      return;
    }
    listEl.scrollLeft += dir * SPEED;
    raf = requestAnimationFrame(tick);
  };
  listEl.addEventListener("mousemove", (e) => {
    const rect = listEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < EDGE) dir = -1;
    else if (x > rect.width - EDGE) dir = 1;
    else dir = 0;
    if (dir !== 0 && !raf) raf = requestAnimationFrame(tick);
  });
  listEl.addEventListener("mouseleave", () => {
    dir = 0;
  });
}

function renderTabs() {
  const listEl = document.getElementById("tab-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = `tab-item${tab.id === activeTabId ? " active" : ""}`;
    item.setAttribute("role", "tab");
    item.setAttribute("data-tab-id", tab.id);
    item.draggable = true;
    item.title = tab.path || tab.name;

    const dot = document.createElement("span");
    dot.className = "tab-lang-dot";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = tab.name;

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close-btn";
    closeBtn.title = uiLang === "ko" ? "탭 닫기" : "Close Tab";
    closeBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    item.addEventListener("dragstart", (e) => {
      draggedTabId = tab.id;
      item.classList.add("dragging");
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", tab.id);
        } catch (_) {}
      }
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedTabId || draggedTabId === tab.id) return;
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      const rect = item.getBoundingClientRect();
      const isRightHalf = e.clientX > rect.left + rect.width / 2;
      item.classList.toggle("drag-over-left", !isRightHalf);
      item.classList.toggle("drag-over-right", isRightHalf);
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over-left", "drag-over-right");
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const sourceId = draggedTabId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
      const rect = item.getBoundingClientRect();
      const insertAfter = e.clientX > rect.left + rect.width / 2;
      item.classList.remove("drag-over-left", "drag-over-right");
      if (sourceId && sourceId !== tab.id) {
        reorderTabs(sourceId, tab.id, insertAfter);
      }
    });

    item.addEventListener("dragend", () => {
      draggedTabId = null;
      listEl.querySelectorAll(".tab-item").forEach((el) => {
        el.classList.remove("dragging", "drag-over-left", "drag-over-right");
      });
    });

    item.appendChild(dot);
    item.appendChild(nameSpan);
    item.appendChild(closeBtn);
    item.addEventListener("click", () => activateTab(tab.id));
    listEl.appendChild(item);
  });

  window.tabs = tabs;
  window.activeTabId = activeTabId;
}

async function activateTab(tabId) {
  clearRuntimeErrorMarkers();
  const target = tabs.find((t) => t.id === tabId);
  if (!target) return;

  // Save current editor content to previous tab before switching
  const prevTab = getActiveTab();
  if (prevTab && editor && !isSwitchingTab && prevTab.id !== target.id) {
    if (displayMode === "raw") {
      const raw = editor.getValue();
      if (raw !== getTabRawCode(prevTab)) {
        prevTab.rawCode = raw;
        prevTab.content = raw;
        prevTab.isDirty = true;
        prevTab.naturalCache = {};
        prevTab.naturalCompiledSig = {};
        prevTab.dualBaseline = {};
      }
    } else if (prevTab.userEditedNatural) {
      syncNaturalEditorToRawBuffer({ commit: true });
    }
  }

  if (target.rawCode === undefined) {
    target.rawCode = target.content ?? "";
  }
  applyExtensionLanguage(target);
  if (!target.language) {
    const detectedLang = detectTabLanguage(target);
    if (detectedLang) target.language = detectedLang;
  }
  activeTabId = target.id;
  currentLang = target.language || "python";
  window.currentLang = currentLang;

  const fileInput = document.getElementById("file-label");
  if (fileInput) {
    fileInput.value = target.name;
    lastCommittedFileName = target.name;
  }
  const langSelect = document.getElementById("lang-select");
  if (langSelect) {
    langSelect.value = currentLang;
  }

  await loadLanguageCartridge(currentLang);
  if (displayMode === "ko" || displayMode === "en") {
    await loadVocabLexicon(displayMode);
  }
  if (editor) {
    isSwitchingTab = true;
    try {
      syncEditorModelLanguage();
      editor.setValue(getEditorBufferForMode(target, displayMode));
      adoptEditorNaturalCache(target, displayMode);
    } finally {
      isSwitchingTab = false;
    }
    if (displayMode !== "ko" && displayMode !== "en") {
      currentRawLineMap = new Map();
      currentNaturalDiagnostics = [];
    }
    registerDictionaryCompletions();
    registerDictionaryHover();
    refreshAllViews();
  }

  renderTabs();
  updateLangMatchDot();
  saveWorkspaceState();
}

async function createNewTab(options = {}) {
  const lang =
    languageFromFileName(options.path || options.name) ||
    options.language ||
    currentLang ||
    "python";
  const nextIndex = tabs.length + 1;
  const rawCode =
    options.rawCode !== undefined
      ? options.rawCode
      : (options.content !== undefined ? options.content : SAMPLE_SNIPPETS[lang] || "");
  const name = options.name || getDefaultFileNameForLang(lang, nextIndex);
  const newTab = {
    id: options.id || `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name,
    path: options.path || null,
    language: lang,
    rawCode: rawCode,
    content: rawCode,
    diskRaw: options.path ? rawCode : null,
    isDirty: Boolean(options.isDirty),
    userEditedNatural: false,
    naturalCache: {},
    naturalCompiledSig: {}
  };
  tabs.push(newTab);
  await activateTab(newTab.id);
  return newTab;
}

async function closeTab(tabId) {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;

  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    await createNewTab({ language: currentLang, content: SAMPLE_SNIPPETS[currentLang] || "" });
    return;
  }

  if (activeTabId === tabId) {
    const nextTab = tabs[Math.min(idx, tabs.length - 1)];
    await activateTab(nextTab.id);
  } else {
    renderTabs();
    saveWorkspaceState();
  }
}

let isRestoringSession = false;
let sessionRestorePromise = null;
let pendingSessionSavePromise = null;
let backendSessionSynced = false;
let saveWorkspaceTimer = null;

function scheduleSaveWorkspaceState(delayMs = 600) {
  if (saveWorkspaceTimer) clearTimeout(saveWorkspaceTimer);
  saveWorkspaceTimer = setTimeout(() => {
    saveWorkspaceTimer = null;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => saveWorkspaceState(), { timeout: 2000 });
    } else {
      saveWorkspaceState();
    }
  }, delayMs);
}

let lastSavedSessionSignature = "";

function computeSessionSignature() {
  const model = editor && editor.getModel();
  const versionId = model ? model.getAlternativeVersionId() : 0;
  const tabSig = tabs
    .map((t) => `${t.id}:${t.name}:${t.language}:${t.path || ""}:${t.isDirty ? 1 : 0}:${t.userEditedNatural ? 1 : 0}`)
    .join(",");
  return `${activeTabId}|${versionId}|${tabSig}|${displayMode}|${uiLang}|${targetLocale}`;
}

function saveWorkspaceState() {
  if (saveWorkspaceTimer) {
    clearTimeout(saveWorkspaceTimer);
    saveWorkspaceTimer = null;
  }
  if (!editor || isSwitchingTab || isRestoringSession) return;
  const signature = computeSessionSignature();
  if (signature === lastSavedSessionSignature) return;
  const activeTab = getActiveTab();
  if (activeTab) {
    if (displayMode === "raw") {
      const raw = editor.getValue();
      if (raw !== getTabRawCode(activeTab)) {
        activeTab.rawCode = raw;
        activeTab.content = raw;
        activeTab.isDirty = true;
      }
    } else if (activeTab.userEditedNatural) {
      syncNaturalEditorToRawBuffer({ commit: true });
    }
  }

  const payload = {
    version: "0.13",
    activeTabId: activeTabId,
    displayMode: displayMode,
    uiLang: uiLang,
    targetLocale: targetLocale,
    tabs: tabs.map((t) => ({
      id: t.id,
      name: t.name,
      path: t.path || null,
      language: t.language || "python",
      rawCode: getTabRawCode(t),
      content: getTabRawCode(t),
      diskRaw: typeof t.diskRaw === "string" ? t.diskRaw : null,
      isDirty: Boolean(t.isDirty)
    }))
  };

  const jsonStr = JSON.stringify(payload);
  lastSavedSessionSignature = signature;

  if (
    backendSessionSynced &&
    window.pywebview &&
    window.pywebview.api &&
    window.pywebview.api.save_workspace_session
  ) {
    const saveOp = Promise.resolve(window.pywebview.api.save_workspace_session(jsonStr)).catch(() => {});
    const tracked = saveOp.finally(() => {
      if (pendingSessionSavePromise === tracked) pendingSessionSavePromise = null;
    });
    pendingSessionSavePromise = tracked;
    return tracked;
  } else {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, jsonStr);
    } catch (_) {}
  }
  return Promise.resolve();
}

async function reloadPathTabsFromDisk(tabList, sessionVersion = null) {
  const api = window.pywebview && window.pywebview.api;
  if (!api || typeof api.read_file_by_path !== "function") return false;
  let healedAny = false;
  for (const t of tabList) {
    if (!t || !t.path) continue;
    // Keep unsaved changes only for v0.13 sessions explicitly marked dirty.
    // Older sessions or non-dirty tabs always re-sync from disk to heal any contamination.
    const hasExplicitUnsavedEdit =
      sessionVersion === "0.13" &&
      t.isDirty === true &&
      typeof t.diskRaw === "string" &&
      getTabRawCode(t) !== t.diskRaw;
    if (hasExplicitUnsavedEdit) continue;
    try {
      const res = await api.read_file_by_path(t.path);
      if (!res || !res.ok || typeof res.content !== "string") continue;
      if (getTabRawCode(t) !== res.content || typeof t.diskRaw !== "string" || t.diskRaw !== res.content) {
        healedAny = true;
      }
      t.rawCode = res.content;
      t.content = res.content;
      t.diskRaw = res.content;
      t.isDirty = false;
      t.userEditedNatural = false;
      t.naturalCache = {};
      t.naturalCompiledSig = {};
      t.dualBaseline = {};
      t.lineOrigin = [];
    } catch (_) {}
  }
  return healedAny;
}

async function restoreWorkspaceState() {
  if (sessionRestorePromise) {
    return await sessionRestorePromise;
  }
  const runRestore = async () => {
    isRestoringSession = true;
    let shouldPersistHealed = false;
    try {
      if (pendingSessionSavePromise) {
        await pendingSessionSavePromise;
      }
      let rawSession = null;

      if (window.pywebview && window.pywebview.api && window.pywebview.api.load_workspace_session) {
        try {
          const res = await window.pywebview.api.load_workspace_session();
          backendSessionSynced = true;
          if (res && res.ok && res.data) {
            rawSession = res.data;
          }
        } catch (_) {
          backendSessionSynced = true;
        }
      }

      if (!rawSession) {
        try {
          rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
        } catch (_) {}
      }

      let restoredFromSaved = false;
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            if (parsed.displayMode) {
              displayMode = parsed.displayMode;
              window.displayMode = displayMode;
              document.querySelectorAll(".mode-btn").forEach((b) => {
                b.classList.toggle("active", b.getAttribute("data-mode") === displayMode);
              });
            }
            if (parsed.targetLocale) {
              targetLocale = parsed.targetLocale;
              window.targetLocale = targetLocale;
              document.body.classList.toggle("locale-none", targetLocale === "none");
            }
            if (parsed.uiLang) {
              applyUiLanguage(parsed.uiLang, false);
            }

            tabs = parsed.tabs;
            tabs.forEach((tab) => {
              applyExtensionLanguage(tab);
              tab.isDirty = Boolean(parsed.version === "0.13" && tab.isDirty);
              tab.userEditedNatural = false;
              tab.naturalCache = {};
              tab.naturalCompiledSig = {};
              tab.dualBaseline = {};
              tab.lineOrigin = [];
            });
            const healedAny = await reloadPathTabsFromDisk(tabs, parsed.version);
            shouldPersistHealed = Boolean(healedAny || parsed.version !== "0.13");
            const targetId =
              parsed.activeTabId && tabs.some((t) => t.id === parsed.activeTabId)
                ? parsed.activeTabId
                : tabs[0].id;
            await activateTab(targetId);
            logConsole(`이전 작업 세션 복원 완료 (${tabs.length}개 탭 열림)`);
            restoredFromSaved = true;
          }
        } catch (_) {}
      }

      // Default initial tab if no prior session exists
      if (!restoredFromSaved && tabs.length === 0) {
        await createNewTab({
          name: "untitled.py",
          language: "python",
          content: SAMPLE_SNIPPETS.python
        });
      }
    } finally {
      isRestoringSession = false;
    }
    if (shouldPersistHealed && backendSessionSynced) {
      lastSavedSessionSignature = "";
      await saveWorkspaceState();
    }
  };
  sessionRestorePromise = runRestore().finally(() => {
    sessionRestorePromise = null;
  });
  return await sessionRestorePromise;
}

let suggestTriggerTimer = null;
let scrollMaskRaf = null;

const naturalSuggestState = {
  open: false,
  items: [],
  selectedIdx: 0,
  explicitNav: false,
  lineNumber: 1,
  startColumn: 1,
  endColumn: 1,
  composingText: "",
  lastQuery: ""
};

function hideNaturalSuggestWidget() {
  naturalSuggestState.open = false;
  naturalSuggestState.items = [];
  naturalSuggestState.selectedIdx = 0;
  naturalSuggestState.explicitNav = false;
  const widget = document.getElementById("natural-suggest-widget");
  if (widget) {
    widget.classList.add("hidden");
    widget.innerHTML = "";
  }
}

function collectNaturalSuggestCandidates(prefixRaw, mode = displayMode) {
  const q = String(prefixRaw || "").trim();
  const qL = q.toLowerCase();
  const isEnMode = mode === "en" || (mode !== "ko" && uiLang === "en");
  if (!q) return [];

  const results = [];
  const seenKeys = new Set();
  const addItem = (item) => {
    const key = `${item.code}|${item.insertWord}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    results.push(item);
  };

  // 1. Check exclusive synonym owner match & bundle prefix/substring match
  const bundles = Array.from(CODE_BUNDLES_BY_CODE.values());
  const choseongQ = (!isEnMode && typeof extractKoreanChoseong === "function") ? extractKoreanChoseong(q) : "";
  const isAllJamo = /^[ㄱ-ㅎ]+$/.test(q);

  for (const b of bundles) {
    const canon = isEnMode ? (b.en || b.code) : (b.ko || b.en || b.code);
    const canonL = canon.toLowerCase();
    const codeL = String(b.code || "").toLowerCase();
    const syns = (isEnMode ? b.synonyms_en : b.synonyms_ko) || [];
    const matchedSyn = syns.find((s) => s.toLowerCase() === qL || s.toLowerCase().startsWith(qL)) || "";
    const grammar = isEnMode ? (b.grammar_ex_en || b.grammar_en || "") : (b.grammar_ex_ko || b.grammar_ko || "");
    const role = isEnMode ? (b.role_en || "") : (b.role_ko || "");

    let score = 0;
    let tag = "";
    if (canonL === qL || codeL === qL) {
      score = 1600;
      tag = isEnMode ? "Canonical" : "고정 대표어";
    } else if (matchedSyn && matchedSyn.toLowerCase() === qL) {
      score = 1520;
      tag = isEnMode ? `${matchedSyn} ➔ ${canon}` : `${matchedSyn} ➔ ${canon}`;
    } else if (canonL.startsWith(qL) || codeL.startsWith(qL)) {
      score = 1350 - Math.min(40, canon.length);
      tag = role;
    } else if (matchedSyn) {
      score = 1240;
      tag = isEnMode ? `syn: ${matchedSyn}` : `유의어: ${matchedSyn}`;
    } else if (isAllJamo && !isEnMode && b.ko && typeof extractKoreanChoseong === "function" && extractKoreanChoseong(b.ko).startsWith(q)) {
      score = 1120;
      tag = isEnMode ? "Initial" : "초성";
    } else if (canonL.includes(qL) || codeL.includes(qL) || syns.some((s) => s.toLowerCase().includes(qL))) {
      score = 920;
      tag = role;
    }

    if (score > 0) {
      const insertWord = naturalInsertForDictEntry(b.code, b, mode) || (mode === "raw" ? b.code : canon);
      addItem({
        score,
        code: b.code,
        canonical: canon,
        en: b.en || "",
        ko: b.ko || "",
        insertWord,
        syns: syns.slice(0, 4),
        grammar,
        tag
      });
    }
  }

  // 2. Active cartridge entries not already in bundles
  if (dictPack && dictPack.entries) {
    for (const [code, tr] of Object.entries(dictPack.entries)) {
      if (!tr || results.length >= 40 && CODE_BUNDLES_BY_CODE.has(code)) continue;
      const canon = isEnMode ? (tr.en || code) : (tr.ko || tr.en || code);
      const canonL = canon.toLowerCase();
      const codeL = code.toLowerCase();
      let score = 0;
      if (canonL === qL || codeL === qL) score = 1480;
      else if (canonL.startsWith(qL) || codeL.startsWith(qL)) score = 1150;
      else if (qL.length >= 2 && (canonL.includes(qL) || codeL.includes(qL))) score = 780;
      if (score > 0) {
        addItem({
          score,
          code,
          canonical: canon,
          en: tr.en || "",
          ko: tr.ko || "",
          insertWord: naturalInsertForDictEntry(code, tr, mode) || (mode === "raw" ? code : canon),
          syns: Array.isArray(tr.synonyms_ko) ? tr.synonyms_ko.slice(0, 3) : [],
          grammar: isEnMode ? (tr.grammar_ex_en || tr.grammar_en || "") : (tr.grammar_ex_ko || tr.grammar_ko || ""),
          tag: tr.role_ko || tr.category || ""
        });
      }
    }
  }

  // 3. Registered variable nouns (KO_NOUN_TO_IDENT) + active Vocab DB prefix slice
  if (!isEnMode) {
    for (const [nounKo, identObj] of Object.entries(KO_NOUN_TO_IDENT)) {
      if (nounKo === q || nounKo.startsWith(q) || (q.length >= 2 && nounKo.includes(q))) {
        addItem({
          score: nounKo === q ? 1420 : 1080,
          code: identObj.single,
          canonical: nounKo,
          en: identObj.single,
          ko: nounKo,
          insertWord: mode === "raw" ? identObj.single : nounKo,
          syns: [],
          grammar: `${nounKo}에 80 넣기`,
          tag: "변수 명사 (DB)"
        });
      }
    }
    const lexKo = vocabLexicon && vocabLexicon.ko;
    if (lexKo && q.length >= 1 && !isAllJamo) {
      let count = 0;
      if (Object.prototype.hasOwnProperty.call(lexKo, q)) {
        const arr = lexKo[q];
        const linked = Array.isArray(arr[2]) && arr[2][0] ? arr[2][0][0] : "";
        addItem({
          score: 1280,
          code: linked || q,
          canonical: q,
          en: arr[1] || q,
          ko: q,
          insertWord: mode === "raw" ? (linked || q) : q,
          syns: [],
          grammar: "",
          tag: linked ? `단어DB (${linked})` : "단어DB 명사"
        });
      }
      for (const word of Object.keys(lexKo)) {
        if (word.startsWith(q) && word !== q) {
          const arr = lexKo[word];
          if (!Array.isArray(arr)) continue;
          const linked = Array.isArray(arr[2]) && arr[2][0] ? arr[2][0][0] : "";
          addItem({
            score: 880 - Math.min(20, word.length),
            code: linked || word,
            canonical: word,
            en: arr[1] || word,
            ko: word,
            insertWord: mode === "raw" ? (linked || word) : word,
            syns: [],
            grammar: "",
            tag: "단어DB"
          });
          count++;
          if (count >= 6) break;
        }
      }
    }
  } else {
    const lexEn = vocabLexicon && vocabLexicon.en;
    if (lexEn && qL.length >= 2) {
      let count = 0;
      for (const word of Object.keys(lexEn)) {
        if (word.toLowerCase().startsWith(qL)) {
          const arr = lexEn[word];
          if (!Array.isArray(arr)) continue;
          const linked = Array.isArray(arr[2]) && arr[2][0] ? arr[2][0][0] : "";
          addItem({
            score: word.toLowerCase() === qL ? 1260 : 860,
            code: linked || word,
            canonical: word,
            en: word,
            ko: "",
            insertWord: mode === "raw" ? (linked || word) : word,
            syns: [],
            grammar: "",
            tag: "Vocab DB"
          });
          count++;
          if (count >= 5) break;
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.canonical.length - b.canonical.length);
  return results.slice(0, 9);
}

function renderNaturalSuggestWidget(position) {
  const widget = document.getElementById("natural-suggest-widget");
  if (!widget || !editor || !naturalSuggestState.open || naturalSuggestState.items.length === 0) {
    hideNaturalSuggestWidget();
    return;
  }
  const isEnUi = uiLang === "en";
  const headHtml = `<div class="natural-suggest-head"><span>${isEnUi ? "Canonical Word ⇄ Code" : "일정 대표 자연어 ⇄ 코드"}</span><span>${isEnUi ? "Enter / Tab / Click: Insert" : "Enter·Tab·클릭: 대표어로 완성"}</span></div>`;
  const itemsHtml = naturalSuggestState.items.map((it, idx) => {
    const activeCls = idx === naturalSuggestState.selectedIdx ? " active" : "";
    const synLine = it.syns && it.syns.length
      ? `<span class="ns-synonyms">${escapeHtml(it.syns.join(" · "))}</span>`
      : "";
    const gramLine = it.grammar
      ? `<span class="ns-grammar">${escapeHtml(it.grammar)}</span>`
      : "";
    return `
      <div class="natural-suggest-item${activeCls}" data-ns-idx="${idx}" role="option" aria-selected="${idx === naturalSuggestState.selectedIdx}">
        <div class="natural-suggest-top">
          <div class="natural-suggest-main">
            <span class="ns-canonical">${escapeHtml(it.insertWord)}</span>
            <span class="ns-arrow">⇄</span>
            <span class="ns-code">${escapeHtml(it.code)}</span>
            ${it.tag ? `<span class="ns-synonyms">[${escapeHtml(it.tag)}]</span>` : ""}
          </div>
          ${synLine}
        </div>
        ${gramLine}
      </div>
    `;
  }).join("");

  widget.innerHTML = headHtml + itemsHtml;
  widget.classList.remove("hidden");

  // Position below cursor inside .editor-pane
  const pane = widget.parentElement;
  const edNode = document.getElementById("editor-container");
  const vis = editor.getScrolledVisiblePosition(position);
  if (pane && edNode && vis) {
    const paneRect = pane.getBoundingClientRect();
    const edRect = edNode.getBoundingClientRect();
    const topPx = (edRect.top - paneRect.top) + vis.top + (vis.height || 20) + 4;
    const leftPx = (edRect.left - paneRect.left) + vis.left;
    const maxLeft = Math.max(8, pane.clientWidth - 435);
    const maxTop = Math.max(12, pane.clientHeight - 270);
    widget.style.left = `${Math.min(Math.max(8, leftPx), maxLeft)}px`;
    widget.style.top = `${Math.min(Math.max(8, topPx), maxTop)}px`;
  }

  widget.querySelectorAll(".natural-suggest-item").forEach((el) => {
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(el.getAttribute("data-ns-idx"));
      const chosen = naturalSuggestState.items[idx];
      if (chosen) applyNaturalSuggestItem(chosen);
    });
  });
}

function applyNaturalSuggestItem(item) {
  if (!editor || !item) return;
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;
  const wordInfo = getNaturalWordUntilPosition(model, pos);
  const startCol = Math.min(naturalSuggestState.startColumn || wordInfo.startColumn, wordInfo.startColumn);
  const endCol = pos.column;
  const insertText = item.insertWord || item.canonical || item.code;

  isInternalReplacement = true;
  try {
    editor.executeEdits("tran-natural-suggest", [{
      range: new monaco.Range(pos.lineNumber, startCol, pos.lineNumber, endCol),
      text: insertText,
      forceMoveMarkers: true
    }]);
  } finally {
    isInternalReplacement = false;
  }

  if (naturalSuggestState.lastQuery && item.code && /[가-힣A-Za-z_]/.test(naturalSuggestState.lastQuery)) {
    recordUserLearnedMapping(naturalSuggestState.lastQuery, item.code, currentLang);
  }
  naturalSuggestState.composingText = "";
  hideNaturalSuggestWidget();

  if (displayMode === "ko" || displayMode === "en") {
    markTabNaturalEdited(getActiveTab());
    syncNaturalEditorToRawBuffer({ commit: true });
    scheduleSaveWorkspaceState(1500);
  }
  refreshAllViews();
  editor.focus();
}

function updateNaturalSuggestWidget(composingChunk = "") {
  if (!editor) return;
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) {
    hideNaturalSuggestWidget();
    return;
  }
  const lineText = model.getLineContent(pos.lineNumber) || "";
  if (/^\s*(?:#|\/\/)/.test(lineText)) {
    hideNaturalSuggestWidget();
    return;
  }
  const protectedIntervals = getProtectedIntervalsForLine(lineText, currentLang);
  if (isOffsetInsideIntervals(Math.max(0, pos.column - 1), protectedIntervals)) {
    hideNaturalSuggestWidget();
    return;
  }

  const wordInfo = getNaturalWordUntilPosition(model, pos);
  let queryWord = wordInfo.word || "";
  if (composingChunk && !queryWord.endsWith(composingChunk)) {
    queryWord = (queryWord + composingChunk).trim();
  }
  if (!queryWord) {
    hideNaturalSuggestWidget();
    return;
  }

  const items = collectNaturalSuggestCandidates(queryWord, displayMode);
  if (!items || items.length === 0) {
    hideNaturalSuggestWidget();
    return;
  }

  naturalSuggestState.open = true;
  naturalSuggestState.items = items;
  naturalSuggestState.selectedIdx = 0;
  naturalSuggestState.explicitNav = false;
  naturalSuggestState.lineNumber = pos.lineNumber;
  naturalSuggestState.startColumn = wordInfo.startColumn;
  naturalSuggestState.endColumn = pos.column;
  naturalSuggestState.lastQuery = queryWord;
  renderNaturalSuggestWidget(pos);
}

function setupEditorEvents() {
  editor.onDidScrollChange((e) => {
    if (!e.scrollTopChanged && !e.scrollHeightChanged) return;
    if (naturalSuggestState.open) hideNaturalSuggestWidget();
    if (scrollMaskRaf) return;
    scrollMaskRaf = requestAnimationFrame(() => {
      scrollMaskRaf = null;
      updateMasks();
    });
  });

  editor.onDidChangeCursorPosition(() => {
    if (naturalSuggestState.open && !naturalSuggestState.composingText) {
      const pos = editor.getPosition();
      const model = editor.getModel();
      const wordInfo = model && pos ? getNaturalWordUntilPosition(model, pos) : null;
      if (!wordInfo || !wordInfo.word) {
        hideNaturalSuggestWidget();
      }
    }
  });

  editor.onDidBlurEditorText(() => {
    setTimeout(() => {
      if (editor && !editor.hasTextFocus()) {
        hideNaturalSuggestWidget();
      }
    }, 160);
  });

  const edDom = editor.getDomNode();
  if (edDom) {
    edDom.addEventListener("compositionstart", () => {
      naturalSuggestState.composingText = "";
    }, true);
    edDom.addEventListener("compositionupdate", (e) => {
      naturalSuggestState.composingText = e.data || "";
      requestAnimationFrame(() => updateNaturalSuggestWidget(naturalSuggestState.composingText));
    }, true);
    edDom.addEventListener("compositionend", () => {
      naturalSuggestState.composingText = "";
      requestAnimationFrame(() => updateNaturalSuggestWidget(""));
    }, true);
    edDom.addEventListener("keydown", (e) => {
      if (!naturalSuggestState.open || naturalSuggestState.items.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        naturalSuggestState.selectedIdx = (naturalSuggestState.selectedIdx + 1) % naturalSuggestState.items.length;
        naturalSuggestState.explicitNav = true;
        renderNaturalSuggestWidget(editor.getPosition());
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        naturalSuggestState.selectedIdx = (naturalSuggestState.selectedIdx - 1 + naturalSuggestState.items.length) % naturalSuggestState.items.length;
        naturalSuggestState.explicitNav = true;
        renderNaturalSuggestWidget(editor.getPosition());
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        hideNaturalSuggestWidget();
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const chosen = naturalSuggestState.items[naturalSuggestState.selectedIdx] || naturalSuggestState.items[0];
        if (chosen) applyNaturalSuggestItem(chosen);
      }
    }, true);
  }

  editor.onDidChangeModelContent((event) => {
    if (isInternalReplacement || isSwitchingTab || isRestoringSession) {
      refreshAllViews();
      return;
    }
    clearRuntimeErrorMarkers();

    let shouldAutoSuggest = false;
    // Natural mode keystrokes only preview the compile; raw is written on save, run, or mode/tab switch
    const activeTabNow = getActiveTab();
    if (displayMode === "ko" || displayMode === "en") {
      markTabNaturalEdited(activeTabNow);
      syncNaturalEditorToRawBuffer({ commit: false });
    } else if (displayMode === "raw" && activeTabNow) {
      if (editor.getValue() !== getTabRawCode(activeTabNow)) {
        activeTabNow.isDirty = true;
      }
    }
    for (const change of event.changes) {
      if (displayMode === "raw") {
        tryConvertNaturalWordBeforeDelimiter(change);
      }
      if (change.text && /^[A-Za-z_가-힣ㄱ-ㅎㅏ-ㅣ]+$/.test(change.text)) {
        const model = editor.getModel();
        if (model) {
          const lineNum = change.range.startLineNumber;
          const lineText = model.getLineContent(lineNum);
          const protectedIntervals = getProtectedIntervalsForLine(lineText, currentLang);
          if (!isOffsetInsideIntervals(change.range.startColumn - 1, protectedIntervals)) {
            shouldAutoSuggest = true;
          }
        }
      }
    }

    refreshViewsWhileTyping();
    scheduleSaveWorkspaceState(1500);

    if (shouldAutoSuggest) {
      if (suggestTriggerTimer) clearTimeout(suggestTriggerTimer);
      suggestTriggerTimer = setTimeout(() => {
        updateNaturalSuggestWidget("");
        if (editor && displayMode === "raw") {
          editor.trigger("tran-natural-suggest", "editor.action.triggerSuggest", {});
        }
      }, 25);
    } else if (event.changes.some((c) => /[\s\n]/.test(c.text || ""))) {
      hideNaturalSuggestWidget();
    }
  });

  // Pasting external source code into the natural view adopts raw code & translates it cleanly.
  if (typeof editor.onDidPaste === "function") {
    editor.onDidPaste((e) => {
      if (displayMode !== "ko" && displayMode !== "en") return;
      const tab = getActiveTab();
      const model = editor.getModel();
      if (!tab || !model || !e || !e.range) return;
      const whole = model.getValue();
      const pasted = model.getValueInRange(e.range);
      if (normalizeNaturalText(pasted).trim() === normalizeNaturalText(whole).trim()) {
        if (looksLikeRawSource(whole, displayMode)) {
          adoptExternalRawSource(tab, whole);
        }
        return;
      }
      if (looksLikeRawSource(pasted, displayMode)) {
        splicePastedRawSourceIntoTab(tab, model, e.range, pasted);
      }
    });
  }
}

let lastCommittedFileName = "untitled.py";

function extractCleanNaturalTextForLangSwitch(tab, prevLang) {
  const natMode = (displayMode === "ko" || displayMode === "en")
    ? displayMode
    : (targetLocale === "none" ? "en" : "ko");
  let kept = [];
  if ((displayMode === "ko" || displayMode === "en") && editor) {
    const rawEditorLines = editor.getValue().split(/\r?\n/);
    const base = tab && tab.dualBaseline && tab.dualBaseline[displayMode];
    if (base && Array.isArray(base.naturalLines) && Array.isArray(base.matchedOpener)) {
      const aligned = alignEditorLinesToBaseline(rawEditorLines, base);
      for (let i = 0; i < rawEditorLines.length; i++) {
        const bIdx = aligned[i];
        const isEmptyCloser =
          !rawEditorLines[i].trim() &&
          bIdx >= 0 &&
          (base.matchedOpener[bIdx] >= 0 || /^[}\])]+[,;]?$/.test(String((base.rawLines && base.rawLines[bIdx]) || "").trim()));
        if (!isEmptyCloser) kept.push(rawEditorLines[i]);
      }
    } else {
      kept = rawEditorLines.slice();
    }
  } else {
    const rawNow = getActiveRawCode();
    const dec = decompileCodeToNaturalText(rawNow, prevLang, natMode);
    for (let i = 0; i < dec.naturalLines.length; i++) {
      const natLn = String(dec.naturalLines[i] || "");
      const isEmptyCloser =
        !natLn.trim() &&
        (dec.matchedOpener[i] >= 0 || /^[}\])]+[,;]?$/.test(String((dec.rawLines && dec.rawLines[i]) || "").trim()));
      if (!isEmptyCloser) kept.push(natLn);
    }
  }
  while (kept.length > 0 && !String(kept[kept.length - 1] || "").trim()) {
    kept.pop();
  }
  return { text: kept.join("\n"), mode: natMode };
}

async function switchLanguage(newLang, customCode = null, options = {}) {
  currentLang = newLang;
  window.currentLang = newLang;
  document.getElementById("lang-select").value = newLang;

  const activeTab = getActiveTab();
  if (activeTab) {
    activeTab.language = newLang;
  }

  await loadLanguageCartridge(newLang);
  const natMode = (options && options.naturalMode) || ((displayMode === "ko" || displayMode === "en") ? displayMode : (targetLocale === "none" ? "en" : "ko"));
  if (
    displayMode === "ko" ||
    displayMode === "en" ||
    (options && options.recompileFromNatural)
  ) {
    await loadVocabLexicon(natMode);
  }
  let effectiveCustomCode = customCode;
  if (options && options.recompileFromNatural && options.naturalText && options.naturalText.trim()) {
    const recompiled = compileNaturalTextToCode(options.naturalText, newLang, natMode, null, null);
    if (recompiled && typeof recompiled.rawCode === "string" && recompiled.rawCode.trim() && recompiled.lineMap && recompiled.lineMap.size > 0) {
      effectiveCustomCode = recompiled.rawCode;
    }
  }
  if (editor) {
    isSwitchingTab = true;
    try {
      syncEditorModelLanguage();
      const nextRaw = effectiveCustomCode !== null ? effectiveCustomCode : (SAMPLE_SNIPPETS[newLang] || "");
      if (activeTab) {
        activeTab.rawCode = nextRaw;
        activeTab.content = nextRaw;
        activeTab.userEditedNatural = false;
        activeTab.naturalCache = {};
        activeTab.naturalCompiledSig = {};
        activeTab.dualBaseline = {};
      }
      editor.setValue(activeTab ? getEditorBufferForMode(activeTab, displayMode) : nextRaw);
      adoptEditorNaturalCache(activeTab, displayMode);
    } finally {
      isSwitchingTab = false;
    }
    if (displayMode !== "ko" && displayMode !== "en") {
      currentRawLineMap = new Map();
      currentNaturalDiagnostics = [];
    }
    registerDictionaryCompletions();
    registerDictionaryHover();
    refreshAllViews();
  }
  renderTabs();
  updateLangMatchDot();
  updateRunButtonLabel();
  saveWorkspaceState();
  logConsole(`언어 카트리지 전환: ${newLang.toUpperCase()} (${dictPack.entry_count}개 1:1 단어 로드됨)`);
}

async function releaseTypingFocusBeforeDialog() {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 16)));
}

async function handleOpenFile() {
  if (!window.pywebview || !window.pywebview.api) {
    logConsole("데스크톱 창(pywebview) 환경에서 파일 열기가 작동합니다.", "error");
    return;
  }
  await releaseTypingFocusBeforeDialog();
  const res = await window.pywebview.api.open_file_dialog();
  if (res && res.ok) {
    // Check if file is already open in a tab
    const existing = tabs.find((t) => t.path && t.path.toLowerCase() === res.path.toLowerCase());
    if (existing) {
      existing.rawCode = res.content;
      existing.content = res.content;
      existing.diskRaw = res.content;
      existing.isDirty = false;
      existing.userEditedNatural = false;
      existing.naturalCache = {};
      existing.naturalCompiledSig = {};
      existing.dualBaseline = {};
      existing.name = res.name;
      existing.path = res.path;
      existing.language = languageFromFileName(res.path || res.name) || res.language;
      const openedLang = detectTabLanguage(existing);
      if (openedLang) existing.language = openedLang;
      await activateTab(existing.id);
    } else {
      const openedLang =
        languageFromFileName(res.path || res.name) || res.language;
      const probeTab = {
        name: res.name,
        path: res.path,
        language: openedLang,
        rawCode: res.content,
        content: res.content
      };
      const detectedOpen = detectTabLanguage(probeTab);
      await createNewTab({
        name: res.name,
        path: res.path,
        language: detectedOpen || openedLang,
        rawCode: res.content,
        content: res.content,
        isDirty: false
      });
    }
    logConsole(`파일 열기 완료: ${res.path}`);
  } else if (res && res.error) {
    logConsole(`파일 열기 오류: ${res.error}`, "error");
  }
}

async function handleSaveFile() {
  if (!window.pywebview || !window.pywebview.api || !editor) {
    logConsole("데스크톱 창(pywebview) 환경에서 파일 저장이 작동합니다.", "error");
    return;
  }
  const fileInput = document.getElementById("file-label");
  const currentFileName = (fileInput.value || "").trim() || lastCommittedFileName || "untitled.py";
  fileInput.value = currentFileName;

  const activeTab = getActiveTab();
  const currentPath = activeTab ? activeTab.path : null;

  if ((displayMode === "ko" || displayMode === "en") && activeTab && activeTab.userEditedNatural) {
    syncNaturalEditorToRawBuffer({ commit: true });
  }
  const rawCode = getActiveRawCode();
  await releaseTypingFocusBeforeDialog();
  const res = await window.pywebview.api.save_file(rawCode, currentFileName, false, currentPath);
  if (res && res.ok) {
    fileInput.value = res.name;
    lastCommittedFileName = res.name;
    if (activeTab) {
      activeTab.name = res.name;
      activeTab.path = res.path;
      activeTab.rawCode = rawCode;
      activeTab.content = rawCode;
      activeTab.diskRaw = rawCode;
      activeTab.isDirty = false;
      activeTab.userEditedNatural = false;
      activeTab.naturalCache = {};
      activeTab.naturalCompiledSig = {};
      activeTab.dualBaseline = {};
      if (res.language) activeTab.language = res.language;
    }
    if (res.language && res.language !== currentLang) {
      await switchLanguage(res.language, rawCode);
    } else {
      if (activeTab && (displayMode === "ko" || displayMode === "en")) {
        const prevPos = editor.getPosition();
        isSwitchingTab = true;
        try {
          editor.setValue(getEditorBufferForMode(activeTab, displayMode));
          adoptEditorNaturalCache(activeTab, displayMode);
          if (prevPos) editor.setPosition(prevPos);
        } finally {
          isSwitchingTab = false;
        }
        refreshAllViews();
      }
      renderTabs();
      saveWorkspaceState();
    }
    const modeLabel = res.saved_as_new ? "새 이름으로 저장 완료" : "원문 코드 덮어쓰기 저장 완료";
    logConsole(`${modeLabel}: ${res.path}`);
  } else if (res && res.error) {
    logConsole(`파일 저장 오류: ${res.error}`, "error");
  }
}

function resolveNaturalLineForRaw(tab, rawLine) {
  const ln = Math.max(1, Number(rawLine) || 1);
  if (displayMode === "raw" || !tab || !(tab.rawLineToNaturalLine instanceof Map) || tab.rawLineToNaturalLine.size === 0) {
    return ln;
  }
  if (tab.rawLineToNaturalLine.has(ln)) {
    return tab.rawLineToNaturalLine.get(ln);
  }
  let bestKey = 0;
  let bestVal = ln;
  for (const [k, v] of tab.rawLineToNaturalLine.entries()) {
    if (k <= ln && k > bestKey) {
      bestKey = k;
      bestVal = v;
    }
  }
  return bestVal;
}

function clearRuntimeErrorMarkers() {
  if (!editor || !runtimeErrorDecorations.length) {
    runtimeErrorDecorations = [];
    return;
  }
  runtimeErrorDecorations = editor.deltaDecorations(runtimeErrorDecorations, []);
}

function applyRuntimeErrorMarkers(diagnostics, langLabel = "") {
  if (!editor || !window.monaco || !Array.isArray(diagnostics) || diagnostics.length === 0) {
    return [];
  }
  const model = editor.getModel();
  if (!model) return [];
  const activeTab = getActiveTab();
  const maxLine = Math.max(1, model.getLineCount());
  const byEditorLine = new Map();

  for (const d of diagnostics.slice(0, 10)) {
    const mapped = resolveNaturalLineForRaw(activeTab, d.line);
    const edLine = Math.max(1, Math.min(maxLine, Number(mapped) || 1));
    if (!byEditorLine.has(edLine)) {
      byEditorLine.set(edLine, d);
    }
  }

  const newDecs = [];
  let firstLine = null;
  const mappedResults = [];
  for (const [edLine, d] of byEditorLine.entries()) {
    if (firstLine === null) firstLine = edLine;
    const summaryText = uiLang === "en" ? (d.summary_en || d.message) : (d.summary_ko || d.message);
    const rawMsg = String(d.message || "").trim();
    const maxCol = Math.max(1, model.getLineMaxColumn(edLine));
    const hoverTitle = uiLang === "en" ? "Execution Error" : "실행 오류";
    const hoverRawLabel = uiLang === "en" ? "Compiler/Runtime" : "원본 오류 메시지";
    newDecs.push({
      range: new monaco.Range(edLine, 1, edLine, maxCol),
      options: {
        isWholeLine: true,
        className: "tran-runtime-error-line",
        linesDecorationsClassName: "tran-runtime-error-gutter",
        after: {
          content: `   ⚠ ${hoverTitle}: ${summaryText}`,
          inlineClassName: "tran-runtime-error-hint"
        },
        hoverMessage: {
          value: `**${hoverTitle}${langLabel ? ` (${langLabel})` : ""}**\n\n${summaryText}${rawMsg ? `\n\n_${hoverRawLabel}:_ \`${rawMsg}\`` : ""}`
        }
      }
    });
    mappedResults.push({ editorLine: edLine, summary: summaryText, rawLine: d.line });
  }

  runtimeErrorDecorations = editor.deltaDecorations(runtimeErrorDecorations, newDecs);
  if (firstLine !== null) {
    editor.revealLineInCenter(firstLine);
  }
  return mappedResults;
}

async function handleRunCode() {
  if (!editor) return;
  if (!window.pywebview || !window.pywebview.api) {
    logConsole("pywebview 브릿지가 연결되지 않았습니다.", "error");
    return;
  }
  clearRuntimeErrorMarkers();
  const activeTabRun = getActiveTab();
  if (displayMode === "ko" || displayMode === "en") {
    syncNaturalEditorToRawBuffer({ commit: Boolean(activeTabRun && activeTabRun.userEditedNatural) });
    if (currentNaturalDiagnostics.length > 0) {
      const badWords = currentNaturalDiagnostics.map((d) => `${d.word}(L${d.lineNumber})`).join(", ");
      logConsole(`DB 미등록 단어가 포함된 줄은 컴파일에서 제외되었습니다: ${badWords}`, "error");
    }
  }
  const runLang = currentLang || "python";
  const langLabel = (typeof SCOPE_LABELS !== "undefined" && SCOPE_LABELS[runLang]) || runLang.toUpperCase();
  logConsole(`${langLabel} 코드 실행 중...`);
  const rawCode = getActiveRawCode();
  const res = typeof window.pywebview.api.run_code === "function"
    ? await window.pywebview.api.run_code(runLang, rawCode)
    : (runLang === "python"
        ? await window.pywebview.api.run_python_code(rawCode)
        : { ok: false, returncode: -1, stdout: "", stderr: "다중 언어 실행 브릿지를 사용할 수 없습니다.", missing_runtime: true, diagnostics: [] });
  if (res && res.stdout) {
    logConsole(`[STDOUT]\n${res.stdout.trimEnd()}`);
  }
  if (res && res.stderr) {
    logConsole(res.missing_runtime ? res.stderr.trimEnd() : `[STDERR]\n${res.stderr.trimEnd()}`, res.missing_runtime ? "info" : "error");
  }
  if (res && Array.isArray(res.diagnostics) && res.diagnostics.length > 0) {
    const mapped = applyRuntimeErrorMarkers(res.diagnostics, langLabel);
    for (const item of mapped) {
      logConsole(`[오류 위치] L${item.editorLine}: ${item.summary}`, "error");
    }
  }
  if (res && !res.stdout && !res.stderr) {
    logConsole(`실행 완료 (종료 코드: ${res.returncode})`);
  }
}
const handleRunPython = handleRunCode;
if (typeof window !== "undefined") {
  window.handleRunCode = handleRunCode;
  window.handleRunPython = handleRunCode;
}

// ============================================================================
// v0.9 5-Compartment Right Sidebar, Full-Screen Views, Blurred Word Overlay & Editor Studio
// ============================================================================

let allCartridgesCache = {}; // { common: {...}, javascript: {...}, python: {...}, kotlin: {...}, swift: {...} }
let flatGlobalEntries = [];  // [{ scope, langLabel, code, en, ko, category, category_en, desc, desc_en, rawEntry }]
let flatEntryLookup = new Map(); // code/en/ko -> first matching flat entry
let currentOverlayWordItem = null;
let dictBrowserState = {
  lang: "all",     // 'all' | 'javascript' | 'python' | 'kotlin' | 'swift'
  sort: "abc",     // 'abc' | 'ganada' | 'role' | 'rel'
  query: ""
};
let editorStudioState = {
  scope: "javascript",
  locale: "ko",
  filter: "",
  workingEntries: {}
};

const SCOPE_LABELS = {
  common: "Common",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  java: "Java"
};

function inferWordRole(code, tr, scope, forEn = false) {
  if (forEn && tr && tr.category_en) return tr.category_en;
  if (!forEn && tr && tr.category) return tr.category;
  if (/^(true|True|false|False|null|None|nil|undefined|NaN)$/.test(code)) {
    return forEn ? "Yes, No & Empty" : "참·거짓과 빈칸";
  }
  if (scope === "common") return forEn ? "Works Everywhere" : "모든 언어 공통 말";
  if (/^(if|else|elif|for|while|do|switch|case|default|when|break|continue|return|yield|guard|defer|try|catch|except|finally|throw|raise|match|pass|with|repeat)$/.test(code)) {
    return forEn ? "Rules & Loops" : "조건과 반복 규칙";
  }
  if (/^(def|fun|func|function|class|struct|interface|enum|protocol|extension|trait|object|typealias|var|val|let|const|async|await|import|from|export|package|include|define|typedef|lambda|public|private|protected|static|final|override|new)$/.test(code)) {
    return forEn ? "Making Boxes & Blueprints" : "이름표와 상자 만들기";
  }
  if (/Error|Exception|Warning|Fault/.test(code)) {
    return forEn ? "Problem Alerts" : "문제·실수 알림";
  }
  if (/^[A-Z][A-Z0-9_]{1,}$/.test(code)) {
    return forEn ? "Fixed Values & Signals" : "정해진 값·신호";
  }
  if (/^[A-Z]/.test(code)) {
    return forEn ? "Data Boxes & Types" : "숫자·글자·목록 상자";
  }
  if (code.includes(".")) {
    return forEn ? "Tools Inside a Box" : "도구 상자에서 꺼내 쓰기";
  }
  return forEn ? "Helper Command" : "바로 쓰는 일꾼 명령";
}

function getHangulInitial(str) {
  if (!str) return uiLang === "en" ? "Other" : "기타";
  const char = str.trim()[0];
  const code = char.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    const idx = Math.floor((code - 0xac00) / 588);
    return initials[idx] || (uiLang === "en" ? "Other" : "기타");
  }
  return char.toUpperCase();
}

const _KID_NL = String.fromCharCode(10);

function _kidEntry(koArr, enArr, ex = "") {
  return {
    ko: { short: koArr[0], desc: koArr[1], usage: koArr[2], syntax: koArr[3], inside: koArr[4], result: koArr[5] },
    en: { short: enArr[0], desc: enArr[1], usage: enArr[2], syntax: enArr[3], inside: enArr[4], result: enArr[5] },
    ex,
  };
}

const CORE_KID_GUIDES = Object.assign(Object.create(null), {
  true: _kidEntry(
    ["'맞다(참)'를 뜻하는 값", "질문에 대한 답이 '네, 맞아요!'일 때 쓰는 참 값이에요.", "불을 켜거나 통과 여부를 켜짐 상태로 둘 때 써요.", "true / True", "따옴표 없이 글자 그대로 적어요.", "'맞다(참)' 상태가 상자에 담겨요."],
    ["Means 'Yes, that is right'", "Represents a 'yes' or 'turned on' answer in code.", "Use it when saving whether a light is on or a rule passed.", "true / True", "Write the word directly with no quotes.", "Stores or checks a 'yes' answer."],
    "is_ready = True"
  ),
  false: _kidEntry(
    ["'틀렸다(거짓)'를 뜻하는 값", "질문에 대한 답이 '아니요!'일 때 쓰는 거짓 값이에요.", "아직 안 끝났거나 문이 잠겨 있다고 표시할 때 써요.", "false / False", "따옴표 없이 글자 그대로 적어요.", "'틀렸다(거짓)' 상태가 상자에 담겨요."],
    ["Means 'No, not right'", "Represents a 'no' or 'turned off' answer in code.", "Use it when saving that a game is not over or a door is locked.", "false / False", "Write the word directly with no quotes.", "Stores or checks a 'no' answer."],
    "is_finished = False"
  ),
  null: _kidEntry(
    ["아무것도 없는 빈 상태", "상자 안이 텅 비어 있거나 아직 정해지지 않았음을 알려줘요.", "결과를 못 찾았거나 빈칸을 비워둘 때 써요.", "null / None / nil", "따옴표 없이 비어 있다는 뜻으로 그대로 적어요.", "'비어 있음'을 뜻하는 빈 값이 돼요."],
    ["Means completely empty", "Shows that a box has nothing inside it yet.", "Use it before you have an answer or when clearing a box.", "null / None / nil", "Write it directly with no quotes.", "Marks the spot as empty."],
    "winner = None"
  ),
  if: _kidEntry(
    ["~라면 이 일을 해! (조건 정하기)", "우리가 정한 규칙이 맞을 때만 아래 코드를 실행하는 문지기예요.", "점수가 90점이 넘으면 '합격!'을 보여주고 싶을 때 써요.", "if 조건:", "맞는지 검사할 질문 (예: 점수 >= 90)", "질문이 맞으면 안쪽 코드를 실행하고, 틀리면 건너뛰어요."],
    ["Only run this if a rule is true", "Acts like a gatekeeper that runs code only when your test passes.", "Use it to show a prize only when score >= 90.", "if (rule) { ... } / if rule:", "Write a yes/no check like score >= 90.", "Runs the inside steps when right, skips them when wrong."],
    ["if score >= 90:", "    print(\"Great!\")"].join(_KID_NL)
  ),
  elif: _kidEntry(
    ["첫 규칙은 틀렸지만 대신 ~라면!", "위의 if가 틀렸을 때 두 번째 질문을 이어서 물어봐요.", "학점을 A, B, C처럼 여러 단계로 나눌 때 써요.", "elif 다른조건:", "두 번째로 검사할 질문 (예: 점수 >= 80)", "앞선 규칙이 틀리고 이번 규칙이 맞을 때만 실행돼요."],
    ["Otherwise, check if this rule is true", "Asks a follow-up question when the first 'if' did not match.", "Use it for grading A, B, or C step by step.", "elif next_rule:", "Write the next yes/no check.", "Runs only when earlier checks failed and this one passes."],
    ["if score >= 90:", "    grade = \"A\"", "elif score >= 80:", "    grade = \"B\""].join(_KID_NL)
  ),
  else: _kidEntry(
    ["앞의 규칙들이 다 아닐 때!", "위의 모든 if 조건이 틀렸을 때 마지막으로 실행되는 길이에요.", "비밀번호가 맞으면 '성공', 그 외엔 전부 '실패'라고 말할 때 써요.", "else:", "괄호나 질문 없이 바로 뒤에 실행할 내용을 적어요.", "앞선 조건 중 하나도 맞지 않았을 때만 이 코드가 실행돼요."],
    ["Otherwise do this instead", "The backup path when none of the 'if' checks matched.", "Use it to say 'Try again' whenever a password is wrong.", "else { ... } / else:", "Nothing goes inside a condition here; write the backup steps.", "Runs only if all earlier 'if' checks were false."]
  ),
  for: _kidEntry(
    ["정해진 만큼 차례대로 반복하기", "목록에 있는 물건을 하나씩 꺼내거나 정해진 횟수만큼 같은 일을 반복해요.", "친구 10명 모두에게 인사말을 보내거나 1부터 5까지 셀 때 써요.", "for 하나 in 목록:", "꺼내 담을 이름표와 반복할 목록이나 숫자 범위", "목록이 끝날 때까지 안쪽 코드를 한 번씩 차례대로 실행해요."],
    ["Repeat once for each item", "Picks up items one at a time or repeats a set number of times.", "Use it to greet every friend in a list or count 1 to 5.", "for (item) / for item in items:", "Write the item name and the list or range to step through.", "Runs the inside code once for every item."] ,
    ["for i in range(3):", "    print(i)"].join(_KID_NL)
  ),
  while: _kidEntry(
    ["~인 동안 계속 반복하기", "정해둔 규칙이 계속 맞는 동안 멈추지 않고 같은 일을 반복해요.", "게임에서 목숨이 남아 있는 동안 계속 움직이게 할 때 써요.", "while 조건:", "계속 반복해도 될지 확인하는 규칙 (예: 체력 > 0)", "규칙이 거짓이 될 때까지 계속 돌다가 조건이 깨지면 멈춰요."],
    ["Keep repeating as long as true", "Loops over and over while a condition stays true.", "Use it to keep a game running while hearts > 0.", "while (rule) / while rule:", "Write the check that keeps the loop going.", "Repeats until the rule becomes false."]
  ),
  do: _kidEntry(
    ["일단 한 번 해보고 반복할지 묻기", "먼저 안쪽 코드를 한 번 꼭 실행한 다음 계속 반복할지 확인해요.", "최소 한 번은 문제를 물어보고 맞을 때까지 다시 물어볼 때 써요.", "do { ... } while (조건);", "먼저 실행할 내용과 뒤에 달아둘 반복 조건", "무조건 1번은 실행되고, 조건이 맞으면 이어서 반복해요."],
    ["Do once first, then check to repeat", "Runs the steps once right away, then checks if it should loop again.", "Use it when asking a user at least once before repeating.", "do { ... } while (rule);", "Put the steps inside { } and the rule after 'while'.", "Always runs at least once."]
  ),
  break: _kidEntry(
    ["반복문 지금 당장 멈추기", "빙글빙글 돌고 있는 반복문을 그 자리에서 바로 끊고 밖으로 나가요.", "보물을 찾자마자 더 이상 상자를 안 열어봐도 될 때 써요.", "break", "괄호나 추가 값 없이 단어만 적어요.", "반복을 즉시 멈추고 반복문 다음 줄로 넘어가요."],
    ["Stop the loop right now", "Jumps straight out of a loop before it finishes the rest.", "Use it when you already found what you wanted.", "break", "Just write the word inside your loop.", "Exits the loop immediately."]
  ),
  continue: _kidEntry(
    ["이번 차례만 건너뛰고 다음으로!", "반복문 안에서 이번 한 번만 아래 코드를 건너뛰고 바로 다음 차례로 가요.", "짝수만 고르고 홀수는 그냥 지나가고 싶을 때 써요.", "continue", "괄호 없이 단어만 적어요.", "이번 순서를 건너뛰고 반복문의 다음 항목을 시작해요."],
    ["Skip this turn, go to next item", "Jumps straight to the next turn of a loop, skipping the rest of this one.", "Use it to skip empty lines or odd numbers inside a loop.", "continue", "Write the word alone where you want to skip.", "Moves straight to the next loop step."]
  ),
  return: _kidEntry(
    ["결과를 돌려주고 끝내기", "이 작업에서 계산해 낸 답을 부른 곳으로 돌려보내고 일을 끝내요.", "더하기 기계가 계산한 합계를 밖으로 건네줄 때 써요.", "return 돌려줄값", "밖으로 건네줄 결과 숫자나 글자 (없으면 비워둬요)", "값을 건네주며 지금 작업을 바로 마쳐요."],
    ["Hand back the answer and finish", "Sends your answer back to whoever asked for it and finishes the job.", "Use it at the end of a recipe to give back the final total.", "return answer", "Write the value you want to hand back.", "Stops the recipe here and gives back that value."]
  ),
  yield: _kidEntry(
    ["하나씩 천천히 건네주기", "결과를 한꺼번에 다 만들지 않고 필요할 때마다 하나씩 꺼내 줘요.", "숫자 100만 개를 메모리에 한 번에 올리지 않고 한 개씩 줄 때 써요.", "yield 꺼내줄값", "이번 차례에 잠깐 건네줄 값", "다음에 다시 부르면 방금 멈췄던 다음 줄부터 이어서 실행돼요."],
    ["Hand out one piece at a time", "Pauses to hand out one item now, and continues from there next time.", "Use it for huge lists so you do not build everything at once.", "yield next_item", "Write the next piece to hand out.", "Pauses and remembers where it left off."]
  ),
  pass: _kidEntry(
    ["아직 비어 있으니 그냥 넘어가기", "코드 자리를 비워두면 에러가 날 때 '여긴 일부러 비워뒀어'라고 적어두는 표시예요.", "나중에 채워 넣을 틀만 먼저 만들어 두고 싶을 때 써요.", "pass", "아무것도 넣지 않고 단어만 적어요.", "아무 일도 하지 않고 조용히 다음 줄로 넘어가요."],
    ["Do nothing here on purpose", "A placeholder telling Python this spot is intentionally empty for now.", "Use it while sketching the outline of a program before filling it in.", "pass", "Write just the word on an indented line.", "Does nothing and moves on without error."]
  ),
  switch: _kidEntry(
    ["값에 따라 알맞은 길 고르기", "한 가지 값이 무엇이냐에 따라 여러 갈래 중 맞는 길로 안내하는 갈림길이에요.", "요일 번호(1~7)에 맞춰 월~일요일을 다르게 보여줄 때 써요.", "switch (값) { case ... }", "갈림길을 고를 기준이 되는 값", "딱 맞는 case 길을 찾아서 실행해요."],
    ["Pick one path from many choices", "Checks one value against several numbered doors and enters the matching one.", "Use it for menu choices 1, 2, 3 instead of lots of 'if' checks.", "switch (value) { case 1: ... }", "Put the value you want to match inside ( ).", "Jumps to the matching 'case' door."]
  ),
  case: _kidEntry(
    ["갈림길의 한 번호표", "switch나 match 안에서 '값이 이거랑 같으면 여기로 와!'라고 적는 번호표예요.", "메뉴 번호가 1번일 때 실행할 안내를 적을 때 써요.", "case 찾을값:", "비교해 볼 고정 값 (예: 1 또는 \"apple\")", "값이 이 번호표와 똑같으면 아래 코드를 실행해요."],
    ["One matching option door", "Marks one specific match inside a switch or match block.", "Use it to say 'if the choice is 1, do this'.", "case value:", "Write the exact value to match after 'case'.", "Runs the lines below when the value matches."]
  ),
  default: _kidEntry(
    ["아무 번호표에도 안 걸렸을 때", "switch 안에서 어떤 case와도 맞지 않을 때 마지막으로 들르는 기본 길이에요.", "없는 메뉴 번호를 눌렀을 때 '다시 골라주세요'를 띄울 때 써요.", "default:", "별도의 값 없이 바로 뒤에 기본 실행 내용을 적어요.", "일치하는 case가 하나도 없을 때 실행돼요."],
    ["Fallback door when nothing matches", "The last path inside a switch block if no 'case' matched.", "Use it to show 'Invalid choice' for unknown inputs.", "default:", "Write the fallback steps after ':'.", "Runs only when every case missed."]
  ),
  when: _kidEntry(
    ["값에 맞춰 길 고르기 (코틀린)", "값이 어떤 범위나 모양에 맞는지 보고 딱 맞는 길 하나를 골라 실행해요.", "점수 구간에 따라 칭찬 문구를 다르게 줄 때 깔끔하게 써요.", "when (값) { ... }", "검사할 값과 '값 -> 할 일' 목록", "처음으로 조건이 맞는 줄의 결과를 실행하거나 돌려줘요."],
    ["Pick the right branch (Kotlin)", "Matches a value against rules and runs the first branch that fits.", "Use it for clean multi-way choices like grades or days.", "when (value) { ... }", "Put the value in ( ) and 'match -> result' lines inside.", "Runs the matching branch."]
  ),
  match: _kidEntry(
    ["모양을 보고 딱 맞는 길 고르기", "들어온 값의 모양이나 내용을 보고 똑같은 패턴을 찾아 실행해요.", "명령어 글자에 따라 다른 동작을 깔끔하게 나눌 때 써요.", "match 값:", "비교해 볼 값과 아래의 case 패턴들", "패턴과 딱 맞는 한 곳의 코드가 실행돼요."],
    ["Match a value against patterns", "Checks what shape or value something has and picks the matching branch.", "Use it when handling different command names or shapes.", "match value:", "Put the value to check after 'match' and 'case' patterns below.", "Runs whichever pattern fits first."]
  ),
  guard: _kidEntry(
    ["조건 안 맞으면 여기서 바로 돌아가기 (스위프트)", "이 조건이 꼭 맞아야 다음으로 진행하고, 아니면 else에서 바로 멈추는 보초예요.", "값이 비어 있거나 잘못됐을 때 미리 빠져나와 코드를 깔끔하게 만들 때 써요.", "guard 조건 else { return }", "꼭 지켜야 할 규칙과 틀렸을 때 빠질 return 문", "조건이 맞으면 아래로 계속 내려가고, 틀리면 여기서 빠져나가요."],
    ["Stop early if a rule fails (Swift)", "A bouncer that makes sure a check passes before moving forward.", "Use it to exit right away when data is empty or wrong.", "guard rule else { return }", "Write the required rule and an 'else' exit.", "Keeps going only if the rule passes."]
  ),
  defer: _kidEntry(
    ["이 일이 끝날 때 마지막으로 꼭 하기", "지금 바로 실행하지 않고, 이 작업이 끝나고 나가기 직전에 마지막으로 실행해요.", "열어둔 파일을 깜빡하지 않고 마지막에 꼭 닫게 해줄 때 써요.", "defer { 마지막에 할 일 }", "작업이 끝날 때 뒤처리로 꼭 실행할 코드", "중간에 return으로 빠져나가도 마지막 정리는 꼭 실행돼요."],
    ["Save this cleanup for the very end", "Waits to run cleanup steps right before leaving the current block.", "Use it so opened files always get closed no matter how you exit.", "defer { cleanup() }", "Put the cleanup step inside { }.", "Runs automatically right as the block finishes."]
  ),
  try: _kidEntry(
    ["문제가 생길지 조심해서 시도하기", "실행하다 에러가 날 수도 있는 코드를 감싸서 프로그램이 꺼지지 않게 보호해요.", "파일 열기나 인터넷 연결처럼 실패할 수 있는 일을 할 때 써요.", "try { 조심할 일 } / try:", "실패할 수도 있는 코드", "문제없이 끝나면 넘어가고, 에러가 나면 바로 catch/except로 잡아요."],
    ["Try risky code safely", "Wraps code that might fail so your app does not crash if something breaks.", "Use it when opening files, reading numbers, or using the internet.", "try { ... } / try:", "Put the risky steps inside.", "Catches errors instead of crashing."]
  ),
  catch: _kidEntry(
    ["문제가 생겼을 때 받아서 수습하기", "try 안에서 에러가 터졌을 때 대신 받아서 안내 메시지를 띄우는 안전망이에요.", "숫자 대신 글자를 입력해서 계산이 멈췄을 때 친절하게 다시 묻는 데 써요.", "catch (에러) { 수습할 일 }", "잡아낼 문제 이름표와 고쳐줄 코드", "에러가 발생해도 앱이 꺼지지 않고 수습 코드가 실행돼요."],
    ["Catch an error and handle it", "Runs right away if code inside 'try' ran into a problem.", "Use it to show a friendly warning instead of crashing.", "catch (err) { ... }", "Name the error in ( ) and write how to recover inside { }.", "Keeps the program running safely."]
  ),
  except: _kidEntry(
    ["문제가 생겼을 때 받아서 수습하기 (파이썬)", "try 안에서 문제가 터졌을 때 멈추지 않고 대신 실행되는 안전망이에요.", "0으로 나누려 하거나 없는 파일을 열었을 때 안내 문구를 띄울 때 써요.", "except 문제이름:", "잡아낼 문제 이름 (비우면 모든 문제)과 수습 코드", "프로그램이 튕기지 않고 안전하게 안내를 보여준 뒤 이어져요."],
    ["Catch a problem safely (Python)", "Runs your backup plan whenever code inside 'try' hits an error.", "Use it when dividing by zero or opening a missing file.", "except ProblemName:", "Write which problem to catch and what backup code to run.", "Prevents crashes and handles errors gently."]
  ),
  finally: _kidEntry(
    ["성공하든 실패하든 무조건 마지막에 실행", "에러가 나든 안 나든 try 작업이 끝나면 마지막에 꼭 거치는 마무리 구역이에요.", "불 끄고 문 잠그듯이 다 쓴 파일이나 연결을 정리할 때 써요.", "finally: / finally { ... }", "무조건 마무리로 실행할 코드", "항상 실행된 뒤 다음 코드로 넘어가요."],
    ["Always run at the very end", "Runs your cleanup code whether 'try' succeeded or failed.", "Use it to close files or hide a loading spinner every time.", "finally { ... } / finally:", "Put the must-run cleanup steps inside.", "Guaranteed to run before leaving."]
  ),
  throw: _kidEntry(
    ["직접 문제 알림 울리기", "잘못된 값이 들어왔을 때 일부러 빨간 경고 알림을 던져서 멈추게 해요.", "나이에 마이너스 숫자가 들어왔을 때 '잘못된 나이!'라고 알릴 때 써요.", "throw 새 문제", "만들어서 던질 문제 알림 내용", "즉시 작업을 멈추고 바깥의 안전망(catch/except)으로 보내요."],
    ["Raise a problem alarm on purpose", "Triggers an error alarm right away when rules are broken.", "Use it if someone passes a negative age or invalid score.", "throw / raise Problem(...)", "Write or build the problem alert to send up.", "Stops here and jumps to the nearest catch/except."]
  ),
  assert: _kidEntry(
    ["이건 꼭 참이어야 해! 점검하기", "우리가 믿고 있는 규칙이 진짜 맞는지 검사해서 틀리면 바로 멈춰 알려줘요.", "테스트할 때 내 계산 결과가 기대한 답과 같은지 확인할 때 써요.", "assert 맞는지검사, 안내말", "꼭 맞아야 하는 조건 (선택으로 틀릴 때 보여줄 글)", "맞으면 조용히 통과하고, 틀리면 바로 멈춰서 실수를 알려줘요."],
    ["Double-check that a rule is true", "Checks an assumption and stops loudly if it turns out false.", "Use it in tests to be sure 2 + 2 really equals 4.", "assert check", "Write the condition that must be true.", "Stays quiet if true, stops with an alert if false."]
  ),
  def: _kidEntry(
    ["나만의 새 일꾼 명령 만들기 (레시피)", "자주 쓰는 여러 줄의 일을 하나로 묶어 이름을 붙여두는 레시피예요.", "점수 계산이나 인사하기를 이름 하나로 언제든 다시 불러 쓰고 싶을 때 써요.", "def 명령이름(넣을재료):", "명령 이름, 괄호 안에 받을 재료들, 그리고 아래의 실행할 일", "이제 '명령이름()'이라고 부르기만 하면 묶어둔 일이 한 번에 실행돼요."],
    ["Make your own helper recipe", "Bundles steps under a reusable name so you do not rewrite them.", "Use it whenever you want to reuse a greeting or math formula.", "def name(inputs):", "Pick a name, list any inputs in ( ), and write the steps below.", "Lets you call that whole recipe by its short name."]
  ),
  lambda: _kidEntry(
    ["이름 없는 초간단 한 줄 명령", "따로 이름을 길게 짓지 않고 그 자리에서 한 줄로 잠깐 만들어 쓰는 일꾼 명령이에요.", "숫자 목록을 정렬하거나 2배씩 바꿀 때 간단한 규칙 하나만 넘길 때 써요.", "lambda 재료: 계산할내용", "콜론 앞에는 받을 재료, 뒤에는 바로 내놓을 결과 식", "작고 가벼운 즉석 명령 하나가 만들어져 바로 쓰여요."],
    ["Tiny one-line mini recipe", "Makes a quick nameless mini-command right where you need it.", "Use it for short sorting or math rules in a single line.", "lambda x: x + 1", "Input before ':' and quick result after ':'.", "Gives a lightweight one-line helper on the spot."]
  ),
  class: _kidEntry(
    ["비슷한 물건 찍어내는 설계도 만들기", "캐릭터나 자동차처럼 특징과 행동을 가진 물건을 여러 개 찍어낼 설계도를 만들어요.", "학생, 몬스터, 버튼처럼 똑같은 틀로 여러 개를 만들어 쓰고 싶을 때 써요.", "class 설계도이름:", "설계도가 가질 정보들과 할 수 있는 행동들", "이 설계도 이름으로 나만의 새 물건을 몇 개든 찍어낼 수 있어요."],
    ["Make a blueprint for building things", "Defines a blueprint with properties and actions so you can stamp out many copies.", "Use it to model players, monsters, cars, or cards.", "class BlueprintName { ... }", "Put the traits and helper actions inside.", "Lets you build real objects from that blueprint."]
  ),
  struct: _kidEntry(
    ["정보를 한 묶음으로 모으는 작은 상자", "이름, 나이, 점수처럼 서로 관련된 값들을 한 묶음으로 묶어두는 가벼운 틀이에요.", "좌표(x, y)나 학생 프로필처럼 여러 값을 한 덩어리로 들고 다닐 때 써요.", "struct 묶음이름 { ... }", "한 묶음에 같이 들어갈 이름과 값 종류들", "여러 값이 깔끔한 한 상자에 담겨 들고 다니기 쉬워져요."],
    ["Bundle related info into one box", "Groups matching pieces like x and y or name and age into one neat package.", "Use it for points, profiles, or settings.", "struct BoxName { ... }", "List the fields stored together inside.", "Makes a neat compact value package."]
  ),
  interface: _kidEntry(
    ["꼭 갖춰야 할 기능 약속표", "'이 설계도는 이 행동들을 꼭 할 줄 알아야 해!'라고 규칙 목록만 적는 약속표예요.", "서로 다른 기계라도 똑같은 버튼 규격을 갖추게 맞춰줄 때 써요.", "interface 약속이름 { ... }", "꼭 만들어야 할 명령 이름과 모양 목록", "이 약속을 따르는 설계도들은 모두 같은 방식으로 쓸 수 있어요."],
    ["Checklist of actions a thing must have", "Writes down the required abilities any matching blueprint must provide.", "Use it so different shapes or tools follow one shared plug style.", "interface Rules { ... }", "List the required command names.", "Guarantees compatible parts work together."]
  ),
  enum: _kidEntry(
    ["정해진 보기 목록 만들기", "동·서·남·북이나 빨강·초록·파랑처럼 딱 정해진 선택지 묶음을 만들어요.", "오타를 내지 않고 정해진 보기 중에서만 안전하게 고르고 싶을 때 써요.", "enum 보기이름 { 보기1, 보기2 }", "선택할 수 있는 고정 보기 이름들", "정해진 보기 외에 엉뚱한 글자가 들어가는 실수를 막아줘요."],
    ["Make a fixed list of choices", "Defines a locked set of named options like North, South, East, West.", "Use it to prevent spelling mistakes on fixed choices.", "enum Choices { A, B }", "Write the allowed option names.", "Only lets valid choices from that list be used."]
  ),
  var: _kidEntry(
    ["나중에 바꿀 수 있는 이름표 상자", "숫자나 글자를 담아두고, 나중에 다른 값으로 갈아 끼울 수 있는 상자를 만들어요.", "게임 점수나 체력처럼 계속 바뀌는 값을 기억해 둘 때 써요.", "var 상자이름 = 처음값", "상자에 붙일 이름과 처음에 넣어둘 값", "이름표가 붙은 상자가 생겨서 언제든 새 값으로 바꿀 수 있어요."],
    ["Make a changeable labeled box", "Creates a storage box whose value you can update later.", "Use it for scores, timers, or counters that change over time.", "var boxName = value", "Give it a name and starting value.", "Creates a box you can refill anytime."]
  ),
  val: _kidEntry(
    ["한 번 넣으면 안 바뀌는 상자 (코틀린)", "처음 넣은 값을 딱 잠가두어 실수로 다른 값으로 덮어쓰지 못하게 지켜줘요.", "내 생일이나 정해진 기준 점수처럼 바뀌면 안 되는 값을 담을 때 써요.", "val 상자이름 = 값", "이름과 처음에 넣고 잠글 값", "안전하게 잠긴 이름표 상자가 만들어져 안심하고 읽을 수 있어요."],
    ["Make a locked single-use box (Kotlin)", "Stores a value once and locks the box so nothing changes it by mistake.", "Use it for IDs or numbers that should stay fixed.", "val boxName = value", "Write the box name and fixed value.", "Keeps the stored value safe from accidental edits."]
  ),
  let: _kidEntry(
    ["값 담아두는 이름표 상자", "JS에서는 값을 바꿀 수 있는 상자를, 스위프트에서는 한 번 담고 잠그는 상자를 만들어요.", "계산할 값을 잠깐 담아두거나 안전하게 보관할 때 써요.", "let 상자이름 = 값", "상자 이름과 처음 넣어둘 값", "그 이름만 적으면 안에 든 값을 언제든 꺼내 쓸 수 있어요."],
    ["Make a labeled value box", "Creates a storage box (changeable in JavaScript, locked in Swift).", "Use it to hold numbers or text under an easy name.", "let boxName = value", "Write the name and value after '='.", "Lets you refer to that value by name."]
  ),
  const: _kidEntry(
    ["절대 안 바뀌는 잠긴 상자", "처음 넣은 값을 자물쇠로 잠가서 나중에 실수로 바꾸지 못하게 보호해요.", "원주율(3.14)이나 게임 최대 시간처럼 고정된 값을 적을 때 써요.", "const 상자이름 = 값", "이름과 잠가둘 고정 값", "값이 고정되어 헷갈리거나 실수로 덮어쓸 일이 없어요."],
    ["Make a locked box that never changes", "Locks a value in place so it cannot be replaced later.", "Use it for rules or settings that stay fixed.", "const BOX_NAME = value", "Give it a name and permanent value.", "Protects important values from accidental changes."]
  ),
  import: _kidEntry(
    ["남이 만든 도구 상자 빌려오기", "이미 잘 만들어져 있는 계산기나 날짜 도구 같은 외부 도구 상자를 내 파일로 가져와요.", "랜덤 숫자 뽑기나 인터넷 통신 도구를 가져와 바로 쓰고 싶을 때 써요.", "import 상자이름", "빌려올 도구 상자(모음)의 이름", "가져온 도구 상자 안의 편리한 명령들을 바로 부를 수 있어요."],
    ["Borrow a toolbox from outside", "Brings ready-made tools (like math, time, or web helpers) into your file.", "Use it at the top of your file before using extra tools.", "import toolboxName", "Write the name of the toolbox you want to bring in.", "Unlocks all commands inside that toolbox."]
  ),
  from: _kidEntry(
    ["특정 도구 상자 안에서 딱 골라 가져오기", "큰 도구 상자 전체가 아니라 그 안의 마음에 드는 도구 몇 개만 콕 집어 빌려와요.", "math 상자에서 딱 제곱근(sqrt) 하나만 짧게 부르고 싶을 때 써요.", "from 상자 import 도구이름", "어느 상자에서 무엇만 꺼내올지 차례로 적어요.", "상자 이름을 길게 안 붙이고도 꺼내온 도구를 바로 쓸 수 있어요."],
    ["Pick specific tools from a toolbox", "Imports only the exact tools you want from inside a toolbox.", "Use it with 'import' to call 'sqrt(9)' directly instead of 'math.sqrt(9)'.", "from toolbox import tool", "Write the toolbox after 'from' and the tool after 'import'.", "Brings just those tools right into your file."]
  ),
  export: _kidEntry(
    ["내 도구를 다른 파일에서도 쓰게 내보내기", "내가 잘 만들어둔 상자나 명령을 다른 파일에서도 import 해서 쓸 수 있게 열어줘요.", "여러 파일로 큰 프로젝트를 나누어 깔끔하게 정리할 때 써요.", "export 명령이름", "바깥 파일에서 가져갈 수 있게 공개할 이름", "다른 파일이 이 이름들을 안전하게 불러다 쓸 수 있어요."],
    ["Share your tool with other files", "Makes your value or recipe available for other files to import.", "Use it when organizing a big project across multiple files.", "export name", "Put 'export' in front of what you want to share.", "Other files can now import and reuse it."]
  ),
  async: _kidEntry(
    ["기다리는 동안 다른 일도 할 수 있게 표시", "인터넷에서 사진 받아오기처럼 오래 걸리는 작업임을 미리 표시해 화면이 멈추지 않게 해요.", "네트워크나 타이머를 기다릴 때 앱이 먹통이 되지 않게 하려고 써요.", "async def / async function", "기다림이 필요한 명령 앞에 붙여줘요.", "안에서 'await(기다리기)'를 써도 화면이 부드럽게 계속 움직여요."],
    ["Allow waiting without freezing", "Marks a recipe that does slow tasks (like fetching web data) without blocking the screen.", "Use it whenever you plan to use 'await' inside.", "async function / async def", "Place before the recipe header.", "Lets other work keep moving while waiting."]
  ),
  await: _kidEntry(
    ["오래 걸리는 일이 끝날 때까지 잠시 기다리기", "인터넷에서 답이 올 때까지 잠깐 기다렸다가, 도착하면 그 결과를 받아 다음 줄을 실행해요.", "서버에서 데이터를 다 받아온 뒤에 화면에 그려주고 싶을 때 써요.", "결과 = await 오래걸리는일()", "다 끝날 때까지 기다릴 비동기 작업", "작업이 다 끝난 뒤 진짜 결과 값이 상자에 들어가요."],
    ["Pause neatly until a slow job finishes", "Waits for a background task (like a download) to finish before running the next line.", "Use it inside an 'async' recipe when you need the finished result.", "answer = await slowJob()", "Place right in front of the slow task.", "Hands you the completed result once ready."]
  ),
  new: _kidEntry(
    ["설계도로 새 물건 하나 찍어내기", "설계도(class)를 보고 실제로 사용할 새 물건(객체)을 하나 만들어내요.", "새 날짜 상자, 새 게임 캐릭터를 하나 뚝딱 만들 때 써요.", "new 설계도이름(초기값)", "만들고 싶은 설계도 이름과 처음 세팅할 값들", "방금 찍어낸 따끈따끈한 새 물건이 만들어져요."],
    ["Build a fresh copy from a blueprint", "Stamps out a brand-new working object using a blueprint.", "Use it to create a new Date, List, or custom game character.", "new Blueprint(inputs)", "Write the blueprint name and starting info in ( ).", "Gives you a brand-new copy ready to use."]
  ),
  this: _kidEntry(
    ["바로 나 자신을 가리키는 손가락", "설계도 안에서 다른 게 아니라 '지금 일하고 있는 바로 나 자신'을 가리켜요.", "내 이름이나 내 점수를 다른 사람 것과 헷갈리지 않고 콕 집을 때 써요.", "this.내이름 / self.내이름", "보통 뒤에 점(.)을 찍고 내 안의 정보나 명령을 적어요.", "정확하게 현재 물건 안에 들어 있는 정보에 닿아요."],
    ["Points right to 'myself'", "Refers to the current object itself from inside its own blueprint.", "Use it to read or update my own name or score.", "this.name / self.name", "Follow it with a dot and the field you want.", "Updates or reads this specific object's own value."],
    "this.score = 100"
  ),
  print: _kidEntry(
    ["글자나 숫자를 화면에 보여주기", "컴퓨터가 계산한 결과나 인사말을 화면 창에 똑똑히 적어 보여줘요.", "내 코드가 잘 돌아가는지 눈으로 확인하거나 사용자에게 말을 걸 때 써요.", "print(보여줄내용)", "화면에 보여주고 싶은 글자, 숫자, 또는 상자 이름", "괄호 안에 넣은 내용이 화면 아래쪽 창에 바로 나타나요."],
    ["Show words or numbers on screen", "Prints messages, numbers, or answers to the screen so you can read them.", "Use it to say hello or check what is inside your box.", "print(thing)", "Put text in quotes or a box name inside ( ).", "The text appears right away on the output screen."],
    "print(\"Hello!\")"
  ),
  "console.log": _kidEntry(
    ["화면에 글자나 값 띄워보기 (JS)", "개발자 확인 창에 글자, 숫자, 상자 안의 내용을 쏙 적어 보여줘요.", "내 자바스크립트 코드가 어디까지 실행됐는지 값을 확인하며 찾고 싶을 때 써요.", "console.log(보여줄내용)", "확인해 보고 싶은 글자나 계산 결과, 상자 이름", "콘솔 창에 값이 깔끔하게 찍혀 나와요."],
    ["Print values to check your code (JS)", "Writes messages or box values into the console screen so you can inspect them.", "Use it anytime to peek at what your code is doing.", "console.log(value)", "Put words, numbers, or boxes inside ( ).", "Shows your message in the console."],
    "console.log(\"Ready!\");"
  ),
  input: _kidEntry(
    ["사용자에게 직접 물어보고 답 받기", "화면에 질문을 띄우고, 사람이 키보드로 타자를 쳐서 엔터를 누를 때까지 기다려 답을 받아와요.", "이름이나 나이를 키보드로 직접 입력받아 인사할 때 써요.", "답 = input(\"질문: \")", "키보드를 치기 전에 화면에 보여줄 안내 질문 글자", "사람이 입력한 내용이 글자 모양으로 상자에 담겨요."],
    ["Ask the user and wait for typing", "Shows a question on screen and waits until the user types an answer.", "Use it to ask for someone's name or guess in a game.", "answer = input(\"Your name? \")", "Put the question message inside ( ).", "Gives back whatever the user typed as text."]
  ),
  scanf: _kidEntry(
    ["키보드 입력을 읽어 상자에 넣기 (C)", "사람이 키보드로 친 숫자나 글자를 규칙에 맞게 읽어 상자에 넣어줘요.", "C 언어에서 정수나 글자를 직접 입력받아 계산할 때 써요.", "scanf(\"%d\", &상자)", "읽어올 모양(\"%d\" 등)과 값을 넣을 상자 주소(&상자)", "입력한 값이 해당 상자 안에 저장돼요."],
    ["Read typed keyboard input into a box (C)", "Reads numbers or letters typed by the user and stores them in your box.", "Use it in C when taking keyboard input.", "scanf(\"%d\", &num);", "Write format like \"%d\" and &boxName.", "Saves the typed value into that box."]
  ),
  len: _kidEntry(
    ["몇 개·몇 글자인지 길이 재기", "글자가 총 몇 글자인지, 목록에 물건이 몇 개 들어있는지 숫자로 세어줘요.", "비밀번호가 너무 짧진 않은지 확인하거나 장바구니 물건 수를 셀 때 써요.", "len(셀대상)", "길이를 재고 싶은 글자나 목록 상자", "몇 개인지 세어낸 숫자(예: 5)를 돌려줘요."],
    ["Count how many items or letters", "Tells you how long a word is or how many items sit inside a list.", "Use it to check password length or count players.", "len(box)", "Put the word or list inside ( ).", "Gives back a whole number count."],
    "len(\"hello\")"
  ),
  range: _kidEntry(
    ["차례대로 숫자 줄 세워 만들기", "0부터 9까지처럼 연속된 숫자들을 순서대로 똑딱 만들어내요.", "for 반복문과 짝을 이뤄 딱 5번만 반복하거나 1부터 10까지 세고 싶을 때 써요.", "range(끝) / range(시작, 끝)", "몇 개 만들지 끝 숫자 (끝 숫자는 포함 안 돼요!)", "차례대로 숫자가 나오는 숫자 줄이 만들어져요."],
    ["Generate a line of numbers in order", "Makes a sequence like 0, 1, 2, 3, 4 without typing each number by hand.", "Use it with 'for' loops to count a fixed number of times.", "range(5) / range(start, stop)", "Put the stop number (it stops right before that number!).", "Produces each number one step at a time."]
  ),
  enumerate: _kidEntry(
    ["번호표 붙여서 하나씩 꺼내기", "목록에서 물건을 꺼낼 때 '0번 사과, 1번 바나나'처럼 순서 번호표를 같이 붙여 꺼내요.", "몇 번째 항목을 보고 있는지 번호도 같이 출력하고 싶을 때 아주 편리해요.", "for 번호, 물건 in enumerate(목록):", "번호표를 붙이고 싶은 목록", "(번호, 물건) 쌍이 차례로 나와서 번호를 따로 셀 필요가 없어요."],
    ["Grab each item with its slot number", "Hands out both the position number (0, 1, 2...) and the item together.", "Use it when looping and needing to know which spot number you are at.", "for idx, item in enumerate(list):", "Put your list inside ( ).", "Gives pairs of (number, item) one by one."]
  ),
  zip: _kidEntry(
    ["두 줄을 나란히 짝지어 묶기", "옷 지퍼 올리듯 두 목록의 첫 번째끼리, 두 번째끼리 나란히 한 쌍으로 짝지어줘요.", "이름 목록과 점수 목록을 '철수-90점'처럼 짝 맞춰 보여줄 때 써요.", "zip(목록1, 목록2)", "나란히 짝짓고 싶은 두 개 이상의 목록", "짝지어진 쌍들을 차례로 꺼내 쓸 수 있어요."],
    ["Pair items from two lists side by side", "Zips two lists together like a jacket zipper so matching spots stay paired.", "Use it to pair a list of names with a list of scores.", "zip(names, scores)", "Put the lists you want paired inside ( ).", "Hands out matching pairs together."]
  ),
  int: _kidEntry(
    ["소수점 없는 딱 떨어지는 정수", "1, 20, -5처럼 소수점이 없는 깔끔한 숫자를 뜻하거나 글자를 정수로 바꿔줘요.", "글자 '12'를 계산할 수 있는 숫자 12로 바꿀 때 써요.", "int(값)", "정수로 만들고 싶은 글자나 소수", "소수점 없는 깔끔한 정수가 돼요."],
    ["Whole numbers without decimals", "Stands for whole numbers like 3 or -10, or turns text like '12' into 12.", "Use it before doing math on typed text numbers.", "int(value)", "Put the number or digit text inside ( ).", "Gives a clean whole number."]
  ),
  float: _kidEntry(
    ["소수점 있는 숫자", "3.14나 -0.5처럼 소수점이 있는 세밀한 숫자를 나타내거나 글자를 소수로 바꿔줘요.", "키, 몸무게, 평균 점수처럼 딱 떨어지지 않는 수를 다룰 때 써요.", "float(값)", "소수점 숫자로 바꾸고 싶은 글자나 숫자", "소수점이 달린 숫자로 바뀌어요."],
    ["Numbers with decimal points", "Stands for decimal numbers like 3.14 or 0.5, or turns text into one.", "Use it for prices, averages, or precise measurements.", "float(value)", "Put a number or decimal text inside ( ).", "Gives a decimal number."]
  ),
  str: _kidEntry(
    ["글자 상자 (문자열)", "단어나 문장을 뜻하거나, 숫자 123을 글자 '123'으로 바꿔줘요.", "숫자를 안내 문장에 이어 붙여 화면에 출력하고 싶을 때 써요.", "str(값) / String", "글자로 바꾸고 싶은 숫자나 값", "글자 모양으로 바뀌어 다른 문장과 합칠 수 있어요."],
    ["Words and text", "Stands for text inside quotes, or turns a number like 123 into text '123'.", "Use it when joining numbers into a sentence.", "str(value) / String", "Put a value inside ( ) to convert it into words.", "Produces text you can join or print."]
  ),
  bool: _kidEntry(
    ["참·거짓 판단기", "어떤 값이 맞는지(참) 틀리는지(거짓) 둘 중 하나로 깔끔하게 정해줘요.", "상자가 비었는지 찼는지 OX 답으로 바꿀 때 써요.", "bool(값) / Boolean", "참인지 거짓인지 궁금한 값 (0이나 빈 상자는 거짓)", "True(참) 또는 False(거짓)가 나와요."],
    ["True-or-false check", "Turns any value into a simple yes (true) or no (false) answer.", "Use it to check whether a box is empty or full.", "bool(value)", "Put any value inside ( ) to test if it counts as yes.", "Gives true (non-empty) or false (empty or zero)."]
  ),
  list: _kidEntry(
    ["순서대로 담는 목록 상자", "사과, 배, 포도처럼 여러 물건을 번호 순서대로 줄 세워 담는 상자예요.", "할 일 목록, 친구 명단, 점수 기록을 모아둘 때 써요.", "[물건1, 물건2] / list()", "안에 차례로 담을 물건들", "추가, 빼기, 정렬이 자유로운 목록 상자가 만들어져요."],
    ["An ordered list box for many items", "Keeps multiple items in line so you can add, remove, or grab by position.", "Use it for scores, groceries, or player names.", "[item1, item2] / list()", "Put items separated by commas inside.", "Creates a list box holding all your items in order."]
  ),
  dict: _kidEntry(
    ["이름표(열쇠)로 찾는 사전 상자", "전화번호부처럼 '이름 -> 번호' 한 쌍으로 묶어두어 이름으로 바로 값을 찾아요.", "학생 이름별 점수나 아이템별 가격표를 관리할 때 최고예요.", "{ \"이름\": 값 }", "이름표(열쇠)와 그 짝이 되는 값들", "이름만 부르면 짝이 된 값을 순식간에 꺼내줘요."],
    ["A lookup book of labels and values", "Stores pairs like 'apple -> 5' so you can look up a value by its label right away.", "Use it for phone numbers, scores by name, or settings.", "{ \"key\": value }", "Write 'label: value' pairs separated by commas.", "Lets you fetch any value immediately using its label."]
  ),
  set: _kidEntry(
    ["똑같은 걸 자동으로 빼주는 주머니", "여러 개를 넣어도 똑같은 값은 딱 한 번만 남기고 중복을 없애주는 주머니예요.", "방문자 명단에서 겹치는 이름을 한 번만 세고 싶을 때 써요.", "set(목록) / new Set()", "중복을 없애고 모아두고 싶은 값들", "겹치는 값 없는 깔끔한 모음이 만들어져요."],
    ["A bag with no duplicates allowed", "Stores unique items and automatically drops exact repeats.", "Use it to collect distinct tags or unique visitors.", "set(items) / new Set()", "Put the items you want deduplicated inside ( ).", "Keeps only one copy of each unique item."]
  ),
  append: _kidEntry(
    ["줄 맨 끝에 새로 붙이기", "목록 상자의 제일 마지막 칸 뒤에 새 물건을 하나 톡 붙여넣어요.", "할 일 목록 맨 아래에 새 할 일을 추가할 때 써요.", "목록.append(새값)", "줄 맨 끝에 새로 이어 붙일 값", "원래 목록의 맨 끝 길이가 1칸 늘어나며 값이 들어가요."],
    ["Add one item to the very end", "Tacks a new item onto the tail end of a list.", "Use it when building up scores or tasks one by one.", "list.append(item) / arr.push(item)", "Put the new item inside ( ).", "Your list grows by one with the new item at the end."],
    "fruits.append(\"apple\")"
  ),
  pop: _kidEntry(
    ["맨 끝이나 지정한 칸 꺼내고 지우기", "목록에서 값 하나를 쑥 뽑아내어 나한테 주면서 동시에 목록에서는 빼버려요.", "쌓아둔 접시 맨 위 한 장을 집어 들 때처럼 써요.", "목록.pop(자리번호)", "비워두면 맨 끝 걸 뽑고, 번호를 적으면 그 칸 걸 뽑아요.", "뽑아낸 값을 돌려주고 목록에서는 사라져요."],
    ["Pull out and remove one item", "Takes an item out of a list, hands it to you, and removes it from the list.", "Use it like taking the top plate off a stack.", "list.pop()", "Leave ( ) empty for the last item, or put a position number.", "Gives you the removed item and shortens the list."]
  ),
  insert: _kidEntry(
    ["중간 원하는 자리에 새치기해 넣기", "맨 끝이 아니라 내가 지정한 칸 번호 자리에 새 값을 쏙 끼워 넣어요.", "달리기 1등 자리에 새 선수를 끼워 넣고 나머지를 뒤로 밀 때 써요.", "목록.insert(자리번호, 값)", "넣을 칸 번호와 집어넣을 새 값", "그 자리에 새 값이 들어가고 뒤쪽 물건들은 한 칸씩 밀려나요."],
    ["Tuck an item into a specific spot", "Drops a new item at any slot number you pick and shifts later ones down.", "Use it when inserting someone at position 0 (the front).", "list.insert(index, item)", "Put the slot number first and the new item second.", "Places the item right at that position."]
  ),
  remove: _kidEntry(
    ["찾아서 똑 떼어 지우기", "목록 안에서 내가 적은 값과 똑같은 걸 찾아 지워버려요.", "장바구니에서 이미 산 물건 하나만 쏙 빼고 싶을 때 써요.", "목록.remove(지울값)", "목록에서 찾아서 없애고 싶은 값", "제일 먼저 찾은 해당 물건이 목록에서 깔끔히 사라져요."],
    ["Find a matching item and erase it", "Looks for the item you named inside the list and removes it.", "Use it to cross a finished item off your list.", "list.remove(item)", "Write the exact item to erase inside ( ).", "Deletes the first match from your list."]
  ),
  clear: _kidEntry(
    ["상자 안을 깨끗이 싹 비우기", "목록이나 사전 상자 안에 들어있던 모든 내용을 한 번에 다 비워 0칸으로 만들어요.", "새 게임을 시작할 때 이전 점수판을 싹 지워 초기화할 때 써요.", "상자.clear()", "괄호 안은 비워서 그대로 불러요.", "상자 자체는 남고 안의 내용물만 텅 비워져요."],
    ["Empty everything out at once", "Wipes all items inside a box or list so it becomes empty (length 0).", "Use it when resetting a scoreboard or cart.", "box.clear()", "Call with empty ( ).", "Leaves an empty box ready to reuse."]
  ),
  sort: _kidEntry(
    ["작은 순·가나다순으로 가지런히 줄 세우기", "뒤죽박죽 섞여 있던 숫자나 단어를 보기 좋게 순서대로 정렬해요.", "시험 점수를 높은 순·낮은 순으로 나란히 세울 때 써요.", "목록.sort() / sorted(목록)", "비워두면 작은 것부터, 순서 규칙을 적어줄 수도 있어요.", "목록이 크기나 알파벳 순서대로 깔끔히 줄 서요."],
    ["Line items up in neat order", "Puts scrambled numbers or words into sorted order from smallest to largest.", "Use it to rank high scores or alphabetize names.", "list.sort() / sorted(list)", "Leave ( ) empty for A-Z / small-to-big, or give a sorting rule.", "Items become neatly ordered."]
  ),
  reverse: _kidEntry(
    ["앞뒤 순서를 거꾸로 뒤집기", "맨 앞에 있던 걸 맨 뒤로 보내며 줄 선 순서를 180도 반대 방향으로 뒤집어요.", "가장 최근 기록부터 거꾸로 보고 싶을 때 써요.", "목록.reverse() / reversed(목록)", "괄호 안은 비워둬요.", "원래 순서가 정반대로 뒤집어져요."],
    ["Flip the whole order backwards", "Swaps front to back so the last item comes first.", "Use it to view latest messages first or reverse a word.", "list.reverse() / reversed(list)", "Call with empty ( ) (or pass the list into reversed).", "Everything stands in opposite order."]
  ),
  filter: _kidEntry(
    ["마음에 드는 것만 체로 걸러내기", "목록을 쭉 보면서 정해둔 규칙에 맞는 것들만 쏙 골라 새 목록을 만들어요.", "짝수만 남기거나 80점 넘는 친구만 따로 추려낼 때 써요.", "filter(고르는규칙)", "어느 것을 남길지 참/거짓으로 대답하는 검사 규칙", "규칙을 통과한 항목들만 담긴 새 모음이 만들어져요."],
    ["Pick only items that pass a check", "Sifts through a list and keeps only the items where your test says yes.", "Use it to keep only passing scores or even numbers.", "items.filter(check) / filter(check, items)", "Provide a yes/no check for each item.", "Gives a new collection containing only matching items."]
  ),
  forEach: _kidEntry(
    ["목록마다 하나씩 차례로 일 시키기", "배열 안의 물건을 처음부터 끝까지 하나씩 꺼내 정한 일을 반복해 시켜요.", "장바구니의 모든 물건 이름을 한 줄씩 출력할 때 써요.", "목록.forEach((물건) => { 할 일 })", "하나씩 꺼낼 때마다 실행해 줄 행동 규칙", "처음부터 마지막 칸까지 빠짐없이 일을 실행해요."],
    ["Do a job for every single item", "Steps through every item in a list from start to finish and runs your step.", "Use it to print or update every item in a group.", "items.forEach(item => { ... })", "Give the step you want run for each item.", "Visits every item in order."]
  ),
  reduce: _kidEntry(
    ["여러 개를 합쳐 딱 하나의 값으로 줄이기", "목록 안의 여러 숫자나 값을 앞에서부터 차례로 합치며 최종 값 하나를 만들어요.", "장바구니 물건 가격을 전부 더해 총합 금액 하나를 뽑아낼 때 써요.", "목록.reduce((모은값, 하나) => 계산, 시작값)", "값을 합치는 규칙과 처음 시작할 값(보통 0)", "전부 뭉쳐진 단 하나의 최종 결과가 나와요."],
    ["Combine many items into one result", "Folds a whole list down into one single answer (like adding all prices into one total).", "Use it to sum totals or find one combined score.", "items.reduce((sum, x) => sum + x, 0)", "Pass how to merge each item and the starting value.", "Gives back one combined final answer."]
  ),
  indexOf: _kidEntry(
    ["몇 번째 칸에 있는지 자리 찾기", "내가 찾는 글자나 값이 처음 나타나는 칸 번호(0부터 시작!)를 알려줘요.", "없으면 -1을 돌려줘서 들어 있는지 없는지도 알 수 있어요.", "찾을대상.indexOf(찾을값)", "어디 있는지 궁금한 글자나 물건", "찾은 칸 번호를 숫자로 알려주고, 없으면 -1(또는 없음)을 알려줘요."],
    ["Find which slot number an item sits in", "Finds the first position (counting from 0!) where your item appears.", "Use it to locate a word in a sentence or an item in a list.", "target.indexOf(item)", "Put the value you are hunting for inside ( ).", "Gives the slot number, or -1 if missing."]
  ),
  includes: _kidEntry(
    ["안에 들어있는지 OX로 확인하기", "목록이나 긴 글자 속에 내가 찾는 게 들어 있는지 맞다·아니다로 알려줘요.", "댓글에 금지어가 들어있는지, 당첨 번호가 있는지 검사할 때 써요.", "상자.includes(찾을값)", "들어있는지 궁금한 글자나 물건", "들어있으면 참(true), 없으면 거짓(false)을 돌려줘요."],
    ["Check yes/no if something is inside", "Quickly tells you whether an item or word exists inside your list or text.", "Use it to see if a word appears in a message or a name is on the guest list.", "box.includes(item) / box.contains(item)", "Put what you are looking for inside ( ).", "Answers true if found, false if not."]
  ),
  split: _kidEntry(
    ["기준 글자로 문장 가위로 싹둑 자르기", "띄어쓰기나 쉼표 같은 구분선을 기준으로 긴 문장을 여러 조각으로 잘라 목록에 담아요.", "'사과,배,포도'를 쉼표마다 잘라 3개짜리 목록으로 만들 때 써요.", "글자.split(자르는기준)", "무엇을 기준으로 자를지 표시 글자 (예: \" \" 또는 \",\")", "잘라낸 단어 조각들이 순서대로 담긴 새 목록이 나와요."],
    ["Snip a sentence into pieces", "Cuts one long piece of text wherever a divider (like space or comma) appears.", "Use it to turn 'red,blue,green' into 3 separate words.", "text.split(divider)", "Put the divider letter like \",\" or \" \" inside ( ).", "Gives a new list of separated word pieces."],
    "\"a,b,c\".split(\",\")"
  ),
  join: _kidEntry(
    ["떨어진 조각들을 하나로 찰싹 이어 붙이기", "목록에 흩어져 있는 글자 조각들 사이에 연결 글자를 넣어 한 문장으로 합쳐요.", "['안녕', '친구']를 띄어쓰기로 이어 '안녕 친구' 한 줄로 만들 때 써요.", "\"-\".join(목록) / 목록.join(\"-\")", "조각들 사이에 끼워 넣을 연결 글자와 붙일 목록", "모두 하나로 깔끔하게 이어진 긴 글자 한 덩이가 돼요."],
    ["Glue pieces together into one text", "Joins a list of words back into a single sentence using your connector.", "Use it to combine ['hi', 'friend'] with a space into 'hi friend'.", "\", \".join(list) / list.join(\", \")", "Choose the glue text placed between each piece.", "Produces one combined sentence."]
  ),
  replace: _kidEntry(
    ["틀린 글자를 다른 글자로 쏙 바꿔치기", "글자 안에서 마음에 안 드는 부분을 찾아 내가 적은 새 단어로 고쳐 넣어요.", "'2025년'을 '2026년'으로 고치거나 안 좋은 말을 별로 가릴 때 써요.", "글자.replace(찾을말, 바꿀말)", "고칠 옛날 글자를 앞에, 새로 넣을 글자를 뒤에 적어요.", "바뀌어 완성된 새 글자가 만들어져요."],
    ["Swap old text for new text", "Searches for a word inside text and switches it out for a new word.", "Use it to fix typos or swap names in a template.", "text.replace(oldWord, newWord)", "Put what to find first and what to replace it with second.", "Creates updated text with the swap made."]
  ),
  trim: _kidEntry(
    ["양쪽 끝 지저분한 빈칸 잘라내기", "문장 맨 앞과 맨 뒤에 실수로 들어간 띄어쓰기나 줄바꿈을 깔끔히 깎아내요.", "사용자가 이름 뒤에 실수로 스페이스를 쳐도 깔끔히 고쳐줄 때 써요.", "글자.trim() / 글자.strip()", "보통 괄호는 비워두면 양쪽 공백을 모두 깎아내요.", "앞뒤 여백이 말끔히 없어진 글자가 나와요."],
    ["Shave off extra spaces at both ends", "Removes accidental spaces or blank lines from the start and end of text.", "Use it to tidy up what a user typed.", "text.trim() / text.strip()", "Usually leave ( ) empty to trim whitespace.", "Returns clean text with no edge spaces."]
  ),
  toUpperCase: _kidEntry(
    ["모두 큰 영어(대문자)로 키우기", "소문자 알파벳 'hello'를 전부 커다란 대문자 'HELLO'로 바꿔줘요.", "대소문자 구분 없이 똑같은 단어인지 편하게 비교할 때 써요.", "글자.toUpperCase() / 글자.upper()", "괄호 안은 비워두고 부르면 돼요.", "영어가 전부 대문자로 바뀐 새 글자가 나와요."],
    ["Turn all letters into CAPITALS", "Converts lowercase English letters like 'hi' into uppercase 'HI'.", "Use it for loud titles or comparing words without worrying about caps.", "text.toUpperCase() / text.upper()", "Call with empty ( ).", "Gives back ALL-CAPS text."]
  ),
  toLowerCase: _kidEntry(
    ["모두 작은 영어(소문자)로 맞추기", "대문자 알파벳 'HELLO'를 전부 소문자 'hello'로 얌전하게 바꿔줘요.", "이메일 주소나 검색어를 전부 소문자로 통일해 찾을 때 자주 써요.", "글자.toLowerCase() / 글자.lower()", "괄호 안은 비워두고 부르면 돼요.", "영어가 전부 소문자로 바뀐 새 글자가 나와요."],
    ["Turn all letters into lowercase", "Converts uppercase English letters like 'HI' into lowercase 'hi'.", "Use it before checking usernames or search terms.", "text.toLowerCase() / text.lower()", "Call with empty ( ).", "Gives back all-lowercase text."]
  ),
  slice: _kidEntry(
    ["원하는 구간만 쏙 오려내기", "긴 글자나 목록에서 시작 번호부터 끝 번호 바로 앞까지 일부분만 칼로 잘라 꺼내요.", "전화번호 뒷자리 4글자만 뽑거나 상위 3명만 잘라올 때 써요.", "대상.slice(시작, 끝)", "몇 번 칸부터 몇 번 칸 직전까지 자를지 번호를 적어요.", "원래 내용은 그대로 두고 오려낸 새 조각만 돌려줘요."],
    ["Cut out just a section", "Copies out a piece of text or a list from a start spot up to an end spot.", "Use it to grab the first 3 letters or top 5 items.", "target.slice(start, end)", "Write the start number and optional stop number.", "Gives a new slice without breaking the original."]
  ),
  startsWith: _kidEntry(
    ["이 글자로 시작하는지 확인하기", "문장이나 단어가 내가 적은 글자로 맨 앞이 시작되는지 OX로 검사해요.", "인터넷 주소가 'https://'로 시작하는지 확인할 때 딱 좋아요.", "글자.startsWith(앞글자)", "맨 앞에 있는지 확인할 시작 글자", "그 글자로 시작하면 참(true), 아니면 거짓(false)을 알려줘요."],
    ["Check if text begins with certain words", "Checks whether a sentence opens with the exact prefix you typed.", "Use it to verify a web link starts with 'https://'.", "text.startsWith(prefix)", "Write the starting word inside ( ).", "Returns true if it starts that way, false otherwise."]
  ),
  endsWith: _kidEntry(
    ["이 글자로 끝나는지 확인하기", "문장이나 파일 이름이 내가 적은 글자로 맨 끝이 마무리되는지 검사해요.", "파일 이름이 '.jpg' 사진 파일로 끝나는지 확인할 때 딱 좋아요.", "글자.endsWith(끝글자)", "맨 뒤에 붙어 있는지 확인할 끝 글자", "그 글자로 끝나면 참(true), 아니면 거짓(false)을 알려줘요."],
    ["Check if text finishes with certain words", "Checks whether text ends with the ending you specified.", "Use it to check if a filename ends in '.png' or '.txt'.", "text.endsWith(ending)", "Write the ending letters inside ( ).", "Returns true if the ending matches."]
  ),
  sum: _kidEntry(
    ["숫자들 전부 다 더하기", "목록에 들어있는 모든 숫자를 한꺼번에 싹 더해서 총합을 구해줘요.", "과목별 점수를 전부 더해 총점을 낼 때 한 줄로 끝낼 수 있어요.", "sum(숫자목록)", "더하고 싶은 숫자들이 담긴 목록", "전부 더한 최종 합계 숫자가 나와요."],
    ["Add all numbers together", "Adds up every number inside a list in one quick step.", "Use it to total scores or shopping prices.", "sum(numbers)", "Put your list of numbers inside ( ).", "Gives back the total sum."]
  ),
  min: _kidEntry(
    ["제일 작은 값 찾기", "여러 숫자나 목록 중에서 가장 작은 꼴찌 값을 쏙 골라내요.", "달리기 기록 중 제일 빠른(숫자가 작은) 최고 기록을 찾을 때 써요.", "min(값들)", "비교하고 싶은 숫자들 또는 숫자 목록", "가장 작은 값 하나를 찾아 돌려줘요."],
    ["Pick the smallest value", "Compares numbers and finds whichever one is the lowest.", "Use it to find the lowest price or fastest lap time.", "min(a, b) / min(list)", "Put numbers or a list inside ( ).", "Hands back the smallest value."]
  ),
  max: _kidEntry(
    ["제일 큰 값 찾기", "여러 숫자나 목록 중에서 가장 큰 1등 값을 쏙 골라내요.", "지금까지 나온 점수 중 최고 기록을 뽑을 때 바로 써요.", "max(값들)", "비교하고 싶은 숫자들 또는 숫자 목록", "가장 큰 값 하나를 찾아 돌려줘요."],
    ["Pick the biggest value", "Compares numbers and finds whichever one is the highest.", "Use it to find a high score or maximum temperature.", "max(a, b) / max(list)", "Put numbers or a list inside ( ).", "Hands back the biggest value."]
  ),
  abs: _kidEntry(
    ["마이너스(-) 떼고 순수 크기만 구하기", "음수(-5)에서 마이너스 기호를 떼어내 0으로부터 떨어진 거리(5)만 남기는 절댓값이에요.", "두 숫자 차이가 방향 상관없이 얼마나 나는지 잴 때 써요.", "abs(숫자)", "마이너스를 없애고 싶은 숫자", "항상 0 이상의 양수 크기가 나와요."],
    ["Drop any minus sign (absolute value)", "Turns negative numbers positive (like -5 into 5) to show pure distance from zero.", "Use it when you only care how far apart two numbers are.", "abs(number)", "Put any number inside ( ).", "Always gives a zero or positive number."]
  ),
  round: _kidEntry(
    ["가까운 숫자로 반올림하기", "소수점 뒤에 있는 숫자를 보고 0.5 이상이면 올려서 깔끔한 숫자로 반올림해요.", "평균 점수 87.6을 보기 좋게 88점으로 만들 때 써요.", "round(숫자, 자리수)", "반올림할 소수 (선택으로 소수점 몇째 자리까지 남길지)", "깔끔하게 반올림된 숫자가 나와요."],
    ["Round to the nearest number", "Rounds a decimal like 4.6 up to 5 or 4.2 down to 4.", "Use it to turn messy averages into neat numbers.", "round(number)", "Put the decimal number inside ( ).", "Gives back the neatly rounded value."]
  ),
  floor: _kidEntry(
    ["소수점 버리고 아래 정수로 내리기", "3.9여도 소수점을 싹 버리고 바로 아래 정수인 3으로 내려버려요.", "나눗셈 뒤 딱 채운 묶음 개수만 구할 때 써요.", "floor(숫자) / Math.floor(숫자)", "소수점을 버릴 숫자", "작거나 같은 가장 큰 정수가 나와요."],
    ["Round down (chop off decimal)", "Always rounds down to the whole number below (even 3.9 becomes 3).", "Use it when counting full boxes or pages.", "Math.floor(number) / math.floor(number)", "Put your decimal number inside ( ).", "Gives the rounded-down whole number."]
  ),
  ceil: _kidEntry(
    ["소수점이 조금만 있어도 위로 올리기", "3.1이어도 소수점이 조금 남아있으면 천장처럼 위 정수인 4로 올려버려요.", "사탕 10개를 3개씩 담으려면 상자가 4개 필요할 때 올림 계산에 써요.", "ceil(숫자) / Math.ceil(숫자)", "위로 올림할 숫자", "크거나 같은 가장 작은 정수가 나와요."],
    ["Round up to the next whole number", "Always rounds up whenever there is any leftover decimal (even 3.1 becomes 4).", "Use it to figure out how many boxes are needed to fit everything.", "Math.ceil(number) / math.ceil(number)", "Put your decimal number inside ( ).", "Gives the rounded-up whole number."]
  ),
  sqrt: _kidEntry(
    ["제곱해서 이 수가 되는 원래 수 찾기", "'어떤 수를 두 번 곱해야 9가 될까? 바로 3!'처럼 제곱근을 계산해 줘요.", "직각삼각형 빗변 길이나 두 점 사이 거리를 구할 때 써요.", "sqrt(숫자) / Math.sqrt(숫자)", "0 이상의 숫자", "그 수의 제곱근(예: sqrt(9) -> 3)이 나와요."],
    ["Find the square root", "Finds what number times itself equals your number (sqrt(9) = 3).", "Use it in geometry to measure straight distances.", "Math.sqrt(number) / math.sqrt(number)", "Put zero or a positive number inside ( ).", "Gives the square root result."]
  ),
  pow: _kidEntry(
    ["같은 수 여러 번 곱하기 (거듭제곱)", "2를 3번 곱하는 2³(8)처럼 어떤 숫자를 지정한 횟수만큼 곱해줘요.", "넓이, 부피나 큰 숫자 배수를 계산할 때 편해요.", "pow(밑수, 횟수)", "곱할 숫자(앞)와 몇 번 곱할지(뒤)", "거듭 곱해서 나온 큰 결과 숫자가 나와요."],
    ["Multiply a number by itself repeatedly", "Raises a base number to a power, like 2 to the 3rd power = 8.", "Use it for area, volume, or exponential growth.", "Math.pow(base, times) / pow(base, times)", "Put the base number first and how many times second.", "Gives the multiplied total."]
  ),
  random: _kidEntry(
    ["무작위 랜덤 숫자 뽑기", "주사위를 굴리듯 매번 실행할 때마다 다른 무작위 숫자나 보기를 뽑아줘요.", "게임에서 보물 상자 보상이나 가위바위보를 랜덤으로 정할 때 써요.", "random() / Math.random()", "원하는 범위 숫자를 넣거나 빈 괄호로 호출해요.", "매번 예측할 수 없는 새 무작위 값이 나와요."],
    ["Pick a surprise random number", "Acts like rolling dice so you get a fresh unpredictable number each time.", "Use it for games, dice rolls, or random quiz cards.", "Math.random() / random.randint(1, 6)", "Leave ( ) empty or set low-to-high limits.", "Gives a random number or choice."]
  ),
  open: _kidEntry(
    ["컴퓨터 속 파일 열기", "메모장이나 사진 같은 파일을 코드로 불러 읽거나 새로 쓸 수 있게 문을 열어요.", "저장된 일기 파일을 읽어 화면에 보여주거나 점수를 파일에 남길 때 써요.", "open(\"파일이름\", \"r/w\")", "열 파일 이름과 읽을지('r') 쓸지('w') 표시", "내용을 읽고 쓸 수 있는 파일 도구가 열려요."],
    ["Open a file on your computer", "Opens a saved file so your program can read from it or write notes inside.", "Use it for loading game saves or writing logs.", "open(\"notes.txt\", \"r\")", "Put the filename and whether to read ('r') or write ('w').", "Hands you a handle to read or write the file."]
  ),
  close: _kidEntry(
    ["열었던 파일·연결 닫고 정리하기", "다 읽거나 쓴 파일을 안전하게 저장하고 문을 닫아 다른 곳도 쓸 수 있게 해줘요.", "파일 작업이나 통신이 끝난 뒤 마무리를 깔끔히 할 때 꼭 써요.", "대상.close()", "괄호 안은 비워둬요.", "변경 내용이 안전하게 저장되고 문이 닫혀요."],
    ["Shut and finish a file or connection", "Saves changes and closes the file cleanly so nothing gets lost.", "Use it whenever you finish reading or writing.", "file.close()", "Call with empty ( ).", "Saves work cleanly and frees the file."]
  ),
  setTimeout: _kidEntry(
    ["잠깐 기다렸다 한 번 실행하기", "지금 당장 안 하고 내가 정한 시간(밀리초)만큼 기다린 뒤에 딱 한 번 실행해요.", "버튼을 누르고 3초 뒤에 '완료!' 안내가 사라지게 만들 때 써요.", "setTimeout(() => { 할 일 }, 시간)", "기다린 뒤 할 일(앞)과 얼마나 기다릴지 1/1000초 숫자(뒤)", "타이머 번호가 생기고 정해진 시간이 지나면 일이 실행돼요."],
    ["Wait a moment, then run once", "Starts a countdown timer and runs your steps once when time is up.", "Use it to hide a banner after 3 seconds (3000 ms).", "setTimeout(() => { ... }, 1000)", "Give the steps to run first and wait time in milliseconds second.", "Runs your steps once after the wait."]
  ),
  setInterval: _kidEntry(
    ["몇 초마다 계속 반복 실행하기", "정해진 시간 간격이 지날 때마다 멈추지 않고 계속 같은 일을 반복해요.", "매 1초마다 시계 숫자가 올라가거나 게임 시간이 줄어들게 만들 때 써요.", "setInterval(() => { 할 일 }, 시간)", "반복할 일(앞)과 반복 간격 1/1000초 숫자(뒤)", "멈추라고 하기 전까지 매 시간 간격마다 계속 실행돼요."],
    ["Repeat every few seconds", "Ticks like a metronome, running your steps over and over on a timer.", "Use it for live clocks or game countdowns.", "setInterval(() => { ... }, 1000)", "Give the steps first and repeat delay in milliseconds second.", "Keeps running at every tick until stopped."]
  ),
  fetch: _kidEntry(
    ["인터넷에서 정보 가져오기", "웹사이트 주소로 찾아가 최신 날씨나 글 정보를 요청해서 받아와요.", "외부 서버에서 데이터를 불러와 화면에 보여줄 때 가장 많이 써요.", "fetch(\"https://...\")", "정보를 가져올 인터넷 주소(URL)", "조금 기다리면 인터넷에서 도착한 응답 결과를 받아볼 수 있어요."],
    ["Grab data from a web address", "Reaches out over the internet to request info or send updates.", "Use it to load weather, news, or user profiles from the web.", "fetch(\"https://...\")", "Put the web link (URL) inside ( ).", "Gives a promise ticket that holds the web reply when ready."]
  ),
  Promise: _kidEntry(
    ["나중에 결과를 주겠다는 약속 종이", "지금 바로 안 끝나는 인터넷 통신이나 기다림 작업의 결과를 나중에 꼭 넘겨주겠다는 약속이에요.", "작업이 성공했을 때(then)와 실패했을 때(catch) 할 일을 이어 적을 때 써요.", "new Promise((성공, 실패) => { ... })", "일이 잘 끝났을 때와 실패했을 때 부를 안내", "시간이 걸리는 작업도 화면이 멈추지 않고 깔끔히 이어져요."],
    ["A promise ticket for work finishing later", "Holds the spot for an answer that takes time, like downloading a file.", "Use it when running slow jobs in the background.", "new Promise((ok, fail) => ...)", "Describe the slow job and call ok() when done.", "Hands over the final answer once ready."]
  ),
  "JSON.parse": _kidEntry(
    ["글자로 온 데이터를 상자로 풀기", "인터넷에서 날아온 긴 글자 뭉치(JSON)를 우리가 바로 꺼내 쓸 수 있는 깔끔한 상자로 바꿔요.", "서버에서 받아온 회원 정보 글자에서 이름과 점수를 꺼내고 싶을 때 써요.", "JSON.parse(글자데이터)", "상자로 풀어내고 싶은 JSON 모양의 글자", "점(.)으로 이름이나 값을 바로 꺼내 쓸 수 있는 상자가 돼요."],
    ["Turn saved JSON text into a real box", "Unpacks JSON text received from the web or storage into boxes you can read.", "Use it right after loading saved text data.", "JSON.parse(text)", "Put the JSON text inside ( ).", "Gives back a real JS object or list."]
  ),
  "JSON.stringify": _kidEntry(
    ["상자를 저장·전송용 글자로 뭉치기", "여러 값이 담긴 상자나 목록을 파일 저장이나 인터넷 전송이 쉬운 깔끔한 한 줄 글자로 바꿔줘요.", "내 게임 기록 상자를 브라우저에 저장하거나 서버로 보낼 때 써요.", "JSON.stringify(상자)", "글자로 바꿔 포장하고 싶은 상자나 목록", "어디든 안전하게 보내고 저장할 수 있는 긴 글자 한 줄이 나와요."],
    ["Pack a box into storable JSON text", "Turns a box or list into neat text so you can save it or send it online.", "Use it before saving game data or sending info to a server.", "JSON.stringify(box)", "Put your object or list inside ( ).", "Produces a neat JSON text string."]
  ),
  malloc: _kidEntry(
    ["메모리 방을 새로 빌려오기 (C)", "데이터를 담을 수 있는 빈 방을 컴퓨터 메모리에서 내가 원하는 크기만큼 빌려와요.", "미리 크기를 정하지 않고 실행 중에 큰 공간이 필요할 때 써요. 다 쓰면 free로 돌려줘야 해요!", "malloc(필요한크기)", "몇 바이트 크기만큼 방을 빌릴지 숫자", "빌려온 메모리 방의 첫 주소를 건네줘요."],
    ["Borrow fresh space in memory (C)", "Asks the computer for a block of empty memory of whatever size you pick.", "Use it when you do not know how much room you need until runtime.", "malloc(bytes)", "Put how many bytes of space you need inside ( ).", "Gives the address of your borrowed space (remember to free it!)."]
  ),
  free: _kidEntry(
    ["빌린 메모리 방 돌려주기 (C)", "malloc 등으로 빌려 썼던 메모리 방을 다 썼으니 다른 일에 쓰라며 컴퓨터에 반납해요.", "메모리가 부족해지지 않게 뒷정리할 때 꼭 짝지어 불러줘야 해요.", "free(주소상자)", "malloc으로 받아두었던 주소 이름", "그 메모리 방이 반납되어 컴퓨터가 깨끗이 다시 쓸 수 있어요."],
    ["Give back borrowed memory (C)", "Returns memory you borrowed with malloc so the computer does not run out.", "Always pair it once you finish using borrowed memory.", "free(ptr)", "Put the memory address box you borrowed inside ( ).", "Frees the space cleanly."]
  ),
  strlen: _kidEntry(
    ["글자가 몇 글자인지 세기 (C)", "C 언어 글자 줄의 맨 끝 표시 직전까지 총 몇 글자(바이트)가 들어있는지 숫자로 세어줘요.", "입력받은 이름이나 문장이 몇 글자인지 알아낼 때 써요.", "strlen(글자)", "길이를 재고 싶은 글자 변수나 문장", "글자 개수를 숫자로 돌려줘요."],
    ["Count letters in text (C)", "Counts how many characters are in a C word up to its end mark.", "Use it to check word length in C.", "strlen(word)", "Put your text inside ( ).", "Gives back the character count."]
  ),
  strcpy: _kidEntry(
    ["글자를 다른 칸에 그대로 베껴 적기 (C)", "한 곳에 들어있는 문장을 다른 빈 글자 공간에 똑같이 복사해 넣어요.", "원본을 지키면서 글자 복사본을 따로 만들고 싶을 때 써요.", "strcpy(복사받을곳, 원본글자)", "먼저 옮겨 적을 빈 자리, 그다음 원본 글자를 적어요.", "복사받을 곳에 원본과 똑같은 글자가 채워져요."],
    ["Copy text into another box (C)", "Copies words from one C text box into another.", "Use it when you want a separate copy of a word.", "strcpy(dest, source)", "Put destination first and original text second.", "Fills destination with a matching copy."]
  ),
  strcmp: _kidEntry(
    ["두 글자가 똑같은지 글자끼리 비교하기 (C)", "두 문장이 서로 완전히 같은지, 사전 순서로 어느 게 앞인지 비교해 줘요.", "두 글자가 똑같으면 딱 0을 돌려주니 if (strcmp(a, b) == 0)처럼 비교해요.", "strcmp(글자1, 글자2)", "서로 똑같은지 비교할 두 글자", "완전히 같으면 0, 다르면 0이 아닌 숫자가 나와요."],
    ["Compare two words (C)", "Checks if two C words match or which comes earlier alphabetically.", "Returns 0 when both words are an exact match!", "strcmp(word1, word2)", "Put the two words inside ( ).", "Gives 0 when they match identically."]
  ),
  Error: _kidEntry(
    ["무언가 잘못됐음을 알리는 문제 알림판", "코드가 규칙에 어긋났거나 문제가 생겼을 때 이유를 적어 띄우는 알림이에요.", "비밀번호가 비었을 때 '비밀번호를 입력해주세요!'라고 직접 문제를 알릴 때 써요.", "new Error(\"이유 설명\")", "왜 문제가 생겼는지 사람이 읽을 설명 글자", "문제를 설명하는 알림이 만들어져 throw로 넘길 수 있어요."],
    ["A general problem alert", "Creates a clear message describing what went wrong.", "Use it to raise helpful alerts when inputs are wrong.", "new Error(\"What went wrong\")", "Write a friendly description of the problem.", "Produces a clear problem alert with your message."]
  ),
  TypeError: _kidEntry(
    ["모양이 다른 값을 잘못 썼다는 알림", "숫자가 와야 할 자리에 글자를 넣거나, 없는 기능을 부르려 할 때 나오는 알림이에요.", "예를 들어 숫자에다가 '글자 자르기'를 시키려 하면 이 알림이 떠서 막아줘요.", "TypeError", "글자와 숫자를 섞어 쓰지 않았는지, 빈 상자를 쓰지 않았는지 살펴보세요.", "어디서 값 종류를 잘못 맞췄는지 알려주며 멈춰줘요."],
    ["Alert: wrong kind of value used", "Appears when you try to use text where a number was needed, or use an empty box.", "Helps spot places where you mixed up lists, text, numbers, or empty boxes.", "TypeError", "Check what type each box actually holds before running.", "Stops and shows the line where value types clashed."]
  ),
  ValueError: _kidEntry(
    ["내용물이 규칙에 안 맞는다는 알림", "모양(글자)은 맞지만 안의 내용 자체가 엉뚱해서 바꿀 수 없을 때 떠요.", "예를 들어 '사과'라는 글자를 숫자(int)로 바꾸려고 하면 숫자가 아니라서 이 알림이 떠요.", "ValueError", "글자 안에 숫자가 아닌 엉뚱한 글자가 들어있지 않은지 확인해요.", "내용을 고칠 수 있게 잘못된 값 위치를 알려줘요."],
    ["Alert: value inside does not fit", "Happens when a value is the right kind (like text) but makes no sense (like int('hello')).", "Helps catch bad numbers or unexpected words before math fails.", "ValueError", "Check that typed text actually contains valid digits or choices.", "Stops right where the strange value broke the rule."]
  ),
  KeyError: _kidEntry(
    ["사전에 없는 이름표를 찾았다는 알림", "사전(dict) 상자에서 등록한 적 없는 이름표로 값을 꺼내려 할 때 뜨는 알림이에요.", "이름표 철자를 틀렸거나 아직 저장 안 된 이름을 찾을 때 나와요.", "KeyError", "찾으려는 이름표가 진짜 사전에 들어있는지 오타가 없는지 확인해요.", "없는 이름표 대신 기본값을 주는 get을 쓰면 안전하게 피할 수 있어요."],
    ["Alert: label missing from lookup book", "Appears when you ask a dictionary for a label that does not exist inside it.", "Use 'get' with a backup value if a label might be missing.", "KeyError", "Double-check label spelling in your lookup book.", "Shows which missing label caused the stop."]
  ),
  IndexError: _kidEntry(
    ["목록 칸 번호를 넘겼다는 알림", "목록에 3칸밖에 없는데 5번 칸을 달라고 하거나 너무 큰 번호를 적었을 때 떠요.", "항상 칸 번호는 0부터 시작해서 '개수 - 1'까지라는 걸 기억하면 막을 수 있어요!", "IndexError", "len()으로 목록 크기를 확인해서 범위 안의 번호만 꺼내세요.", "없는 칸을 부른 정확한 줄을 알려주고 멈춰요."],
    ["Alert: list slot number is too big", "Appears when asking for slot #10 in a list that only has 3 items.", "Remember slots start at 0, so a 3-item list stops at slot 2!", "IndexError", "Check list size with len() before picking a slot.", "Pinpoints where the out-of-range slot was requested."]
  ),
  NullPointerException: _kidEntry(
    ["텅 빈 상자를 꺼내 쓰려 했다는 알림 (자바)", "값이 들어있지 않은 빈 상자(null)한테 명령을 내리려 할 때 자바가 띄우는 경고예요.", "상자 안에 실제로 물건이 들어있는지(null이 아닌지) 확인한 뒤 쓰면 예방할 수 있어요.", "NullPointerException", "이 상자가 비어 있지 않은지 먼저 if문으로 확인해 보세요.", "어느 빈 상자를 잘못 건드렸는지 바로 짚어 알려줘요."],
    ["Alert: tried to use an empty box (Java)", "Shows up when Java tries to run an action on an empty 'null' box.", "Check 'if (box != null)' before calling commands on it.", "NullPointerException", "Make sure the box actually holds something first.", "Shows the exact line touching an empty box."]
  ),
  ArrayIndexOutOfBoundsException: _kidEntry(
    ["배열 칸 번호가 넘쳤다는 문제 알림 (자바)", "5칸짜리 목록에서 6번째 칸이나 마이너스 칸을 달라고 잘못 적었을 때 자바가 띄우는 경고예요.", "반복문 끝 번호를 배열 길이보다 1 작게 맞추면 깔끔하게 해결할 수 있어요.", "ArrayIndexOutOfBoundsException", "칸 번호가 0 이상이고 목록 길이보다 작은지 확인해요.", "잘못 적힌 칸 번호가 몇 번인지까지 정확히 집어서 멈춰줘요."],
    ["Alert: slot number passed the list end (Java)", "Shows up when Java asks for a slot past the end (or below 0) of an array.", "Keep loop counters strictly less than array.length.", "ArrayIndexOutOfBoundsException", "Check that your slot index stays from 0 up to length - 1.", "Stops and tells you the exact bad slot number."]
  ),
  "document.getElementById": _kidEntry(
    ["웹페이지에서 ID 이름표로 부품 찾기", "HTML 화면에서 내가 붙여둔 고유한 id 이름표로 버튼이나 글자칸 하나를 콕 집어 찾아와요.", "버튼을 누르면 화면의 특정 제목 글자만 콕 집어서 바꾸고 싶을 때 써요.", "document.getElementById(\"아이디\")", "HTML에 적어둔 id 이름 글자를 따옴표 안에 넣어요.", "찾아온 화면 부품을 상자에 담아 글자나 색을 마음대로 바꿀 수 있어요."],
    ["Grab a page part by its ID tag", "Finds the one button, box, or heading on a webpage with a matching id name.", "Use it before changing text or colors on a webpage.", "document.getElementById(\"myBtn\")", "Put the exact id name in quotes inside ( ).", "Hands you that webpage element so you can update it."]
  ),
  "document.querySelector": _kidEntry(
    ["웹페이지에서 조건으로 첫 번째 부품 찾기", "클래스 이름이나 태그 이름 같은 규칙으로 웹페이지에서 딱 맞는 첫 번째 부품을 찾아와요.", "버튼이나 입력창을 찾아서 모양을 바꾸거나 클릭 이벤트를 달 때 자주 써요.", "document.querySelector(\".클래스\")", "찾을 규칙 글자(예: \".btn\", \"#title\", \"p\")", "규칙과 제일 먼저 일치하는 화면 부품 하나를 찾아줘요."],
    ["Find the first matching part on a page", "Searches a webpage using CSS selector rules (like '.card' or '#title').", "Use it to grab any button, card, or input on screen.", "document.querySelector(\".card\")", "Put the selector rule in quotes inside ( ).", "Gives back the first matching element on the page."]
  ),
  addEventListener: _kidEntry(
    ["클릭·키보드 같은 일에 반응 연결하기", "'버튼이 클릭되면 이 일을 해줘!'처럼 사용자의 행동에 귀를 기울여 반응을 달아줘요.", "버튼 클릭, 키보드 입력, 마우스 올림에 맞춰 화면을 움직일 때 필수예요.", "대상.addEventListener(\"click\", 할일)", "앞에는 기다릴 행동(\"click\" 등), 뒤에는 그럴 때 실행할 일을 적어요.", "이제 사용자가 그 행동을 할 때마다 정해둔 일이 자동으로 실행돼요."],
    ["Listen for clicks or keys and react", "Tells a button or window what to do whenever someone clicks, types, or scrolls.", "Use it to make webpages interactive when clicked.", "btn.addEventListener(\"click\", fn)", "Put the action name like \"click\" first and your steps second.", "Runs your steps each time that action happens."]
  ),
  constructor: _kidEntry(
    ["새 물건 만들 때 처음 준비하는 일", "설계도로 새 물건을 찍어낼 때 맨 처음 자동으로 실행되어 이름이나 초기값을 세팅해 줘요.", "새 캐릭터나 상자를 만들자마자 기본 점수와 이름을 넣어줄 때 써요.", "constructor(초기값) { ... }", "처음 물건을 만들 때 받아서 넣어줄 초기 정보들", "새 물건이 기본 준비를 마친 상태로 만들어져요."],
    ["First setup step when building a new object", "Runs automatically right when a new copy is built from a blueprint to set up its starting values.", "Use it to give a new player or box its starting name and score.", "constructor(startValues) { ... }", "Put the starting values needed when building a new object.", "Finishes setting up the brand-new object."]
  ),
  toString: _kidEntry(
    ["글자 모양으로 바꾸기", "숫자나 상자 안에 든 내용을 사람이 읽을 수 있는 글자 모양으로 바꿔줘요.", "화면에 보여주거나 다른 문장과 이어 붙이고 싶을 때 써요.", "대상.toString()", "보통 괄호 안을 비워두거나 진법 숫자를 넣어요.", "내용이 깔끔한 글자 모양으로 바뀌어 나와요."],
    ["Turn a value into readable text", "Converts a number or box into plain text you can read or print.", "Use it when joining a value into a sentence or showing it on screen.", "item.toString()", "Usually call with empty ( ).", "Gives back the value as text."]
  ),
  valueOf: _kidEntry(
    ["안에 든 진짜 알맹이 값 꺼내기", "포장된 상자 안에서 계산에 바로 쓸 수 있는 진짜 숫자나 기본 알맹이 값을 꺼내줘요.", "글자나 포장된 값을 비교하거나 계산에 쓰기 전에 알맹이를 꺼낼 때 써요.", "대상.valueOf()", "괄호를 비워두거나 바꿀 대상을 넣어요.", "상자 안의 기본 알맹이 값이 나와요."],
    ["Get the plain inner value", "Unwraps a boxed value and hands back the simple number or value inside.", "Use it when comparing or converting wrapped values.", "item.valueOf()", "Call with empty ( ) or pass the value to convert.", "Gives back the simple inner value."]
  ),
  hasOwnProperty: _kidEntry(
    ["이 이름표가 진짜 내 안에 있는지 확인", "남한테 빌려온 것 말고 내 상자 안에 직접 이 이름표가 들어있는지 OX로 알려줘요.", "사전이나 상자에서 특정 항목이 직접 저장되어 있는지 안전하게 검사할 때 써요.", "상자.hasOwnProperty(\"이름\")", "들어있는지 확인하고 싶은 이름표 글자", "직접 가지고 있으면 참(true), 없으면 거짓(false)을 알려줘요."],
    ["Check if a box directly holds this label", "Checks yes/no whether an object has that exact label stored directly inside it.", "Use it before reading a label to be sure it really exists on that box.", "box.hasOwnProperty(\"name\")", "Put the label name in quotes inside ( ).", "Answers true if present on the box, false if not."]
  ),
});

CORE_KID_GUIDES.True = CORE_KID_GUIDES.true;
CORE_KID_GUIDES.False = CORE_KID_GUIDES.false;
CORE_KID_GUIDES.None = CORE_KID_GUIDES.null;
CORE_KID_GUIDES.nil = CORE_KID_GUIDES.null;
CORE_KID_GUIDES.undefined = CORE_KID_GUIDES.null;
CORE_KID_GUIDES.raise = CORE_KID_GUIDES.throw;
CORE_KID_GUIDES.fun = CORE_KID_GUIDES.def;
CORE_KID_GUIDES.func = CORE_KID_GUIDES.def;
CORE_KID_GUIDES.function = CORE_KID_GUIDES.def;
CORE_KID_GUIDES.protocol = CORE_KID_GUIDES.interface;
CORE_KID_GUIDES.self = CORE_KID_GUIDES.this;
CORE_KID_GUIDES.println = CORE_KID_GUIDES.print;
CORE_KID_GUIDES.printf = CORE_KID_GUIDES.print;
CORE_KID_GUIDES.length = CORE_KID_GUIDES.len;
CORE_KID_GUIDES.size = CORE_KID_GUIDES.len;
CORE_KID_GUIDES.count = CORE_KID_GUIDES.len;
CORE_KID_GUIDES.double = CORE_KID_GUIDES.float;
CORE_KID_GUIDES.string = CORE_KID_GUIDES.str;
CORE_KID_GUIDES.String = CORE_KID_GUIDES.str;
CORE_KID_GUIDES.boolean = CORE_KID_GUIDES.bool;
CORE_KID_GUIDES.Boolean = CORE_KID_GUIDES.bool;
CORE_KID_GUIDES.Array = CORE_KID_GUIDES.list;
CORE_KID_GUIDES.map = CORE_KID_GUIDES.dict;
CORE_KID_GUIDES.Map = CORE_KID_GUIDES.dict;
CORE_KID_GUIDES.Set = CORE_KID_GUIDES.set;
CORE_KID_GUIDES.push = CORE_KID_GUIDES.append;
CORE_KID_GUIDES.add = CORE_KID_GUIDES.append;
CORE_KID_GUIDES.sorted = CORE_KID_GUIDES.sort;
CORE_KID_GUIDES.reversed = CORE_KID_GUIDES.reverse;
CORE_KID_GUIDES.find = CORE_KID_GUIDES.indexOf;
CORE_KID_GUIDES.contains = CORE_KID_GUIDES.includes;
CORE_KID_GUIDES.strip = CORE_KID_GUIDES.trim;
CORE_KID_GUIDES.upper = CORE_KID_GUIDES.toUpperCase;
CORE_KID_GUIDES.lower = CORE_KID_GUIDES.toLowerCase;
CORE_KID_GUIDES.substring = CORE_KID_GUIDES.slice;
CORE_KID_GUIDES.startswith = CORE_KID_GUIDES.startsWith;
CORE_KID_GUIDES.endswith = CORE_KID_GUIDES.endsWith;
CORE_KID_GUIDES.Exception = CORE_KID_GUIDES.Error;

function describeWordForKids(item, isEnUi = false) {
  const code = (item && item.code) || "";
  const scope = (item && item.scope) || currentLang;
  const langLabel = (item && item.langLabel) || (typeof SCOPE_LABELS !== "undefined" && SCOPE_LABELS[scope]) || scope;
  const rawKo = (item && item.ko) || "";
  const rawEn = (item && item.en) || "";
  const koPretty = rawKo && rawKo !== code ? rawKo : (rawEn ? rawEn.replace(/_/g, " ") : code);
  const enPretty = rawEn
    ? rawEn.replace(/_/g, " ")
    : code.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._]+/g, " ").toLowerCase();

  const core = Object.prototype.hasOwnProperty.call(CORE_KID_GUIDES, code) ? CORE_KID_GUIDES[code] : null;
  if (core && core.ko && core.en) {
    const pick = isEnUi ? core.en : core.ko;
    return {
      shortDesc: pick.short,
      desc: pick.desc,
      usage: pick.usage,
      syntax: pick.syntax,
      inside: pick.inside,
      result: pick.result,
      hoverExample: core.ex || "",
    };
  }

  const hay = `${code} ${rawEn} ${rawKo}`.toLowerCase();
  const isAllCaps = /^[A-Z][A-Z0-9_]{1,}$/.test(code);
  const isPascal = /^[A-Z]/.test(code) && !isAllCaps;
  const isControl = /^(else|elif|switch|case|default|when|match|guard|defer|try|catch|except|finally|throw|raise|repeat|with|until|unless)$/.test(code);
  const isDecl = /^(static|final|public|private|protected|internal|open|override|abstract|sealed|data|companion|lateinit|typealias|extension|object|mutating|inout|extern|volatile|register|inline|typedef|define|package)$/.test(code);

  const pickOut = (koShort, koDesc, koUsage, koSyntax, koInside, koResult, enShort, enDesc, enUsage, enSyntax, enInside, enResult) => {
    if (isEnUi) {
      return { shortDesc: enShort, desc: enDesc, usage: enUsage, syntax: enSyntax, inside: enInside, result: enResult, hoverExample: "" };
    }
    return { shortDesc: koShort, desc: koDesc, usage: koUsage, syntax: koSyntax, inside: koInside, result: koResult, hoverExample: "" };
  };

  if (/error|exception|warning|fault|panic/.test(hay) || /예외|에러|오류|경고/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 문제 알림`,
      `무언가 잘못됐을 때 실행을 멈추고 알려주는 빨간 경고판 '${koPretty}'이에요.`,
      `잘못된 값이 들어오거나 예상치 못한 문제가 생겼을 때 이유를 짚어내려 나와요.`,
      `${code}`,
      `보통 try/catch나 에러 메시지 문구와 함께 써서 원인을 확인해요.`,
      `어디서 무슨 실수가 났는지 정확히 알려주며 프로그램을 보호해요.`,
      `Problem alert: ${enPretty}`,
      `A safety alarm (${enPretty}) that stops and tells you when something goes wrong.`,
      `Shows up or gets checked inside try/catch when unexpected data causes trouble.`,
      `${code}`,
      `Usually paired with try/catch or an explanation message.`,
      `Tells you what broke and helps keep your app safe.`
    );
  }

  if (isAllCaps) {
    return pickOut(
      `고정된 약속 값 '${koPretty}'`,
      `언제 써도 바뀌지 않고 미리 정해져 있는 값이나 신호 '${koPretty}'(${code})예요.`,
      `색상, 상태, 최대치처럼 변하지 않는 기준 값을 편하게 적고 싶을 때 써요.`,
      `${code}`,
      `괄호 없이 '${code}' 이름만 그대로 적으면 그 값이 들어가요.`,
      `이 자리에 미리 정해진 숫자나 상태 값이 바로 들어가요.`,
      `Fixed preset value: ${enPretty}`,
      `A ready-made value or signal (${enPretty}) that stays the same everywhere.`,
      `Use it instead of guessing magic numbers or secret codes by hand.`,
      `${code}`,
      `Write just '${code}' with no parentheses.`,
      `Drops the fixed preset value right into that spot.`
    );
  }

  if (/^(is|has|can|should|will|did|was|are)[A-Z_]/.test(code) || /check|verify|valid|contains|includes|starts|ends|empty|exists|equal|match/.test(hay) || /여부|인지|포함|확인|맞는지|비었/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 맞는지 OX 확인`,
      `'${koPretty}' 조건이 맞는지 틀리는지 OX 퀴즈처럼 바로 검사해 줘요.`,
      `if 문이나 반복문 안에서 '맞으면 통과, 아니면 건너뛰기'를 고를 때 자주 써요.`,
      `${code}(확인할대상)`,
      `맞는지 궁금한 값이나 비교할 내용을 괄호 안에 적어요.`,
      `결과로 '참(맞음)' 또는 '거짓(틀림)' 둘 중 하나를 돌려줘요.`,
      `Yes/No check: ${enPretty}`,
      `Checks '${enPretty}' like a quick true-or-false quiz.`,
      `Often placed inside an 'if' rule to decide which path to take.`,
      `${code}(target)`,
      `Put the value or rule you want tested inside ( ).`,
      `Gives back yes (true) or no (false).`
    );
  }

  if (/add|append|push|insert|put|prepend|unshift|enqueue|register|attach|bind|connect|subscribe/.test(hay) || /추가|넣기|삽입|등록|연결/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 새로 추가해 넣기`,
      `'${koPretty}' 뜻처럼 상자나 목록에 새로운 값이나 기능을 하나 더 붙여 넣어요.`,
      `장바구니에 물건을 더하거나 목록·화면에 새 내용을 붙일 때 써요.`,
      `${code}(넣을값)`,
      `새로 집어넣을 물건이나 위치 번호를 괄호 안에 적어요.`,
      `원하던 새 내용이 안전하게 목록이나 대상에 더해져요.`,
      `Add / attach: ${enPretty}`,
      `Adds a new item or connection (${enPretty}) right where you need it.`,
      `Use it when putting new items into a box, list, or screen.`,
      `${code}(item)`,
      `Put the new item or spot inside ( ).`,
      `Adds your new item cleanly into place.`
    );
  }

  if (/remove|delete|del|pop|shift|clear|erase|drop|trim|strip|unlink|dispose|destroy|cancel|stop|abort/.test(hay) || /제거|삭제|지우기|비우기|취소|중단|끄기/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 빼내거나 지우기`,
      `'${koPretty}' 뜻처럼 필요 없는 값이나 여백을 깔끔하게 지워내요.`,
      `목록에서 다 쓴 물건을 빼거나 진행 중이던 일을 멈춰 치울 때 써요.`,
      `${code}(지울대상)`,
      `지우고 싶은 값이나 자리 번호를 넣어요 (비워두면 알아서 지우기도 해요).`,
      `골라낸 항목이 깔끔하게 빠지고 남은 내용으로 정리돼요.`,
      `Remove / clear: ${enPretty}`,
      `Removes unwanted items, extra spaces, or stops a task (${enPretty}).`,
      `Use it to clean up lists, text, or finished work.`,
      `${code}(target)`,
      `Put what you want removed inside ( ) (some work with empty ( )).`,
      `Erases the unwanted part and leaves things tidy.`
    );
  }

  if (/sort|order|reverse|shuffle|rank|rotate|swap/.test(hay) || /정렬|뒤집|섞기|순서/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 순서 바꾸기`,
      `'${koPretty}' 뜻처럼 줄 서 있는 항목의 순서를 보기 좋게 바꾸거나 섞어줘요.`,
      `점수 순서로 줄 세우거나 글자·카드 순서를 새로 정돈할 때 써요.`,
      `${code}(...)`,
      `순서를 정할 기준이 있으면 넣고, 없으면 비워두고 불러요.`,
      `원하던 새로운 순서대로 물건들이 가지런히 바뀌어요.`,
      `Reorder items: ${enPretty}`,
      `Sorts, flips, or mixes up items into a new order (${enPretty}).`,
      `Use it for leaderboards, alphabetical lists, or card games.`,
      `${code}(...)`,
      `Optional sorting rule, or leave ( ) empty for normal order.`,
      `Arranges everything in your new order.`
    );
  }

  if (/find|search|index|get|fetch|load|read|select|lookup|query|seek|peek|receive|download/.test(hay) || /찾기|검색|가져오기|읽기|조회|불러/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 찾아서 꺼내오기`,
      `'${koPretty}' 뜻처럼 상자·파일·웹에서 원하는 정보를 찾아서 가져와요.`,
      `찾고 싶은 글자가 몇 번째 칸에 있는지 보거나 저장된 값을 읽어올 때 써요.`,
      `${code}(찾을것)`,
      `어느 것을 찾아 가져올지 이름이나 번호를 적어요.`,
      `찾아낸 값이나 그 값이 있는 위치 번호를 바로 돌려줘요.`,
      `Find / fetch: ${enPretty}`,
      `Searches for or grabs the value you asked for (${enPretty}).`,
      `Use it when looking up stored info, text spots, or saved data.`,
      `${code}(target)`,
      `Put what you want to look up inside ( ).`,
      `Hands back what it found (or says nothing was found).`
    );
  }

  if (/save|write|send|emit|post|store|update|assign|set[A-Z_]|output|show|display|print|alert|notify/.test(hay) || /저장|쓰기|보내기|바꾸기|설정|출력|알림|표시/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 적거나 보내기`,
      `'${koPretty}' 뜻처럼 새 값을 적어서 저장하거나 화면·다른 곳으로 보내요.`,
      `값을 새로 고쳐 적어두거나 사용자에게 글자·알림을 보여줄 때 써요.`,
      `${code}(넣을내용)`,
      `저장하거나 보낼 내용 (또는 바꿀 이름과 새 값)을 적어요.`,
      `새 정보가 알맞은 곳에 잘 적히거나 화면에 나타나요.`,
      `Save / send: ${enPretty}`,
      `Writes, saves, shows, or sends data cleanly (${enPretty}).`,
      `Use it to store results, update values, or display info.`,
      `${code}(value)`,
      `Put what you want saved, sent, or shown inside ( ).`,
      `Updates or delivers your value.`
    );
  }

  if (/to[A-Z]|parse|format|encode|decode|stringify|convert|cast/.test(hay) || /변환|바꾸기|포맷|인코딩|디코딩|해석/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 모양 바꾸기`,
      `'${koPretty}' 뜻처럼 글자, 숫자, 날짜의 모양을 다루기 쉬운 새 모양으로 바꿔줘요.`,
      `글자 숫자를 진짜 계산용 숫자로 바꾸거나 날짜를 보기 좋은 문장으로 꾸밀 때 써요.`,
      `${code}(바꿀값)`,
      `모양을 바꿔주고 싶은 원래 숫자나 글자를 넣어요.`,
      `원하는 새 모양으로 깔끔하게 변신한 값이 나와요.`,
      `Change shape: ${enPretty}`,
      `Converts text, numbers, or dates into a new shape (${enPretty}).`,
      `Use it before doing math or formatting nice text.`,
      `${code}(value)`,
      `Put the original value inside ( ).`,
      `Gives back the converted result.`
    );
  }

  if (/math|calc|sum|avg|mean|abs|round|floor|ceil|sqrt|pow|sin|cos|tan|log|rand|sqrt|hypot|trunc|clamp/.test(hay) || /절댓값|반올림|버림|올림|제곱|난수|랜덤|계산|평균|삼각/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 숫자 계산하기`,
      `'${koPretty}' 숫자 계산을 컴퓨터가 눈 깜짝할 사이에 대신 풀어줘요.`,
      `게임 점수 계산, 랜덤 주사위, 소수점 정리를 손쉽게 끝내고 싶을 때 써요.`,
      `${code}(숫자)`,
      `계산에 쓰고 싶은 숫자들이나 상자를 넣어요.`,
      `계산이 딱 끝난 정확한 숫자 답이 바로 나와요.`,
      `Math helper: ${enPretty}`,
      `Solves quick math or number work for you (${enPretty}).`,
      `Use it for scores, rounding decimals, or dice rolls.`,
      `${code}(number)`,
      `Put the number or numbers inside ( ).`,
      `Gives back the exact calculated answer.`
    );
  }

  if (/split|join|slice|substr|substring|replace|upper|lower|pad|repeat|char|word|letter|text|regex|prefix|suffix/.test(hay) || /글자|문자|대문자|소문자|자르기|합치기|치환|문장/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 글자 다듬기`,
      `'${koPretty}' 뜻처럼 단어나 문장을 자르고 합치고 원하는 대로 예쁘게 다듬어요.`,
      `이름에서 성만 잘라내거나 문장 속 오타를 한꺼번에 고칠 때 써요.`,
      `${code}(...)`,
      `자르거나 고칠 기준 글자나 번호를 적어줘요.`,
      `요청한 대로 깔끔하게 새로 다듬어진 글자가 나와요.`,
      `Text helper: ${enPretty}`,
      `Cuts, joins, or cleans up words and sentences (${enPretty}).`,
      `Use it whenever editing or inspecting text.`,
      `${code}(...)`,
      `Put any divider letters or slot numbers inside ( ).`,
      `Gives back neatly updated text.`
    );
  }

  if (/len|length|size|count|width|height|measure/.test(hay) || /길이|개수|크기|높이|너비/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 수·크기 재기`,
      `'${koPretty}' 뜻처럼 몇 글자인지, 몇 칸인지, 크기가 얼마인지 숫자로 세어줘요.`,
      `목록이 몇 개인지 확인하거나 그림 크기를 맞춰 그릴 때 써요.`,
      `${code}`,
      `대상을 괄호 안에 넣거나 점(.) 뒤에 붙여서 세어봐요.`,
      `개수나 크기를 뜻하는 숫자를 알려줘요.`,
      `Measure size: ${enPretty}`,
      `Counts how many items or how big something is (${enPretty}).`,
      `Use it before picking slots or checking sizes.`,
      `${code}`,
      `Either pass the box inside ( ) or write box.${code}.`,
      `Gives a number telling the size or count.`
    );
  }

  if (/map|reduce|foreach|each|every|some|any|all|iter|loop|range|zip|slice|group|flatten/.test(hay) || /하나씩|모두|반복|묶기|걸러/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 줄줄이 하나씩 다루기`,
      `'${koPretty}' 뜻처럼 상자 안의 물건들을 처음부터 끝까지 하나씩 꺼내 다루어줘요.`,
      `모든 항목에 같은 계산을 한꺼번에 해주고 새 목록으로 받을 때 편해요.`,
      `${code}(할일)`,
      `하나씩 꺼냈을 때 각각 해줄 일을 적어요.`,
      `목록 전체를 돌며 일한 새 결과가 나와요.`,
      `Step through items: ${enPretty}`,
      `Goes through items in a collection one after another (${enPretty}).`,
      `Use it to transform or test every item in a list at once.`,
      `${code}(rule)`,
      `Provide what to do with each item.`,
      `Returns the updated results or yes/no answer.`
    );
  }

  if (/time|date|timer|sleep|delay|timeout|interval|now|clock|hour|minute|second|year|month|day/.test(hay) || /날짜|시간|타이머|대기|초|년|월|일/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 시간·날짜 다루기`,
      `'${koPretty}' 뜻처럼 오늘 날짜·현재 시각을 구하거나 잠깐 기다렸다가 실행해요.`,
      `시계를 띄우거나 몇 초 뒤에 다음 일이 일어나게 할 때 써요.`,
      `${code}(...)`,
      `기다릴 시간이나 알아볼 날짜 정보를 적어요 (비워두는 것도 많아요).`,
      `현재 시간·날짜를 얻거나 정한 시간이 지난 뒤 이어져요.`,
      `Time & clock: ${enPretty}`,
      `Reads dates and clocks or pauses for a timer (${enPretty}).`,
      `Use it to show today's date or delay an action.`,
      `${code}(...)`,
      `Leave ( ) empty for 'now', or pass how long to wait.`,
      `Gives time details or waits neatly.`
    );
  }

  if (/ui|view|window|document|element|button|canvas|draw|paint|color|font|style|click|mouse|key|screen|scroll|focus/.test(hay) || /화면|창|버튼|그리기|색상|클릭|마우스|키보드|스크롤/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 화면·모양 다루기`,
      `'${koPretty}' 뜻처럼 눈에 보이는 화면 부품이나 색깔·그림·버튼 동작을 다뤄요.`,
      `웹페이지 글자를 바꾸거나 사용자 클릭·스크롤에 반응하게 만들 때 써요.`,
      `${code}(...)`,
      `바꿀 화면 부품, 색깔 이름, 또는 클릭 시 할 일을 적어요.`,
      `화면 모습이 즉시 바뀌거나 사용자의 조작에 반응해요.`,
      `Screen & look: ${enPretty}`,
      `Controls buttons, text, colors, drawings, or clicks on screen (${enPretty}).`,
      `Use it to make apps look good and respond to users.`,
      `${code}(...)`,
      `Pass element names, styles, or click actions.`,
      `Updates what shows on screen right away.`
    );
  }

  if (/file|dir|folder|path|stream|mkdir|fopen|fclose|fread|fwrite/.test(hay) || /파일|폴더|경로|디렉토리/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 파일·폴더 다루기`,
      `'${koPretty}' 뜻처럼 내 컴퓨터에 저장된 파일이나 폴더를 찾고 열어 다루어요.`,
      `메모, 점수 기록, 사진 파일을 열거나 새 폴더를 정리할 때 써요.`,
      `${code}(경로)`,
      `다루려는 파일이나 폴더의 이름(위치)을 적어요.`,
      `파일·폴더가 열리거나 원하는 정리가 깔끔히 끝나요.`,
      `Files & folders: ${enPretty}`,
      `Opens, reads, saves, or organizes files and folders (${enPretty}).`,
      `Use it when working with files saved on disk.`,
      `${code}(filePath)`,
      `Put the file name or folder path in quotes.`,
      `Opens or updates the file on your computer.`
    );
  }

  if (/http|url|uri|socket|cookie|header|request|response|network|dns/.test(hay) || /통신|요청|응답|웹|인터넷|주소/.test(rawKo)) {
    return pickOut(
      `'${koPretty}' 인터넷 주고받기`,
      `'${koPretty}' 뜻처럼 인터넷을 통해 다른 컴퓨터와 질문·답변을 주고받아요.`,
      `웹에서 최신 데이터를 가져오거나 내가 쓴 정보를 서버에 올릴 때 써요.`,
      `${code}(주소)`,
      `연결할 인터넷 주소나 같이 보낼 내용을 적어요.`,
      `상대방 컴퓨터로 요청이 날아가고 답변이 돌아와요.`,
      `Web & network: ${enPretty}`,
      `Talks to websites or servers across the internet (${enPretty}).`,
      `Use it when sending or receiving online information.`,
      `${code}(url)`,
      `Put the web address or message to send inside ( ).`,
      `Sends the request and receives the answer.`
    );
  }

  if (isControl || isDecl) {
    return pickOut(
      `'${koPretty}' 약속 규칙`,
      `${langLabel}에서 코드의 순서나 상자 성격('${koPretty}')을 정해주는 특별한 약속 말 '${code}'이에요.`,
      `코드 흐름을 제어하거나 상자의 사용 규칙을 미리 정해둘 때 앞쪽에 적어줘요.`,
      `${code} ...`,
      `뒤에 이어질 상자 이름이나 실행할 코드 묶음을 적어요.`,
      `이 약속에 맞춰 아래나 뒤의 코드가 질서 있게 움직여요.`,
      `Code rule: ${enPretty}`,
      `A special rule word in ${langLabel} (${enPretty}) that guides flow or shapes how a box works.`,
      `Write it right before a name, block, or rule.`,
      `${code} ...`,
      `Follow it with the target name or code block.`,
      `Guides how the nearby code runs or stays safe.`
    );
  }

  if (isPascal) {
    return pickOut(
      `'${koPretty}' 모양 상자·설계도`,
      `'${koPretty}' 종류의 데이터를 담거나 관련 도구를 모아둔 큰 도구 상자 '${code}'예요.`,
      `글자, 날짜, 목록처럼 정해진 모양의 새 상자를 만들거나 점(.)을 찍어 도구를 꺼낼 때 써요.`,
      `${code}`,
      `새 상자를 만들 땐 뒤에 괄호 ( )를 붙이고, 도구를 쓸 땐 점(.)을 붙여요.`,
      `'${koPretty}' 성질을 가진 깔끔한 상자나 값이 준비돼요.`,
      `Data box: ${enPretty}`,
      `A ready-made blueprint or toolbox named '${code}' (${enPretty}) in ${langLabel}.`,
      `Use it to make new values of that kind or call tools inside it with a dot.`,
      `${code}`,
      `Put starting values inside ( ) if making a new one, or add '.' for its tools.`,
      `Creates or works with a '${enPretty}' value.`
    );
  }

  return pickOut(
    `'${koPretty}' 실행 명령`,
    `${langLabel}에서 '${koPretty}' 일을 한 번에 척척 해주는 편리한 명령 '${code}'예요.`,
    `복잡한 코드를 길게 짜지 않고 '${koPretty}' 기능을 바로 쓰고 싶을 때 불러요.`,
    `${code}(...)`,
    `괄호 안에 필요한 값이나 재료를 넣어요 (필요 없으면 비워둬요).`,
    `'${koPretty}' 작업이 끝나고 그 결과를 돌려주거나 화면에 반영돼요.`,
    `${enPretty}`,
    `A handy ${langLabel} command '${code}' that handles '${enPretty}' for you.`,
    `Call it whenever you want '${enPretty}' done without writing extra code yourself.`,
    `${code}(...)`,
    `Put any needed values inside ( ), or leave empty if none needed.`,
    `Finishes the '${enPretty}' step and hands back the result.`
  );
}

function buildWordUsageGuide(item) {
  const { scope, langLabel, code, en, ko } = item;
  const isEnUi = uiLang === "en";
  const kidGuide = describeWordForKids(item, isEnUi);

  const desc = isEnUi
    ? (item.desc_en || item.desc || kidGuide.desc)
    : (item.desc || kidGuide.desc);
  const usage = isEnUi
    ? (item.usage_en || item.usage || kidGuide.usage)
    : (item.usage || kidGuide.usage);
  const syntax = isEnUi
    ? (item.syntax_en || item.syntax || kidGuide.syntax)
    : (item.syntax || kidGuide.syntax);
  const inside = isEnUi
    ? (item.inside_en || item.inside || kidGuide.inside)
    : (item.inside || kidGuide.inside);
  const result = isEnUi
    ? (item.result_en || item.result || kidGuide.result)
    : (item.result || kidGuide.result);
  const hoverExample = kidGuide.hoverExample || "";

  let rawEx = isEnUi ? (item.example_en || item.example || hoverExample || "") : (item.example || hoverExample || "");
  if (!rawEx) {
    if (scope === "python" || (scope === "common" && currentLang === "python")) {
      rawEx = isEnUi
        ? `# [Python] '${code}' usage example\nresult = ${code}\nprint(result)`
        : `# [Python] '${code}' 사용 예제\nresult = ${code}\nprint(result)`;
    } else if (scope === "kotlin") {
      rawEx = isEnUi
        ? `// [Kotlin] '${code}' usage example\nfun demo() {\n    val result = ${code}\n    println(result)\n}`
        : `// [Kotlin] '${code}' 사용 예제\nfun demo() {\n    val result = ${code}\n    println(result)\n}`;
    } else if (scope === "swift") {
      rawEx = isEnUi
        ? `// [Swift] '${code}' usage example\nfunc demo() {\n    let result = ${code}\n    print(result)\n}`
        : `// [Swift] '${code}' 사용 예제\nfunc demo() {\n    let result = ${code}\n    print(result)\n}`;
    } else if (scope === "c") {
      rawEx = isEnUi
        ? `// [C] '${code}' usage example\n#include <stdio.h>\nvoid demo() {\n    /* ${code} */\n}`
        : `// [C] '${code}' 사용 예제\n#include <stdio.h>\nvoid demo() {\n    /* ${code} */\n}`;
    } else if (scope === "java") {
      rawEx = isEnUi
        ? `// [Java] '${code}' usage example\npublic class Demo {\n    void test() {\n        /* ${code} */\n    }\n}`
        : `// [Java] '${code}' 사용 예제\npublic class Demo {\n    void test() {\n        /* ${code} */\n    }\n}`;
    } else {
      rawEx = isEnUi
        ? `// [JavaScript] '${code}' usage example\nconst result = ${code};\nconsole.log(result);`
        : `// [JavaScript] '${code}' 사용 예제\nconst result = ${code};\nconsole.log(result);`;
    }
  }

  // Generate 1-layer and 2-layer natural versions of example
  let enEx = rawEx;
  let koEx = item.example || rawEx;
  if (en && en !== code) {
    enEx = enEx.split(code).join(en);
  }
  if (ko && ko !== code) {
    koEx = koEx.split(code).join(ko);
  }

  let tip = "";
  if (isEnUi) {
    tip = targetLocale === "none"
      ? `Type '${en}' in the editor and press Space or '(' to automatically turn it into code '${code}'.`
      : `Type '${ko}' (Korean) or '${en}' (English) in the editor and press Space or '(' to automatically turn it into code '${code}'.`;
  } else {
    tip = targetLocale === "none"
      ? `에디터에 영어로 '${en}'을(를) 적고 스페이스바(Space)나 '('를 누르면 자동으로 코드 '${code}'(으)로 바뀌어요.`
      : `에디터에 한글로 '${ko}' 또는 영어로 '${en}'을(를) 적고 스페이스바(Space)나 '('를 누르면 자동으로 코드 '${code}'(으)로 바뀌어요.`;
  }

  return { desc, usage, syntax, inside, rawEx, enEx, koEx, result, tip, hoverExample };
}

async function loadAllRawCartridges(forceReload = false) {
  const targetScopes = ["common", "javascript", "typescript", "python", "kotlin", "swift", "c", "java"];
  if (!forceReload && allCartridgesCache && targetScopes.every((sc) => allCartridgesCache[sc] && allCartridgesCache[sc].__rawScope)) {
    return allCartridgesCache;
  }
  if (!forceReload && allCartridgesLoadingPromise) {
    return allCartridgesLoadingPromise;
  }

  allCartridgesLoadingPromise = (async () => {
    let bridgeMap = null;
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_all_raw_cartridges === "function") {
      try {
        bridgeMap = await window.pywebview.api.get_all_raw_cartridges();
      } catch (_) {
        bridgeMap = null;
      }
    }

    for (const sc of targetScopes) {
      if (forceReload || !allCartridgesCache[sc] || !allCartridgesCache[sc].__rawScope) {
        if (bridgeMap && bridgeMap[sc] && bridgeMap[sc].entries) {
          allCartridgesCache[sc] = Object.assign({ scope: sc, __rawScope: true }, bridgeMap[sc]);
        } else {
          try {
            const resp = await fetch(`../dicts/${sc}.json`).then((r) => r.json());
            if (resp && resp.entries) {
              allCartridgesCache[sc] = Object.assign({ scope: sc, __rawScope: true }, resp);
            }
          } catch (_) {
            if (!allCartridgesCache[sc]) allCartridgesCache[sc] = { scope: sc, entries: {} };
          }
        }
      }
    }
    rebuildFlatGlobalEntries();
    buildLanguageExclusivityIndex();
    return allCartridgesCache;
  })();

  try {
    return await allCartridgesLoadingPromise;
  } finally {
    allCartridgesLoadingPromise = null;
  }
}

function rebuildFlatGlobalEntries() {
  const list = [];
  const scopes = ["common", "javascript", "typescript", "python", "kotlin", "swift", "c", "java"];
  initExclusiveBundleIndexes();
  for (const sc of scopes) {
    const entries = (allCartridgesCache[sc] && allCartridgesCache[sc].entries) || {};
    registerCartridgeBundlesIntoIndex(entries);
  }
  for (const sc of scopes) {
    const entries = (allCartridgesCache[sc] && allCartridgesCache[sc].entries) || {};
    for (const [code, tr] of Object.entries(entries)) {
      if (!tr || typeof tr !== "object") continue;
      const en = tr.en || "";
      const ko = tr[targetLocale] || tr.ko || "";
      const category = inferWordRole(code, tr, sc, false);
      const category_en = inferWordRole(code, tr, sc, true);
      const desc = tr.desc || "";
      const desc_en = tr.desc_en || tr.desc || "";
      const usage = tr.usage || "";
      const usage_en = tr.usage_en || tr.usage || "";
      const syntax = tr.syntax || "";
      const syntax_en = tr.syntax_en || tr.syntax || "";
      const inside = tr.inside || "";
      const inside_en = tr.inside_en || tr.inside || "";
      const example = tr.example || "";
      const example_en = tr.example_en || tr.example || "";
      const result = tr.result || "";
      const result_en = tr.result_en || tr.result || "";
      const bundle = getExclusiveBundleMeta(code, sc, tr);

      list.push({
        scope: sc,
        langLabel: SCOPE_LABELS[sc] || sc.toUpperCase(),
        code,
        en: bundle.en || en,
        ko: bundle.ko || ko,
        synonyms_ko: bundle.synonyms_ko,
        synonyms_en: bundle.synonyms_en,
        grammar_ko: bundle.grammar_ko,
        grammar_ex_ko: bundle.grammar_ex_ko,
        grammar_en: bundle.grammar_en,
        grammar_ex_en: bundle.grammar_ex_en,
        role_ko: bundle.role_ko,
        role_en: bundle.role_en,
        category,
        category_en,
        desc,
        desc_en,
        usage,
        usage_en,
        syntax,
        syntax_en,
        inside,
        inside_en,
        example,
        example_en,
        result,
        result_en,
        rawEntry: tr
      });
    }
  }
  flatGlobalEntries = list;
  window.flatGlobalEntries = flatGlobalEntries;
  const lookup = new Map();
  for (const item of list) {
    if (item.code && !lookup.has(item.code)) lookup.set(item.code, item);
    if (item.en && !lookup.has(item.en)) lookup.set(item.en, item);
    if (item.ko && !lookup.has(item.ko)) lookup.set(item.ko, item);
  }
  flatEntryLookup = lookup;
  semanticIndexBuiltFromGlobal = false;
  buildSemanticInvertedIndex(flatGlobalEntries);
  semanticIndexBuiltFromGlobal = flatGlobalEntries.length > 0;

  updateQuickSearchTotalBadge();
}

function evaluateSearchRelevance(item, rawQuery, targetLang = currentLang) {
  const q = String(rawQuery || "").trim();
  const qL = q.toLowerCase();
  if (!qL) return { score: 0, reasonTag: "", learned: false };

  const hasKoreanQuery = /[가-힣]/.test(q);
  const hideKo = uiLang === "en" && !hasKoreanQuery;
  const codeL = (item.code || "").toLowerCase();
  const enL = (item.en || "").toLowerCase();
  const koL = hideKo ? "" : (item.ko || "").toLowerCase();
  const descL = hideKo ? "" : (item.desc || "").toLowerCase();
  const descEnL = (item.desc_en || "").toLowerCase();
  const catL = hideKo ? "" : (item.category || "").toLowerCase();
  const catEnL = (item.category_en || "").toLowerCase();
  const activeLangBonus = (item.scope === targetLang || item.scope === "common") ? 25 : 0;

  // 1. Exclusive 1:N canonical/synonym match wins over substring or stale learned record
  const synHitKo = typeof SYNONYM_TO_OWNER_KO !== "undefined" ? SYNONYM_TO_OWNER_KO.get(q) : null;
  const synHitEn = typeof SYNONYM_TO_OWNER_EN !== "undefined" ? SYNONYM_TO_OWNER_EN.get(qL) : null;
  if ((synHitKo && !synHitKo.glossOnly && String(synHitKo.code || "").toLowerCase() === codeL) || (synHitEn && !synHitEn.glossOnly && String(synHitEn.code || "").toLowerCase() === codeL)) {
    return {
      score: 2600 - Math.min(20, item.code.length) + activeLangBonus,
      reasonTag: hideKo ? "Exclusive Synonym" : "대표·동의어 매칭",
      learned: false
    };
  }

  // 1b. User-learned personal mapping when query is not owned by another grammar canonical
  const learnedRec = (!(synHitKo && !synHitKo.glossOnly) && !(synHitEn && !synHitEn.glossOnly))
    ? lookupUserLearnedRecord(q, targetLang)
    : null;
  if (learnedRec && learnedRec.code === item.code) {
    const scopeBonus = (item.scope === targetLang || item.scope === "common") ? 120 : 0;
    const freqBonus = Math.min(50, (learnedRec.count || 1) * 5);
    return {
      score: 2500 + scopeBonus + freqBonus,
      reasonTag: "내 학습 1순위",
      learned: true
    };
  }

  // 2. Exact match
  if (codeL === qL || (koL && koL === qL) || enL === qL) {
    return {
      score: 1000 - item.code.length + activeLangBonus,
      reasonTag: "",
      learned: false
    };
  }

  // 3. Prefix match on code, Korean, English, or exclusive synonyms
  if (codeL.startsWith(qL)) {
    return { score: 850 - item.code.length + activeLangBonus, reasonTag: "", learned: false };
  }
  if (koL && koL.startsWith(qL)) {
    return { score: 820 - item.ko.length + activeLangBonus, reasonTag: "", learned: false };
  }
  if (enL.startsWith(qL)) {
    return { score: 780 - item.en.length + activeLangBonus, reasonTag: "", learned: false };
  }
  const synListKo = Array.isArray(item.synonyms_ko) ? item.synonyms_ko : [];
  const synListEn = Array.isArray(item.synonyms_en) ? item.synonyms_en : [];
  if (!hideKo && synListKo.some((s) => String(s || "").toLowerCase().startsWith(qL))) {
    return { score: 835 + activeLangBonus, reasonTag: "동의어 묶음", learned: false };
  }
  if (synListEn.some((s) => String(s || "").toLowerCase().startsWith(qL))) {
    return { score: 795 + activeLangBonus, reasonTag: hideKo ? "Synonym Bundle" : "영문 동의어", learned: false };
  }

  // 4. KO/EN stem + offline synonym cluster matching
  const queryStems = extractBilingualStems(q);
  const synScore = computeSynonymClusterScore(queryStems, item.code);
  if (synScore > 0) {
    return {
      score: synScore + activeLangBonus,
      reasonTag: hideKo ? "Synonym Suggest" : "유의어 추천",
      learned: false
    };
  }

  // 4b. Offline POS Vocab DB exact/stem relevance link
  const vocabMode = hasKoreanQuery ? "ko" : "en";
  const vocabHit = getVocabEntry(q, vocabMode) || (queryStems[1] ? getVocabEntry(queryStems[1], vocabMode) : null);
  if (vocabHit && Array.isArray(vocabHit.codes)) {
    const matchedPair = vocabHit.codes.find(([cTok]) => String(cTok || "").toLowerCase() === codeL);
    if (matchedPair) {
      return {
        score: 640 + Math.min(90, Number(matchedPair[1]) || 40) + activeLangBonus,
        reasonTag: hideKo ? `Vocab DB (${vocabHit.pos})` : `단어DB (${vocabHit.pos})`,
        learned: false
      };
    }
  }

  // 5. Prefix-only code match (no KO/EN substring matching across different canonicals)
  if (codeL.startsWith(qL)) {
    return { score: 650 + activeLangBonus, reasonTag: "", learned: false };
  }

  // 6. Kid-friendly description / role / usage keyword inverted index
  const invScore = computeInvertedIndexScore(queryStems, item.code);
  if (invScore > 0) {
    return {
      score: invScore + activeLangBonus,
      reasonTag: hideKo ? "Description Match" : "설명 키워드",
      learned: false
    };
  }

  // 7. Category, grammar, or raw description substring fallback
  const gramKoL = hideKo ? "" : String(item.grammar_ko || "").toLowerCase();
  const gramEnL = String(item.grammar_en || "").toLowerCase();
  if (catL.includes(qL) || catEnL.includes(qL) || descL.includes(qL) || descEnL.includes(qL) || gramKoL.includes(qL) || gramEnL.includes(qL)) {
    return { score: 400 + activeLangBonus, reasonTag: hideKo ? "Grammar / Desc" : "문법·설명 키워드", learned: false };
  }

  return { score: 0, reasonTag: "", learned: false };
}

function computeSearchRelevanceScore(item, rawQuery, targetLang = currentLang) {
  return evaluateSearchRelevance(item, rawQuery, targetLang).score;
}
if (typeof window !== "undefined") window.computeSearchRelevanceScore = computeSearchRelevanceScore;

function searchGlobalDictionary(query, limit = 10, targetLang = currentLang) {
  const q = (query || "").trim();
  if (!q) return [];
  const qL = q.toLowerCase();
  const scored = [];
  const seenKeys = new Set();

  for (const item of flatGlobalEntries) {
    const evalRes = evaluateSearchRelevance(item, q, targetLang);
    if (evalRes.score > 0) {
      scored.push({
        item,
        score: evalRes.score,
        reasonTag: evalRes.reasonTag,
        learned: evalRes.learned
      });
      seenKeys.add(`${item.code}|${item.ko}|${item.en}`);
    }
  }

  // Also search Offline POS Vocab DB (vocabLexicon.ko / vocabLexicon.en)
  const scanLex = (lex, isKo) => {
    if (!lex) return;
    let scannedHits = 0;
    const exactEntry = isKo ? lex[q] : lex[qL];
    const checkList = [];
    if (exactEntry) checkList.push([isKo ? q : qL, exactEntry, 1100]);
    for (const word of Object.keys(lex)) {
      if (exactEntry && word === (isKo ? q : qL)) continue;
      const wl = isKo ? word : word.toLowerCase();
      if (wl.startsWith(qL)) {
        checkList.push([word, lex[word], 790 - Math.min(40, wl.length)]);
        scannedHits++;
      } else if (qL.length >= 2 && wl.includes(qL)) {
        checkList.push([word, lex[word], 540 - Math.min(30, wl.indexOf(qL))]);
        scannedHits++;
      }
      if (scannedHits >= 35) break;
    }
    const meta = vocabLexicon[(isKo ? "ko" : "en") + "Meta"];
    const posMap = (meta && meta.posMap) || { n: "noun", v: "verb", a: "adj", g: "grammar" };
    for (const [word, arr, baseScore] of checkList) {
      if (!Array.isArray(arr)) continue;
      const posName = posMap[arr[0]] || arr[0] || "word";
      const varIdent = arr[1] || word;
      const hasLinkedCode = Array.isArray(arr[2]) && arr[2].length > 0 && arr[2][0] && arr[2][0][0];
      const topCode = hasLinkedCode ? arr[2][0][0] : word;
      const bundle = hasLinkedCode
        ? getExclusiveBundleMeta(topCode, targetLang || "common", {
            ko: isKo ? word : "",
            en: isKo ? varIdent : word
          })
        : {
            code: varIdent,
            ko: isKo ? word : "",
            en: isKo ? varIdent : word,
            synonyms_ko: [],
            synonyms_en: [],
            grammar_ko: "",
            grammar_ex_ko: "",
            grammar_en: "",
            grammar_ex_en: "",
            role_ko: "",
            role_en: ""
          };
      const resolvedKo = isKo ? (bundle.ko || word) : (bundle.ko || word);
      const resolvedEn = bundle.en || (isKo ? varIdent : word);
      const key = `${topCode}|${resolvedKo}|${resolvedEn}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      scored.push({
        item: {
          scope: targetLang || "common",
          langLabel: "VOCAB DB",
          code: topCode,
          en: resolvedEn,
          ko: resolvedKo,
          synonyms_ko: bundle.synonyms_ko,
          synonyms_en: bundle.synonyms_en,
          grammar_ko: bundle.grammar_ko,
          grammar_ex_ko: bundle.grammar_ex_ko,
          grammar_en: bundle.grammar_en,
          grammar_ex_en: bundle.grammar_ex_en,
          role_ko: bundle.role_ko,
          role_en: bundle.role_en,
          category: posName,
          category_en: posName
        },
        score: baseScore,
        reasonTag: hasLinkedCode
          ? (isKo ? `단어DB (${posName})` : `Vocab DB (${posName})`)
          : (isKo ? `변수명 (${posName})` : `Identifier (${posName})`),
        learned: false
      });
    }
  };
  scanLex(vocabLexicon.ko, true);
  scanLex(vocabLexicon.en, false);

  scored.sort((a, b) => b.score - a.score || String(a.item.code || "").localeCompare(String(b.item.code || "")));
  const slice = limit > 0 ? scored.slice(0, limit) : scored;
  return slice.map((s) => Object.assign({}, s.item, {
    _relevanceScore: s.score,
    _reasonTag: s.reasonTag,
    _isLearned: s.learned
  }));
}
if (typeof window !== "undefined") window.searchGlobalDictionary = searchGlobalDictionary;

function renderQuickSearchPopup(query) {
  const popup = document.getElementById("quick-search-popup");
  const resultsBox = document.getElementById("quick-search-results");
  const clearBtn = document.getElementById("btn-quick-search-clear");
  if (!popup || !resultsBox) return;

  const q = (query || "").trim();
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !q);
  }
  if (!q) {
    popup.classList.add("hidden");
    resultsBox.innerHTML = "";
    return;
  }

  const top10 = searchGlobalDictionary(q, 10, currentLang);
  resultsBox.innerHTML = "";

  if (top10.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "quick-search-empty";
    emptyEl.textContent = uiLang === "ko" ? `"${q}"에 해당하는 DB 단어가 없습니다.` : `No matching Vocab DB words for "${q}".`;
    resultsBox.appendChild(emptyEl);
  } else {
    top10.forEach((item) => {
      const row = document.createElement("div");
      row.className = "quick-search-item";
      row.setAttribute("data-scope", item.scope);
      row.setAttribute("data-code", item.code);

      const hasBundleSynonyms = item.langLabel !== "VOCAB DB" || (Array.isArray(item.synonyms_ko) && item.synonyms_ko.length > 0) || (Array.isArray(item.synonyms_en) && item.synonyms_en.length > 0);
      const bundle = hasBundleSynonyms
        ? getExclusiveBundleMeta(item.code, item.scope, item.rawEntry, item)
        : {
            code: item.code,
            ko: item.ko || "",
            en: item.en || "",
            synonyms_ko: [],
            synonyms_en: [],
            grammar_ko: "",
            grammar_en: ""
          };
      const canonicalKo = bundle.ko || item.ko || item.code;
      const canonicalEn = bundle.en || item.en || item.code;
      const showNatKo = targetLocale !== "none" && (uiLang !== "en" || /[가-힣]/.test(q));
      const primaryNat = showNatKo ? canonicalKo : canonicalEn;
      const secondaryNat = showNatKo ? canonicalEn : canonicalKo;
      const isEnUi = uiLang === "en" && !/[가-힣]/.test(q);
      const langTag = item.langLabel === "VOCAB DB"
        ? "DB"
        : (item.scope === "common" ? "ALL" : (item.scope === "java" ? "JAVA" : (item.scope === "c" ? "C" : item.scope.slice(0, 2).toUpperCase())));

      let badgeHtml = "";
      if (item._isLearned) {
        badgeHtml = `<span class="qs-learned-badge">${hoverIcon("spark")} ${isEnUi ? "Learned #1" : "내 학습 1순위"}</span>`;
      } else if (item._reasonTag) {
        badgeHtml = `<span class="qs-reason-badge">${escapeHtml(item._reasonTag)}</span>`;
      }

      const kid = typeof describeWordForKids === "function" ? describeWordForKids(item, isEnUi) : null;
      const summaryText = String(
        isEnUi
          ? (item.desc_en || (kid && (kid.short || kid.desc)) || "")
          : (item.desc || (kid && (kid.short || kid.desc)) || "")
      ).trim();
      const grammarHint = String(
        isEnUi ? (bundle.grammar_en || item.grammar_en || "") : (bundle.grammar_ko || item.grammar_ko || "")
      ).trim();
      const synList = showNatKo ? (bundle.synonyms_ko || []) : (bundle.synonyms_en || []);
      const extraSyns = synList.filter((w) => w && w !== primaryNat).slice(0, 6);

      row.innerHTML = `
        <div class="qs-item-left">
          <span class="qs-lang-tag">${escapeHtml(langTag)}</span>
          <span class="qs-code">${escapeHtml(item.code)}</span>
          <span class="qs-arrow">⇄</span>
          <span class="qs-ko">${escapeHtml(primaryNat)}</span>
          ${secondaryNat && secondaryNat !== primaryNat ? `<span class="qs-en">${escapeHtml(secondaryNat)}</span>` : ""}
          ${badgeHtml}
        </div>
        ${summaryText ? `<div class="qs-summary-desc">${escapeHtml(summaryText)}</div>` : ""}
        ${(extraSyns.length > 0 || grammarHint) ? `
          <div class="qs-synonym-row">
            <span class="synonym-chip canonical">${escapeHtml(showNatKo ? "대표:" : "Canonical:")} ${escapeHtml(primaryNat)}</span>
            ${extraSyns.map((s) => `<span class="synonym-chip">${escapeHtml(s)}</span>`).join("")}
            ${grammarHint ? `<span class="synonym-chip">${escapeHtml(grammarHint)}</span>` : ""}
          </div>
        ` : ""}
      `;

      row.addEventListener("click", () => {
        if (q && /[가-힣A-Za-z_]/.test(q) && item.code) {
          const learnScope = item.scope && item.scope !== "common" ? item.scope : currentLang;
          recordUserLearnedMapping(q, item.code, learnScope);
        }
        popup.classList.add("hidden");
        const rawSkel = displayMode === "raw" && item.code ? buildSymbolSkeletonForCode(item.code, currentLang) : null;
        const rawInsert = rawSkel ? rawSkel.preview : adaptOpCodeToLang(item.code || "", currentLang);
        const insertWord = displayMode === "raw"
          ? (rawInsert || primaryNat)
          : (naturalInsertForDictEntry(item.code, item, displayMode) || (displayMode === "en" ? canonicalEn : canonicalKo) || primaryNat);
        if (editor && insertWord) {
          const pos = editor.getPosition() || { lineNumber: 1, column: 1 };
          editor.executeEdits("tran-quick-search-insert", [{
            range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
            text: insertWord,
            forceMoveMarkers: true
          }]);
          if (displayMode === "ko" || displayMode === "en") {
            markTabNaturalEdited(getActiveTab());
            syncNaturalEditorToRawBuffer({ commit: true });
            scheduleSaveWorkspaceState(1500);
          }
          if (typeof hideNaturalSuggestWidget === "function") hideNaturalSuggestWidget();
          refreshAllViews();
          editor.focus();
          logConsole(`대표 단어 삽입 완료: "${insertWord}" (${item.code})`);
        }
      });
      resultsBox.appendChild(row);
    });
  }

  popup.classList.remove("hidden");
}

function closeAllFullscreenPanels(includeModals = false) {
  [
    "fullscreen-raw-view",
    "fullscreen-dict-view",
    "word-example-overlay",
    "fullscreen-sentence-view"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  if (includeModals) {
    ["ui-lang-modal", "locale-modal", "quick-search-popup"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
    if (typeof hideNaturalSuggestWidget === "function") hideNaturalSuggestWidget();
  }
}

let dictFilteredEntriesCache = [];
let dictRenderOffset = 0;
const DICT_RENDER_CHUNK = 120;

async function openFullscreenDictView(options = {}) {
  closeAllFullscreenPanels();
  await loadAllRawCartridges();

  const panel = document.getElementById("fullscreen-dict-view");
  const searchInput = document.getElementById("dict-main-search-input");
  const clearBtn = document.getElementById("btn-dict-search-clear");
  if (!panel) return;

  if (options.lang) {
    dictBrowserState.lang = options.lang;
  }
  if (typeof options.query === "string") {
    dictBrowserState.query = options.query;
    dictBrowserState.sort = options.query.trim() ? "rel" : (dictBrowserState.sort === "rel" ? "abc" : dictBrowserState.sort);
  }
  if (options.sort) {
    dictBrowserState.sort = options.sort;
  }
  if (uiLang === "en" && dictBrowserState.sort === "ganada") {
    dictBrowserState.sort = "abc";
  }

  if (searchInput) {
    searchInput.value = dictBrowserState.query;
  }
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !dictBrowserState.query.trim());
  }

  syncDictBrowserTabsUI();
  renderFullscreenDictionaryList();
  panel.classList.remove("hidden");
  if (searchInput) searchInput.focus();
}

function syncDictBrowserTabsUI() {
  document.querySelectorAll("#dict-lang-tabs .dict-lang-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dict-lang") === dictBrowserState.lang);
  });
  document.querySelectorAll("#dict-sort-tabs .dict-sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dict-sort") === dictBrowserState.sort);
  });
  const relBtn = document.getElementById("btn-sort-rel");
  if (relBtn) {
    relBtn.style.display = dictBrowserState.query.trim() ? "" : "none";
  }
}

function getFilteredAndSortedDictEntries() {
  const q = (dictBrowserState.query || "").trim();
  const targetLangFilter = dictBrowserState.lang || "all";
  const evalLang = targetLangFilter === "all" ? currentLang : targetLangFilter;
  const sortMode = dictBrowserState.sort || "abc";

  let items = flatGlobalEntries.filter((item) => {
    if (targetLangFilter !== "all" && item.scope !== targetLangFilter && item.scope !== "common") {
      return false;
    }
    return true;
  });

  if (q) {
    const matched = [];
    for (const item of items) {
      const res = evaluateSearchRelevance(item, q, evalLang);
      if (res.score > 0) {
        matched.push({ item, score: res.score });
      }
    }
    if (sortMode === "rel") {
      matched.sort((a, b) => b.score - a.score || String(a.item.code || "").localeCompare(String(b.item.code || "")));
      return matched.map((m) => m.item);
    }
    items = matched.map((m) => m.item);
  }

  const isEnUi = uiLang === "en";
  items = items.slice();
  if (sortMode === "ganada") {
    items.sort((a, b) => {
      const ka = String(a.ko || a.en || a.code || "");
      const kb = String(b.ko || b.en || b.code || "");
      return ka.localeCompare(kb, "ko") || String(a.code || "").localeCompare(String(b.code || ""));
    });
  } else if (sortMode === "role") {
    items.sort((a, b) => {
      const ra = String(isEnUi ? (a.role_en || a.category_en || a.category) : (a.role_ko || a.category || a.category_en));
      const rb = String(isEnUi ? (b.role_en || b.category_en || b.category) : (b.role_ko || b.category || b.category_en));
      return ra.localeCompare(rb, isEnUi ? "en" : "ko") || String(a.code || "").localeCompare(String(b.code || ""));
    });
  } else {
    items.sort((a, b) => {
      const ea = String(a.en || a.code || "").toLowerCase();
      const eb = String(b.en || b.code || "").toLowerCase();
      return ea.localeCompare(eb) || String(a.code || "").localeCompare(String(b.code || ""));
    });
  }
  return items;
}

function renderFullscreenDictionaryList() {
  const tbody = document.getElementById("dict-main-tbody");
  const countBadge = document.getElementById("dict-fullscreen-count");
  const scrollWrap = document.getElementById("dict-main-scroll-wrap");
  if (!tbody) return;

  dictFilteredEntriesCache = getFilteredAndSortedDictEntries();
  dictRenderOffset = 0;
  tbody.innerHTML = "";

  if (countBadge) {
    countBadge.textContent = uiLang === "ko"
      ? `${dictFilteredEntriesCache.length.toLocaleString()}개 항목`
      : `${dictFilteredEntriesCache.length.toLocaleString()} Entries`;
  }

  if (dictFilteredEntriesCache.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">${
      uiLang === "ko" ? "검색 조건에 맞는 매칭사전 항목이 없습니다." : "No matching dictionary entries found."
    }</td>`;
    tbody.appendChild(tr);
    return;
  }

  appendDictRows(tbody, dictFilteredEntriesCache, 0, DICT_RENDER_CHUNK);
  dictRenderOffset = Math.min(DICT_RENDER_CHUNK, dictFilteredEntriesCache.length);

  if (scrollWrap) {
    scrollWrap.scrollTop = 0;
    if (!scrollWrap.__dictScrollBound) {
      scrollWrap.__dictScrollBound = true;
      scrollWrap.addEventListener("scroll", () => {
        if (dictRenderOffset >= dictFilteredEntriesCache.length) return;
        if (scrollWrap.scrollTop + scrollWrap.clientHeight >= scrollWrap.scrollHeight - 240) {
          const tb = document.getElementById("dict-main-tbody");
          if (!tb) return;
          appendDictRows(tb, dictFilteredEntriesCache, dictRenderOffset, DICT_RENDER_CHUNK);
          dictRenderOffset = Math.min(dictRenderOffset + DICT_RENDER_CHUNK, dictFilteredEntriesCache.length);
        }
      });
    }
  }
}

function appendDictRows(tbody, list, startIdx, count) {
  const isEnUi = uiLang === "en";
  const endIdx = Math.min(list.length, startIdx + count);
  const frag = document.createDocumentFragment();

  for (let i = startIdx; i < endIdx; i++) {
    const item = list[i];
    const bundle = getExclusiveBundleMeta(item.code, item.scope, item.rawEntry, item);
    const canonEn = bundle.en || item.en || "";
    const canonKo = bundle.ko || item.ko || "";
    const synEn = (bundle.synonyms_en || []).filter((w) => w && w.toLowerCase() !== canonEn.toLowerCase()).slice(0, 5);
    const synKo = (bundle.synonyms_ko || []).filter((w) => w && w !== canonKo).slice(0, 5);

    const langTag = item.scope === "common" ? "ALL" : (item.scope === "java" ? "JAVA" : (item.scope === "c" ? "C" : item.scope.slice(0, 2).toUpperCase()));
    const roleText = isEnUi
      ? (bundle.role_en || item.category_en || item.category || "")
      : (bundle.role_ko || item.category || item.category_en || "");
    const natGrammar = isEnUi
      ? (bundle.grammar_en || item.grammar_en || item.syntax_en || item.syntax || "")
      : (bundle.grammar_ko || item.grammar_ko || item.syntax || item.syntax_en || "");
    const kid = typeof describeWordForKids === "function" ? describeWordForKids(item, isEnUi) : null;
    const shortDesc = isEnUi
      ? (item.desc_en || (kid && (kid.short || kid.desc)) || "")
      : (item.desc || (kid && (kid.short || kid.desc)) || "");

    const synEnHtml = synEn.length > 0
      ? `<div class="qs-synonym-row">${synEn.map((s) => `<span class="synonym-chip">${escapeHtml(s)}</span>`).join("")}</div>`
      : "";
    const synKoHtml = synKo.length > 0
      ? `<div class="qs-synonym-row">${synKo.map((s) => `<span class="synonym-chip">${escapeHtml(s)}</span>`).join("")}</div>`
      : "";

    const row = document.createElement("tr");
    row.className = "dict-word-row";
    row.setAttribute("data-code", item.code);
    row.setAttribute("data-scope", item.scope);
    row.innerHTML = `
      <td class="dict-col-lang"><span class="qs-lang-tag">${escapeHtml(langTag)}</span></td>
      <td class="dict-col-role">${escapeHtml(roleText)}</td>
      <td class="dict-cell-code"><code>${escapeHtml(item.code)}</code></td>
      <td class="dict-cell-en"><div><strong>${escapeHtml(canonEn)}</strong></div>${synEnHtml}</td>
      <td class="dict-cell-ko target-locale-only"><div><strong>${escapeHtml(canonKo)}</strong></div>${synKoHtml}</td>
      <td class="dict-cell-syntax">${escapeHtml(natGrammar)}</td>
      <td class="dict-cell-desc">${escapeHtml(shortDesc)}</td>
    `;
    row.addEventListener("click", () => openWordExampleOverlay(item));
    frag.appendChild(row);
  }
  tbody.appendChild(frag);
}

function scrollToAndHighlightDictRow(code, scope) {
  const tbody = document.getElementById("dict-main-tbody");
  if (!tbody) return;
  const rows = tbody.querySelectorAll("tr.dict-word-row");
  for (const r of rows) {
    if (r.getAttribute("data-code") === code && (!scope || r.getAttribute("data-scope") === scope)) {
      r.scrollIntoView({ block: "center", behavior: "smooth" });
      r.classList.add("highlight-flash");
      setTimeout(() => r.classList.remove("highlight-flash"), 1600);
      return;
    }
  }
}

function openWordExampleOverlay(item) {
  if (!item) return;
  currentOverlayWordItem = item;
  const overlay = document.getElementById("word-example-overlay");
  if (!overlay) return;

  const isEnUi = uiLang === "en";
  const bundle = getExclusiveBundleMeta(item.code, item.scope, item.rawEntry, item);
  const guide = buildWordUsageGuide(item);
  const canonEn = bundle.en || item.en || item.code;
  const canonKo = bundle.ko || item.ko || canonEn;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "";
  };

  setTxt("word-overlay-lang-badge", item.langLabel || SCOPE_LABELS[item.scope] || (item.scope || currentLang).toUpperCase());
  setTxt("word-overlay-role-badge", isEnUi ? (bundle.role_en || item.category_en || item.category) : (bundle.role_ko || item.category || item.category_en));
  setTxt("word-overlay-raw", item.code);
  setTxt("word-overlay-en", canonEn);
  setTxt("word-overlay-ko", canonKo);

  const synBox = document.getElementById("word-overlay-synonyms");
  if (synBox) {
    const chips = [];
    const synKoList = Array.isArray(bundle.synonyms_ko) ? bundle.synonyms_ko.filter((w) => w && w !== canonKo) : [];
    const synEnList = Array.isArray(bundle.synonyms_en) ? bundle.synonyms_en.filter((w) => w && w.toLowerCase() !== String(canonEn).toLowerCase()) : [];
    if (targetLocale !== "none" && canonKo) {
      chips.push(`<span class="synonym-chip canonical">${escapeHtml(isEnUi ? "Canonical KO:" : "일정 대표(KO):")} ${escapeHtml(canonKo)}</span>`);
      synKoList.forEach((w) => chips.push(`<span class="synonym-chip">${escapeHtml(w)}</span>`));
    }
    if (canonEn) {
      chips.push(`<span class="synonym-chip canonical">${escapeHtml(isEnUi ? "Canonical EN:" : "대표 영어(EN):")} ${escapeHtml(canonEn)}</span>`);
      synEnList.forEach((w) => chips.push(`<span class="synonym-chip">${escapeHtml(w)}</span>`));
    }
    synBox.innerHTML = chips.join("") || `<span class="synonym-chip">${escapeHtml(canonKo || canonEn)}</span>`;
  }

  setTxt("word-overlay-usage-desc", guide.desc);

  const natGramLines = [];
  const koG = bundle.grammar_ko || `${canonKo}  (배타적 동의어 입력 시에도 '${canonKo}' 기준으로 동일 컴파일)`;
  const koExG = bundle.grammar_ex_ko || guide.koEx || "";
  const enG = bundle.grammar_en || `${canonEn}  (Follow word order; exclusive synonyms normalize to '${canonEn}')`;
  const enExG = bundle.grammar_ex_en || guide.enEx || "";
  if (targetLocale !== "none") {
    natGramLines.push(`[한국어 자연어 입력 문법] ${koG}`);
    if (koExG) natGramLines.push(`  • 예시: ${koExG}`);
  }
  natGramLines.push(`[English Natural Grammar] ${enG}`);
  if (enExG) natGramLines.push(`  • Example: ${enExG}`);
  setTxt("word-overlay-natural-grammar", natGramLines.join("\n"));

  setTxt("word-overlay-where", guide.usage);
  setTxt("word-overlay-syntax", guide.syntax);
  setTxt("word-overlay-inside", guide.inside);
  setTxt("word-overlay-ex-raw", guide.rawEx);
  setTxt("word-overlay-ex-en", guide.enEx);
  setTxt("word-overlay-ex-ko", guide.koEx);
  setTxt("word-overlay-result", guide.result);
  setTxt("word-overlay-tip", guide.tip);

  overlay.classList.remove("hidden");
}

function closeWordExampleOverlay() {
  const overlay = document.getElementById("word-example-overlay");
  if (overlay) overlay.classList.add("hidden");
  currentOverlayWordItem = null;
}

function syncInlineSummaryToggleUI() {
  const btn = document.getElementById("btn-toggle-inline-summary");
  if (!btn) return;
  const dict = UI_I18N[uiLang] || UI_I18N.en;
  btn.textContent = showInlineSentenceSummary ? dict.btn_inline_summary_on : dict.btn_inline_summary_off;
}

function updateSentenceComposerPreview() {
  const inputEl = document.getElementById("sentence-composer-input");
  const previewEl = document.getElementById("sentence-composer-preview");
  const badgeEl = document.getElementById("sentence-composer-pattern-badge");
  if (!inputEl || !previewEl) return;

  const isEnMode = displayMode === "en" || (displayMode !== "ko" && uiLang === "en");
  const rawText = inputEl.value.trim();
  if (!rawText) {
    previewEl.textContent = isEnMode
      ? `// ${currentLang.toUpperCase()} Preview: Pick a pattern pill above or type an English sentence.`
      : `// ${currentLang.toUpperCase()} 미리보기: 위 예시를 누르거나 한국어 어순으로 입력해보세요.`;
    if (badgeEl) badgeEl.textContent = isEnMode ? "KO / EN Word-Order Ready" : "4가지 어순 틀 지원";
    return;
  }

  const effectiveLangMode = /[가-힣]/.test(rawText) ? "ko" : "en";
  const res = parseNaturalSentenceToCode(rawText, currentLang, effectiveLangMode);
  const validation = validateNaturalLineTokens(rawText, effectiveLangMode);
  if (!validation.ok && validation.unknownWords.length > 0) {
    const unknownList = validation.unknownWords.map((u) => u.word).join(", ");
    previewEl.textContent =
      effectiveLangMode === "en"
        ? `// Blocked — unregistered Vocab DB word(s): ${unknownList}\n// Please replace with words registered in the Vocab DB.`
        : `// 차단됨 — DB 미등록 단어: ${unknownList}\n// 단어 DB에 등재된 자연어 단어만 사용할 수 있습니다.`;
    if (badgeEl) badgeEl.textContent = effectiveLangMode === "en" ? "Unregistered Word" : "DB 미등록 단어";
    return;
  }

  if (res && res.code) {
    previewEl.textContent = res.code;
    const titleLabel = effectiveLangMode === "en" ? (res.titleEn || res.titleKo) : (res.titleKo || res.titleEn);
    if (badgeEl) {
      const icon = hoverIcon(res.iconKey || "rule");
      badgeEl.innerHTML = `${icon} ${escapeHtml(titleLabel)} (${currentLang.toUpperCase()})`;
    }
  } else {
    previewEl.textContent = isEnMode
      ? `// Does not match the 4 word-order patterns yet.\n` +
        `// Examples:\n` +
        `// ① put 80 into score\n` +
        `// ② if score is at least 80 then print passed\n` +
        `// ③ from scores filter at least 80 then sort and save file\n` +
        `// ④ for each item in items print item  /  repeat 5 times print hello`
      : `// 아직 4가지 어순 틀과 정확히 맞지 않습니다.\n` +
        `// 예시:\n` +
        `// ① 점수에 80 넣기\n` +
        `// ② 만약 점수 80 이상이면 합격 출력\n` +
        `// ③ 점수 80 이상 골라서 정렬하고 파일저장\n` +
        `// ④ 목록 하나씩 출력  /  5번 반복 안녕 출력`;
    if (badgeEl) badgeEl.textContent = isEnMode ? "Waiting for pattern" : "어순 입력 대기";
  }
}

function renderLearnedMappingsUI() {
  const box = document.getElementById("user-learned-list-box");
  if (!box) return;
  box.innerHTML = "";

  const entries = [];
  const scopes = [currentLang, "global", "python", "javascript", "typescript", "kotlin", "swift", "c", "java"];
  const seenScopeSet = new Set();
  for (const sc of scopes) {
    if (seenScopeSet.has(sc)) continue;
    seenScopeSet.add(sc);
    const bucket = userLearnedMappings && userLearnedMappings[sc];
    if (!bucket || typeof bucket !== "object") continue;
    for (const [key, rec] of Object.entries(bucket)) {
      if (!rec || !rec.code || rec.derivedFrom) continue;
      entries.push({ scope: sc, key, rawQuery: rec.rawQuery || key, code: rec.code, count: rec.count || 1, updatedAt: rec.updatedAt || 0 });
    }
  }
  entries.sort((a, b) => b.updatedAt - a.updatedAt);

  if (entries.length === 0) {
    const empty = document.createElement("span");
    empty.className = "sentence-card-desc";
    empty.textContent = "아직 학습된 단어가 없습니다. 빠른 검색이나 자동완성에서 추천 코드를 선택하면 자동 학습됩니다.";
    box.appendChild(empty);
    return;
  }

  for (const item of entries) {
    const chip = document.createElement("div");
    chip.className = "learned-chip";
    const scopeLabel = item.scope === "global" ? "ALL" : item.scope.toUpperCase();
    chip.innerHTML = `
      <span class="qs-lang-tag">${escapeHtml(scopeLabel)}</span>
      <span>${escapeHtml(item.rawQuery)}</span>
      <span>➔</span>
      <code>${escapeHtml(item.code)}</code>
      <button type="button" class="learned-chip-del" title="이 학습 기록 삭제">✕</button>
    `;
    const delBtn = chip.querySelector(".learned-chip-del");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        removeUserLearnedMapping(item.scope, item.key);
      });
    }
    box.appendChild(chip);
  }
}

function renderSentenceSummaryPanel() {
  const listEl = document.getElementById("code-sentence-summary-list");
  const langBadge = document.getElementById("sentence-summary-lang-badge");
  if (langBadge) {
    langBadge.textContent = (currentLang || "python").toUpperCase();
  }
  if (!listEl) return;
  listEl.innerHTML = "";

  const isEnSummary = displayMode === "en" || (displayMode !== "ko" && uiLang === "en");
  const rawCode = getActiveRawCode();
  const summaries = isEnSummary
    ? summarizeFullCodeToEnglish(rawCode, currentLang)
    : summarizeFullCodeToKorean(rawCode, currentLang);

  if (summaries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sentence-summary-row";
    empty.innerHTML = isEnSummary
      ? `<div class="sentence-natural-line">No code lines to summarize yet. Try inserting a sentence pattern on the left or writing in the editor.</div>`
      : `<div class="sentence-natural-line">해석할 코드 줄이 아직 없습니다. 왼쪽 문장 입력기에서 어순 문장을 넣어보거나 에디터에 코드를 작성하세요.</div>`;
    listEl.appendChild(empty);
    return;
  }

  for (const row of summaries) {
    const itemEl = document.createElement("div");
    itemEl.className = "sentence-summary-row";
    itemEl.style.cursor = "pointer";
    itemEl.innerHTML = `
      <div class="sentence-summary-meta">
        <span class="sentence-line-no">Line ${row.lineNumber}</span>
        <code class="sentence-raw-snippet">${escapeHtml(row.rawLine)}</code>
      </div>
      <div class="sentence-natural-line">${hoverIcon(row.iconKey || "note")} ${escapeHtml(row.sentenceEn || row.sentenceKo)}</div>
    `;
    itemEl.addEventListener("click", () => {
      closeAllFullscreenPanels();
      if (editor) {
        editor.revealLineInCenter(row.lineNumber);
        editor.setPosition({ lineNumber: row.lineNumber, column: 1 });
        editor.focus();
      }
    });
    listEl.appendChild(itemEl);
  }
}

async function openFullscreenSentenceView(initialQuery = "") {
  if (flatGlobalEntries.length === 0) {
    await loadAllRawCartridges();
  }
  closeAllFullscreenPanels();
  const panel = document.getElementById("fullscreen-sentence-view");
  if (!panel) return;

  const isEnStudio = displayMode === "en" || (displayMode !== "ko" && uiLang === "en");
  const sampleSpecs = isEnStudio
    ? [
        { sample: "put 80 into score", label: "① Assign: put 80 into score" },
        { sample: "if score is at least 80 then print passed", label: "② Condition: if score is at least 80 then print passed" },
        { sample: "from scores filter at least 80 then sort and save file", label: "③ Pipeline: from scores filter at least 80 then sort and save file" },
        { sample: "for each item in items print item", label: "④ Loop (Each): for each item in items print item" },
        { sample: "repeat 5 times print hello", label: "④ Loop (Count): repeat 5 times print hello" }
      ]
    : [
        { sample: "점수에 80 넣기", label: "① 값 담기: 점수에 80 넣기" },
        { sample: "만약 점수 80 이상이면 합격 출력", label: "② 조건: 만약 점수 80 이상이면 합격 출력" },
        { sample: "점수 80 이상 골라서 정렬하고 파일저장", label: "③ 연속 작업: 점수 80 이상 골라서 정렬하고 파일저장" },
        { sample: "목록 하나씩 출력", label: "④ 반복(하나씩): 목록 하나씩 출력" },
        { sample: "5번 반복 안녕 출력", label: "④ 반복(횟수): 5번 반복 안녕 출력" }
      ];
  const pills = panel.querySelectorAll(".pattern-pill");
  pills.forEach((pill, i) => {
    if (sampleSpecs[i]) {
      pill.setAttribute("data-pattern-sample", sampleSpecs[i].sample);
      pill.textContent = sampleSpecs[i].label;
    }
  });
  const inputEl = document.getElementById("sentence-composer-input");
  if (inputEl) {
    if (typeof initialQuery === "string" && initialQuery.trim()) {
      inputEl.value = initialQuery.trim();
    }
    inputEl.placeholder = isEnStudio
      ? "e.g. if score is at least 80 then print passed"
      : "예: 만약 점수 80 이상이면 합격 출력";
  }

  syncInlineSummaryToggleUI();
  renderLearnedMappingsUI();
  updateSentenceComposerPreview();
  renderSentenceSummaryPanel();
  panel.classList.remove("hidden");
  if (inputEl) inputEl.focus();
}

function openFullscreenRawView() {
  closeAllFullscreenPanels();
  const panel = document.getElementById("fullscreen-raw-view");
  if (!panel) return;
  const rawCode = getActiveRawCode();
  const pre = document.getElementById("raw-code-preview");
  if (pre) pre.textContent = rawCode;
  const metaBadge = document.getElementById("raw-view-meta-badge");
  if (metaBadge) {
    const lineCount = rawCode ? rawCode.split("\n").length : 0;
    metaBadge.textContent = `${currentLang.toUpperCase()} · ${lineCount} Lines`;
  }
  panel.classList.remove("hidden");
}

// DOM Ready Wiring
window.addEventListener("DOMContentLoaded", () => {
  initTabBarEdgeScroll();
  // Mode buttons (Dual-Buffer switch between RAW / EN Natural / KO Natural)
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetMode = btn.getAttribute("data-mode");
      switchDisplayMode(targetMode, true).then(() => {
        logConsole(`표시 모드 변경: ${displayMode.toUpperCase()}`);
      });
    });
  });

  // Language select
  document.getElementById("lang-select").addEventListener("change", (e) => {
    const newLang = e.target.value;
    const extMap = { python: "py", javascript: "js", typescript: "ts", kotlin: "kt", swift: "swift", c: "c", java: "java" };
    const prevLang = currentLang;
    const activeTab = getActiveTab();
    if (activeTab && !activeTab.path && activeTab.name.startsWith("untitled")) {
      const base = activeTab.name.replace(/\.[^.]+$/, "");
      const nextName = `${base}.${extMap[newLang] || "txt"}`;
      activeTab.name = nextName;
      document.getElementById("file-label").value = nextName;
      lastCommittedFileName = nextName;
    }
    const rawNow = getActiveRawCode();
    const isDefaultPrevSnippet =
      !rawNow.trim() || rawNow.trim() === String(SAMPLE_SNIPPETS[prevLang] || "").trim();
    if (isDefaultPrevSnippet) {
      switchLanguage(newLang, null);
    } else {
      const natInfo = extractCleanNaturalTextForLangSwitch(activeTab, prevLang);
      switchLanguage(newLang, rawNow, {
        recompileFromNatural: true,
        naturalText: natInfo.text,
        naturalMode: natInfo.mode
      });
    }
  });

  // New Tab button
  const newTabBtn = document.getElementById("btn-new-tab");
  if (newTabBtn) {
    newTabBtn.addEventListener("click", () => {
      createNewTab({ language: currentLang });
      logConsole("새 작업 탭이 추가되었습니다.");
    });
  }

  // UI Language Settings Modal (Default: EN)
  const uiLangModal = document.getElementById("ui-lang-modal");
  const openUiLangModal = () => {
    if (uiLangModal) uiLangModal.classList.remove("hidden");
  };
  const closeUiLangModal = () => {
    if (uiLangModal) uiLangModal.classList.add("hidden");
  };

  const btnUiLang = document.getElementById("btn-ui-lang");
  if (btnUiLang) {
    btnUiLang.addEventListener("click", openUiLangModal);
  }
  const btnCloseUiLang = document.getElementById("btn-close-ui-lang-modal");
  if (btnCloseUiLang) {
    btnCloseUiLang.addEventListener("click", closeUiLangModal);
  }
  const btnConfirmUiLang = document.getElementById("btn-confirm-ui-lang-modal");
  if (btnConfirmUiLang) {
    btnConfirmUiLang.addEventListener("click", closeUiLangModal);
  }
  if (uiLangModal) {
    uiLangModal.addEventListener("click", (e) => {
      if (e.target === uiLangModal) closeUiLangModal();
    });
  }
  document.querySelectorAll("#ui-lang-list .locale-item").forEach((item) => {
    item.addEventListener("click", () => {
      const selected = item.getAttribute("data-ui-lang");
      if (selected) {
        applyUiLanguage(selected, true);
        logConsole(
          selected === "ko"
            ? "인터페이스 언어 변경: 한국어 (KO)"
            : "UI Language switched: English (EN)"
        );
      }
    });
  });

  // Locale Plugin Settings Modal
  const localeModal = document.getElementById("locale-modal");
  const openLocaleModal = () => {
    if (localeModal) localeModal.classList.remove("hidden");
  };
  const closeLocaleModal = () => {
    if (localeModal) localeModal.classList.add("hidden");
  };

  const btnLocaleSettings = document.getElementById("btn-locale-settings");
  if (btnLocaleSettings) {
    btnLocaleSettings.addEventListener("click", openLocaleModal);
  }
  const btnCloseLocale = document.getElementById("btn-close-locale-modal");
  if (btnCloseLocale) {
    btnCloseLocale.addEventListener("click", closeLocaleModal);
  }
  const btnConfirmLocale = document.getElementById("btn-confirm-locale-modal");
  if (btnConfirmLocale) {
    btnConfirmLocale.addEventListener("click", closeLocaleModal);
  }
  if (localeModal) {
    localeModal.addEventListener("click", (e) => {
      if (e.target === localeModal) closeLocaleModal();
    });
  }
  document.querySelectorAll("#locale-plugin-list .locale-item").forEach((item) => {
    item.addEventListener("click", () => {
      const selected = item.getAttribute("data-locale");
      if (selected) {
        setTargetLocale(selected);
      }
    });
  });

  // Inline filename input interactions
  const fileLabelInput = document.getElementById("file-label");
  fileLabelInput.addEventListener("focus", () => {
    const val = fileLabelInput.value;
    const dotIdx = val.lastIndexOf(".");
    if (dotIdx > 0) {
      fileLabelInput.setSelectionRange(0, dotIdx);
    } else {
      fileLabelInput.select();
    }
  });

  fileLabelInput.addEventListener("input", () => {
    const activeTab = getActiveTab();
    if (activeTab) {
      activeTab.name = (fileLabelInput.value || "").trim() || activeTab.name;
      renderTabs();
      updateLangMatchDot();
      saveWorkspaceState();
    }
  });

  fileLabelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fileLabelInput.blur();
      if (editor) editor.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      fileLabelInput.value = lastCommittedFileName;
      const activeTab = getActiveTab();
      if (activeTab) {
        activeTab.name = lastCommittedFileName;
        renderTabs();
        saveWorkspaceState();
      }
      fileLabelInput.blur();
      if (editor) editor.focus();
    }
  });

  // Global window-level capture shortcuts (works regardless of where focus is)
  window.addEventListener(
    "keydown",
    (e) => {
      const key = (e.key || "").toLowerCase();
      if (e.key === "Escape" && uiLangModal && !uiLangModal.classList.contains("hidden")) {
        e.preventDefault();
        closeUiLangModal();
        return;
      }
      if (e.key === "Escape" && localeModal && !localeModal.classList.contains("hidden")) {
        e.preventDefault();
        closeLocaleModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === fileLabelInput) {
          fileLabelInput.blur();
        }
        handleSaveFile();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "o") {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFile();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        e.stopPropagation();
        createNewTab({ language: currentLang });
        logConsole("새 작업 탭이 추가되었습니다.");
      } else if (e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        handleRunCode();
      }
    },
    { capture: true }
  );

  // Topbar buttons
  document.getElementById("btn-open").addEventListener("click", handleOpenFile);
  document.getElementById("btn-save").addEventListener("click", handleSaveFile);
  document.getElementById("btn-run").addEventListener("click", handleRunCode);
  document.getElementById("btn-clear-log").addEventListener("click", () => {
    document.getElementById("console-output").textContent = "";
  });

  // Single-Row Window Control Buttons (Steam / VS Code Style)
  const btnWinMin = document.getElementById("btn-win-minimize");
  const btnWinMax = document.getElementById("btn-win-maximize");
  const btnWinClose = document.getElementById("btn-win-close");

  const updateMaximizeButtonIcon = (isMaximized) => {
    if (!btnWinMax) return;
    btnWinMax.title = isMaximized ? "Restore" : "Maximize";
    btnWinMax.innerHTML = isMaximized
      ? '<svg viewBox="0 0 12 12" width="10" height="10"><path d="M3.5 3.5V1.5H10.5V8.5H8.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'
      : '<svg viewBox="0 0 12 12" width="10" height="10"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  };

  if (btnWinMin) {
    btnWinMin.addEventListener("click", () => {
      if (window.pywebview && window.pywebview.api && window.pywebview.api.minimize_window) {
        window.pywebview.api.minimize_window();
      }
    });
  }
  if (btnWinMax) {
    btnWinMax.addEventListener("click", async () => {
      if (window.pywebview && window.pywebview.api && window.pywebview.api.toggle_maximize_window) {
        const res = await window.pywebview.api.toggle_maximize_window();
        if (res && typeof res.maximized === "boolean") {
          updateMaximizeButtonIcon(res.maximized);
        }
      }
    });
  }
  const flushDirtySessionOnClose = () => {
    if (saveWorkspaceTimer || tabs.some((t) => t && (t.isDirty || t.userEditedNatural))) {
      return saveWorkspaceState();
    }
    return pendingSessionSavePromise || Promise.resolve();
  };
  window.addEventListener("beforeunload", () => {
    flushDirtySessionOnClose();
  });

  if (btnWinClose) {
    btnWinClose.addEventListener("click", async () => {
      try {
        await flushDirtySessionOnClose();
      } catch (_) {}
      if (window.pywebview && window.pywebview.api && window.pywebview.api.close_window) {
        window.pywebview.api.close_window();
      } else {
        window.close();
      }
    });
  }

  // Native Topbar Drag & Double-Click Maximize (ignored on controls and when maximized)
  const topbarEl = document.querySelector(".topbar");
  if (topbarEl) {
    const isInteractiveTopbarChild = (target) =>
      Boolean(
        target &&
          target.closest(
            "button, input, select, label, .window-controls-group, .mode-switch, .detected-lang-badge"
          )
      );

    topbarEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || isInteractiveTopbarChild(e.target)) return;
      if (window.pywebview && window.pywebview.api && window.pywebview.api.start_window_drag) {
        window.pywebview.api.start_window_drag();
      }
    });

    topbarEl.addEventListener("dblclick", async (e) => {
      if (isInteractiveTopbarChild(e.target)) return;
      if (window.pywebview && window.pywebview.api && window.pywebview.api.toggle_maximize_window) {
        const res = await window.pywebview.api.toggle_maximize_window();
        if (res && typeof res.maximized === "boolean") {
          updateMaximizeButtonIcon(res.maximized);
        }
      }
    });
  }

  // ==========================================================================
  // v0.9 Right Sidebar 5-Compartment & Full-Screen Event Wiring
  // ==========================================================================

  // Slot 1: Quick Search Input + Relevance Mini Popup + More Button
  const quickSearchInput = document.getElementById("quick-search-input");
  const quickSearchPopup = document.getElementById("quick-search-popup");
  const btnQuickSearchClear = document.getElementById("btn-quick-search-clear");
  const btnQuickSearchMore = document.getElementById("btn-quick-search-more");

  if (quickSearchInput) {
    quickSearchInput.addEventListener("focus", async () => {
      if (flatGlobalEntries.length === 0) {
        await loadAllRawCartridges();
      }
      if (quickSearchInput.value.trim()) {
        renderQuickSearchPopup(quickSearchInput.value);
      }
    });

    quickSearchInput.addEventListener("input", async () => {
      if (flatGlobalEntries.length === 0) {
        await loadAllRawCartridges();
      }
      renderQuickSearchPopup(quickSearchInput.value);
    });

    quickSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (quickSearchPopup) quickSearchPopup.classList.add("hidden");
        quickSearchInput.blur();
      } else if (e.key === "Enter" && quickSearchInput.value.trim()) {
        if (quickSearchPopup) quickSearchPopup.classList.add("hidden");
        openFullscreenDictView({ lang: "all", query: quickSearchInput.value.trim() });
      }
    });
  }

  if (btnQuickSearchClear && quickSearchInput) {
    btnQuickSearchClear.addEventListener("click", () => {
      quickSearchInput.value = "";
      renderQuickSearchPopup("");
      quickSearchInput.focus();
    });
  }

  if (btnQuickSearchMore && quickSearchInput) {
    btnQuickSearchMore.addEventListener("click", () => {
      const q = quickSearchInput.value.trim();
      if (quickSearchPopup) quickSearchPopup.classList.add("hidden");
      openFullscreenDictView({ lang: "all", query: q });
    });
  }

  document.addEventListener("click", (e) => {
    if (
      quickSearchPopup &&
      !quickSearchPopup.classList.contains("hidden") &&
      !e.target.closest(".quick-search-box")
    ) {
      quickSearchPopup.classList.add("hidden");
    }
  });

  // Slot 2: Full-Screen Raw Code View
  const btnOpenRawView = document.getElementById("btn-open-raw-view");
  const btnBackFromRaw = document.getElementById("btn-back-from-raw");
  const btnCopyRawCode = document.getElementById("btn-copy-raw-code");

  if (btnOpenRawView) {
    btnOpenRawView.addEventListener("click", openFullscreenRawView);
  }
  if (btnBackFromRaw) {
    btnBackFromRaw.addEventListener("click", closeAllFullscreenPanels);
  }
  if (btnCopyRawCode) {
    btnCopyRawCode.addEventListener("click", async () => {
      const rawCode = getActiveRawCode();
      try {
        await navigator.clipboard.writeText(rawCode);
        logConsole("원문 코드(Raw Buffer)가 클립보드에 복사되었습니다.");
      } catch (_) {}
    });
  }

  // Slot 3: Full-Screen Matching Dictionary + Word Example/Grammar Overlay
  const btnOpenDictView = document.getElementById("btn-open-dict-view");
  const btnBackFromDict = document.getElementById("btn-back-from-dict");
  const dictMainSearchInput = document.getElementById("dict-main-search-input");
  const btnDictSearchClear = document.getElementById("btn-dict-search-clear");
  const dictLangTabs = document.getElementById("dict-lang-tabs");
  const dictSortTabs = document.getElementById("dict-sort-tabs");
  const btnCloseWordOverlay = document.getElementById("btn-close-word-overlay");
  const wordExampleOverlay = document.getElementById("word-example-overlay");

  if (btnOpenDictView) {
    btnOpenDictView.addEventListener("click", () => openFullscreenDictView({ lang: "all", query: "" }));
  }
  if (btnBackFromDict) {
    btnBackFromDict.addEventListener("click", () => closeAllFullscreenPanels());
  }
  if (dictMainSearchInput) {
    dictMainSearchInput.addEventListener("input", () => {
      const q = dictMainSearchInput.value || "";
      dictBrowserState.query = q;
      if (q.trim()) {
        dictBrowserState.sort = "rel";
      } else if (dictBrowserState.sort === "rel") {
        dictBrowserState.sort = "abc";
      }
      if (btnDictSearchClear) btnDictSearchClear.classList.toggle("hidden", !q.trim());
      syncDictBrowserTabsUI();
      renderFullscreenDictionaryList();
    });
  }
  if (btnDictSearchClear && dictMainSearchInput) {
    btnDictSearchClear.addEventListener("click", () => {
      dictMainSearchInput.value = "";
      dictBrowserState.query = "";
      if (dictBrowserState.sort === "rel") dictBrowserState.sort = "abc";
      btnDictSearchClear.classList.add("hidden");
      syncDictBrowserTabsUI();
      renderFullscreenDictionaryList();
      dictMainSearchInput.focus();
    });
  }
  if (dictLangTabs) {
    dictLangTabs.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-dict-lang]");
      if (!tab) return;
      dictBrowserState.lang = tab.getAttribute("data-dict-lang") || "all";
      syncDictBrowserTabsUI();
      renderFullscreenDictionaryList();
    });
  }
  if (dictSortTabs) {
    dictSortTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dict-sort]");
      if (!btn) return;
      dictBrowserState.sort = btn.getAttribute("data-dict-sort") || "abc";
      syncDictBrowserTabsUI();
      renderFullscreenDictionaryList();
    });
  }
  if (btnCloseWordOverlay) {
    btnCloseWordOverlay.addEventListener("click", closeWordExampleOverlay);
  }
  if (wordExampleOverlay) {
    wordExampleOverlay.addEventListener("click", (e) => {
      if (e.target === wordExampleOverlay) closeWordExampleOverlay();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (wordExampleOverlay && !wordExampleOverlay.classList.contains("hidden")) {
      closeWordExampleOverlay();
      return;
    }
    const openPanel = ["fullscreen-dict-view", "fullscreen-raw-view", "fullscreen-sentence-view"].find((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
    if (openPanel) closeAllFullscreenPanels();
  });

  // Slot 5: Korean Word-Order Composer & Code Sentence Summarizer
  const btnOpenSentenceView = document.getElementById("btn-open-sentence-view");
  const btnBackFromSentence = document.getElementById("btn-back-from-sentence");
  const btnToggleInlineSummary = document.getElementById("btn-toggle-inline-summary");
  const sentenceComposerInput = document.getElementById("sentence-composer-input");
  const btnInsertComposedCode = document.getElementById("btn-insert-composed-code");
  const btnClearLearnedMappings = document.getElementById("btn-clear-learned-mappings");

  if (btnOpenSentenceView) {
    btnOpenSentenceView.addEventListener("click", () => openFullscreenSentenceView());
  }
  if (btnBackFromSentence) {
    btnBackFromSentence.addEventListener("click", closeAllFullscreenPanels);
  }
  if (btnToggleInlineSummary) {
    btnToggleInlineSummary.addEventListener("click", () => {
      showInlineSentenceSummary = !showInlineSentenceSummary;
      syncInlineSummaryToggleUI();
      if (editor) updateMasks();
    });
  }
  if (sentenceComposerInput) {
    sentenceComposerInput.addEventListener("input", updateSentenceComposerPreview);
    sentenceComposerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && btnInsertComposedCode) {
        e.preventDefault();
        btnInsertComposedCode.click();
      }
    });
  }
  document.querySelectorAll(".pattern-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const sample = pill.getAttribute("data-pattern-sample") || "";
      if (sentenceComposerInput) {
        sentenceComposerInput.value = sample;
        updateSentenceComposerPreview();
        sentenceComposerInput.focus();
      }
    });
  });
  if (btnInsertComposedCode) {
    btnInsertComposedCode.addEventListener("click", () => {
      const rawText = sentenceComposerInput ? sentenceComposerInput.value.trim() : "";
      const effMode = /[가-힣]/.test(rawText) ? "ko" : "en";
      const validation = validateNaturalLineTokens(rawText, effMode);
      if (!validation.ok) {
        const bad = validation.unknownWords.map((u) => u.word).join(", ");
        logConsole(`DB 미등록 단어가 포함되어 삽입할 수 없습니다: ${bad}`, "error");
        return;
      }
      const parsed = parseNaturalSentenceToCode(rawText, currentLang, effMode);
      if (!parsed || !parsed.code) {
        logConsole(
          displayMode === "en"
            ? "Please enter a sentence matching one of the 4 English word-order patterns."
            : "4가지 한국어/영어 어순 틀에 맞게 입력한 뒤 삽입해주세요.",
          "error"
        );
        return;
      }
      if (editor) {
        const model = editor.getModel();
        const pos = editor.getPosition() || { lineNumber: model ? model.getLineCount() : 1, column: 1 };
        const lineText = model ? model.getLineContent(pos.lineNumber) : "";
        const prefix = lineText.trim().length > 0 ? "\n" : "";
        const insertCol = lineText.trim().length > 0 ? lineText.length + 1 : 1;
        const textToInsert = (displayMode === "ko" || displayMode === "en") ? rawText : parsed.code;
        editor.executeEdits("tran-sentence-composer", [{
          range: new monaco.Range(pos.lineNumber, insertCol, pos.lineNumber, lineText.length + 1),
          text: prefix + textToInsert + "\n",
          forceMoveMarkers: true
        }]);
        if (displayMode === "ko" || displayMode === "en") {
          markTabNaturalEdited(getActiveTab());
          syncNaturalEditorToRawBuffer({ commit: true });
          scheduleSaveWorkspaceState(1500);
        }
        closeAllFullscreenPanels();
        refreshAllViews();
        editor.focus();
        const titleLabel = parsed.titleKo || parsed.titleEn || "Sentence";
        logConsole(`문장 어순 변환 삽입 완료 [${titleLabel}]: ${rawText}`);
      }
    });
  }
  if (btnClearLearnedMappings) {
    btnClearLearnedMappings.addEventListener("click", () => {
      clearUserLearnedMappings();
      logConsole("개인화 학습 단어 기록이 초기화되었습니다.");
    });
  }

  // Wait briefly for pywebview bridge if running inside desktop window
  window.addEventListener("pywebviewready", async () => {
    await Promise.all([
      loadUserLearnedMappings(),
      loadVocabLexicons(),
      loadAllRawCartridges().catch(() => {}),
      refreshRuntimeStatus()
    ]);
    renderLearnedMappingsUI();
    updateQuickSearchTotalBadge();
    if (editor) {
      if (sessionRestorePromise) {
        await sessionRestorePromise;
      } else if (!backendSessionSynced) {
        await restoreWorkspaceState();
      } else {
        const activeTab = getActiveTab();
        if (
          activeTab &&
          !activeTab.userEditedNatural &&
          (displayMode === "ko" || displayMode === "en") &&
          activeTab.dualBaseline &&
          activeTab.dualBaseline[displayMode] &&
          !activeTab.dualBaseline[displayMode].usedVocab
        ) {
          activeTab.naturalCache = {};
          activeTab.naturalCompiledSig = {};
          activeTab.dualBaseline = {};
          isSwitchingTab = true;
          try {
            editor.setValue(getEditorBufferForMode(activeTab, displayMode));
            adoptEditorNaturalCache(activeTab, displayMode);
          } finally {
            isSwitchingTab = false;
          }
        }
      }
      registerDictionaryCompletions();
      registerDictionaryHover();
      refreshAllViews();
    }
  });

  loadUserLearnedMappings().then(() => {
    renderLearnedMappingsUI();
    if (editor) updateMasks();
  });
  closeAllFullscreenPanels(true);
  applyUiLanguage("en", false);
  updateRunButtonLabel();
  bootMonaco();
});

/* ============================================================================
 *   🄯 (c)카피레프트 Copyleft — Tran.IDE
 *   a Bakk jaejin production
 *   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
 * ============================================================================ */
