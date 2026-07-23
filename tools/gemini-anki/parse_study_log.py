#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""직접 정리한 학습 로그(study_log.md)를 parse_takeout.py와 같은 JSON 구조로 변환한다.

로그 파일에서 "## "로 시작하는 줄을 날짜/구분 헤더로 인식하고, 그 아래 줄들을
활동(activity) 하나로 묶는다 (헤더가 없으면 파일 전체를 활동 하나로 취급).
Takeout 전체를 내보내는 대신, 공부하다가 카드로 남기고 싶은 부분만 직접
이 파일에 적어 쌓아두는 용도.
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from parse_takeout import filter_activities

HEADER_PREFIX = "## "


def parse_log(text: str) -> list[dict]:
    entries: list[dict] = []
    current_header = ""
    current_body: list[str] = []

    def flush_current() -> None:
        body = "\n".join(current_body).strip()
        if body:
            entries.append(
                {"index": len(entries), "title": "", "text": body, "timestamp": current_header}
            )

    for line in text.splitlines():
        if line.startswith(HEADER_PREFIX):
            flush_current()
            current_header = line[len(HEADER_PREFIX):].strip()
            current_body = []
        else:
            current_body.append(line)
    flush_current()

    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log_file", type=Path, help="학습 로그 파일 경로 (예: study_log.md)")
    parser.add_argument(
        "-o", "--output", type=Path, default=None, help="출력 JSON 경로 (기본: stdout)"
    )
    parser.add_argument(
        "--start-date", type=date.fromisoformat, default=None, help="이 날짜(YYYY-MM-DD) 이후 항목만 포함"
    )
    parser.add_argument(
        "--end-date", type=date.fromisoformat, default=None, help="이 날짜(YYYY-MM-DD) 이전 항목만 포함"
    )
    parser.add_argument("--keyword", default=None, help="제목/본문에 이 문자열을 포함하는 항목만 포함")
    args = parser.parse_args()

    if not args.log_file.exists():
        print(f"파일을 찾을 수 없습니다: {args.log_file}", file=sys.stderr)
        sys.exit(1)

    activities = parse_log(args.log_file.read_text(encoding="utf-8"))
    total_count = len(activities)
    activities = filter_activities(activities, args.start_date, args.end_date, args.keyword)
    if total_count != len(activities):
        print(f"필터 적용: 전체 {total_count}개 중 {len(activities)}개만 포함.", file=sys.stderr)

    output_json = json.dumps(activities, ensure_ascii=False, indent=2)

    if args.output:
        args.output.write_text(output_json, encoding="utf-8")
        print(f"{len(activities)}개 항목을 {args.output}에 저장했습니다.", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
