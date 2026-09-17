#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""study_log에서 파싱한 활동 목록에서 카드 후보를 뽑는 공통 로직.

--ai 여부에 따라 extract_expressions.py(정규식)나 ai_extract.py(Gemini API) 중
하나를 골라 쓴다. study_log_to_anki.py, study_log_to_file.py, run_all_logs.py가
공유한다.
"""

import os


class ExtractionError(Exception):
    """추출 실패 시 발생. 호출하는 쪽에서 종료할지 다음 파일로 넘어갈지 결정한다."""


def get_candidates(
    activities: list[dict],
    use_ai: bool,
    api_key: str | None = None,
    model: str | None = None,
) -> list[dict]:
    if use_ai:
        from ai_extract import DEFAULT_MODEL, build_candidates_ai

        key = api_key or os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ExtractionError(
                "GEMINI_API_KEY 환경변수가 없습니다. aistudio.google.com에서 무료로 발급받아 설정하세요."
            )
        try:
            return build_candidates_ai(activities, key, model or DEFAULT_MODEL)
        except Exception as exc:
            raise ExtractionError(
                f"Gemini API 호출 실패: {exc}\n"
                "모델 이름이 더 이상 지원되지 않는 오류(404)라면 --model 옵션으로 다른 모델명을"
                " 지정해보세요 (예: --model gemini-2.5-flash). 일시적인 서버 과부하(503) 등"
                " 오류라면 잠시 후 다시 시도해보세요."
            ) from exc

    from extract_expressions import build_candidates

    return build_candidates(activities)
