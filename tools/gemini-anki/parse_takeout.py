#!/usr/bin/env python3
"""Google Takeout의 Gemini Apps 'My Activity.html'을 파싱해 JSON으로 변환한다."""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

MONTH_ABBR = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def parse_timestamp_date(timestamp: str) -> date | None:
    """타임스탬프에서 날짜만 추출한다. Takeout의 영문("Jul 20, 2026, ...")/
    한글("2026. 7. 20. 오후 ...") 표기와 ISO 형식("2026-07-20", study_log.md
    헤더용) 표기를 모두 시도한다."""
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", timestamp.strip())
    if match:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    match = re.search(r"([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})", timestamp)
    if match and match.group(1) in MONTH_ABBR:
        return date(int(match.group(3)), MONTH_ABBR[match.group(1)], int(match.group(2)))

    match = re.search(r"(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.", timestamp)
    if match:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))

    return None


def parse_activity_html(html_path: Path) -> list[dict]:
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    activities = []

    for cell in soup.find_all("div", class_="outer-cell"):
        title_el = cell.find("p", class_="mdl-typography--title")
        title = title_el.get_text(strip=True) if title_el else ""

        content_cells = cell.find_all("div", class_="content-cell")
        body_parts = []
        timestamp = ""
        for content in content_cells:
            classes = content.get("class", [])
            text = content.get_text(separator="\n", strip=True)
            if "mdl-typography--caption" in classes:
                timestamp = text
            else:
                body_parts.append(text)

        body = "\n".join(part for part in body_parts if part)
        if not body and not title:
            continue

        activities.append(
            {
                "index": len(activities),
                "title": title,
                "text": body,
                "timestamp": timestamp,
            }
        )

    return activities


def filter_activities(
    activities: list[dict],
    start_date: date | None = None,
    end_date: date | None = None,
    keyword: str | None = None,
) -> list[dict]:
    filtered = []
    keyword_lower = keyword.lower() if keyword else None

    for activity in activities:
        if start_date or end_date:
            activity_date = parse_timestamp_date(activity.get("timestamp", ""))
            if activity_date is None:
                continue
            if start_date and activity_date < start_date:
                continue
            if end_date and activity_date > end_date:
                continue

        if keyword_lower:
            haystack = (activity.get("title", "") + "\n" + activity.get("text", "")).lower()
            if keyword_lower not in haystack:
                continue

        filtered.append(activity)

    for i, activity in enumerate(filtered):
        activity["index"] = i

    return filtered


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html_file", type=Path, help="Takeout의 My Activity.html 경로")
    parser.add_argument(
        "-o", "--output", type=Path, default=None, help="출력 JSON 경로 (기본: stdout)"
    )
    parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        default=None,
        help="이 날짜(YYYY-MM-DD) 이후 활동만 포함",
    )
    parser.add_argument(
        "--end-date",
        type=date.fromisoformat,
        default=None,
        help="이 날짜(YYYY-MM-DD) 이전 활동만 포함",
    )
    parser.add_argument(
        "--keyword",
        default=None,
        help="제목/본문에 이 문자열을 포함하는 활동만 포함 (대소문자 무시)",
    )
    args = parser.parse_args()

    if not args.html_file.exists():
        print(f"파일을 찾을 수 없습니다: {args.html_file}", file=sys.stderr)
        sys.exit(1)

    activities = parse_activity_html(args.html_file)
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
