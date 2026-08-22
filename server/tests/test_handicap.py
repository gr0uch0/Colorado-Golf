"""WHS / USGA Handicap Index unit tests.

Fixtures marked USGA are taken from the Rules of Handicapping (effective 2024)
and published USGA FAQ examples.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from server.handicap import (
    NOT_ESTABLISHED_MESSAGE,
    ScoringRound,
    adjusted_gross_score,
    apply_low_hi_caps,
    course_handicap,
    course_handicap_unrounded,
    exceptional_score_reduction,
    handicap_index,
    net_double_bogey_cap,
    playing_handicap,
    rebuild_scoring_record,
    round_nearest_int_half_up,
    round_tenth,
    score_differential,
    score_differential_raw,
    strokes_on_hole,
)


def _dt(days: int = 0) -> datetime:
    return datetime(2026, 1, 15, tzinfo=timezone.utc) + timedelta(days=days)


def _round(
    n: int,
    differential: float,
    *,
    holes: int = 18,
    course_id: str = "c1",
    days: int = 0,
    raw: float | None = None,
) -> ScoringRound:
    return ScoringRound(
        id=n,
        course_id=course_id,
        played_at=_dt(days),
        holes=holes,
        differential=differential,
        differential_raw=raw if raw is not None else differential,
    )


class TestRounding:
    def test_positive_half_up_tenth(self):
        assert round_tenth(1.54) == 1.5
        assert round_tenth(1.55) == 1.6
        assert round_tenth(1.56) == 1.6

    def test_rule_5_1c_minus_differentials(self):
        # USGA Rule 5.1c worked examples.
        assert round_tenth(-1.54) == -1.5
        assert round_tenth(-1.55) == -1.5
        assert round_tenth(-1.56) == -1.6

    def test_half_up_int_toward_plus_infinity(self):
        assert round_nearest_int_half_up(11.5) == 12
        assert round_nearest_int_half_up(11.4) == 11
        assert round_nearest_int_half_up(-1.5) == -1
        assert round_nearest_int_half_up(-1.6) == -2


class TestScoreDifferential:
    def test_eighteen_hole_pcc_zero(self):
        # (113/125) × (85 − 71.3 − 0) = 12.3928 → 12.4
        assert score_differential(85, 71.3, 125) == 12.4

    def test_nine_hole_uses_half_pcc(self):
        raw_18 = score_differential_raw(42, 35.1, 119, pcc=2.0, holes=18)
        raw_9 = score_differential_raw(42, 35.1, 119, pcc=2.0, holes=9)
        assert abs(raw_9 - (113 / 119) * (42 - 35.1 - 1.0)) < 1e-9
        assert raw_18 != raw_9

    def test_default_pcc_is_zero(self):
        a = score_differential(90, 72.0, 113)
        b = score_differential(90, 72.0, 113, pcc=0)
        assert a == b == 18.0


class TestNetDoubleBogey:
    def test_strokes_allocated_from_si_1(self):
        assert strokes_on_hole(11, 1, 18) == 1
        assert strokes_on_hole(11, 11, 18) == 1
        assert strokes_on_hole(11, 12, 18) == 0

    def test_plus_handicap_gives_strokes_back(self):
        # CH −2: give strokes on SI 18 and 17.
        assert strokes_on_hole(-2, 18, 18) == -1
        assert strokes_on_hole(-2, 17, 18) == -1
        assert strokes_on_hole(-2, 16, 18) == 0

    def test_cap_par_plus_two_plus_strokes(self):
        assert net_double_bogey_cap(4, 11, 1, 18) == 7
        assert net_double_bogey_cap(4, 11, 18, 18) == 6
        assert net_double_bogey_cap(3, 0, 1, 18) == 5

    def test_adjusted_gross_caps_blow_up_holes(self):
        scores = [4, 4, 4, 10, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
        pars = [4] * 18
        si = list(range(1, 19))
        # 17×4 + 10 = 78; CH 0 → NDB = par+2 = 6, so the 10 becomes 6 (saves 4).
        assert sum(scores) == 78
        assert adjusted_gross_score(scores, pars, si, course_handicap=0) == 74


class TestHandicapIndexTable:
    """USGA Rule 5.2a worked examples."""

    def test_fewer_than_three_not_established(self):
        result = handicap_index([12.4, 13.1])
        assert result.handicap_index is None
        assert result.established is False
        assert result.message == NOT_ESTABLISHED_MESSAGE

    def test_three_scores_lowest_minus_2(self):
        # Rule 5.2a/1: 15.3, 15.2, 16.6 → 15.2 − 2.0 = 13.2
        result = handicap_index([15.3, 15.2, 16.6])
        assert result.handicap_index == 13.2
        assert result.used_count == 1
        assert result.table_adjustment == -2.0

    def test_three_scores_second_usga_example(self):
        # Rule 5.2a/2 first three: 40.7, 42.4, 36.1 → 36.1 − 2.0 = 34.1
        result = handicap_index([40.7, 42.4, 36.1])
        assert result.handicap_index == 34.1

    def test_six_scores_avg_lowest_two_minus_1(self):
        # Rule 5.2a/2 after six: avg(36.1, 40.7)=38.4 − 1.0 = 37.4
        result = handicap_index([40.7, 42.4, 36.1, 45.9, 43.6, 45.0])
        assert result.handicap_index == 37.4
        assert result.used_count == 2
        assert result.table_adjustment == -1.0

    def test_five_scores_no_adjustment(self):
        result = handicap_index([10.0, 12.0, 11.0, 20.0, 18.0])
        assert result.used_count == 1
        assert result.table_adjustment == 0.0
        assert result.handicap_index == 10.0

    def test_twenty_uses_lowest_eight(self):
        diffs = [20.0] * 12 + [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0]
        result = handicap_index(diffs)
        assert result.used_count == 8
        assert result.table_adjustment == 0.0
        assert result.handicap_index == round_tenth(sum([10, 11, 12, 13, 14, 15, 16, 17]) / 8)

    def test_used_indices_are_the_lowest(self):
        result = handicap_index([15.3, 15.2, 16.6])
        assert result.used_indices == (1,)


class TestCaps:
    def test_soft_cap_usga_example(self):
        # USGA: Low HI 10.0, 8-of-20 average 14.0 → 13.5
        capped, soft, hard = apply_low_hi_caps(14.0, 10.0)
        assert capped == 13.5
        assert soft is True
        assert hard is False

    def test_hard_cap_at_five_above_low(self):
        # Low 10.0, average 18.0 → soft 15.5 then hard 15.0
        capped, soft, hard = apply_low_hi_caps(18.0, 10.0)
        assert capped == 15.0
        assert soft is True
        assert hard is True

    def test_no_cap_when_increase_within_three(self):
        capped, soft, hard = apply_low_hi_caps(12.5, 10.0)
        assert capped == 12.5
        assert not soft and not hard

    def test_no_cap_without_low_hi(self):
        result = handicap_index([14.0] * 6, low_handicap_index_365d=None)
        assert result.soft_cap_applied is False
        assert result.hard_cap_applied is False

    def test_handicap_index_applies_soft_cap(self):
        diffs = [14.0] * 20
        result = handicap_index(diffs, low_handicap_index_365d=10.0)
        assert result.handicap_index == 13.5
        assert result.soft_cap_applied is True
        assert result.hard_cap_applied is False


class TestExceptionalScoreReduction:
    def test_rule_5_9_thresholds(self):
        # SCGA/USGA example: HI 11.7, SD 4.5 → 7.2 better → −1.0
        assert exceptional_score_reduction(4.5, 11.7) == -1.0
        # HI 11.7, SD 0.9 → 10.8 better → −2.0
        assert exceptional_score_reduction(0.9, 11.7) == -2.0
        assert exceptional_score_reduction(5.0, 11.7) == 0.0
        assert exceptional_score_reduction(4.7, None) == 0.0

    def test_seven_oh_is_exceptional(self):
        assert exceptional_score_reduction(5.0, 12.0) == -1.0

    def test_nine_point_nine_is_minus_one_not_two(self):
        assert exceptional_score_reduction(2.1, 12.0) == -1.0

    def test_ten_oh_is_minus_two(self):
        assert exceptional_score_reduction(2.0, 12.0) == -2.0

    def test_rebuild_applies_minus_one_to_window(self):
        rounds = [_round(i, 15.0, days=i) for i in range(8)]
        rounds.append(_round(8, 7.0, days=8, raw=7.0))
        state = rebuild_scoring_record(rounds)
        # 8 scores of 15.0 → HI = avg lowest 2 = 15.0
        # 9th SD 7.0 is 8.0 better → ESR −1.0 on all 9
        assert state.result.exceptional_score_applied is True
        assert all(r.esr_adjustment == -1.0 for r in state.rounds)
        # 9 scores, lowest 3 of (14,14,...,6) = 6, 14, 14 → avg 11.333 → 11.3
        assert state.result.handicap_index == 11.3


class TestCourseAndPlayingHandicap:
    def test_course_handicap_formula(self):
        # HI 12.7, slope 125, CR 71.2, par 72
        # 12.7 × (125/113) + (71.2 − 72) = 13.24867… → 13
        unrounded = course_handicap_unrounded(12.7, 125, 71.2, 72)
        assert abs(unrounded - 13.248672566) < 1e-6
        assert course_handicap(12.7, 125, 71.2, 72) == 13

    def test_playing_handicap_uses_unrounded_and_allowance(self):
        unrounded = course_handicap_unrounded(12.7, 125, 71.2, 72)
        assert playing_handicap(unrounded, allowance=1.0) == 13
        assert playing_handicap(unrounded, allowance=0.85) == 11

    def test_nine_hole_course_handicap_halves_index(self):
        # (12.7 / 2) × (119/113) + (35.1 − 36)
        ch = course_handicap(12.7, 119, 35.1, 36, holes=9)
        unrounded = course_handicap_unrounded(12.7, 119, 35.1, 36, holes=9)
        assert ch == round_nearest_int_half_up(unrounded)
        assert unrounded < course_handicap_unrounded(12.7, 119, 35.1, 36, holes=18)


class TestRebuildRecord:
    def test_nine_hole_pairing(self):
        rounds = [
            _round(1, 7.2, holes=9, days=0, raw=7.21),
            _round(2, 8.1, holes=9, days=1, raw=8.14),
            _round(3, 15.0, holes=18, days=2),
        ]
        state = rebuild_scoring_record(rounds)
        # Combined 9s ≈ 15.35 → 15.4 plus 15.0; 2 diffs → not established
        assert state.result.established is False
        extra = _round(4, 14.0, days=3)
        state = rebuild_scoring_record(rounds + [extra])
        assert state.result.established is True
        # 3 equivalents (paired 9s + two 18s); lowest 1 is the 14.0 round.
        assert state.rounds[3].counting is True
        assert state.result.handicap_index == 12.0

    def test_unpaired_nine_does_not_establish(self):
        rounds = [
            _round(1, 10.0, holes=18, days=0),
            _round(2, 11.0, holes=18, days=1),
            _round(3, 8.0, holes=9, days=2),
        ]
        state = rebuild_scoring_record(rounds)
        assert state.result.established is False
        assert state.rounds[2].unpaired_nine is True
        assert state.rounds[2].counting is False

    def test_low_hi_and_soft_cap_after_twenty(self):
        good = [_round(i, 10.0, days=i) for i in range(20)]
        worse = _round(20, 30.0, days=20)
        state = rebuild_scoring_record(good + [worse])
        assert state.result.low_handicap_index == 10.0
        # 8 of 20 after posting 30: still eight 10.0s in the 21-round window
        # of most recent 20 (dropped the oldest 10, added 30) → still 10.0
        assert state.result.soft_cap_applied is False

    def test_hard_cap_when_eight_of_twenty_jump(self):
        # 20 scores at 10.0, then 20 at 20.0 so the rolling 8-of-20 is 20.0.
        early = [_round(i, 10.0, days=i) for i in range(20)]
        later = [_round(20 + i, 20.0, days=20 + i) for i in range(20)]
        state = rebuild_scoring_record(early + later)
        assert state.result.hard_cap_applied is True
        assert state.result.handicap_index == 15.0
        assert state.result.low_handicap_index == 10.0

    def test_home_course_is_most_played(self):
        rounds = [
            _round(1, 12.0, course_id="a", days=0),
            _round(2, 12.0, course_id="b", days=1),
            _round(3, 12.0, course_id="a", days=2),
        ]
        state = rebuild_scoring_record(rounds)
        assert state.home_course_id == "a"
