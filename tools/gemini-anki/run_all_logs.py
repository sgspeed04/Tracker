#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""study_log*.md 파일들을 한 번에 찾아서 각자의 Anki 덱으로 카드를 추가한다.

run_study_log.bat이 이 스크립트를 호출한다. 배치 파일 자체에는 한글(비ASCII
문자)을 넣지 않는다 — 윈도우 cmd가 한글이 섞인 배치 파일을 codepage 문제로
잘못 파싱해버리는 경우가 있어서, 파일↔덱 매핑과 안내 메시지는 여기 파이썬
코드에 둔다.
"""

import os
import sys
from pathlib import Path

from extraction import ExtractionError, get_candidates
from parse_study_log import parse_log
from push_to_anki import push_notes

SCRIPT_DIR = Path(__file__).resolve().parent

LOG_DECK_MAP = {
    "study_log.md": "Gemini 학습",
    "study_log_chinese.md": "중국어",
    "study_log_english.md": "영어",
    "study_log_bi.md": "BI",
    "study_log_python.md": "파이썬",
}


def process(log_file: Path, deck: str) -> None:
    print(f"\n=== {log_file.name} -> 덱: {deck} ===")
    activities = parse_log(log_file.read_text(encoding="utf-8"))
    try:
        candidates = get_candidates(activities, use_ai=True)
    except ExtractionError as exc:
        print(exc)
        print(f"{log_file.name} 처리를 건너뛰고 다음 파일로 넘어갑니다.")
        return

    if not candidates:
        print("추출된 표현 후보가 없습니다.")
        return

    for candidate in candidates:
        print(f"  - {candidate['expression']}: {candidate['meaning']}")

    try:
        result = push_notes(candidates, deck)
    except Exception as exc:
        print(f"AnkiConnect에 연결할 수 없습니다: {exc}")
        print("PC에서 Anki를 켜고 있는지 확인하세요.")
        return

    print(f"추가됨: {result['added']}개, 이미 있어서 복습일 당김: {result['bumped']}개")


def main() -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        print(
            "GEMINI_API_KEY 환경변수가 없습니다. "
            "aistudio.google.com에서 무료로 발급받아 설정하세요."
        )
        sys.exit(1)

    found = False
    for filename, deck in LOG_DECK_MAP.items():
        log_file = SCRIPT_DIR / filename
        if log_file.exists():
            found = True
            process(log_file, deck)

    if not found:
        print(
            "처리할 로그 파일이 없습니다. "
            "study_log_*.example.md 파일들을 study_log_*.md로 복사한 뒤 내용을 채우세요."
        )


if __name__ == "__main__":
    main()
