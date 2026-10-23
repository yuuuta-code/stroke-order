export const RECORD_KEY = 'kanji-challenge-v1';
export const rankNames = { none: '未合格', bronze: '銅', silver: '銀', gold: '金' };

export function loadRecords(storage, validCharacters) {
  try {
    const parsed = JSON.parse(storage.getItem(RECORD_KEY) || '{}');
    const records = {};
    for (const character of validCharacters) {
      const record = parsed?.[character];
      if (!record || !Number.isInteger(record.bestScore) || record.bestScore < 0 || record.bestScore > 100 ||
          !Number.isSafeInteger(record.attempts) || record.attempts < 1 || !Object.hasOwn(rankNames, record.bestRank)) continue;
      const expectedRank = record.bestScore >= 95 ? 'gold' : record.bestScore >= 90 ? 'silver' : record.bestScore >= 80 ? 'bronze' : 'none';
      if (record.bestRank !== expectedRank) continue;
      records[character] = { bestScore: record.bestScore, bestRank: record.bestRank, attempts: record.attempts };
    }
    return records;
  } catch { return {}; }
}

export function recordAttempt(records, character, result, storage) {
  const previous = records[character];
  const bestScore = Math.max(previous?.bestScore ?? 0, result.score);
  records[character] = {
    bestScore,
    bestRank: bestScore >= 95 ? 'gold' : bestScore >= 90 ? 'silver' : bestScore >= 80 ? 'bronze' : 'none',
    attempts: (previous?.attempts || 0) + 1,
  };
  let saved = true;
  try { storage.setItem(RECORD_KEY, JSON.stringify(records)); } catch { saved = false; }
  return { previous: previous?.bestScore ?? null, improved: !previous || result.score > previous.bestScore, saved };
}
