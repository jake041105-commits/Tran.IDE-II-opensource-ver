# Contributing to Tran.IDE II

Tran.IDE II 오픈소스 프로젝트에 기여해 주셔서 감사합니다!

## 핵심 원칙: 1:1 배타적 자연어 매핑 (1:1 Exclusive Mapping)

Tran.IDE II의 모든 언어 카트리지(`dicts/*.json`)는 **하나의 코드 토큰 ↔ 하나의 대표 자연어**가 충돌 없이 1:1로 대응하는 것을 원칙으로 합니다.

1. **중복 금지**: 동일한 자연어 대표어나 동의어가 서로 다른 코드 토큰에 중복 할당되지 않도록 해주세요.
2. **개인 데이터 제외**: 개인 학습 데이터(`dicts/user_learned.json`)나 로컬 세션 파일(`workspace_session.json`)은 커밋하지 마세요.
3. **테스트 확인**: 변경 후 `python -m py_compile main.py dict_manager.py` 및 앱 실행을 통해 UI·변환 동작에 이상이 없는지 확인해 주세요.

## 라이선스 동의 (Licensing)

이 저장소에 제출되는 모든 기여물은 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 조건에 따라 배포됩니다.

---
*🄯 (c)카피레프트 Copyleft — Tran.IDE | a Bakk jaejin production*
