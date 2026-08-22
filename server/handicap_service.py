"""Post scores into the WHS scoring record and recompute Handicap Index.

Existing course_progress rows are never deleted. A round is posted only when:
- the scorecard is a complete 9- or 18-hole card (27-hole cards are skipped)
- the course has stored Course Rating and Slope (never the 113/72 defaults)
"""

from __future__ import annotations

from typing import Any

from server.db import (
    get_user_by_username,
    list_all_rounds,
    list_approved_users,
    list_rounds_for_user,
    load_course_hole_counts,
    load_course_hole_pars,
    load_course_hole_stroke_index,
    load_course_whs_ratings,
    save_user_handicap_state,
    update_round_handicap_fields,
    upsert_round,
    user_public_dict,
)
from server.handicap import (
    DEFAULT_HANDICAP_ALLOWANCE,
    DEFAULT_PCC,
    NOT_ESTABLISHED_MESSAGE,
    ScoringRound,
    adjusted_gross_score,
    course_handicap_unrounded,
    format_handicap,
    parse_played_at,
    playing_handicap,
    rebuild_scoring_record,
    round_nearest_int_half_up,
    round_tenth,
    score_differential_raw,
)


def _complete_scores(values: Any, holes: int) -> list[int] | None:
    if not isinstance(values, list) or len(values) != holes:
        return None
    out: list[int] = []
    for value in values:
        if value is None or value == "":
            return None
        try:
            n = int(value)
        except (TypeError, ValueError):
            return None
        if n < 1:
            return None
        out.append(n)
    return out


def try_post_round_from_progress(
    username: str,
    course_id: str,
    entry: dict[str, Any],
) -> dict[str, Any]:
    """Create/update a handicap round from a saved scorecard. Never guesses ratings."""
    hole_counts = load_course_hole_counts()
    holes = hole_counts.get(course_id)
    if holes == 27:
        return {"posted": False, "reason": "27-hole cards are not posted for handicap yet."}
    scores_raw = entry.get("holeScores") or entry.get("hole_scores")
    if holes not in (9, 18):
        if isinstance(scores_raw, list) and len(scores_raw) in (9, 18):
            holes = len(scores_raw)
        else:
            return {"posted": False, "reason": "Need a 9- or 18-hole course to post."}

    scores = _complete_scores(scores_raw, holes)
    if scores is None:
        return {"posted": False, "reason": "Scorecard is incomplete."}

    ratings = load_course_whs_ratings().get(course_id) or {}
    course_rating = ratings.get("courseRating")
    slope_rating = ratings.get("slopeRating")
    if course_rating is None or slope_rating is None:
        return {
            "posted": False,
            "reason": "Course Rating and Slope must be saved on this course before a score can count toward handicap.",
        }

    pars = load_course_hole_pars().get(course_id)
    stroke_index = load_course_hole_stroke_index().get(course_id)
    ndb = (
        isinstance(pars, list)
        and isinstance(stroke_index, list)
        and len(pars) == holes
        and len(stroke_index) == holes
    )
    par = int(sum(pars)) if ndb else ratings.get("par")
    if par is None:
        return {
            "posted": False,
            "reason": "Course par (or per-hole pars) must be saved before posting.",
        }
    par = int(round(float(par)))

    user = get_user_by_username(username)
    if not user:
        return {"posted": False, "reason": "User not found."}
    public = user_public_dict(user)
    hi_for_ch = public.get("computedHandicapIndex")
    if hi_for_ch is None:
        hi_for_ch = public.get("seedHandicap")

    if hi_for_ch is None:
        ch_unrounded = 0.0
        ch_rounded = 0
    else:
        ch_unrounded = course_handicap_unrounded(
            float(hi_for_ch),
            float(slope_rating),
            float(course_rating),
            par,
            holes=holes,
        )
        ch_rounded = round_nearest_int_half_up(ch_unrounded)

    if ndb:
        ags = adjusted_gross_score(scores, pars, stroke_index, ch_rounded, holes)
    else:
        # Hole-by-hole exists but par/SI are not stored — do not invent SI 1..n.
        ags = sum(scores)

    gross = sum(scores)
    sd_raw = score_differential_raw(
        ags, float(course_rating), float(slope_rating), pcc=DEFAULT_PCC, holes=holes
    )
    sd = round_tenth(sd_raw)
    allowance = float(entry.get("handicapAllowance") or DEFAULT_HANDICAP_ALLOWANCE)
    played_at = entry.get("playedAt") or entry.get("played_at")
    if not played_at:
        from datetime import datetime, timezone

        played_at = datetime.now(timezone.utc).isoformat()

    upsert_round(
        {
            "username": username,
            "course_id": course_id,
            "played_at": str(played_at),
            "holes": holes,
            "hole_scores": scores,
            "gross": gross,
            "adjusted_gross": ags,
            "course_rating": float(course_rating),
            "slope_rating": int(slope_rating),
            "par": par,
            "pcc": DEFAULT_PCC,
            "format": str(entry.get("format") or "stroke"),
            "handicap_allowance": allowance,
            "score_differential": sd,
            "score_differential_raw": sd_raw,
            "ndb_applied": ndb,
            "handicap_index_at_play": hi_for_ch,
            "course_handicap_unrounded": ch_unrounded,
            "course_handicap": ch_rounded,
            "playing_handicap": playing_handicap(ch_unrounded, allowance),
        }
    )
    recompute_player_handicap(username)
    return {"posted": True, "reason": None}


def recompute_player_handicap(username: str) -> None:
    stored = list_rounds_for_user(username)
    scoring = [
        ScoringRound(
            id=r["id"],
            course_id=r["courseId"],
            played_at=parse_played_at(r["playedAt"]),
            holes=r["holes"],
            differential=r["scoreDifferential"],
            differential_raw=r["scoreDifferentialRaw"],
        )
        for r in stored
    ]
    state = rebuild_scoring_record(scoring)
    ratings = load_course_whs_ratings()
    hole_pars = load_course_hole_pars()
    hole_counts = load_course_hole_counts()

    home_id = state.home_course_id
    home_ch = None
    home_ph = None
    hi = state.result.handicap_index
    if hi is not None and home_id:
        info = ratings.get(home_id) or {}
        cr = info.get("courseRating")
        slope = info.get("slopeRating")
        holes = hole_counts.get(home_id) or info.get("holeCount") or 18
        if holes == 27:
            holes = 18
        pars = hole_pars.get(home_id)
        if pars and holes in (9, 18) and len(pars) == holes:
            par = sum(pars)
        else:
            par = info.get("par")
        if cr is not None and slope is not None and par is not None and holes in (9, 18):
            unrounded = course_handicap_unrounded(hi, slope, cr, par, holes=holes)
            home_ch = round_nearest_int_half_up(unrounded)
            home_ph = playing_handicap(unrounded, DEFAULT_HANDICAP_ALLOWANCE)

    trend = [
        {
            "playedAt": point.played_at.isoformat(),
            "handicapIndex": point.handicap_index,
            "courseId": point.course_id,
        }
        for point in state.trend
    ]
    save_user_handicap_state(
        username,
        computed_index=state.result.handicap_index,
        low_index=state.result.low_handicap_index,
        soft_cap=state.result.soft_cap_applied,
        hard_cap=state.result.hard_cap_applied,
        exceptional=state.result.exceptional_score_applied,
        home_course_id=home_id,
        home_course_handicap=home_ch,
        home_playing_handicap=home_ph,
        trend=trend,
    )
    for rnd in state.rounds:
        if rnd.id is None:
            continue
        update_round_handicap_fields(
            rnd.id,
            esr_adjustment=rnd.esr_adjustment,
            counting=rnd.counting,
            handicap_index_at_play=rnd.handicap_index_at_play,
            handicap_index_after=rnd.handicap_index_after,
        )


def handicap_payload_for_state() -> dict[str, Any]:
    """Per-user handicap block for GET /api/state."""
    by_user: dict[str, list[dict[str, Any]]] = {}
    for rnd in list_all_rounds():
        by_user.setdefault(rnd["username"], []).append(rnd)

    members = {m["username"]: m for m in list_approved_users()}
    out: dict[str, Any] = {}
    for username, member in members.items():
        rounds = by_user.get(username, [])
        out[username] = {
            **_member_handicap_fields(member),
            "rounds": rounds,
            "notEstablishedReason": None
            if member.get("handicapEstablished")
            else NOT_ESTABLISHED_MESSAGE,
        }
    return out


def _member_handicap_fields(member: dict[str, Any]) -> dict[str, Any]:
    return {
        "handicapIndex": member.get("handicap"),
        "handicapDisplay": member.get("handicapDisplay"),
        "computedHandicapIndex": member.get("computedHandicapIndex"),
        "seedHandicap": member.get("seedHandicap"),
        "handicapSource": member.get("handicapSource"),
        "established": bool(member.get("handicapEstablished")),
        "lowHandicapIndex": member.get("lowHandicapIndex"),
        "lowHandicapIndexDisplay": member.get("lowHandicapIndexDisplay"),
        "softCapApplied": bool(member.get("softCapApplied")),
        "hardCapApplied": bool(member.get("hardCapApplied")),
        "exceptionalScoreApplied": bool(member.get("exceptionalScoreApplied")),
        "homeCourseId": member.get("homeCourseId"),
        "courseHandicap": member.get("homeCourseHandicap"),
        "playingHandicap": member.get("homePlayingHandicap"),
        "trend": member.get("handicapTrend") or [],
        "courseHandicapDisplay": format_handicap(member.get("homeCourseHandicap")),
        "playingHandicapDisplay": format_handicap(member.get("homePlayingHandicap")),
    }
