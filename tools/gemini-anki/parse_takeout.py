#!/usr/bin/env python3
"""Google Takeout의 Gemini Apps 'My Activity.html'을 파싱해 JSON으로 변환한다."""

import argparse
import json
import sys
from pathlib import Path

from bs4 import BeautifulSoup


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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html_file", type=Path, help="Takeout의 My Activity.html 경로")
    parser.add_argument(
        "-o", "--output", type=Path, default=None, help="출력 JSON 경로 (기본: stdout)"
    )
    args = parser.parse_args()

    if not args.html_file.exists():
        print(f"파일을 찾을 수 없습니다: {args.html_file}", file=sys.stderr)
        sys.exit(1)

    activities = parse_activity_html(args.html_file)
    output_json = json.dumps(activities, ensure_ascii=False, indent=2)

    if args.output:
        args.output.write_text(output_json, encoding="utf-8")
        print(f"{len(activities)}개 항목을 {args.output}에 저장했습니다.", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
