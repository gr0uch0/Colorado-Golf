import { sumHoleScores } from './holeScores';
import { sumNetScores } from './netScore';

export function buildPlayerPlayedRounds(username, courses, progressByUser) {
  const userProgress = progressByUser?.[username] || {};
  const rounds = [];

  for (const course of courses || []) {
    const prog = userProgress[course.id];
    if (!prog?.played) continue;

    const detail = course.playedByDetail?.find((player) => player.username === username);
    const holeScores = detail?.holeScores ?? [];
    const courseHandicap = detail?.courseHandicap ?? null;
    const holeCount = course.holeCount;

    rounds.push({
      courseId: course.id,
      name: course.name,
      city: course.city,
      playedAt: prog.playedAt ?? null,
      gross: sumHoleScores(holeScores),
      net: sumNetScores(
        holeScores,
        course.holeStrokeIndex,
        courseHandicap,
        holeCount
      ),
      courseHandicapDisplay: detail?.courseHandicapDisplay ?? null,
    });
  }

  return rounds.sort((a, b) => {
    if (a.playedAt && b.playedAt) return b.playedAt.localeCompare(a.playedAt);
    if (a.playedAt) return -1;
    if (b.playedAt) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
