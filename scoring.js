// Geometry-only scoring. Coordinates stay in the original 109 × 109 space.
export const SAMPLE_COUNT = 32;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function resample(points, count = SAMPLE_COUNT) {
  if (!points.length) return [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  const total = lengths.at(-1);
  if (!total) return Array.from({ length: count }, () => [...points[0]]);
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const span = lengths[segment] - lengths[segment - 1];
    const t = span ? (target - lengths[segment - 1]) / span : 0;
    return points[segment - 1].map((v, axis) => v + (points[segment][axis] - v) * t);
  });
}

function rms(a, b) {
  return Math.sqrt(a.reduce((sum, p, i) => sum + distance(p, b[i]) ** 2, 0) / a.length);
}

function direction(a, b) {
  let sum = 0;
  for (let i = 1; i < a.length; i++) {
    const u = a[i].map((v, axis) => v - a[i - 1][axis]);
    const v = b[i].map((x, axis) => x - b[i - 1][axis]);
    const norm = Math.hypot(...u) * Math.hypot(...v);
    sum += norm > 1e-8 ? Math.max(0, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / norm)) : 0;
  }
  return sum / (a.length - 1);
}

export function rankFor(score, passed = true) {
  return !passed || score < 80 ? 'none' : score >= 95 ? 'gold' : score >= 90 ? 'silver' : 'bronze';
}

export function scoreAttempt(input, reference) {
  const expected = reference.map(p => resample(p));
  const actual = input.map(p => resample(p));
  const slots = Math.max(actual.length, expected.length, 1);
  const matched = Math.min(actual.length, expected.length);
  const comparisons = Array.from({ length: matched }, (_, i) => {
    const points = actual[i];
    const valid = points.length === SAMPLE_COUNT && input[i].reduce((s, p, j, list) => s + (j ? distance(p, list[j - 1]) : 0), 0) >= 1;
    if (!valid) return { rms: Infinity, direction: 0, order: false, valid: false };
    const error = rms(points, expected[i]);
    // Recognize a clearly better matching stroke elsewhere, even for nearby parallel strokes.
    const ownShape = Math.min(error, rms([...points].reverse(), expected[i]));
    const order = expected.some((stroke, j) => j !== i && Math.min(rms(points, stroke), rms([...points].reverse(), stroke)) + 1 < ownShape);
    return { rms: error, direction: direction(points, expected[i]), order, valid: true };
  });
  const countOK = actual.length === expected.length && expected.length > 0;
  const meanRms = matched ? Math.sqrt(comparisons.reduce((s, c) => s + c.rms ** 2, 0) / matched) : Infinity;
  const shape = 60 * Math.max(0, 1 - meanRms / 20) * matched / slots;
  const flow = 30 * comparisons.reduce((s, c) => s + c.direction, 0) / slots;
  const count = 10 * matched / slots;
  const directionOK = countOK && comparisons.every(c => c.valid && c.direction >= .5 && !c.order);
  const shapeOK = countOK && comparisons.every(c => c.valid && c.rms <= 12);
  const raw = Math.round(shape + flow + count);
  const passed = countOK && directionOK && shapeOK && raw >= 80;
  const score = passed ? raw : Math.min(79, raw);
  let feedback;
  if (!countOK) feedback = `画数を確認しましょう。お手本は${expected.length}画、今回は${actual.length}画でした。`;
  else {
    const invalid = comparisons.findIndex(c => !c.valid);
    const wrong = comparisons.findIndex(c => c.order || c.direction < .5);
    const worst = comparisons.reduce((best, c, i) => c.rms > comparisons[best].rms ? i : best, 0);
    if (invalid >= 0) feedback = `${invalid + 1}画目が短すぎます。点だけでなく、線を最後まで書きましょう。`;
    else if (wrong >= 0) feedback = `${wrong + 1}画目の順番・方向を、書き順アニメーションでもう一度確認しましょう。`;
    else if (score < 95 || !passed) feedback = `${worst + 1}画目の位置・長さ・曲がり方を見比べると、さらに近づけられます。`;
    else feedback = '一画ずつ、お手本によく一致しています。この調子で次の文字にも挑戦しましょう。';
  }
  return { score, passed, rank: rankFor(score, passed), feedback, countOK, directionOK, shapeOK, comparisons };
}
