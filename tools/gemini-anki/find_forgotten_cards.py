#!/usr/bin/env python3
"""Anki에서 자주 까먹는(lapse가 많은) 카드를 찾아 보여준다.

Anki는 카드마다 "다시(Again)"를 누른 횟수(lapses)를 이미 추적하고 있으므로,
그 값이 높은 카드만 뽑아 Gemini에게 다시 설명을 요청할 때 쓸 프롬프트를 만든다.
"""

import argparse
import sys

from push_to_anki import invoke


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deck", default="Gemini 학습", help="검색할 Anki 덱 이름")
    parser.add_argument(
        "--min-lapses", type=int, default=2, help="이 횟수 이상 까먹은 카드만 표시 (기본: 2)"
    )
    parser.add_argument(
        "--print-prompt",
        action="store_true",
        help="Gemini에 붙여넣을 재설명 요청 프롬프트도 함께 출력",
    )
    args = parser.parse_args()

    query = f'deck:"{args.deck}" prop:lapses>={args.min_lapses}'
    try:
        card_ids = invoke("findCards", query=query)
    except Exception as exc:
        print(f"AnkiConnect에 연결할 수 없습니다: {exc}", file=sys.stderr)
        print("PC에서 Anki를 켜고 있는지 확인하세요.", file=sys.stderr)
        sys.exit(1)

    if not card_ids:
        print(f"'{args.deck}' 덱에서 {args.min_lapses}번 이상 까먹은 카드가 없습니다.")
        return

    cards_info = invoke("cardsInfo", cards=card_ids)
    cards_info.sort(key=lambda card: card.get("lapses", 0), reverse=True)

    print(f"자주 까먹는 카드 {len(cards_info)}개 (덱: {args.deck}):\n")
    for card in cards_info:
        front = card["fields"].get("Front", {}).get("value", "")
        back = card["fields"].get("Back", {}).get("value", "")
        print(f"- {front} (까먹은 횟수: {card.get('lapses', 0)})\n    {back}\n")

    if args.print_prompt:
        expressions = ", ".join(
            card["fields"].get("Front", {}).get("value", "") for card in cards_info
        )
        print("---")
        print("아래를 복사해서 Gemini에 붙여넣어보세요:\n")
        print(f"나는 다음 표현들을 자꾸 까먹어: {expressions}. 각각 예문과 함께 다시 쉽게 설명해줘.")


if __name__ == "__main__":
    main()
