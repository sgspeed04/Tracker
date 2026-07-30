#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""study_log.md → Anki로 가져오기(Import) 가능한 텍스트 파일로 변환한다.

push_to_anki.py와 달리 AnkiConnect(로컬 PC의 Anki 실행 필요)를 쓰지 않는다.
대신 탭으로 구분된 Front/Back 텍스트 파일을 만들어주는데, 이 파일은
Anki 데스크톱의 파일 > 가져오기, 또는 AnkiDroid(안드로이드)의 가져오기
기능으로 바로 넣을 수 있다. PC용 Anki가 없는 환경(예: Termux가 깔린
안드로이드 태블릿)에서도 카드 후보를 만들 때 이 스크립트를 쓴다.
"""

import argparse
import sys
from pathlib import Path

from extraction import ExtractionError, get_candidates
from parse_study_log import parse_log


def write_import_file(candidates: list[dict], output_path: Path) -> None:
    lines = [
        f"{candidate['expression'].replace(chr(9), ' ')}\t{candidate['meaning'].replace(chr(9), ' ')}"
        for candidate in candidates
    ]
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log_file", type=Path, help="학습 로그 파일 경로 (예: study_log.md)")
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("anki_import.txt"), help="출력 파일 경로"
    )
    parser.add_argument(
        "--ai",
        action="store_true",
        help="정규식 대신 Gemini API로 추출 (형식 안 갖춘 긴 글도 가능, GEMINI_API_KEY 필요)",
    )
    parser.add_argument(
        "--api-key", default=None, help="Gemini API 키 (기본: GEMINI_API_KEY 환경변수)"
    )
    parser.add_argument(
        "--model", default=None, help="Gemini 모델 이름 (기본: ai_extract.DEFAULT_MODEL)"
    )
    args = parser.parse_args()

    if not args.log_file.exists():
        print(f"파일을 찾을 수 없습니다: {args.log_file}", file=sys.stderr)
        sys.exit(1)

    activities = parse_log(args.log_file.read_text(encoding="utf-8"))
    try:
        candidates = get_candidates(activities, args.ai, args.api_key, args.model)
    except ExtractionError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

    if not candidates:
        print("추출된 표현 후보가 없습니다.")
        return

    print(f"{len(candidates)}개 후보 발견:")
    for candidate in candidates:
        print(f"  - {candidate['expression']}: {candidate['meaning']}")

    write_import_file(candidates, args.output)
    print(f"\n{args.output} 파일로 저장했습니다.")
    print("- Anki 데스크톱: 파일 > 가져오기 → 이 파일 선택 (필드 구분자: 탭, 노트 유형: 기본)")
    print("- AnkiDroid(안드로이드): 오른쪽 위 메뉴 > 가져오기 → 이 파일 선택")


if __name__ == "__main__":
    main()
