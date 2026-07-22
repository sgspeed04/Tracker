#!/usr/bin/env python3
"""study_log.md → 카드 후보 추출 → Anki 추가까지 한 번에 실행하는 편의 스크립트.

parse_study_log.py + extract_expressions.py + push_to_anki.py를 한 명령으로 묶은 것.
같은 로그를 여러 번 돌려도 push_to_anki.py가 중복 카드는 건너뛰므로 안전하다.

--ai 옵션을 주면 정규식 대신 Gemini API로 추출한다 — "**표현** - 설명" 형식으로
미리 정리하지 않은 긴 글을 그대로 넣어도 AI가 알아서 핵심 표현을 뽑아준다.
이 경우 GEMINI_API_KEY 환경변수(또는 --api-key)가 필요하다.
"""

import argparse
import sys
from pathlib import Path

from extraction import get_candidates
from parse_study_log import parse_log
from push_to_anki import build_note, invoke


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log_file", type=Path, help="학습 로그 파일 경로 (예: study_log.md)")
    parser.add_argument("--deck", default="Gemini 학습", help="추가할 Anki 덱 이름")
    parser.add_argument(
        "--dry-run", action="store_true", help="Anki에 추가하지 않고 추출된 후보만 보여준다"
    )
    parser.add_argument(
        "--ai",
        action="store_true",
        help="정규식 대신 Gemini API로 추출 (형식 안 갖춘 긴 글도 가능, GEMINI_API_KEY 필요)",
    )
    parser.add_argument(
        "--api-key", default=None, help="Gemini API 키 (기본: GEMINI_API_KEY 환경변수)"
    )
    args = parser.parse_args()

    if not args.log_file.exists():
        print(f"파일을 찾을 수 없습니다: {args.log_file}", file=sys.stderr)
        sys.exit(1)

    activities = parse_log(args.log_file.read_text(encoding="utf-8"))
    candidates = get_candidates(activities, args.ai, args.api_key)

    if not candidates:
        if args.ai:
            print("추출된 표현 후보가 없습니다.")
        else:
            print("추출된 표현 후보가 없습니다. 로그가 '**표현** - 설명' 형식인지 확인하세요 (--ai 옵션을 쓰면 형식 없이도 됩니다).")
        return

    print(f"{len(candidates)}개 후보 발견:")
    for candidate in candidates:
        print(f"  - {candidate['expression']}: {candidate['meaning']}")

    if args.dry_run:
        return

    try:
        invoke("createDeck", deck=args.deck)
    except Exception as exc:
        print(f"\nAnkiConnect에 연결할 수 없습니다: {exc}", file=sys.stderr)
        print("PC에서 Anki를 켜고 있는지 확인하세요.", file=sys.stderr)
        sys.exit(1)

    notes = [build_note(candidate, args.deck) for candidate in candidates]
    can_add = invoke("canAddNotes", notes=notes)
    to_add = [note for note, ok in zip(notes, can_add) if ok]
    skipped = len(notes) - len(to_add)
    added_ids = invoke("addNotes", notes=to_add) if to_add else []
    added = sum(1 for note_id in added_ids if note_id is not None)

    print(f"\n추가됨: {added}개, 중복으로 건너뜀: {skipped}개, 덱: {args.deck}")


if __name__ == "__main__":
    main()
