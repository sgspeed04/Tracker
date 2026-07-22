#!/usr/bin/env python3
"""study_log에서 파싱한 활동 목록에서 카드 후보를 뽑는 공통 로직.

--ai 여부에 따라 extract_expressions.py(정규식)나 ai_extract.py(Gemini API) 중
하나를 골라 쓴다. study_log_to_anki.py와 study_log_to_file.py가 공유한다.
"""

import os
import sys


def get_candidates(activities: list[dict], use_ai: bool, api_key: str | None = None) -> list[dict]:
    if use_ai:
        from ai_extract import build_candidates_ai

        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            print(
                "GEMINI_API_KEY 환경변수가 없습니다. aistudio.google.com에서 무료로 발급받아 설정하세요.",
                file=sys.stderr,
            )
            sys.exit(1)
        try:
            return build_candidates_ai(activities, key)
        except Exception as exc:
            print(f"Gemini API 호출 실패: {exc}", file=sys.stderr)
            sys.exit(1)

    from extract_expressions import build_candidates

    return build_candidates(activities)
