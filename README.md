**English** | [한국어](README.ko.md)

# Tran.IDE II (v0.12)

> **🄯 (c)카피레프트 Copyleft — Tran.IDE | a Bakk jaejin production**  
> **Bidirectional 1:1 Natural Language ↔ Code IDE**

---

## Overview

**Tran.IDE II** is a desktop integrated development environment that bidirectionally translates standard source code (`RAW Code`) to and from English natural phrasing (`EN Natural`) and Korean (`KO Korean`) using **exclusive 1:1 mappings**.

You can write executable programs using natural-language word order without memorizing syntax symbols (`()`, `{}`, `:`, `;`), or open existing source files and inspect them as readable natural-language lines and sentence summaries.

---

## Key Features

- **3-Mode Dual-Buffer Editor (`RAW Code` / `EN Natural` / `KO Korean`)**:
  - Masks and decompiles code keywords and identifiers into natural language while protecting comments and string literals, and compiles natural-language edits back into valid source code.
- **7-Language Execution & Natural-Line Error Highlighting**:
  - Executes **Python, JavaScript, TypeScript** (via offline bundled Monaco `tsWorker.js`), **C, Java, Kotlin, and Swift**.
  - Maps compiler and runtime `stderr` line numbers back onto the corresponding natural-language editor line, displaying inline highlights, localized diagnostic summaries, and full raw error tooltips.
- **Exclusive 1:1 Matching Dictionary & Quick Code Search**:
  - Enforces conflict-free 1:1 mapping where each code token owns a unique canonical natural word and exclusive synonym bundle.
- **Natural Sentence Composer & Code Summarizer**:
  - Builds code from Korean/English word-order templates (assignments, conditionals, filter/sort/save pipelines, loops) and explains existing code line-by-line in plain sentences.
- **Offline POS Vocabulary Database (`dicts/vocab_ko.json`, `dicts/vocab_en.json`)**:
  - Validates natural-language tokens and provides offline autocomplete without requiring an internet connection.

---

## Installation & Usage

### Option 1. End Users — Windows Installer (`Setup.exe`, Recommended)
Run everything out of the box without manual environment setup:
1. Download **`Tran.IDE_II_v0.12_Setup.exe`** (or the portable **`Tran.IDE_II_v0.12_Portable.zip`**) from the GitHub **Releases** page.
2. Run the setup wizard — it bundles **Python, Node.js (JS/TS), TinyCC (C), Eclipse Temurin OpenJDK (Java), Kotlin Compiler, and Microsoft Edge WebView2**.
3. *(Optional)* To run **Swift** on Windows, check **"Install Swift for Windows toolchain via winget"** during setup or install Swift for Windows separately.

### Option 2. Developers — Run from Source (`run_tran_ide.bat`)
1. Clone this repository.
2. Double-click **`run_tran_ide.bat`**. On first launch it automatically creates `.venv`, installs dependencies from `requirements.txt`, and starts `Tran.IDE II`.
   *(Or run manually: `python -m venv .venv` → `.venv\Scripts\activate` → `pip install -r requirements.txt` → `python main.py`)*

### Option 3. Build Your Own Installer & `.exe` Launcher
On Windows, double-click **`build_installer.bat`** or run one of the commands below to generate **`Tran.IDE_II_v0.12_Setup.exe`** and **`Tran.IDE_II_v0.12_Portable.zip`** inside `dist/`:

```bash
# Full build with bundled portable runtimes (Python, Node.js, TinyCC, OpenJDK, Kotlin)
python scripts/build_installer.py

# Lightweight Python-only installer
python scripts/build_installer.py --lite

# Compile only the native Tran.IDE II.exe launcher in the repository root
python scripts/build_installer.py --launcher-only
```

---

## Project Structure

```text
.
├── main.py                        # pywebview bridge API, 7-language runner & error parser, app entrypoint
├── dict_manager.py                # Language cartridge loader & 1:1 bidirectional dictionary manager
├── run_tran_ide.bat               # Windows one-click auto-setup & launch script
├── build_installer.bat            # Windows one-click Setup.exe & portable package builder
├── requirements.txt               # Python package dependencies
├── LICENSE                        # Verbatim GNU Affero General Public License v3.0 (AGPL-3.0)
├── NOTICE                         # Copyright, copyleft attribution, and third-party notices
├── CONTRIBUTING.md                # Contribution guidelines
├── README.md                      # English README (default)
├── README.ko.md                   # Korean README
├── scripts/
│   └── build_installer.py         # Portable runtime bundler & Inno Setup release builder
├── installer/
│   ├── launcher.cs                # Native Windows launcher executable source (Tran.IDE II.exe)
│   └── TranIDE2.iss               # Inno Setup installer script
├── .github/workflows/
│   └── release.yml                # GitHub Actions automated Windows release workflow
├── ui/                            # Frontend UI (index.html, app.js, style.css, bundled Monaco Editor)
└── dicts/                         # 7-language cartridges & offline KO/EN vocabulary DBs
```

---

## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full license text and [NOTICE](NOTICE) for copyright and third-party notices.

```text
🄯 (c)카피레프트 Copyleft — Tran.IDE
Copyright (C) 2026 Bakk jaejin (a Bakk jaejin production)
```
