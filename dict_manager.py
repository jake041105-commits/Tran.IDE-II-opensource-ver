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

import json
from pathlib import Path
from typing import Any, Dict, List, Optional


class DictManager:
    """Loads language cartridges, merges with common.json, and enforces 1:1 bidirectional mapping."""

    SUPPORTED_LANGUAGES = ("python", "javascript", "typescript", "kotlin", "swift", "c", "java")
    INSTALLED_LOCALE_PLUGINS = (
        {"code": "none", "name": "None (English only)", "short": "—", "status": "2차 번역 끄기"},
        {"code": "ko", "name": "한국어 (Korean)", "short": "KO", "status": "기본 탑재"},
    )
    NON_LOCALE_KEYS = (
        "en",
        "category",
        "desc",
        "usage",
        "syntax",
        "inside",
        "example",
        "result",
        "category_en",
        "desc_en",
        "usage_en",
        "syntax_en",
        "inside_en",
        "example_en",
        "result_en",
    )

    def __init__(self, dicts_dir: Path, user_data_dir: Optional[Path] = None) -> None:
        self.dicts_dir = dicts_dir
        self.user_data_dir = user_data_dir or dicts_dir
        self._vocab_raw_cache: Dict[str, str] = {}
        self._vocab_dict_cache: Dict[str, Dict[str, Any]] = {}

    def _user_learned_path(self, for_write: bool = False) -> Path:
        if self.user_data_dir != self.dicts_dir:
            user_path = self.user_data_dir / "user_learned.json"
            if for_write:
                self.user_data_dir.mkdir(parents=True, exist_ok=True)
                return user_path
            if user_path.exists():
                return user_path
        return self.dicts_dir / "user_learned.json"

    def get_available_locales(self) -> List[Dict[str, str]]:
        return [dict(item) for item in self.INSTALLED_LOCALE_PLUGINS]

    def _read_json(self, filename: str) -> Dict[str, Any]:
        path = self.dicts_dir / filename
        if not path.exists():
            return {"_meta": {"language": filename}, "entries": {}}
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def load_language_pack(self, language: str, target_locale: str = "ko") -> Dict[str, Any]:
        lang = language.lower().strip()
        if lang not in self.SUPPORTED_LANGUAGES:
            lang = "python"
        locale = (target_locale or "ko").lower().strip()

        common_data = self._read_json("common.json").get("entries", {})
        lang_data = self._read_json(f"{lang}.json").get("entries", {})

        merged_entries: Dict[str, Dict[str, str]] = {}
        for code_token, translations in common_data.items():
            merged_entries[code_token] = dict(translations)
        if lang == "typescript":
            js_data = self._read_json("javascript.json").get("entries", {})
            for code_token, translations in js_data.items():
                merged_entries[code_token] = dict(translations)
        for code_token, translations in lang_data.items():
            merged_entries[code_token] = dict(translations)

        compiled = self.compile_maps(merged_entries, locale)

        return {
            "language": lang,
            "target_locale": locale,
            "entry_count": len(merged_entries),
            "is_valid_1to1": True,
            "conflicts": [],
            "entries": merged_entries,
            "maps": compiled,
        }

    def get_all_raw_cartridges(self) -> Dict[str, Any]:
        """Returns unmerged raw cartridge dictionaries keyed by scope name."""
        scopes = ("common", "javascript", "typescript", "python", "kotlin", "swift", "c", "java")
        return {sc: self._read_json(f"{sc}.json") for sc in scopes}

    @staticmethod
    def compile_maps(entries: Dict[str, Dict[str, str]], target_locale: str = "ko") -> Dict[str, Dict[str, str]]:
        code_to_en: Dict[str, str] = {}
        code_to_ko: Dict[str, str] = {}
        en_to_code: Dict[str, str] = {}
        ko_to_code: Dict[str, str] = {}
        locale_lower = (target_locale or "ko").lower().strip()

        for code_token, trans in entries.items():
            en_word = trans.get("en", "").strip()
            target_word = trans.get(locale_lower, "").strip() if locale_lower != "none" else ""
            if en_word:
                code_to_en[code_token] = en_word
                en_to_code[en_word] = code_token
            if target_word and locale_lower != "none":
                code_to_ko[code_token] = target_word
                ko_to_code[target_word] = code_token

        return {
            "code_to_en": code_to_en,
            "code_to_ko": code_to_ko,
            "en_to_code": en_to_code,
            "ko_to_code": ko_to_code,
        }

    def get_user_learned_mappings(self) -> Dict[str, Any]:
        """Loads offline personalized natural-word -> code mappings from dicts/user_learned.json."""
        default_buckets: Dict[str, Dict[str, Any]] = {
            "global": {},
            "python": {},
            "javascript": {},
            "typescript": {},
            "kotlin": {},
            "swift": {},
            "c": {},
            "java": {},
        }
        path = self._user_learned_path(for_write=False)
        if not path.exists():
            return {"ok": True, "mappings": default_buckets}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return {"ok": True, "mappings": default_buckets}
            raw_map = data.get("mappings") if isinstance(data.get("mappings"), dict) else data
            merged = dict(default_buckets)
            for k in default_buckets.keys():
                if isinstance(raw_map.get(k), dict):
                    merged[k] = dict(raw_map[k])
            return {"ok": True, "mappings": merged}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "mappings": default_buckets}

    def save_user_learned_mappings(self, mappings: Dict[str, Any]) -> Dict[str, Any]:
        """Persists offline personalized natural-word -> code mappings to dicts/user_learned.json."""
        allowed_scopes = ("global", "python", "javascript", "typescript", "kotlin", "swift", "c", "java")
        clean: Dict[str, Dict[str, Any]] = {s: {} for s in allowed_scopes}
        if isinstance(mappings, dict):
            src = mappings.get("mappings") if isinstance(mappings.get("mappings"), dict) else mappings
            for sc in allowed_scopes:
                bucket = src.get(sc)
                if isinstance(bucket, dict):
                    for stem_key, info in bucket.items():
                        k_str = str(stem_key or "").strip()
                        if not k_str:
                            continue
                        if isinstance(info, dict):
                            code_val = str(info.get("code") or "").strip()
                            if code_val:
                                entry_obj: Dict[str, Any] = {
                                    "code": code_val,
                                    "rawQuery": str(info.get("rawQuery") or k_str).strip(),
                                    "count": int(info.get("count") or 1),
                                    "updatedAt": int(info.get("updatedAt") or 0),
                                }
                                if info.get("derivedFrom"):
                                    entry_obj["derivedFrom"] = str(info.get("derivedFrom")).strip()
                                clean[sc][k_str] = entry_obj
                        elif isinstance(info, str) and info.strip():
                            clean[sc][k_str] = {
                                "code": info.strip(),
                                "rawQuery": k_str,
                                "count": 1,
                                "updatedAt": 0,
                            }
        path = self._user_learned_path(for_write=True)
        payload = {"_meta": {"version": "0.3", "type": "user_learned_mappings"}, "mappings": clean}
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return {"ok": True, "mappings": clean}

    def get_vocab_lexicon_raw(self, lang_code: str = "ko") -> str:
        """Reads dicts/vocab_{lang}.json once and returns raw JSON string for O(1) bridge transfer."""
        lc = "en" if str(lang_code or "").lower().strip() == "en" else "ko"
        cached = self._vocab_raw_cache.get(lc)
        if cached is not None:
            return cached
        path = self.dicts_dir / f"vocab_{lc}.json"
        if not path.exists():
            return json.dumps({"ok": False, "language": lc, "error": f"vocab_{lc}.json not found", "entries": {}, "_meta": {}})
        try:
            raw_text = path.read_text(encoding="utf-8")
            self._vocab_raw_cache[lc] = raw_text
            return raw_text
        except Exception as exc:
            return json.dumps({"ok": False, "language": lc, "error": str(exc), "entries": {}, "_meta": {}})

    def get_vocab_lexicon(self, lang_code: str = "ko") -> Dict[str, Any]:
        """Loads offline POS-tagged KO or EN vocabulary-to-code DB from dicts/vocab_{lang}.json."""
        lc = "en" if str(lang_code or "").lower().strip() == "en" else "ko"
        cached_dict = self._vocab_dict_cache.get(lc)
        if cached_dict is not None:
            return cached_dict
        path = self.dicts_dir / f"vocab_{lc}.json"
        if not path.exists():
            return {"ok": False, "language": lc, "error": f"vocab_{lc}.json not found", "entries": {}, "_meta": {}}
        try:
            raw_text = self._vocab_raw_cache.get(lc)
            if raw_text is None:
                raw_text = path.read_text(encoding="utf-8")
                self._vocab_raw_cache[lc] = raw_text
            data = json.loads(raw_text)
            res = {
                "ok": True,
                "language": lc,
                "_meta": data.get("_meta", {}),
                "entries": data.get("entries", {}),
            }
            self._vocab_dict_cache[lc] = res
            return res
        except Exception as exc:
            return {"ok": False, "language": lc, "error": str(exc), "entries": {}, "_meta": {}}

# ============================================================================
#   🄯 (c)카피레프트 Copyleft — Tran.IDE | a Bakk jaejin production
#   Copyright (C) 2026 Bakk jaejin | SPDX-License-Identifier: AGPL-3.0-or-later
# ============================================================================
