# ============================================================================
#   Tran.IDE II — Bidirectional 1:1 Natural Language <-> Code IDE
#   🄯 (c)카피레프트 Copyleft — Tran.IDE
#   Copyright (C) 2026 Bakk jaejin (a Bakk jaejin production)
#
#   SPDX-License-Identifier: AGPL-3.0-or-later
#   This program is free software: you can redistribute it and/or modify
#   it under the terms of the GNU Affero General Public License as published by
#   the Free Software Foundation, either version 3 of the License, or
#   (at your option) any later version.
#   See the LICENSE and NOTICE files or <https://www.gnu.org/licenses/>.
# ============================================================================
"""Build Tran.IDE II portable payload (with optional multi-language runtimes), launcher exe, and Inno Setup installer."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build" / "release"
CACHE = ROOT / "build" / "cache"
PAYLOAD = BUILD / "payload"
DIST_DIR = ROOT / "dist"
APP_VERSION = "0.12"
EXE_NAME = "Tran.IDE II.exe"
PORTABLE_ZIP_NAME = f"Tran.IDE_II_v{APP_VERSION}_Portable.zip"
SETUP_NAME = f"Tran.IDE_II_v{APP_VERSION}_Setup.exe"
ICON = ROOT / "ui" / "tran_ide_app.ico"
LAUNCHER_CS = ROOT / "installer" / "launcher.cs"
ISS = ROOT / "installer" / "TranIDE2.iss"
REQUIREMENTS = ROOT / "requirements.txt"

PYTHON_EMBED_URL = "https://www.python.org/ftp/python/3.13.7/python-3.13.7-embed-amd64.zip"
GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py"
NODE_WIN64_ZIP_URL = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip"
TCC_WIN64_ZIP_URL = "https://download.savannah.gnu.org/releases/tinycc/tcc-0.9.27-win64-bin.zip"
TEMURIN_JDK21_URL = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
KOTLIN_ZIP_URL = "https://github.com/JetBrains/kotlin/releases/download/v2.1.10/kotlin-compiler-2.1.10.zip"
WEBVIEW2_URL = "https://go.microsoft.com/fwlink/?linkid=2124701"
INNO_URL = "https://github.com/jrsoftware/issrc/releases/download/is-6_7_4/innosetup-6.7.4.exe"

DEFAULT_PIP_PACKAGES = [
    "pywebview==6.2.1",
    "pythonnet==3.2.1",
    "bottle==0.13.4",
    "proxy_tools==0.1.0",
    "clr_loader==0.3.1",
    "cffi==2.1.1",
    "typing_extensions==4.16.0",
    "pycparser==3.12",
]


def run(cmd: list[str], **kwargs) -> None:
    print(">", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kwargs)


def find_csc() -> Path:
    candidates = [
        Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
        Path(r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"),
    ]
    which_csc = shutil.which("csc.exe") or shutil.which("csc")
    if which_csc:
        candidates.insert(0, Path(which_csc))
    for cand in candidates:
        if cand.exists():
            return cand
    raise FileNotFoundError("C# compiler (csc.exe) not found (.NET Framework 4.x required).")


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"cached {dest.name}", flush=True)
        return dest
    tmp = dest.with_suffix(dest.suffix + ".part")
    print(f"download {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": f"Tran.IDE-II-builder/{APP_VERSION}"})
    with urllib.request.urlopen(req, timeout=240) as resp, tmp.open("wb") as out:
        shutil.copyfileobj(resp, out)
    tmp.replace(dest)
    print(f"saved {dest.name} ({dest.stat().st_size} bytes)", flush=True)
    return dest


def extract_zip_flattened(zip_path: Path, dest_dir: Path) -> None:
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    staging = dest_dir.parent / f"__stage_{dest_dir.name}"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(staging)
    entries = list(staging.iterdir())
    source_root = entries[0] if len(entries) == 1 and entries[0].is_dir() else staging
    for item in source_root.iterdir():
        shutil.move(str(item), str(dest_dir / item.name))
    shutil.rmtree(staging, ignore_errors=True)


def enable_site(payload: Path) -> None:
    pth_files = list(payload.glob("python*._pth"))
    if not pth_files:
        raise FileNotFoundError("embeddable python ._pth missing")
    pth = pth_files[0]
    lines: list[str] = []
    has_site = False
    has_lib = False
    for raw in pth.read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        if stripped.lstrip("#").strip() == "import site":
            lines.append("import site")
            has_site = True
            continue
        if stripped.lower().replace("/", "\\") == "lib\\site-packages":
            has_lib = True
        lines.append(raw)
    if not has_site:
        lines.append("import site")
    if not has_lib:
        lines.append("Lib\\site-packages")
    pth.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_requirements() -> list[str]:
    if not REQUIREMENTS.exists():
        return list(DEFAULT_PIP_PACKAGES)
    pkgs: list[str] = []
    for raw in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        pkgs.append(line)
    return pkgs or list(DEFAULT_PIP_PACKAGES)


def copy_app_files(payload: Path) -> None:
    for name in ("main.py", "dict_manager.py"):
        shutil.copy2(ROOT / name, payload / name)
    if (ROOT / "LICENSE").exists():
        shutil.copy2(ROOT / "LICENSE", payload / "LICENSE.txt")
    if (ROOT / "NOTICE").exists():
        shutil.copy2(ROOT / "NOTICE", payload / "NOTICE")

    ui_dest = payload / "ui"
    if ui_dest.exists():
        shutil.rmtree(ui_dest)
    shutil.copytree(ROOT / "ui", ui_dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    dicts_dest = payload / "dicts"
    dicts_dest.mkdir(parents=True, exist_ok=True)
    for json_path in sorted((ROOT / "dicts").glob("*.json")):
        if json_path.name == "user_learned.json":
            continue
        shutil.copy2(json_path, dicts_dest / json_path.name)

    (payload / "packaged.marker").write_text(f"Tran.IDE II {APP_VERSION}\n", encoding="utf-8")


def compile_launcher(out_exe: Path) -> Path:
    csc = find_csc()
    out_exe.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(csc),
        "/nologo",
        "/target:winexe",
        "/platform:x64",
        f"/out:{out_exe}",
        "/r:System.Windows.Forms.dll",
        "/r:System.dll",
    ]
    if ICON.exists():
        cmd.append(f"/win32icon:{ICON}")
    cmd.append(str(LAUNCHER_CS))
    run(cmd)
    return out_exe


def bundle_multi_lang_runtimes(payload: Path) -> None:
    runtimes_dir = payload / "runtimes"
    runtimes_dir.mkdir(parents=True, exist_ok=True)

    # 1. Node.js (JavaScript & TypeScript) - single node.exe binary
    node_dir = runtimes_dir / "node"
    if not (node_dir / "node.exe").exists():
        node_zip = download(NODE_WIN64_ZIP_URL, CACHE / "node-win-x64.zip")
        node_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(node_zip) as zf:
            for member in zf.namelist():
                if member.endswith("/node.exe") or member == "node.exe":
                    with zf.open(member) as src, (node_dir / "node.exe").open("wb") as dst:
                        shutil.copyfileobj(src, dst)
                    break

    # 2. TinyCC (Lightweight C compiler)
    tcc_dir = runtimes_dir / "tcc"
    if not (tcc_dir / "tcc.exe").exists():
        tcc_zip = download(TCC_WIN64_ZIP_URL, CACHE / "tcc-win64.zip")
        extract_zip_flattened(tcc_zip, tcc_dir)

    # 3. Eclipse Temurin OpenJDK 21 (Java & Kotlin host JVM)
    jdk_dir = runtimes_dir / "jdk"
    if not (jdk_dir / "bin" / "java.exe").exists():
        jdk_zip = download(TEMURIN_JDK21_URL, CACHE / "temurin-jdk21-win64.zip")
        extract_zip_flattened(jdk_zip, jdk_dir)

    # 4. Kotlin Compiler (kotlinc)
    kt_dir = runtimes_dir / "kotlin"
    if not (kt_dir / "bin" / "kotlinc.bat").exists():
        kt_zip = download(KOTLIN_ZIP_URL, CACHE / "kotlin-compiler.zip")
        extract_zip_flattened(kt_zip, kt_dir)


def build_payload(include_runtimes: bool = True) -> None:
    if PAYLOAD.exists():
        shutil.rmtree(PAYLOAD)
    PAYLOAD.mkdir(parents=True, exist_ok=True)

    embed_zip = download(PYTHON_EMBED_URL, CACHE / "python-3.13.7-embed-amd64.zip")
    with zipfile.ZipFile(embed_zip) as zf:
        zf.extractall(PAYLOAD)
    enable_site(PAYLOAD)

    get_pip = download(GET_PIP_URL, CACHE / "get-pip.py")
    python = PAYLOAD / "python.exe"
    run([str(python), str(get_pip), "--no-warn-script-location"], cwd=PAYLOAD)
    pip = [str(python), "-m", "pip", "install", "--no-cache-dir", "--no-warn-script-location"]
    run(pip + ["setuptools", "wheel"], cwd=PAYLOAD)
    run(pip + load_requirements(), cwd=PAYLOAD)

    copy_app_files(PAYLOAD)
    if include_runtimes:
        bundle_multi_lang_runtimes(PAYLOAD)
    compile_launcher(PAYLOAD / EXE_NAME)

    for junk in list(PAYLOAD.rglob("__pycache__")):
        shutil.rmtree(junk, ignore_errors=True)


def find_iscc() -> Path | None:
    candidates: Iterable[Path] = [
        CACHE / "InnoSetup" / "ISCC.exe",
        Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
    ]
    which_iscc = shutil.which("ISCC.exe") or shutil.which("iscc")
    if which_iscc:
        candidates = [Path(which_iscc), *candidates]
    for path in candidates:
        if path.exists():
            return path
    return None


def ensure_inno() -> Path:
    existing = find_iscc()
    if existing:
        return existing
    installer = download(INNO_URL, CACHE / "innosetup-setup.exe")
    dest = CACHE / "InnoSetup"
    dest.mkdir(parents=True, exist_ok=True)
    run(
        [
            str(installer),
            "/VERYSILENT",
            "/SUPPRESSMSGBOXES",
            "/NORESTART",
            f"/DIR={dest}",
        ]
    )
    iscc = dest / "ISCC.exe"
    if not iscc.exists():
        raise FileNotFoundError("Inno Setup compiler was not installed.")
    return iscc


def build_installer() -> Path:
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    webview2 = download(WEBVIEW2_URL, CACHE / "MicrosoftEdgeWebView2RuntimeInstallerX64.exe")
    iscc = ensure_inno()
    cmd = [
        str(iscc),
        f"/DOutputDir={DIST_DIR}",
        f"/DPayloadDir={PAYLOAD}",
        f"/DWebView2File={webview2}",
        f"/DIconFile={ICON}",
        str(ISS),
    ]
    run(cmd)
    setup = DIST_DIR / SETUP_NAME
    if not setup.exists():
        raise FileNotFoundError(f"Installer missing after build: {setup}")
    return setup


def _is_junk(path: Path) -> bool:
    return "__pycache__" in path.parts or path.suffix in {".pyc", ".pyo"}


def build_portable_zip() -> Path:
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = DIST_DIR / PORTABLE_ZIP_NAME
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in PAYLOAD.rglob("*"):
            if path.is_dir() or _is_junk(path):
                continue
            arcname = Path("Tran.IDE II") / path.relative_to(PAYLOAD)
            zf.write(path, arcname.as_posix())
    return zip_path


def smoke_import() -> None:
    python = PAYLOAD / "python.exe"
    run(
        [
            str(python),
            "-c",
            "import webview, bottle, clr_loader, pythonnet, dict_manager; print('smoke_import ok')",
        ],
        cwd=PAYLOAD,
        env={**os.environ, "PYTHONPATH": str(PAYLOAD)},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Tran.IDE II launcher, portable archive, and Setup.exe installer.")
    parser.add_argument("--lite", action="store_true", help="Build Python-only installer without extra language runtimes.")
    parser.add_argument("--launcher-only", action="store_true", help="Only compile Tran.IDE II.exe into repository root.")
    parser.add_argument("--skip-installer", action="store_true", help="Skip Inno Setup compilation (build payload & portable zip only).")
    args = parser.parse_args()

    if args.launcher_only:
        exe = compile_launcher(ROOT / EXE_NAME)
        print(f"launcher: {exe} ({exe.stat().st_size} bytes)")
        return

    CACHE.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    build_payload(include_runtimes=not args.lite)
    smoke_import()
    zip_path = build_portable_zip()
    print(f"portable: {zip_path} ({zip_path.stat().st_size} bytes)")
    if not args.skip_installer:
        setup = build_installer()
        print(f"setup: {setup} ({setup.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

# ============================================================================
#   🄯 (c)카피레프트 Copyleft — Tran.IDE | a Bakk jaejin production
#   Copyright (C) 2026 Bakk jaejin | SPDX-License-Identifier: AGPL-3.0-or-later
# ============================================================================
