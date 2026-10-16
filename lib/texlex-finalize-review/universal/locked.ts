/** Refuse a proposal that would change a locked support level already written in the section. */
export function proposalChangesLockedLevel(
  current: string,
  next: string,
  levelA: number | null | undefined,
  levelB: number | null | undefined
): boolean {
  const locked = [levelA, levelB].filter((level): level is number => level === 1 || level === 2 || level === 3);
  if (!locked.length) return false;
  const levels = (text: string) =>
    [...text.matchAll(/level\s+([123])/gi)].map((match) => Number(match[1]));
  const before = levels(current);
  const after = levels(next);
  if (before.join(",") === after.join(",")) return false;
  return locked.some((level) => before.includes(level) && !after.includes(level));
}

/** Refuse a proposal that flips a written meets / does-not-meet statement. */
export function proposalFlipsConclusion(current: string, next: string): boolean {
  const doesNotMeet = /does not meet/i;
  const meets = /\bmeets criteria\b/i;
  if (doesNotMeet.test(current) && meets.test(next) && !doesNotMeet.test(next)) return true;
  if (meets.test(current) && !doesNotMeet.test(current) && doesNotMeet.test(next)) return true;
  return false;
}
