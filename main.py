# ============================================================================
#   🄯 (c)카피레프트 Copyleft — Tran.IDE
#   a Bakk jaejin production
#   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
# ============================================================================

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import webview

from dict_manager import DictManager

IS_FROZEN = getattr(sys, "frozen", False)
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) if IS_FROZEN else Path(__file__).resolve().parent
IS_PACKAGED = not IS_FROZEN and (BASE_DIR / "packaged.marker").exists()
IS_RELEASE = IS_FROZEN or IS_PACKAGED
DICTS_DIR = BASE_DIR / "dicts"
UI_DIR = BASE_DIR / "ui"
RUNTIMES_DIR = BASE_DIR / "runtimes"
USER_DATA_DIR = (
    Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "Tran.IDE II"
    if IS_RELEASE
    else BASE_DIR / ".venv"
)

EXT_TO_LANG = {
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".swift": "swift",
    ".c": "c",
    ".h": "c",
    ".java": "java",
}

_RUNTIME_SPECS: Dict[str, Tuple[List[str], Tuple[str, ...]]] = {
    "javascript": (
        ["node", "node.exe"],
        (
            r"C:\Program Files\nodejs\node.exe",
            r"%LOCALAPPDATA%\Programs\nodejs\node.exe",
        ),
    ),
    "java": (
        ["java", "java.exe"],
        (
            r"C:\Program Files\Microsoft\jdk-*\bin\java.exe",
            r"C:\Program Files\Java\*\bin\java.exe",
            r"C:\Program Files\Eclipse Adoptium\jdk-*\bin\java.exe",
        ),
    ),
    "c": (
        ["gcc", "gcc.exe", "tcc", "tcc.exe", "clang", "clang.exe"],
        (
            r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.*\mingw64\bin\gcc.exe",
            r"%LOCALAPPDATA%\Microsoft\WinGet\Links\gcc.exe",
            r"C:\mingw64\bin\gcc.exe",
            r"C:\msys64\mingw64\bin\gcc.exe",
            r"C:\Program Files\LLVM\bin\clang.exe",
        ),
    ),
    "kotlin": (
        ["kotlinc.bat", "kotlinc.exe", "kotlinc"],
        (
            r"%LOCALAPPDATA%\Programs\Android Studio\plugins\Kotlin\kotlinc\bin\kotlinc.bat",
            r"C:\Program Files\Android\Android Studio\plugins\Kotlin\kotlinc\bin\kotlinc.bat",
            r"C:\Program Files\JetBrains\*\plugins\Kotlin\kotlinc\bin\kotlinc.bat",
            r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\*\*\bin\kotlinc.bat",
        ),
    ),
    "swift": (
        ["swift.exe", "swift"],
        (
            r"%LOCALAPPDATA%\Programs\Swift\Toolchains\*\usr\bin\swift.exe",
            r"C:\Program Files\Swift\Toolchains\*\usr\bin\swift.exe",
            r"C:\Library\Developer\Toolchains\*\usr\bin\swift.exe",
        ),
    ),
}


def _get_live_windows_env(name: str) -> str:
    """Read an environment variable from Windows Registry (HKCU then HKLM) to avoid stale Explorer PATH."""
    if sys.platform != "win32":
        return os.environ.get(name, "")
    try:
        import winreg
    except ImportError:
        return os.environ.get(name, "")

    values: List[str] = []
    for root, subkey in (
        (winreg.HKEY_CURRENT_USER, r"Environment"),
        (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
    ):
        try:
            with winreg.OpenKey(root, subkey) as key:
                val, _ = winreg.QueryValueEx(key, name)
                if val:
                    values.append(os.path.expandvars(str(val)))
        except OSError:
            continue
    if name.lower() == "path":
        return os.pathsep.join(v for v in values if v)
    return values[0] if values else os.environ.get(name, "")


def _get_live_windows_path_dirs() -> List[str]:
    raw_path = _get_live_windows_env("Path")
    seen = set()
    dirs: List[str] = []
    for part in raw_path.split(os.pathsep):
        cleaned = part.strip().strip('"')
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            dirs.append(cleaned)
    return dirs


def _find_executable(names: List[str], extra_paths: Tuple[str, ...] = ()) -> Optional[str]:
    """Locate an executable via process PATH, live Windows Registry PATH, and expanded glob extra_paths."""
    for name in names:
        found = shutil.which(name)
        if found:
            return found

    if sys.platform == "win32":
        live_dirs = _get_live_windows_path_dirs()
        for d in live_dirs:
            dir_path = Path(d)
            if not dir_path.exists():
                continue
            for name in names:
                cand = dir_path / name
                if cand.exists() and cand.is_file():
                    return str(cand)

    for raw_pattern in extra_paths:
        pattern = os.path.expandvars(raw_pattern)
        if any(ch in pattern for ch in "*?[]"):
            matches = sorted(glob.glob(pattern), reverse=True)
            for m in matches:
                p = Path(m)
                if p.exists() and p.is_file():
                    return str(p)
        else:
            p = Path(pattern)
            if p.exists() and p.is_file():
                return str(p)
    return None


def _find_bundled_runtime(lang: str) -> Optional[str]:
    """Locate a portable runtime bundled under BASE_DIR / 'runtimes'."""
    if not RUNTIMES_DIR.exists():
        return None
    l = (lang or "").lower().strip()
    if l in ("javascript", "typescript"):
        l = "node"

    patterns_by_lang: Dict[str, Tuple[str, ...]] = {
        "python": (
            "python/python.exe",
            "python/*/python.exe",
            "python/bin/python3",
            "python/bin/python",
        ),
        "node": (
            "node/node.exe",
            "node/*/node.exe",
            "node/bin/node",
            "node/*/bin/node",
        ),
        "c": (
            "tcc/tcc.exe",
            "tcc/*/tcc.exe",
            "c/bin/gcc.exe",
            "c/*/bin/gcc.exe",
            "mingw64/bin/gcc.exe",
            "tcc/tcc",
            "c/bin/gcc",
        ),
        "java": (
            "jdk/bin/java.exe",
            "jdk/*/bin/java.exe",
            "java/bin/java.exe",
            "jdk/bin/java",
            "jdk/*/bin/java",
        ),
        "kotlin": (
            "kotlin/bin/kotlinc.bat",
            "kotlin/*/bin/kotlinc.bat",
            "kotlin/kotlinc/bin/kotlinc.bat",
            "kotlin/bin/kotlinc",
            "kotlin/*/bin/kotlinc",
        ),
        "swift": (
            "swift/usr/bin/swift.exe",
            "swift/*/usr/bin/swift.exe",
            "swift/usr/bin/swift",
        ),
    }
    patterns = patterns_by_lang.get(l, ())
    for rel in patterns:
        if any(ch in rel for ch in "*?[]"):
            matches = sorted(RUNTIMES_DIR.glob(rel), reverse=True)
            for m in matches:
                if m.exists() and m.is_file():
                    return str(m)
        else:
            cand = RUNTIMES_DIR / rel
            if cand.exists() and cand.is_file():
                return str(cand)
    return None


def _resolve_tool(lang: str) -> Optional[str]:
    """Unified runtime/compiler resolver for all 7 supported languages."""
    l = (lang or "").lower().strip()
    bundled = _find_bundled_runtime(l)
    if bundled:
        return bundled
    if l == "python":
        return _python_for_run()
    if l == "typescript":
        node_bin = _resolve_tool("javascript")
        return node_bin
    spec = _RUNTIME_SPECS.get(l)
    if not spec:
        return None
    names, extra = spec
    return _find_executable(names, extra)


def _sync_swift_msvc_modulemaps(sdkroot: str, msvc_inc: Path, ucrt_inc: Path, um_inc: Path, shared_inc: Path) -> None:
    """Install Swift Windows modulemaps into user-space MsvcSdk include folders when missing."""
    share_dir = Path(sdkroot) / "usr" / "share"
    if not share_dir.exists():
        return
    try:
        pairs = [
            (share_dir / "winsdk_um.modulemap", um_inc / "module.modulemap"),
            (share_dir / "winsdk_shared.modulemap", shared_inc / "module.modulemap"),
            (share_dir / "vcruntime.modulemap", msvc_inc / "module.modulemap"),
            (share_dir / "vcruntime.apinotes", msvc_inc / "vcruntime.apinotes"),
        ]
        for src, dst in pairs:
            if src.exists() and not dst.exists() and dst.parent.exists():
                shutil.copy2(src, dst)

        ucrt_src = share_dir / "ucrt.modulemap"
        ucrt_dst = ucrt_inc / "module.modulemap"
        if ucrt_src.exists() and not ucrt_dst.exists() and ucrt_dst.parent.exists():
            txt = ucrt_src.read_text(encoding="utf-8")
            for hdr_name, block_re in (
                ("stdalign.h", r"\n\s*module\s+stdalign\s*\{[^}]*\}\r?\n?"),
                ("stdnoreturn.h", r"\n\s*module\s+stdnoreturn\s*\{[^}]*\}\r?\n?"),
                ("corecrt_math.h", r"\n\s*module\s+math\s*\{[^}]*corecrt_math\.h[^}]*\}\r?\n?"),
            ):
                if not (ucrt_inc / hdr_name).exists():
                    txt = re.sub(block_re, "\n", txt, flags=re.MULTILINE)
            ucrt_dst.write_text(txt, encoding="utf-8")
    except OSError:
        pass


def _get_swift_windows_msvc_env() -> Dict[str, str]:
    """Locate Swift Windows SDKROOT plus MSVC and Windows SDK INCLUDE/LIB directories."""
    env_out: Dict[str, str] = {}
    sdkroot = os.environ.get("SDKROOT") or _get_live_windows_env("SDKROOT")
    if not sdkroot or not Path(sdkroot).exists():
        sdk_globs = sorted(
            glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Swift\Platforms\*\Windows.platform\Developer\SDKs\Windows.sdk"))
            + glob.glob(r"C:\Program Files\Swift\Platforms\*\Windows.platform\Developer\SDKs\Windows.sdk")
            + glob.glob(r"C:\Library\Developer\Platforms\Windows.platform\Developer\SDKs\Windows.sdk"),
            reverse=True,
        )
        if sdk_globs:
            sdkroot = sdk_globs[0]
    if sdkroot:
        env_out["SDKROOT"] = sdkroot

    msvc_inc: Optional[Path] = None
    msvc_lib: Optional[Path] = None
    msvc_candidates = sorted(
        glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Swift\MsvcSdk\VC\Tools\MSVC\*"))
        + glob.glob(r"C:\Program Files (x86)\Microsoft Visual Studio\*\*\VC\Tools\MSVC\*")
        + glob.glob(r"C:\Program Files\Microsoft Visual Studio\*\*\VC\Tools\MSVC\*"),
        reverse=True,
    )
    for mdir in msvc_candidates:
        mp = Path(mdir)
        if (mp / "include" / "vcruntime.h").exists() and (mp / "lib" / "x64").exists():
            msvc_inc = mp / "include"
            msvc_lib = mp / "lib" / "x64"
            break

    ucrt_inc: Optional[Path] = None
    um_inc: Optional[Path] = None
    shared_inc: Optional[Path] = None
    ucrt_lib: Optional[Path] = None
    um_lib: Optional[Path] = None
    kits_candidates = [
        Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Swift\MsvcSdk\Windows Kits\10")),
        Path(r"C:\Program Files (x86)\Windows Kits\10"),
    ]
    for kroot in kits_candidates:
        if not kroot.exists():
            continue
        inc_base = kroot / "Include" if (kroot / "Include").exists() else kroot / "include"
        lib_base = kroot / "Lib" if (kroot / "Lib").exists() else kroot / "lib"
        if not inc_base.exists() or not lib_base.exists():
            continue
        for ver_dir in sorted([p for p in inc_base.iterdir() if p.is_dir()], reverse=True):
            if (ver_dir / "ucrt" / "stdlib.h").exists() and (ver_dir / "um" / "Windows.h").exists():
                ucrt_inc = ver_dir / "ucrt"
                um_inc = ver_dir / "um"
                shared_inc = ver_dir / "shared"
                lver = lib_base / ver_dir.name
                if (lver / "ucrt" / "x64").exists() and (lver / "um" / "x64").exists():
                    ucrt_lib = lver / "ucrt" / "x64"
                    um_lib = lver / "um" / "x64"
                break
        if ucrt_inc and ucrt_lib:
            break

    if sdkroot and msvc_inc and ucrt_inc and um_inc and shared_inc:
        local_msvc = Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Swift\MsvcSdk"))
        if str(ucrt_inc).lower().startswith(str(local_msvc).lower()):
            _sync_swift_msvc_modulemaps(sdkroot, msvc_inc, ucrt_inc, um_inc, shared_inc)

    inc_dirs = [str(p) for p in (msvc_inc, ucrt_inc, um_inc, shared_inc) if p and p.exists()]
    if inc_dirs:
        existing_inc = os.environ.get("INCLUDE", "")
        env_out["INCLUDE"] = os.pathsep.join(inc_dirs + ([existing_inc] if existing_inc else []))

    lib_dirs = [str(p) for p in (msvc_lib, ucrt_lib, um_lib) if p and p.exists()]
    if lib_dirs:
        existing_lib = os.environ.get("LIB", "")
        env_out["LIB"] = os.pathsep.join(lib_dirs + ([existing_lib] if existing_lib else []))

    return env_out


def _wrap_java_with_map(code: str) -> Tuple[str, str, Dict[int, int]]:
    """Wrap top-level Java statements in Main and return (source, filename, wrapped_to_orig_line_map)."""
    src = str(code or "")
    class_m = re.search(r"\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", src)
    has_main = bool(re.search(r"\bstatic\s+void\s+main\s*\(", src))
    if has_main:
        cls_name = class_m.group(1) if class_m else "Main"
        return src, f"{cls_name}.java", {}

    imports: List[Tuple[int, str]] = []
    body_lines: List[Tuple[int, str]] = []
    for idx, line in enumerate(src.splitlines(), start=1):
        if re.match(r"^\s*import\s+[^;]+;\s*$", line):
            imports.append((idx, line))
        else:
            body_lines.append((idx, line))

    out_lines: List[str] = []
    line_map: Dict[int, int] = {}
    for orig_ln, imp in imports:
        out_lines.append(imp)
        line_map[len(out_lines)] = orig_ln
    if imports:
        out_lines.append("")
    out_lines.append("public class Main {")
    out_lines.append("    public static void main(String[] args) throws Exception {")
    if body_lines:
        for orig_ln, ln in body_lines:
            out_lines.append(f"        {ln}" if ln.strip() else "")
            line_map[len(out_lines)] = orig_ln
    else:
        out_lines.append("        // empty")
    out_lines.append("    }")
    out_lines.append("}")
    return "\n".join(out_lines) + "\n", "Main.java", line_map


def _wrap_java_if_needed(code: str) -> Tuple[str, str]:
    """Wrap top-level Java statements in a Main class when no main entrypoint exists."""
    wrapped, fname, _ = _wrap_java_with_map(code)
    return wrapped, fname


def _wrap_c_with_map(code: str) -> Tuple[str, Dict[int, int]]:
    """Wrap top-level C statements into main() and return (source, wrapped_to_orig_line_map)."""
    src = str(code or "")
    if re.search(r"\bmain\s*\(", src):
        return src, {}

    directives: List[Tuple[int, str]] = []
    body_lines: List[Tuple[int, str]] = []
    for idx, line in enumerate(src.splitlines(), start=1):
        if re.match(r"^\s*#\s*(?:include|define|pragma)\b", line):
            directives.append((idx, line))
        else:
            body_lines.append((idx, line))

    has_stdio = any("stdio.h" in d for _, d in directives)
    has_string = any("string.h" in d for _, d in directives)
    out_lines: List[str] = []
    line_map: Dict[int, int] = {}
    if not has_stdio:
        out_lines.append("#include <stdio.h>")
    if not has_string:
        out_lines.append("#include <string.h>")
    for orig_ln, d in directives:
        out_lines.append(d)
        line_map[len(out_lines)] = orig_ln
    out_lines.append("")
    out_lines.append("int main(void) {")
    for orig_ln, ln in body_lines:
        out_lines.append(f"    {ln}" if ln.strip() else "")
        line_map[len(out_lines)] = orig_ln
    out_lines.append("    return 0;")
    out_lines.append("}")
    return "\n".join(out_lines) + "\n", line_map


def _wrap_c_if_needed(code: str) -> str:
    """Wrap top-level C statements into main() with standard headers when absent."""
    wrapped, _ = _wrap_c_with_map(code)
    return wrapped


def _map_wrapped_line(wrapped_line: int, line_map: Optional[Dict[int, int]]) -> int:
    if not line_map:
        return max(1, wrapped_line)
    if wrapped_line in line_map:
        return line_map[wrapped_line]
    preceding = [k for k in line_map.keys() if k <= wrapped_line]
    if preceding:
        return line_map[max(preceding)]
    return min(line_map.values()) if line_map else max(1, wrapped_line)


def _summarize_error_ko_en(raw_msg: str) -> Tuple[str, str]:
    msg = str(raw_msg or "").strip()
    low = msg.lower()
    if any(k in low for k in ("indentationerror", "taberror", "unexpected indent", "unindent does not match")):
        return (
            "들여쓰기 오류 (공백 간격을 맞추세요)",
            "Indentation error (align spaces consistently)",
        )
    if any(k in low for k in ("syntaxerror", "invalid syntax", "unexpected token", "unexpected identifier", "expected ';'", "';' expected", "expected expression", "unterminated string", "was never closed")):
        return (
            "문법 오류 (괄호·따옴표·구두점을 확인하세요)",
            "Syntax error (check brackets, quotes, or punctuation)",
        )
    if any(k in low for k in ("nameerror", "referenceerror", "is not defined", "cannot find name", "undeclared", "cannot find symbol", "unresolved reference", "cannot find '")):
        return (
            "정의되지 않은 이름/변수/함수입니다",
            "Undefined variable, name, or symbol",
        )
    if any(k in low for k in ("typeerror", "incompatible types", "type mismatch", "is not assignable", "cannot convert value of type")):
        return (
            "자료형(타입)이 맞지 않습니다",
            "Type mismatch error",
        )
    if any(k in low for k in ("zerodivisionerror", "division by zero", "divide by zero", "arithmeticexception: / by zero")):
        return (
            "0으로 나눌 수 없습니다",
            "Division by zero",
        )
    if any(k in low for k in ("indexerror", "indexoutofboundsexception", "arrayindexoutofboundsexception", "index out of range")):
        return (
            "목록/배열 범위를 벗어난 인덱스입니다",
            "Index out of range",
        )
    if "keyerror" in low:
        return (
            "사전에 존재하지 않는 키입니다",
            "Key not found in dictionary",
        )
    if any(k in low for k in ("valueerror", "numberformatexception")):
        return (
            "올바르지 않은 값 변환/형식입니다",
            "Invalid value or format",
        )
    if any(k in low for k in ("attributeerror", "has no attribute", "is not a function")):
        return (
            "해당 객체에 없는 속성/메서드입니다",
            "Missing attribute or method",
        )
    if any(k in low for k in ("modulenotfounderror", "importerror", "cannot find module", "no such file or directory", "filenotfounderror")):
        return (
            "모듈 또는 파일을 찾을 수 없습니다",
            "Module or file not found",
        )
    short = msg.splitlines()[0].strip() if msg else "실행 오류"
    if len(short) > 110:
        short = short[:107] + "..."
    return short, short


def _extract_last_error_line(stderr_text: str, default_msg: str = "Execution error") -> str:
    lines = [ln.strip() for ln in str(stderr_text or "").splitlines() if ln.strip()]
    for ln in reversed(lines):
        if re.match(r"^(?:[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception|Warning)|error):", ln) or "Exception in thread" in ln:
            return ln
    return lines[-1] if lines else default_msg


def _parse_error_diagnostics(
    lang: str,
    stderr_text: str,
    line_map: Optional[Dict[int, int]] = None,
) -> List[Dict[str, Any]]:
    """Extract normalized 1-based line diagnostics and KO/EN summaries from compiler/runtime stderr."""
    text = str(stderr_text or "").strip()
    if not text:
        return []
    l = (lang or "python").lower().strip()
    diags: List[Dict[str, Any]] = []
    seen = set()

    def add_diag(raw_line: int, col: Optional[int], message: str) -> None:
        mapped_line = _map_wrapped_line(raw_line, line_map)
        msg_clean = str(message or "").strip() or "Execution error"
        key = (mapped_line, msg_clean)
        if key in seen or len(diags) >= 10:
            return
        seen.add(key)
        ko, en = _summarize_error_ko_en(msg_clean)
        diags.append(
            {
                "line": mapped_line,
                "column": col,
                "message": msg_clean,
                "summary_ko": ko,
                "summary_en": en,
            }
        )

    if l == "python":
        err_msg = _extract_last_error_line(text, "Python runtime error")
        matches = list(re.finditer(r'File\s+"([^"]+)",\s+line\s+(\d+)', text))
        user_matches = [m for m in matches if m.group(1) in ("<string>", "<tran_ide>") or m.group(1).endswith(".py")]
        target_list = user_matches if user_matches else matches
        if target_list:
            last_m = target_list[-1]
            add_diag(int(last_m.group(2)), None, err_msg)
        return diags

    if l == "javascript":
        err_msg = ""
        for ln in text.splitlines():
            st = ln.strip()
            if re.match(r"^(?:SyntaxError|ReferenceError|TypeError|RangeError|Error):", st):
                err_msg = st
                break
        if not err_msg:
            err_msg = _extract_last_error_line(text, "JavaScript error")
        for m in re.finditer(r"main\.js:(\d+)(?::(\d+))?", text):
            col = int(m.group(2)) if m.group(2) else None
            add_diag(int(m.group(1)), col, err_msg)
            break
        return diags

    if l == "typescript":
        for m in re.finditer(r"^(\d+):(\d+)\s+(.+)$", text, re.MULTILINE):
            add_diag(int(m.group(1)), int(m.group(2)), m.group(3))
        if not diags:
            err_msg = _extract_last_error_line(text, "TypeScript runtime error")
            for m in re.finditer(r"main\.cjs:(\d+)(?::(\d+))?", text):
                col = int(m.group(2)) if m.group(2) else None
                add_diag(int(m.group(1)), col, err_msg)
                break
        return diags

    if l == "c":
        for m in re.finditer(r"(?:^|[\s/\\])main\.c:(\d+)(?::(\d+))?:\s*(?:fatal\s+)?error:\s*(.+)", text, re.MULTILINE):
            col = int(m.group(2)) if m.group(2) else None
            add_diag(int(m.group(1)), col, m.group(3))
        if not diags:
            for m in re.finditer(r"(?:^|[\s/\\])main\.c:(\d+)(?::(\d+))?:\s*warning:\s*(.+)", text, re.MULTILINE):
                col = int(m.group(2)) if m.group(2) else None
                add_diag(int(m.group(1)), col, m.group(3))
        return diags

    if l == "java":
        for m in re.finditer(r"(?:^|[\s/\\])[A-Za-z0-9_]+\.java:(\d+):\s*error:\s*(.+)", text, re.MULTILINE):
            add_diag(int(m.group(1)), None, m.group(2))
        if not diags:
            first_line = next((ln.strip() for ln in text.splitlines() if ln.strip()), "Java runtime error")
            for m in re.finditer(r"\(([A-Za-z0-9_]+\.java):(\d+)\)", text):
                add_diag(int(m.group(2)), None, first_line)
                break
        return diags

    if l == "kotlin":
        for m in re.finditer(r"(?:^|[\s/\\])main\.kts?:(\d+):(\d+):\s*error:\s*(.+)", text, re.MULTILINE):
            add_diag(int(m.group(1)), int(m.group(2)), m.group(3))
        if not diags:
            first_line = next((ln.strip() for ln in text.splitlines() if ln.strip()), "Kotlin runtime error")
            for m in re.finditer(r"\(main\.kts?:(\d+)\)", text):
                add_diag(int(m.group(1)), None, first_line)
                break
        return diags

    if l == "swift":
        for m in re.finditer(r"(?:^|[\s/\\])main\.swift:(\d+):(\d+):\s*error:\s*(.+)", text, re.MULTILINE):
            add_diag(int(m.group(1)), int(m.group(2)), m.group(3))
        return diags

    return diags


def _run_subprocess(
    cmd: List[str],
    cwd: Optional[str] = None,
    timeout: int = 10,
    extra_env: Optional[Dict[str, str]] = None,
    prepend_paths: Tuple[str, ...] = (),
) -> subprocess.CompletedProcess:
    run_env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    if extra_env:
        for k, v in extra_env.items():
            if v is not None:
                run_env[k] = str(v)
    path_parts = [p for p in prepend_paths if p]
    if sys.platform == "win32":
        path_parts.extend(_get_live_windows_path_dirs())
    if run_env.get("PATH"):
        path_parts.append(run_env["PATH"])
    if path_parts:
        run_env["PATH"] = os.pathsep.join(path_parts)
    creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000) if sys.platform == "win32" else 0
    return subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=run_env,
        creationflags=creation_flags,
        timeout=timeout,
    )


def _run_typescript_with_node(node_bin: str, code: str, timeout: int = 10) -> Dict[str, Any]:
    """Transpile and run TypeScript using Node.js and Monaco's bundled offline TS 5.0.2 compiler."""
    ts_worker = UI_DIR / "vendor" / "monaco-editor" / "min" / "vs" / "language" / "typescript" / "tsWorker.js"
    with tempfile.TemporaryDirectory(prefix="tran_ts_") as tmpdir:
        tmp_path = Path(tmpdir)
        ts_file = tmp_path / "main.ts"
        ts_file.write_text(str(code or ""), encoding="utf-8")

        if ts_worker.exists():
            runner_file = tmp_path / "tran_ts_runner.cjs"
            out_cjs = tmp_path / "main.cjs"
            runner_js = """const fs = require("fs");
const vm = require("vm");
const [,, workerPath, tsPath, outCjsPath] = process.argv;
const workerSrc = fs.readFileSync(workerPath, "utf8");
const sb = {
  self: {},
  console,
  setTimeout,
  clearTimeout,
  performance,
  define(a, b, c) {
    const fn = typeof a === "function" ? a : (typeof b === "function" ? b : c);
    if (typeof fn === "function") fn();
  }
};
sb.define.amd = true;
sb.self = sb;
vm.runInNewContext(workerSrc, sb);
const ts = sb.ts;
if (!ts || typeof ts.transpileModule !== "function") {
  console.error("Bundled TypeScript compiler unavailable.");
  process.exit(2);
}
const tsSrc = fs.readFileSync(tsPath, "utf8");
const res = ts.transpileModule(tsSrc, {
  fileName: "main.ts",
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true
  }
});
const diags = (res.diagnostics || []).filter((d) => d.category === 1);
if (diags.length > 0) {
  for (const d of diags) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\\n");
    let loc = "";
    if (d.file && typeof d.start === "number") {
      const lc = d.file.getLineAndCharacterOfPosition(d.start);
      loc = `${lc.line + 1}:${lc.character + 1} `;
    }
    console.error(`${loc}${msg}`);
  }
  process.exit(1);
}
fs.writeFileSync(outCjsPath, res.outputText, "utf8");
require(outCjsPath);
"""
            runner_file.write_text(runner_js, encoding="utf-8")
            proc = _run_subprocess(
                [node_bin, str(runner_file), str(ts_worker), str(ts_file), str(out_cjs)],
                cwd=tmpdir,
                timeout=timeout,
            )
            runtime_label = "node+tsWorker"
        else:
            proc = _run_subprocess([node_bin, str(ts_file)], cwd=tmpdir, timeout=timeout)
            runtime_label = "node-strip-types"

        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "language": "typescript",
            "runtime": runtime_label,
            "diagnostics": _parse_error_diagnostics("typescript", proc.stderr) if proc.returncode != 0 else [],
        }


class TranApi:
    """Bridge API exposed to the pywebview frontend."""

    def __init__(self) -> None:
        self.dict_manager = DictManager(DICTS_DIR, user_data_dir=USER_DATA_DIR if IS_RELEASE else DICTS_DIR)
        self.current_file: Optional[Path] = None
        self._window: Optional[webview.Window] = None
        self._is_maximized: bool = False
        self._prev_bounds: Optional[tuple] = None

    def set_window(self, window: webview.Window) -> None:
        self._window = window

    def minimize_window(self) -> Dict[str, Any]:
        if self._window:
            self._window.minimize()
            return {"ok": True}
        return {"ok": False, "error": "Window not initialized"}

    def toggle_maximize_window(self) -> Dict[str, Any]:
        if not self._window:
            return {"ok": False, "error": "Window not initialized"}

        form = getattr(self._window, "native", None)
        if form:
            from webview.platforms.winforms import WinForms
            import System

            if self._is_maximized:
                def _restore():
                    form.WindowState = WinForms.FormWindowState.Normal

                form.Invoke(System.Action(_restore))
                self._is_maximized = False
                return {"ok": True, "maximized": False}
            else:
                def _maximize():
                    wa = WinForms.Screen.FromControl(form).WorkingArea
                    form.MaximizedBounds = wa
                    form.WindowState = WinForms.FormWindowState.Maximized

                form.Invoke(System.Action(_maximize))
                self._is_maximized = True
                return {"ok": True, "maximized": True}
        else:
            if self._is_maximized:
                self._window.restore()
                self._is_maximized = False
                return {"ok": True, "maximized": False}
            else:
                self._window.maximize()
                self._is_maximized = True
                return {"ok": True, "maximized": True}

    def close_window(self) -> Dict[str, Any]:
        if self._window:
            self._window.destroy()
            return {"ok": True}
        return {"ok": False, "error": "Window not initialized"}

    def start_window_drag(self) -> Dict[str, Any]:
        if not self._window or self._is_maximized or sys.platform != "win32":
            return {"ok": False}

        form = getattr(self._window, "native", None)
        if not form:
            return {"ok": False}

        from webview.platforms.winforms import WinForms
        import System
        import ctypes

        def _drag():
            if form.WindowState == WinForms.FormWindowState.Maximized:
                return
            hwnd = int(form.Handle.ToInt64())
            user32 = ctypes.windll.user32
            user32.ReleaseCapture()
            user32.SendMessageW(hwnd, 0x00A1, 2, 0)

        form.Invoke(System.Action(_drag))
        return {"ok": True}

    def get_dictionary(self, language: str, target_locale: str = "ko") -> Dict[str, Any]:
        return self.dict_manager.load_language_pack(language, target_locale)

    def get_all_raw_cartridges(self) -> Dict[str, Any]:
        return self.dict_manager.get_all_raw_cartridges()

    def get_available_locales(self) -> Any:
        return self.dict_manager.get_available_locales()

    def get_user_learned_mappings(self) -> Dict[str, Any]:
        return self.dict_manager.get_user_learned_mappings()

    def save_user_learned_mappings(self, mappings: Dict[str, Any]) -> Dict[str, Any]:
        return self.dict_manager.save_user_learned_mappings(mappings)

    def get_vocab_lexicon_raw(self, lang_code: str = "ko") -> str:
        return self.dict_manager.get_vocab_lexicon_raw(lang_code)

    def get_vocab_lexicon(self, lang_code: str = "ko") -> Dict[str, Any]:
        return self.dict_manager.get_vocab_lexicon(lang_code)

    def read_file_by_path(self, path_str: str) -> Dict[str, Any]:
        try:
            file_path = Path(path_str)
            if not file_path.exists() or not file_path.is_file():
                return {"ok": False, "error": "File not found"}
            content = file_path.read_text(encoding="utf-8")
            detected_lang = EXT_TO_LANG.get(file_path.suffix.lower(), "python")
            return {
                "ok": True,
                "path": str(file_path),
                "name": file_path.name,
                "language": detected_lang,
                "content": content,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def open_file_dialog(self) -> Dict[str, Any]:
        if not self._window:
            return {"ok": False, "error": "Window not initialized"}

        file_types = (
            "Supported Code Files (*.py;*.js;*.mjs;*.cjs;*.jsx;*.ts;*.tsx;*.mts;*.cts;*.kt;*.kts;*.swift;*.c;*.h;*.java)",
            "All files (*.*)",
        )
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types
        )
        if not result:
            return {"ok": False, "cancelled": True}

        file_path = Path(result[0])
        try:
            content = file_path.read_text(encoding="utf-8")
            self.current_file = file_path
            detected_lang = EXT_TO_LANG.get(file_path.suffix.lower(), "python")
            return {
                "ok": True,
                "path": str(file_path),
                "name": file_path.name,
                "language": detected_lang,
                "content": content,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def save_file(
        self,
        content: str,
        filename: str = "untitled.py",
        save_as: bool = False,
        current_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self._window:
            return {"ok": False, "error": "Window not initialized"}

        clean_name = (filename or "untitled.py").strip() or "untitled.py"
        target_path = Path(current_path) if current_path else self.current_file
        name_changed = target_path is not None and target_path.name != clean_name

        if save_as or target_path is None or name_changed:
            dialog_kwargs: Dict[str, Any] = {
                "save_filename": clean_name,
                "file_types": ("All files (*.*)",),
            }
            if target_path is not None:
                dialog_kwargs["directory"] = str(target_path.parent)

            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                **dialog_kwargs,
            )
            if not result:
                return {"ok": False, "cancelled": True}
            target_path = Path(result if isinstance(result, str) else result[0])

        try:
            target_path.write_text(content, encoding="utf-8")
            self.current_file = target_path
            detected_lang = EXT_TO_LANG.get(target_path.suffix.lower(), "python")
            return {
                "ok": True,
                "path": str(target_path),
                "name": target_path.name,
                "language": detected_lang,
                "saved_as_new": name_changed,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def get_runtime_status(self) -> Dict[str, bool]:
        """Reports availability of language execution runtimes on this machine."""
        node_bin = _resolve_tool("javascript")
        java_bin = _resolve_tool("java")
        c_bin = _resolve_tool("c")
        kotlin_bin = _resolve_tool("kotlin")
        swift_bin = _resolve_tool("swift")
        ts_worker_exists = (UI_DIR / "vendor" / "monaco-editor" / "min" / "vs" / "language" / "typescript" / "tsWorker.js").exists()
        return {
            "python": True,
            "javascript": bool(node_bin),
            "typescript": bool(node_bin and ts_worker_exists),
            "java": bool(java_bin),
            "c": bool(c_bin),
            "kotlin": bool(kotlin_bin and java_bin),
            "swift": bool(swift_bin),
        }

    def run_code(self, language: str, code: str) -> Dict[str, Any]:
        """Executes raw source code in an isolated subprocess for the specified language."""
        lang = (language or "python").lower().strip()
        try:
            if lang == "python":
                python = _resolve_tool("python") or _python_for_run()
                cmd = [python, "--tran-run-python", code] if IS_FROZEN else [python, "-c", code]
                proc = _run_subprocess(cmd, timeout=15)
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "language": lang,
                    "runtime": "python",
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr) if proc.returncode != 0 else [],
                }

            if lang == "javascript":
                node_bin = _resolve_tool("javascript")
                if not node_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "Node.js가 설치되어 있지 않습니다. Node.js를 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                with tempfile.TemporaryDirectory(prefix="tran_js_") as tmpdir:
                    js_file = Path(tmpdir) / "main.js"
                    js_file.write_text(str(code or ""), encoding="utf-8")
                    proc = _run_subprocess(
                        [node_bin, str(js_file)],
                        cwd=tmpdir,
                        timeout=15,
                        prepend_paths=(str(Path(node_bin).parent),),
                    )
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "language": lang,
                    "runtime": "node",
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr) if proc.returncode != 0 else [],
                }

            if lang == "typescript":
                node_bin = _resolve_tool("typescript")
                if not node_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "TypeScript 실행에는 Node.js가 필요합니다. Node.js를 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                return _run_typescript_with_node(node_bin, code, timeout=15)

            if lang == "java":
                java_bin = _resolve_tool("java")
                if not java_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "Java 런타임(JDK)이 설치되어 있지 않습니다. JDK를 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                wrapped_src, fname, java_line_map = _wrap_java_with_map(code)
                with tempfile.TemporaryDirectory(prefix="tran_java_") as tmpdir:
                    java_file = Path(tmpdir) / fname
                    java_file.write_text(wrapped_src, encoding="utf-8")
                    proc = _run_subprocess(
                        [java_bin, "-Dfile.encoding=UTF-8", str(java_file)],
                        cwd=tmpdir,
                        timeout=25,
                        prepend_paths=(str(Path(java_bin).parent),),
                    )
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "language": lang,
                    "runtime": "java",
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr, java_line_map) if proc.returncode != 0 else [],
                }

            if lang == "c":
                c_bin = _resolve_tool("c")
                if not c_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "C 컴파일러(gcc/clang/tcc)가 설치되어 있지 않습니다. MinGW-w64 또는 LLVM을 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                wrapped_c, c_line_map = _wrap_c_with_map(code)
                c_bin_dir = str(Path(c_bin).parent)
                with tempfile.TemporaryDirectory(prefix="tran_c_") as tmpdir:
                    c_file = Path(tmpdir) / "main.c"
                    exe_name = "main.exe" if sys.platform == "win32" else "main"
                    exe_file = Path(tmpdir) / exe_name
                    c_file.write_text(wrapped_c, encoding="utf-8")
                    compile_cmd = [c_bin, str(c_file), "-o", str(exe_file)]
                    if "gcc" in Path(c_bin).name.lower():
                        compile_cmd.append("-fexec-charset=UTF-8")
                    comp = _run_subprocess(compile_cmd, cwd=tmpdir, timeout=30, prepend_paths=(c_bin_dir,))
                    if comp.returncode != 0:
                        return {
                            "ok": False,
                            "returncode": comp.returncode,
                            "stdout": comp.stdout,
                            "stderr": comp.stderr,
                            "language": lang,
                            "runtime": Path(c_bin).stem,
                            "diagnostics": _parse_error_diagnostics(lang, comp.stderr, c_line_map),
                        }
                    proc = _run_subprocess([str(exe_file)], cwd=tmpdir, timeout=15, prepend_paths=(c_bin_dir,))
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "language": lang,
                    "runtime": Path(c_bin).stem,
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr, c_line_map) if proc.returncode != 0 else [],
                }

            if lang == "kotlin":
                kotlinc_bin = _resolve_tool("kotlin")
                if not kotlinc_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "Kotlin 컴파일러(kotlinc)가 설치되어 있지 않습니다. Kotlin 컴파일러를 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                java_bin = _resolve_tool("java")
                if not java_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "Kotlin 실행에 필요한 Java 런타임(java)을 찾을 수 없습니다.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                kt_env = {}
                if not os.environ.get("JAVA_HOME"):
                    kt_env["JAVA_HOME"] = str(Path(java_bin).parent.parent)
                kt_paths = (str(Path(kotlinc_bin).parent), str(Path(java_bin).parent))
                with tempfile.TemporaryDirectory(prefix="tran_kt_") as tmpdir:
                    if re.search(r"\bfun\s+main\s*\(", str(code or "")):
                        kt_file = Path(tmpdir) / "main.kt"
                        jar_file = Path(tmpdir) / "main.jar"
                        kt_file.write_text(str(code or ""), encoding="utf-8")
                        comp = _run_subprocess(
                            [kotlinc_bin, str(kt_file), "-include-runtime", "-d", str(jar_file)],
                            cwd=tmpdir,
                            timeout=45,
                            extra_env=kt_env,
                            prepend_paths=kt_paths,
                        )
                        if comp.returncode != 0:
                            return {
                                "ok": False,
                                "returncode": comp.returncode,
                                "stdout": comp.stdout,
                                "stderr": comp.stderr,
                                "language": lang,
                                "runtime": "kotlinc",
                                "diagnostics": _parse_error_diagnostics(lang, comp.stderr),
                            }
                        proc = _run_subprocess(
                            [java_bin, "-Dfile.encoding=UTF-8", "-jar", str(jar_file)],
                            cwd=tmpdir,
                            timeout=20,
                            extra_env=kt_env,
                            prepend_paths=kt_paths,
                        )
                    else:
                        kts_file = Path(tmpdir) / "main.kts"
                        kts_file.write_text(str(code or ""), encoding="utf-8")
                        proc = _run_subprocess(
                            [kotlinc_bin, "-script", str(kts_file)],
                            cwd=tmpdir,
                            timeout=45,
                            extra_env=kt_env,
                            prepend_paths=kt_paths,
                        )
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "language": lang,
                    "runtime": "kotlinc",
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr) if proc.returncode != 0 else [],
                }

            if lang == "swift":
                swift_bin = _resolve_tool("swift")
                if not swift_bin:
                    return {
                        "ok": False,
                        "returncode": -1,
                        "stdout": "",
                        "stderr": "Swift 툴체인(swift)이 설치되어 있지 않습니다. Swift for Windows를 설치한 뒤 다시 실행하세요.",
                        "language": lang,
                        "runtime": None,
                        "missing_runtime": True,
                        "diagnostics": [],
                    }
                swift_env = _get_swift_windows_msvc_env()
                swift_bin_dir = str(Path(swift_bin).parent)
                swift_runtime_glob = sorted(
                    glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Swift\Runtimes\*\usr\bin"))
                    + glob.glob(r"C:\Program Files\Swift\Runtimes\*\usr\bin"),
                    reverse=True,
                )
                swift_paths = (swift_bin_dir, *swift_runtime_glob)
                swiftc_cand = Path(swift_bin).with_name("swiftc.exe" if sys.platform == "win32" else "swiftc")
                with tempfile.TemporaryDirectory(prefix="tran_swift_") as tmpdir:
                    sw_file = Path(tmpdir) / "main.swift"
                    sw_file.write_text(str(code or ""), encoding="utf-8")
                    if swiftc_cand.exists():
                        exe_name = "main.exe" if sys.platform == "win32" else "main"
                        exe_file = Path(tmpdir) / exe_name
                        compile_cmd = [str(swiftc_cand)]
                        if sys.platform == "win32":
                            compile_cmd.append("-use-ld=lld")
                        compile_cmd.extend([str(sw_file), "-o", str(exe_file)])
                        comp = _run_subprocess(
                            compile_cmd,
                            cwd=tmpdir,
                            timeout=90,
                            extra_env=swift_env,
                            prepend_paths=swift_paths,
                        )
                        if comp.returncode != 0:
                            stderr_txt = comp.stderr or ""
                            if "stdlib.h" in stderr_txt and not swift_env.get("INCLUDE"):
                                stderr_txt = (
                                    stderr_txt.rstrip()
                                    + "\n[안내] Windows에서 Swift 실행에는 MSVC/Windows SDK(또는 %LOCALAPPDATA%\\Programs\\Swift\\MsvcSdk) 헤더가 필요합니다."
                                )
                            return {
                                "ok": False,
                                "returncode": comp.returncode,
                                "stdout": comp.stdout,
                                "stderr": stderr_txt,
                                "language": lang,
                                "runtime": "swiftc",
                                "diagnostics": _parse_error_diagnostics(lang, comp.stderr),
                            }
                        proc = _run_subprocess(
                            [str(exe_file)],
                            cwd=tmpdir,
                            timeout=20,
                            extra_env=swift_env,
                            prepend_paths=swift_paths,
                        )
                        return {
                            "ok": proc.returncode == 0,
                            "returncode": proc.returncode,
                            "stdout": proc.stdout,
                            "stderr": proc.stderr,
                            "language": lang,
                            "runtime": "swiftc",
                            "diagnostics": _parse_error_diagnostics(lang, proc.stderr) if proc.returncode != 0 else [],
                        }
                    proc = _run_subprocess(
                        [swift_bin, str(sw_file)],
                        cwd=tmpdir,
                        timeout=90,
                        extra_env=swift_env,
                        prepend_paths=swift_paths,
                    )
                stderr_txt = proc.stderr or ""
                if proc.returncode != 0 and "stdlib.h" in stderr_txt and not swift_env.get("INCLUDE"):
                    stderr_txt = (
                        stderr_txt.rstrip()
                        + "\n[안내] Windows에서 Swift 실행에는 MSVC/Windows SDK(또는 %LOCALAPPDATA%\\Programs\\Swift\\MsvcSdk) 헤더가 필요합니다."
                    )
                return {
                    "ok": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": stderr_txt,
                    "language": lang,
                    "runtime": "swift",
                    "diagnostics": _parse_error_diagnostics(lang, proc.stderr) if proc.returncode != 0 else [],
                }

            return {
                "ok": False,
                "returncode": -1,
                "stdout": "",
                "stderr": f"지원하지 않는 실행 언어입니다: {lang}",
                "language": lang,
                "runtime": None,
                "diagnostics": [],
            }
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "returncode": -1,
                "stdout": "",
                "stderr": "Execution timed out (limit exceeded).",
                "language": lang,
                "runtime": None,
                "diagnostics": [],
            }
        except Exception as exc:
            return {
                "ok": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(exc),
                "language": lang,
                "runtime": None,
                "diagnostics": [],
            }

    def run_python_code(self, code: str) -> Dict[str, Any]:
        """Executes raw Python source code in an isolated subprocess."""
        return self.run_code("python", code)

    def save_workspace_session(self, session_json: str) -> Dict[str, Any]:
        try:
            session_file = USER_DATA_DIR / "workspace_session.json"
            session_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_file = USER_DATA_DIR / "workspace_session.json.tmp"
            tmp_file.write_text(session_json, encoding="utf-8")
            os.replace(tmp_file, session_file)
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def load_workspace_session(self) -> Dict[str, Any]:
        try:
            session_file = USER_DATA_DIR / "workspace_session.json"
            if not session_file.exists():
                return {"ok": False}
            return {"ok": True, "data": session_file.read_text(encoding="utf-8")}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}


def setup_window_styles(window: webview.Window) -> None:
    if sys.platform != "win32":
        return

    import ctypes

    def _configure_styles() -> None:
        try:
            form = getattr(window, "native", None)
            if form:
                from webview.platforms.winforms import WinForms
                import System

                def _apply():
                    hwnd = int(form.Handle.ToInt64())
                    user32 = ctypes.windll.user32
                    GWL_STYLE = -16
                    WS_MINIMIZEBOX = 0x00020000
                    WS_SYSMENU = 0x00080000
                    old_style = user32.GetWindowLongW(hwnd, GWL_STYLE)
                    user32.SetWindowLongW(hwnd, GWL_STYLE, old_style | WS_MINIMIZEBOX | WS_SYSMENU)

                form.Invoke(System.Action(_apply))
        except Exception:
            pass

    window.events.shown += _configure_styles


def _cleanup_stale_tran_ide2_processes() -> None:
    """Terminates any older Tran.IDE2 main.py process so WebView2 never locks with 0x800700AA."""
    if sys.platform != "win32":
        return
    try:
        import json as _json

        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        q = "Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CommandLine | ConvertTo-Json -Compress"
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", q],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=5,
            creationflags=creation_flags,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return
        rows = _json.loads(proc.stdout)
        if isinstance(rows, dict):
            rows = [rows]
        my_pid = os.getpid()
        parent_map = {
            int(r["ProcessId"]): int(r.get("ParentProcessId") or 0)
            for r in rows
            if r.get("ProcessId")
        }
        protected_pids = {my_pid, os.getppid()}
        cur = my_pid
        for _ in range(16):
            parent = parent_map.get(cur, 0)
            if not parent or parent in protected_pids:
                break
            protected_pids.add(parent)
            cur = parent
        for row in rows:
            pid = int(row.get("ProcessId") or 0)
            cmd = str(row.get("CommandLine") or "")
            if pid and pid not in protected_pids and "Tran.IDE2" in cmd and "main.py" in cmd:
                subprocess.run(
                    ["taskkill", "/F", "/PID", str(pid)],
                    capture_output=True,
                    timeout=5,
                    creationflags=creation_flags,
                )
    except Exception:
        pass


def _python_for_run() -> str:
    exe = Path(sys.executable).resolve()
    sibling = exe.with_name("python.exe")
    if sibling.exists():
        return str(sibling)
    return str(exe)


def main() -> None:
    if sys.platform == "win32":
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("ViveCoding.Tran.IDEII")
        if not IS_RELEASE:
            _cleanup_stale_tran_ide2_processes()

    api = TranApi()
    index_path = UI_DIR / "index.html"
    icon_path = UI_DIR / "tran_ide_app.ico"
    if not icon_path.exists():
        icon_path = UI_DIR / "tran_icon.ico"
    webview_storage = USER_DATA_DIR / "webview_data"
    webview_storage.mkdir(parents=True, exist_ok=True)
    window = webview.create_window(
        title="Tran.IDE II",
        url=index_path.as_uri(),
        js_api=api,
        width=1280,
        height=820,
        min_size=(900, 600),
        background_color="#1e1e1e",
        frameless=True,
        easy_drag=False,
    )
    api.set_window(window)
    setup_window_styles(window)
    webview.start(
        debug=False,
        http_server=True,
        private_mode=False,
        storage_path=str(webview_storage),
        icon=str(icon_path) if icon_path.exists() else None,
    )


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--tran-run-python":
        exec(compile(sys.argv[2], "<tran_ide>", "exec"), {"__name__": "__main__"})
        sys.exit(0)
    main()

# ============================================================================
#   🄯 (c)카피레프트 Copyleft — Tran.IDE
#   a Bakk jaejin production
#   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
# ============================================================================
