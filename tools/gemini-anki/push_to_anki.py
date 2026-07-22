#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""extract_expressions.py의 candidates.json을 AnkiConnect로 Anki에 카드로 추가한다.

사전 조건: PC에서 Anki가 실행 중이고, AnkiConnect 애드온이 설치되어 있어야 한다.
(설치 방법은 tools/gemini-anki/README.md 참고)
"""

import argparse
import json
import sys
from pathlib import Path

import requests

ANKICONNECT_URL = "http://localhost:8765"


def invoke(action: str, **params):
    payload = {"action": action, "version": 6, "params": params}
    response = requests.post(ANKICONNECT_URL, json=payload, timeout=10)
    response.raise_for_status()
    body = response.json()
    if body.get("error") is not None:
        raise RuntimeError(f"AnkiConnect 오류 ({action}): {body['error']}")
    return body["result"]


def build_note(candidate: dict, deck: str) -> dict:
    context = f"(출처: {candidate.get('source_timestamp', '')})" if candidate.get("source_timestamp") else ""
    back = candidate["meaning"]
    if context:
        back = f"{back}\n\n{context}"
    return {
        "deckName": deck,
        "modelName": "Basic",
        "fields": {"Front": candidate["expression"], "Back": back},
        "options": {"allowDuplicate": False, "duplicateScope": "deck"},
        "tags": ["gemini-study"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidates_json", type=Path, help="extract_expressions.py 출력 JSON")
    parser.add_argument("--deck", default="Gemini 학습", help="추가할 Anki 덱 이름")
    parser.add_argument(
        "--only-reviewed",
        action="store_true",
        help="reviewed:true로 표시된 후보만 추가 (검토를 강제하고 싶을 때 사용)",
    )
    args = parser.parse_args()

    if not args.candidates_json.exists():
        print(f"파일을 찾을 수 없습니다: {args.candidates_json}", file=sys.stderr)
        sys.exit(1)

    candidates = json.loads(args.candidates_json.read_text(encoding="utf-8"))
    if args.only_reviewed:
        candidates = [c for c in candidates if c.get("reviewed")]

    if not candidates:
        print("추가할 후보가 없습니다.", file=sys.stderr)
        return

    try:
        invoke("createDeck", deck=args.deck)
    except Exception as exc:
        print(f"AnkiConnect에 연결할 수 없습니다: {exc}", file=sys.stderr)
        print("PC에서 Anki를 켜고 http://localhost:8765 접속이 되는지 먼저 확인하세요 (test_connection.py 참고).", file=sys.stderr)
        sys.exit(1)

    notes = [build_note(c, args.deck) for c in candidates]
    can_add = invoke("canAddNotes", notes=notes)

    to_add = [note for note, ok in zip(notes, can_add) if ok]
    skipped = len(notes) - len(to_add)

    added_ids = invoke("addNotes", notes=to_add) if to_add else []
    added = sum(1 for i in added_ids if i is not None)

    print(f"추가됨: {added}개, 중복으로 건너뜀: {skipped}개, 덱: {args.deck}")


if __name__ == "__main__":
    main()
