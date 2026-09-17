#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""parse_takeout.py의 출력(JSON)에서 핵심 표현 후보를 추출한다.

Gemini 응답이 굵게(**표현**) 강조 후 대시로 설명을 붙이는 습관, 또는
따옴표로 용어를 정의하는 패턴을 인식한다. 자동 추출은 완벽하지 않으므로
push_to_anki.py로 넘기기 전에 candidates.json을 검토/수정하는 것을 권장한다.
"""

import argparse
import json
import re
import sys
from pathlib import Path

BOLD_DASH = re.compile(r"\*\*(.+?)\*\*\s*[:–\-]\s*([^\n*\"]{1,200})")
QUOTED_DEFINE = re.compile(r'"([^"\n]{1,60})"\s*[:–\-]\s*([^\n"*]{1,200})')


def extract_from_text(text: str) -> list[tuple[str, str]]:
    found = []
    for pattern in (BOLD_DASH, QUOTED_DEFINE):
        for match in pattern.finditer(text):
            expression = match.group(1).strip()
            meaning = match.group(2).strip()
            if expression and meaning:
                found.append((expression, meaning))
    return found


def build_candidates(activities: list[dict]) -> list[dict]:
    seen = {}
    for activity in activities:
        for expression, meaning in extract_from_text(activity.get("text", "")):
            key = expression.lower()
            if key in seen:
                continue
            seen[key] = {
                "expression": expression,
                "meaning": meaning,
                "source_index": activity["index"],
                "source_timestamp": activity.get("timestamp", ""),
                "reviewed": False,
            }
    return list(seen.values())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("activities_json", type=Path, help="parse_takeout.py 출력 JSON")
    parser.add_argument(
        "-o", "--output", type=Path, default=None, help="출력 JSON 경로 (기본: stdout)"
    )
    args = parser.parse_args()

    if not args.activities_json.exists():
        print(f"파일을 찾을 수 없습니다: {args.activities_json}", file=sys.stderr)
        sys.exit(1)

    activities = json.loads(args.activities_json.read_text(encoding="utf-8"))
    candidates = build_candidates(activities)
    output_json = json.dumps(candidates, ensure_ascii=False, indent=2)

    if args.output:
        args.output.write_text(output_json, encoding="utf-8")
        print(f"{len(candidates)}개 후보를 {args.output}에 저장했습니다. 검토 후 push_to_anki.py를 실행하세요.", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
