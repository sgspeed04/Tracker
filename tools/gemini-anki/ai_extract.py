#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gemini API로 자유 형식 텍스트에서 핵심 표현/뜻 후보를 추출한다.

extract_expressions.py의 정규식 방식과 달리, 미리 "**표현** - 설명" 형식으로
정리해두지 않은 긴 글을 그대로 넣어도 AI가 알아서 핵심 표현을 뽑아준다.
무료 Gemini API 키(aistudio.google.com에서 발급)가 필요하다.
"""

import json
import re
import time

import requests

RETRYABLE_STATUS_CODES = {429, 503}
MAX_RETRIES = 3

DEFAULT_MODEL = "gemini-flash-latest"
API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

PROMPT = """다음은 학습자가 공부하며 남긴 메모입니다. 나중에 복습카드로 만들면
좋을 것들을 최대한 많이, 아끼지 말고 뽑아주세요. 두 종류를 섞어서 뽑으세요:

1. 단어/짧은 표현 - 그 뜻과 함께
2. 통째로 외울 만한 문장 - 문장 전체를 expression으로, 해석을 meaning으로

너무 당연하거나 사소한 것만 빼고, 다시 볼 가치가 있으면 최대한 많이 뽑으세요
(단어 하나짜리로 다 뭉치지 말고, 문장도 꼭 섞어서 뽑으세요).

expression이 중국어라면, meaning 맨 앞에 병음(발음)을 괄호로 적고 그다음에
뜻을 이어서 쓰세요. 예: "(bàoguān) 세관에 신고하는 절차".

JSON 배열로만 답하세요. 다른 설명은 절대 붙이지 마세요.
형식: [{{"expression": "표현 또는 문장", "meaning": "뜻(중국어면 병음을 맨 앞에)"}}, ...]

핵심 표현이 없으면 빈 배열 []을 반환하세요.

메모:
---
{text}
---
"""


def call_gemini(text: str, api_key: str, model: str = DEFAULT_MODEL) -> list[dict]:
    url = API_URL_TEMPLATE.format(model=model)

    for attempt in range(MAX_RETRIES):
        response = requests.post(
            url,
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": PROMPT.format(text=text)}]}]},
            timeout=60,
        )
        if response.ok:
            break
        if response.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES - 1:
            time.sleep(2 ** attempt * 2)  # 2s, 4s
            continue
        raise RuntimeError(f"Gemini API 오류 ({response.status_code}): {response.text}")

    body = response.json()

    try:
        raw = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Gemini 응답을 해석할 수 없습니다: {body}") from exc

    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        raise RuntimeError(f"Gemini 응답에서 JSON 배열을 찾을 수 없습니다: {raw}")

    return json.loads(match.group(0))


def build_candidates_ai(
    activities: list[dict], api_key: str, model: str = DEFAULT_MODEL
) -> list[dict]:
    seen: dict[str, dict] = {}
    for activity in activities:
        text = activity.get("text", "").strip()
        if not text:
            continue
        for item in call_gemini(text, api_key, model):
            expression = str(item.get("expression", "")).strip()
            meaning = str(item.get("meaning", "")).strip()
            if not expression or not meaning:
                continue
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
