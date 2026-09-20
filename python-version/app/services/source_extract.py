from __future__ import annotations

import os
import re
from typing import Optional

CHANNELS = [
    "Website",
    "Event",
    "LinkedIn",
    "Organic Search",
    "Referral",
    "Manual/Sales",
    "Other",
]

EVENT_KEYWORDS = (
    r"booth|QR scan|festival|conference|summit|expo|"
    r"SaaStr|Mobile World Congress|Singapore FinTech|TechCrunch Disrupt|"
    r"Money20/20|Web Summit|London Tech|Dubai FinTech|Retail Asia|APAC Logistics"
)

EVENT_NAMES = [
    "SaaStr",
    "Mobile World Congress",
    "Singapore FinTech",
    "Singapore FinTech Festival",
    "TechCrunch Disrupt",
    "Money20/20",
    "Web Summit",
    "London Tech",
    "London Tech Week",
    "Dubai FinTech",
    "Dubai FinTech Week",
    "Retail Asia Expo",
    "Retail Asia",
    "APAC Logistics",
]

WEBSITE_PAGES = [
    "pricing page",
    "contact page",
    "blog post",
    "homepage",
    "product tour",
    "comparison-vs-hubspot",
    "case study page",
    "book-a-demo page",
    "book-a-demo",
]


def _extract_event_name(text: str) -> str:
    for name in EVENT_NAMES:
        if re.search(re.escape(name), text, re.IGNORECASE):
            return name
    m = re.search(
        r"at (?:the )?([A-Z][A-Za-z0-9 ]{2,50}?(?:booth|festival|conference|summit|expo|week))",
        text,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip()
    m = re.search(r"(?:at|during) (?:the )?([A-Z][A-Za-z0-9/ ]{4,60})", text, re.IGNORECASE)
    if m:
        candidate = m.group(1).strip().rstrip(".,")
        if len(candidate) > 2:
            return candidate
    return "Unknown event"


def _extract_referrer(text: str) -> str:
    m = re.search(
        r"Referred by ([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})",
        text,
    )
    if m:
        return m.group(1).strip()
    return "Unknown referrer"


def _extract_website_page(text: str) -> str:
    for page in WEBSITE_PAGES:
        if re.search(re.escape(page), text, re.IGNORECASE):
            return page
    m = re.search(r"(?:on the|landed on the|via the) ([a-zA-Z\- ]{2,60}?)(?:\.|,| |$)", text, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip("., ")
    return "Website form"


def _rules_extract(text: str) -> dict:
    t = text or ""

    event_pat = rf"(?i).*(?:{EVENT_KEYWORDS}).*"
    if re.match(event_pat, t):
        return {"channel": "Event", "detail": _extract_event_name(t)}

    ref_pat = r"Referred by [A-Z][a-z]+ [A-Z][a-z]+"
    if re.search(ref_pat, t):
        return {"channel": "Referral", "detail": _extract_referrer(t)}

    li_pat = r"(?i).*(Linkedin|LinkedIn|DM inbound|LinkedIn after commenting).*"
    if re.match(li_pat, t):
        return {"channel": "LinkedIn", "detail": "LinkedIn outreach/DM"}

    organic_pat = r"(?i)(organic google search|Googled us|found us through.*google)"
    ad_pat = r"(?i)google ad"
    if re.search(organic_pat, t) and not re.search(ad_pat, t):
        return {"channel": "Organic Search", "detail": _extract_website_page(t)}

    manual_pat = (
        r"(?i)(Manual.*added|cold outreach|general info@|"
        r"walked into our office|reached out via.*inbox|inbound phone call)"
    )
    if re.search(manual_pat, t):
        m = re.search(manual_pat, t, re.IGNORECASE)
        return {"channel": "Manual/Sales", "detail": m.group(0) if m else "Manual/Sales activity"}

    web_pat = (
        r"(?i)(Filled out the form|booked a demo|form on the|book-a-demo|"
        r"pricing page|contact page|blog post|homepage|product tour|"
        r"comparison-vs-hubspot|case study page)"
    )
    if re.search(web_pat, t):
        return {"channel": "Website", "detail": _extract_website_page(t)}

    return {"channel": "Other", "detail": "No regex match"}


def _mock_llm_extract(text: str) -> dict:
    t = (text or "").lower()

    if any(k in t for k in ["booth", "saastr", "fintech festival", "world congress", "summit", "expo", "qr scan", "conference"]):
        return {"channel": "Event", "detail": "Event (mock)"}
    if "referred by" in t:
        return {"channel": "Referral", "detail": "Referral (mock)"}
    if "linkedin" in t or "dm inbound" in t:
        return {"channel": "LinkedIn", "detail": "LinkedIn (mock)"}
    if any(k in t for k in ["organic google", "googled us", "found us through google"]) and "google ad" not in t:
        return {"channel": "Organic Search", "detail": "Organic Search (mock)"}
    if any(k in t for k in ["manual", "cold outreach", "info@", "walked into", "inbox", "phone call"]):
        return {"channel": "Manual/Sales", "detail": "Manual/Sales (mock)"}
    if any(k in t for k in ["form", "demo", "pricing page", "contact page", "blog", "homepage", "product tour", "book-a-demo"]):
        return {"channel": "Website", "detail": "Website (mock)"}
    return {"channel": "Other", "detail": "Other (mock)"}


def _llm_extract_real(text: str) -> Optional[dict]:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    try:
        import json
        from openai import OpenAI

        client = OpenAI(api_key=key)
        prompt = (
            "Klasifikasikan teks berikut ke salah satu channel: "
            "Website, Event, LinkedIn, Organic Search, Referral, Manual/Sales, Other. "
            "Berikan detail singkat (nama event, referrer, halaman, dll). "
            'Format JSON HARUS: {"channel": "...", "detail": "..."}'
            f"\n\nTeks: {text}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
        )
        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        if data.get("channel") in CHANNELS and isinstance(data.get("detail"), str):
            return data
    except Exception:
        pass
    return None


def extract_source(text: str, use_llm: bool = True) -> dict:
    result = _rules_extract(text)
    if result["channel"] != "Other":
        return result
    if use_llm and len(text or "") > 10:
        llm_result = _llm_extract_real(text)
        if llm_result:
            return llm_result
        return _mock_llm_extract(text)
    return result
