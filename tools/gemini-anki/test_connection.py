#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PC에서 Anki + AnkiConnect가 정상 작동 중인지 확인한다 (localhost:8765 연결 테스트)."""

import sys

import requests

ANKICONNECT_URL = "http://localhost:8765"


def main() -> None:
    try:
        response = requests.post(
            ANKICONNECT_URL,
            json={"action": "version", "version": 6},
            timeout=5,
        )
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.ConnectionError:
        print("연결 실패: Anki가 켜져 있는지, AnkiConnect 애드온이 설치되어 있는지 확인하세요.", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"연결 실패: {exc}", file=sys.stderr)
        sys.exit(1)

    if result.get("error"):
        print(f"AnkiConnect 오류: {result['error']}", file=sys.stderr)
        sys.exit(1)

    print(f"연결 성공! AnkiConnect API 버전: {result['result']}")


if __name__ == "__main__":
    main()
