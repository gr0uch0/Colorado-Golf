import { normalizeHoleCount } from './holes';

export const HOLES_PER_ROW = 9;

export function holeLayoutBlocks(holeCount) {
  const count = normalizeHoleCount(holeCount);
  const blocks = [];
  for (let start = 0; start < count; start += HOLES_PER_ROW) {
    const end = Math.min(start + HOLES_PER_ROW, count);
    const holes = [];
    for (let hole = start + 1; hole <= end; hole += 1) {
      holes.push(hole);
    }
    blocks.push({
      label:
        holes.length === 1
          ? `Hole ${holes[0]}`
          : `Holes ${holes[0]}–${holes[holes.length - 1]}`,
      holes,
    });
  }
  return blocks;
}
