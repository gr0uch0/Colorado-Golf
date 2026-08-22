"""World Handicap System (WHS / USGA) calculations.

Pure functions only — no I/O. Rules referenced:
- Score Differential: Rule 5.1a / 5.1b
- Handicap Index (fewer than 20): Rule 5.2a
- Low Handicap Index + caps: Rules 5.7 / 5.8
- Exceptional Score Reduction: Rule 5.9 (7.0–9.9 → −1.0, 10.0+ → −2.0)
- Course / Playing Handicap: Rule 6.1 / 6.2a

PCC (Playing Conditions Calculation) is not implemented for this casual
friend group. DEFAULT_PCC is the hook to wire it in later.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from decimal import ROUND_FLOOR, ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal
from typing import Iterable, Sequence

HANDICAP_MIN = -10.0
HANDICAP_MAX = 54.0

# Playing Conditions Calculation — not computed for friend rounds.
# Full PCC (Rule 5.6) adjusts from −1.0 to +3.0 based on a field of scores
# on the same day at the same course. Leave at 0 until that is implemented.
DEFAULT_PCC = 0.0

# 100% individual stroke play among friends (WHS Appendix C).
DEFAULT_HANDICAP_ALLOWANCE = 1.0

# v1: two 9-hole Score Differentials are added to form one 18-hole equivalent
# (pre-2024 combining). WHS 2024 Rule 5.1b instead combines a 9-hole SD with
# an expected 9-hole SD from the player's Index; that table is not in this
# module. Flip this to "expected_score" when that hook is implemented.
NINE_HOLE_18_EQUIVALENT_MODE = "pair"

NOT_ESTABLISHED_MESSAGE = (
    "Not yet established — 3 acceptable 18-hole rounds "
    "(or 9-hole rounds pairing to that many holes) are required."
)

# Rule 5.2a: (# of 18-hole differentials available) → (how many lowest, adjustment)
_HI_TABLE: dict[int, tuple[int, float]] = {
    3: (1, -2.0),
    4: (1, -1.0),
    5: (1, 0.0),
    6: (2, -1.0),
    7: (2, 0.0),
    8: (2, 0.0),
    9: (3, 0.0),
    10: (3, 0.0),
    11: (3, 0.0),
    12: (4, 0.0),
    13: (4, 0.0),
    14: (4, 0.0),
    15: (5, 0.0),
    16: (5, 0.0),
    17: (6, 0.0),
    18: (6, 0.0),
    19: (7, 0.0),
    20: (8, 0.0),
}


def parse_handicap(value: str | float | int | None) -> float | None:
    """Parse USGA Handicap Index; plus handicaps use a leading + (stored negative)."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        plus = False
    else:
        s = str(value).strip()
        if not s:
            return None
        plus = s.startswith("+")
        if plus:
            s = s[1:].strip()
        if not s:
            return None
        try:
            num = float(s)
        except ValueError as e:
            raise ValueError(
                "Handicap must be a number, or use + for plus handicaps (e.g. +2.1)."
            ) from e
    if plus:
        num = -abs(num)
    if num < HANDICAP_MIN or num > HANDICAP_MAX:
        raise ValueError(
            f"Handicap index must be between +{abs(HANDICAP_MIN):g} and {HANDICAP_MAX:g}."
        )
    return round_tenth(num)


def format_handicap(value: float | None) -> str | None:
    if value is None:
        return None
    num = float(value)
    if num < 0:
        return f"+{abs(num):g}"
    return f"{num:g}"


def round_tenth(value: float) -> float:
    """Round to 1 decimal.

    Positive values: .5 rounds away from 0 (1.55 → 1.6).
    Negative Score Differentials (Rule 5.1c): .5 rounds toward 0
    (−1.55 → −1.5, −1.56 → −1.6).
    """
    d = Decimal(str(value))
    quant = Decimal("0.1")
    rounding = ROUND_HALF_DOWN if value < 0 else ROUND_HALF_UP
    return float(d.quantize(quant, rounding=rounding))


def round_nearest_int_half_up(value: float) -> int:
    """Round 0.5 upwards toward +infinity: 1.5 → 2, −1.5 → −1."""
    d = Decimal(str(value)) + Decimal("0.5")
    return int(d.to_integral_value(rounding=ROUND_FLOOR))


# --- Score Differential -----------------------------------------------------


def score_differential(
    adjusted_gross_score: float,
    course_rating: float,
    slope_rating: float,
    pcc: float = DEFAULT_PCC,
    holes: int = 18,
) -> float:
    """18- or 9-hole Score Differential, rounded to one decimal (Rule 5.1).

    18-hole: (113 / Slope) × (AGS − Course Rating − PCC)
    9-hole:  (113 / Slope) × (AGS − Course Rating − 0.5 × PCC)
    """
    return round_tenth(
        score_differential_raw(
            adjusted_gross_score, course_rating, slope_rating, pcc=pcc, holes=holes
        )
    )


def score_differential_raw(
    adjusted_gross_score: float,
    course_rating: float,
    slope_rating: float,
    pcc: float = DEFAULT_PCC,
    holes: int = 18,
) -> float:
    if slope_rating <= 0:
        raise ValueError("Slope Rating must be greater than 0.")
    if holes not in (9, 18):
        raise ValueError("holes must be 9 or 18.")
    pcc_term = float(pcc) if holes == 18 else 0.5 * float(pcc)
    return (113.0 / float(slope_rating)) * (
        float(adjusted_gross_score) - float(course_rating) - pcc_term
    )


# --- Net Double Bogey -------------------------------------------------------


def strokes_on_hole(
    course_handicap: int, stroke_index: int, hole_count: int = 18
) -> int:
    """Stroke allocation from Course Handicap and hole stroke index.

    Positive CH: extra strokes from SI 1 (hardest) upward.
    Plus (negative) CH: strokes given back from SI 18 (easiest) downward.
    """
    count = max(1, int(hole_count))
    si = int(stroke_index)
    ch = int(course_handicap)
    if ch == 0:
        return 0
    abs_ch = abs(ch)
    full_rounds = abs_ch // count
    remainder = abs_ch % count
    if ch > 0:
        extra = 1 if si <= remainder else 0
        return full_rounds + extra
    extra = 1 if remainder and si >= (count - remainder + 1) else 0
    return -(full_rounds + extra)


def net_double_bogey_cap(
    hole_par: int,
    course_handicap: int,
    stroke_index: int,
    hole_count: int = 18,
) -> int:
    """Max hole score for handicap: Par + 2 + strokes received on that hole."""
    return int(hole_par) + 2 + strokes_on_hole(course_handicap, stroke_index, hole_count)


def adjusted_gross_score(
    hole_scores: Sequence[int],
    hole_pars: Sequence[int],
    stroke_indexes: Sequence[int],
    course_handicap: int,
    hole_count: int | None = None,
) -> int:
    """Sum of hole scores after Net Double Bogey cap (Rule 3.1b)."""
    n = hole_count if hole_count is not None else len(hole_scores)
    if len(hole_scores) != n or len(hole_pars) != n or len(stroke_indexes) != n:
        raise ValueError("hole scores, pars, and stroke indexes must match hole count.")
    total = 0
    for score, par, si in zip(hole_scores, hole_pars, stroke_indexes, strict=True):
        cap = net_double_bogey_cap(par, course_handicap, si, n)
        total += min(int(score), cap)
    return total


# --- Course / Playing Handicap ----------------------------------------------


def course_handicap(
    handicap_index: float,
    slope_rating: float,
    course_rating: float,
    par: float,
    holes: int = 18,
) -> int:
    """Rounded Course Handicap (Rule 6.1). Use unrounded value for Playing Handicap."""
    return round_nearest_int_half_up(
        course_handicap_unrounded(
            handicap_index, slope_rating, course_rating, par, holes=holes
        )
    )


def course_handicap_unrounded(
    handicap_index: float,
    slope_rating: float,
    course_rating: float,
    par: float,
    holes: int = 18,
) -> float:
    slope = float(slope_rating)
    if holes == 9:
        return (float(handicap_index) / 2.0) * (slope / 113.0) + (
            float(course_rating) - float(par)
        )
    return float(handicap_index) * (slope / 113.0) + (float(course_rating) - float(par))


def playing_handicap(
    course_handicap_value: float, allowance: float = DEFAULT_HANDICAP_ALLOWANCE
) -> int:
    """Playing Handicap = unrounded Course Handicap × allowance, .5 rounded up (Rule 6.2a)."""
    return round_nearest_int_half_up(float(course_handicap_value) * float(allowance))


# --- Exceptional Score Reduction (Rule 5.9) ---------------------------------


def exceptional_score_reduction(
    score_differential_raw: float, handicap_index_at_play: float | None
) -> float:
    """Return −1.0, −2.0, or 0.0. Comparison uses the unrounded differential."""
    if handicap_index_at_play is None:
        return 0.0
    better_by = float(handicap_index_at_play) - float(score_differential_raw)
    if better_by >= 10.0:
        return -2.0
    if better_by >= 7.0:
        return -1.0
    return 0.0


# --- Handicap Index (Rule 5.2a + 5.8 caps) ----------------------------------


@dataclass(frozen=True)
class HandicapIndexResult:
    handicap_index: float | None
    established: bool
    used_count: int
    used_indices: tuple[int, ...]
    table_adjustment: float
    base_index: float | None
    low_handicap_index: float | None
    soft_cap_applied: bool
    hard_cap_applied: bool
    exceptional_score_applied: bool
    message: str | None = None


def _hi_table_lookup(n: int) -> tuple[int, float] | None:
    if n < 3:
        return None
    return _HI_TABLE.get(min(n, 20))


def handicap_index(
    differentials: list[float],
    low_handicap_index_365d: float | None = None,
    *,
    exceptional_score_applied: bool = False,
) -> HandicapIndexResult:
    """Compute Handicap Index from the most recent ≤20 (ESR-adjusted) differentials.

    `differentials` should already be in most-recent-last or any order; the
    lowest N of the list are used per Rule 5.2a. Pass at most 20 values
    (the scoring record's most recent 20). Caps apply only when
    `low_handicap_index_365d` is set (Low HI is established after 20 scores).
    """
    n = len(differentials)
    lookup = _hi_table_lookup(n)
    if lookup is None:
        return HandicapIndexResult(
            handicap_index=None,
            established=False,
            used_count=0,
            used_indices=(),
            table_adjustment=0.0,
            base_index=None,
            low_handicap_index=low_handicap_index_365d,
            soft_cap_applied=False,
            hard_cap_applied=False,
            exceptional_score_applied=exceptional_score_applied,
            message=NOT_ESTABLISHED_MESSAGE,
        )

    used_n, adjustment = lookup
    indexed = sorted(enumerate(differentials), key=lambda item: (item[1], item[0]))
    used = indexed[:used_n]
    used_indices = tuple(i for i, _ in used)
    avg = sum(v for _, v in used) / used_n
    base = round_tenth(avg + adjustment)
    if base > HANDICAP_MAX:
        base = HANDICAP_MAX

    capped, soft, hard = apply_low_hi_caps(base, low_handicap_index_365d)
    return HandicapIndexResult(
        handicap_index=capped,
        established=True,
        used_count=used_n,
        used_indices=used_indices,
        table_adjustment=adjustment,
        base_index=base,
        low_handicap_index=low_handicap_index_365d,
        soft_cap_applied=soft,
        hard_cap_applied=hard,
        exceptional_score_applied=exceptional_score_applied,
        message=None,
    )


def apply_low_hi_caps(
    base_index: float, low_handicap_index: float | None
) -> tuple[float, bool, bool]:
    """Soft cap (50% of increase beyond +3.0) then hard cap (+5.0). Rule 5.8."""
    if low_handicap_index is None:
        return base_index, False, False
    low = float(low_handicap_index)
    hi = float(base_index)
    soft = False
    hard = False
    delta = hi - low
    if delta > 3.0:
        excess = delta - 3.0
        hi = low + 3.0 + 0.5 * excess
        soft = True
    if hi - low > 5.0:
        hi = low + 5.0
        hard = True
    return round_tenth(hi), soft, hard


# --- Scoring-record rebuild (9-hole pairing, ESR, Low HI, which rounds count)


@dataclass
class ScoringRound:
    """One posted 9- or 18-hole score in a player's record."""

    id: int | None
    course_id: str
    played_at: datetime
    holes: int
    differential: float
    differential_raw: float
    esr_adjustment: float = 0.0
    counting: bool = False
    handicap_index_at_play: float | None = None
    handicap_index_after: float | None = None
    unpaired_nine: bool = False


@dataclass(frozen=True)
class TrendPoint:
    played_at: datetime
    handicap_index: float
    course_id: str
    round_ids: tuple[int | None, ...]


@dataclass
class PlayerHandicapState:
    result: HandicapIndexResult
    rounds: list[ScoringRound]
    trend: list[TrendPoint]
    home_course_id: str | None = None
    course_handicap: int | None = None
    playing_handicap: int | None = None
    course_handicap_unrounded: float | None = None


@dataclass
class _Equivalent:
    played_at: datetime
    differential: float
    differential_raw: float
    esr_adjustment: float = 0.0
    round_ids: tuple[int | None, ...] = ()
    course_ids: tuple[str, ...] = ()


def parse_played_at(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def rebuild_scoring_record(rounds: Iterable[ScoringRound]) -> PlayerHandicapState:
    """Replay a player's rounds in date order and apply WHS safeguards.

    9-hole rounds are paired in chronological order to 18-hole equivalents.
    An unpaired 9-hole round does not count toward the Index.
    """
    ordered = sorted(
        (replace(r, esr_adjustment=0.0, counting=False, unpaired_nine=False) for r in rounds),
        key=lambda r: (r.played_at, r.id or 0),
    )
    by_id: dict[int | None, ScoringRound] = {r.id: r for r in ordered}

    equivalents: list[_Equivalent] = []
    pending_nine: ScoringRound | None = None
    current_hi: float | None = None
    low_hi: float | None = None
    hi_history: list[tuple[datetime, float]] = []
    trend: list[TrendPoint] = []
    last_result = handicap_index([])

    def _flush_equivalent(eq: _Equivalent, hi_at_play: float | None) -> HandicapIndexResult:
        nonlocal current_hi, low_hi, last_result
        esr = exceptional_score_reduction(eq.differential_raw, hi_at_play)
        eq.esr_adjustment = 0.0
        window = equivalents[-19:] + [eq] if equivalents else [eq]
        if esr:
            for item in window:
                item.esr_adjustment += esr
        equivalents.append(eq)

        recent = equivalents[-20:]
        adjusted = [item.differential + item.esr_adjustment for item in recent]
        esr_flag = any(item.esr_adjustment != 0 for item in recent)
        caps_low = low_hi if len(equivalents) > 20 else None
        # Caps apply only after Low HI is established (20 acceptable scores).
        # On the 20th score Low HI is first set after this calculation.
        result = handicap_index(
            adjusted,
            caps_low,
            exceptional_score_applied=esr_flag,
        )
        if result.established and result.handicap_index is not None:
            current_hi = result.handicap_index
            if len(equivalents) >= 20:
                hi_history.append((eq.played_at, current_hi))
                window_start = eq.played_at - timedelta(days=365)
                window_vals = [hi for dt, hi in hi_history if dt >= window_start]
                low_hi = min(window_vals) if window_vals else current_hi
                result = replace(result, low_handicap_index=low_hi)
            last_result = result
            trend.append(
                TrendPoint(
                    played_at=eq.played_at,
                    handicap_index=current_hi,
                    course_id=eq.course_ids[-1] if eq.course_ids else "",
                    round_ids=eq.round_ids,
                )
            )
        else:
            last_result = result
        for rid in eq.round_ids:
            rnd = by_id.get(rid)
            if rnd is None:
                continue
            rnd.handicap_index_at_play = hi_at_play
            rnd.handicap_index_after = current_hi
        return result

    for rnd in ordered:
        hi_at_play = current_hi
        rnd.handicap_index_at_play = hi_at_play
        if rnd.holes == 9:
            if pending_nine is None:
                pending_nine = rnd
                rnd.unpaired_nine = True
                continue
            raw = pending_nine.differential_raw + rnd.differential_raw
            eq = _Equivalent(
                played_at=rnd.played_at,
                differential=round_tenth(raw),
                differential_raw=raw,
                round_ids=(pending_nine.id, rnd.id),
                course_ids=(pending_nine.course_id, rnd.course_id),
            )
            pending_nine.unpaired_nine = False
            _flush_equivalent(eq, hi_at_play)
            pending_nine = None
            continue
        if rnd.holes != 18:
            continue
        eq = _Equivalent(
            played_at=rnd.played_at,
            differential=rnd.differential,
            differential_raw=rnd.differential_raw,
            round_ids=(rnd.id,),
            course_ids=(rnd.course_id,),
        )
        _flush_equivalent(eq, hi_at_play)

    # Copy final ESR (later exceptional scores adjust earlier rounds in the window).
    for item in equivalents:
        for rid in item.round_ids:
            rnd = by_id.get(rid)
            if rnd is not None:
                rnd.esr_adjustment = item.esr_adjustment

    # Mark which source rounds are in the used-N of the most recent 20 equivalents.
    recent = equivalents[-20:]
    if recent and last_result.established:
        used = set(last_result.used_indices)
        for idx, item in enumerate(recent):
            is_used = idx in used
            for rid in item.round_ids:
                rnd = by_id.get(rid)
                if rnd is not None:
                    rnd.counting = is_used

    home_course_id = _most_played_course(ordered)
    return PlayerHandicapState(
        result=last_result,
        rounds=ordered,
        trend=trend,
        home_course_id=home_course_id,
    )


def _most_played_course(rounds: Sequence[ScoringRound]) -> str | None:
    counts: dict[str, int] = {}
    for rnd in rounds:
        counts[rnd.course_id] = counts.get(rnd.course_id, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda item: (item[1], item[0]))[0]


def displayed_handicap_index(
    computed: float | None, seed: float | None
) -> tuple[float | None, str | None, str]:
    """Return (value, display string, source). Seed is used until an Index is established."""
    if computed is not None:
        return computed, format_handicap(computed), "computed"
    if seed is not None:
        return seed, format_handicap(seed), "seed"
    return None, "Not yet established", "none"
