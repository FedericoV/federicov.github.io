// Betting math. Everything on the Bet Facts screen is computed here.
// See research/RESEARCH.md for derivations.

export const americanToDecimal = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
export const impliedProb = (a) => 1 / americanToDecimal(a);
export const fmtAmerican = (a) => (a > 0 ? `+${a}` : `${a}`);

// Proportional devig of a two-way market: this side's share of the overround.
export function fairProb(odds, oppOdds) {
  const p = impliedProb(odds);
  const q = impliedProb(oppOdds);
  return p / (p + q);
}

// legs: [{odds, oppOdds}]. Assumes legs are independent (true for different games).
export function slipStats(legs, stake) {
  const decimal = legs.reduce((d, l) => d * americanToDecimal(l.odds), 1);
  const fair = legs.reduce((p, l) => p * fairProb(l.odds, l.oppOdds), 1);
  const rtp = fair * decimal; // return-to-player per $1
  return {
    decimal,
    fair,
    implied: 1 / decimal,
    payout: stake * decimal,
    profitIfWin: stake * (decimal - 1),
    ev: stake * (rtp - 1),
    evPct: rtp - 1,
    houseEdge: 1 - rtp,
  };
}

// Deterministic PRNG so the demo history is identical for every visitor.
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wilson score interval for a binomial proportion.
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function meanSd(xs) {
  const n = xs.length;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
  return [m, Math.sqrt(v)];
}

// Bets needed to detect a true per-bet edge `edge` (e.g. 0.03) at one-sided
// 95% confidence with 80% power, given per-bet return SD `sd`.
export const betsNeeded = (edge, sd) => Math.ceil((((1.645 + 0.842) * sd) / edge) ** 2);

// Per-bet return SD for a bet with win prob p and decimal odds d.
export const betSd = (p, d) => Math.sqrt(p * (1 - p)) * d;

// Simulate `years` of placing this exact bet once a week, at the fair probability.
export function simulateSeasons(fair, stake, decimal, { years = 10000, weeks = 52, seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const out = new Float64Array(years);
  const win = stake * (decimal - 1);
  for (let y = 0; y < years; y++) {
    let pl = 0;
    for (let w = 0; w < weeks; w++) pl += rng() < fair ? win : -stake;
    out[y] = pl;
  }
  out.sort();
  return out;
}

export const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

// Expected bankroll after re-betting all of it n times at edge e.
export const churn = (bankroll, houseEdge, n) => bankroll * (1 - houseEdge) ** n;

export const futureValue = (amount, rate, years) => amount * (1 + rate) ** years;

export const money = (x, digits = 0) => {
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (x < 0 ? '−$' : '$') + s;
};
export const signedMoney = (x, digits = 2) => (x >= 0 ? '+' : '') + money(x, digits);
export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const signedPct = (x, digits = 1) => (x >= 0 ? '+' : '−') + `${Math.abs(x * 100).toFixed(digits)}%`;
