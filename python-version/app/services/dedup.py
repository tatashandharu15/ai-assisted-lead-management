from __future__ import annotations

from collections import defaultdict

from rapidfuzz import fuzz

from app.services.cleaner import normalize_company_tokens


def _email_localpart(email: str) -> str:
    if not email:
        return ""
    return email.split("@")[0].lower()


def _build_pairs_from_groups(groups: list[list[int]]) -> set[tuple[int, int]]:
    pairs: set[tuple[int, int]] = set()
    for group in groups:
        items = sorted(set(group))
        n = len(items)
        for i in range(n):
            for j in range(i + 1, n):
                pairs.add((items[i], items[j]))
    return pairs


def _union_find_components(
    pairs_with_confidence: list[tuple[int, int, float, str]],
) -> tuple[dict[int, list[int]], dict[tuple[int, int], tuple[float, str]]]:
    parent: dict[int, int] = {}

    def find(x: int) -> int:
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    pair_info: dict[tuple[int, int], tuple[float, str]] = {}
    all_ids: set[int] = set()
    for a, b, conf, exp in pairs_with_confidence:
        all_ids.add(a)
        all_ids.add(b)
        key = (min(a, b), max(a, b))
        pair_info[key] = (conf, exp)
        union(a, b)

    component_map: dict[int, list[int]] = defaultdict(list)
    for x in all_ids:
        component_map[find(x)].append(x)

    return component_map, pair_info


def find_dedupe_candidates(
    session=None,
    leads: list | None = None,
    min_confidence: float = 0.7,
    limit: int | None = None,
):
    from app.models import Lead

    if leads is None:
        if session is None:
            raise ValueError("Either session or leads must be provided")
        rows = session.query(Lead).all()
        leads_list = rows
    else:
        leads_list = leads

    lead_data: list[dict] = []
    for lead in leads_list:
        if isinstance(lead, Lead):
            lid = int(lead.id)
            fullname = (
                (getattr(lead, "full_name", None) or "").strip()
                or f"{getattr(lead, 'first_name', '') or ''} {getattr(lead, 'last_name', '') or ''}".strip()
            )
            lead_data.append(
                {
                    "id": lid,
                    "record_id": getattr(lead, "record_id", None),
                    "full_name": fullname,
                    "company_name": getattr(lead, "company_name", "") or "",
                    "email": getattr(lead, "email", "") or "",
                    "phone_digits": getattr(lead, "phone_digits", "") or "",
                    "country": getattr(lead, "country", "") or "",
                }
            )
        else:
            lid = int(lead.get("id"))
            fullname = (
                (lead.get("full_name") or "").strip()
                or f"{lead.get('first_name','') or ''} {lead.get('last_name','') or ''}".strip()
            )
            lead_data.append(
                {
                    "id": lid,
                    "record_id": lead.get("record_id"),
                    "full_name": fullname,
                    "company_name": lead.get("company_name") or "",
                    "email": lead.get("email") or "",
                    "phone_digits": lead.get("phone_digits") or "",
                    "country": lead.get("country") or "",
                }
            )

    id_to_data = {d["id"]: d for d in lead_data}

    block_a: dict[str, list[int]] = defaultdict(list)
    block_b: dict[tuple[str, str], list[int]] = defaultdict(list)
    block_c: dict[str, list[int]] = defaultdict(list)
    block_d: dict[str, list[int]] = defaultdict(list)

    for d in lead_data:
        pd = d["phone_digits"]
        if pd and len(pd) >= 5:
            block_a[pd].append(d["id"])

        localpart = _email_localpart(d["email"])
        fname = (d["full_name"].strip() or "").split()
        first_initial = fname[0][0].lower() if fname and fname[0] else ""
        if localpart and first_initial:
            block_b[(localpart, first_initial)].append(d["id"])

        ct = normalize_company_tokens(d["company_name"])[:3]
        cp = (d["country"] or "")[:2].lower()
        if ct and cp:
            block_c[ct + cp].append(d["id"])

        em = (d["email"] or "").strip().lower()
        if em and "@" in em:
            block_d[em].append(d["id"])

    groups_a = [g for g in block_a.values() if len(g) > 1]
    groups_b = [g for g in block_b.values() if len(g) > 1]
    groups_c = [g for g in block_c.values() if len(g) > 1]
    groups_d = [g for g in block_d.values() if len(g) > 1]

    pairs = _build_pairs_from_groups(groups_a + groups_b + groups_c + groups_d)

    pairs_with_confidence: list[tuple[int, int, float, str]] = []
    for a_id, b_id in pairs:
        la = id_to_data[a_id]
        lb = id_to_data[b_id]

        name_a = la["full_name"] or ""
        name_b = lb["full_name"] or ""
        score_name = fuzz.token_sort_ratio(name_a, name_b) if (name_a and name_b) else 0.0

        comp_a = normalize_company_tokens(la["company_name"])
        comp_b = normalize_company_tokens(lb["company_name"])
        score_company = fuzz.ratio(comp_a, comp_b) if (comp_a and comp_b) else 0.0

        lp_a = _email_localpart(la["email"])
        lp_b = _email_localpart(lb["email"])
        score_email = fuzz.ratio(lp_a, lp_b) if (lp_a and lp_b) else 0.0

        confidence = (0.35 * score_name + 0.35 * score_company + 0.3 * score_email) / 100.0

        phone_identical = bool(la["phone_digits"]) and la["phone_digits"] == lb["phone_digits"]
        if phone_identical:
            confidence = min(1.0, confidence * 1.1)

        if confidence >= min_confidence:
            exp = (
                f"Match signals: phone_identical={'true' if phone_identical else 'false'}, "
                f"name_sim={int(round(score_name))}%, company_sim={int(round(score_company))}%"
            )
            pairs_with_confidence.append((a_id, b_id, confidence, exp))

    component_map, pair_info = _union_find_components(pairs_with_confidence)

    groups_out: list[dict] = []
    for comp_id, members in enumerate(component_map.values(), start=1):
        member_sorted = sorted(members)
        max_conf = 0.0
        best_exp = ""
        for i in range(len(member_sorted)):
            for j in range(i + 1, len(member_sorted)):
                key = (member_sorted[i], member_sorted[j])
                if key in pair_info:
                    c, e = pair_info[key]
                    if c > max_conf:
                        max_conf = c
                        best_exp = e

        leads_preview = []
        for mid in member_sorted:
            md = id_to_data[mid]
            leads_preview.append(
                {
                    "id": mid,
                    "name": md["full_name"],
                    "email": md["email"],
                    "company": md["company_name"],
                }
            )

        groups_out.append(
            {
                "group_id": comp_id,
                "confidence": round(float(max_conf), 4),
                "lead_ids": member_sorted,
                "explanation": best_exp,
                "leads_preview": leads_preview,
            }
        )

    groups_out.sort(key=lambda g: g["confidence"], reverse=True)

    if limit is not None:
        groups_out = groups_out[:limit]

    return groups_out, pairs
