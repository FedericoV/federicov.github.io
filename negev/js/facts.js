// The Bet Facts label. No jokes in this file.
import {
  slipStats, fairProb, fmtAmerican, simulateSeasons, quantile, churn, futureValue,
  wilson, meanSd, betsNeeded, betSd, money, signedMoney, pct, signedPct,
} from './math.js';
import { REFERENCE, SOURCES, INDEX_REAL, TBILL } from './data.js';

const SRC_ORDER = ['il', 'nj', 'nv', 'lotto', 'tbill', 'sp', 'nber', 'hlp', 'pop', 'limits'];
const cite = (key) => `<sup>${SRC_ORDER.indexOf(key) + 1}</sup>`;
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);

export function slipTitle(legs) {
  if (legs.length === 1) return `${legs[0].label} ${fmtAmerican(legs[0].odds)}`;
  return `${legs.length}-leg parlay`;
}

// How often this bettor's straight picks actually won, relative to the fair odds.
export function recordSkill(history) {
  const st = history.filter((b) => b.type === 'straight');
  const wins = sum(st, (b) => (b.won ? 1 : 0));
  const expected = sum(st, (b) => b.fair);
  return { n: st.length, wins, expected, k: wins / expected };
}

export function ledger(history, wage) {
  const staked = sum(history, (b) => b.stake);
  const net = sum(history, (b) => b.net);
  const zeroSkillEv = sum(history, (b) => b.stake * (b.fair * b.decimal - 1));
  return { n: history.length, staked, net, roi: net / staked, zeroSkillEv, hours: -net / wage };
}

export function factsHTML({ legs, stake, history, wage }) {
  const s = slipStats(legs, stake);
  const rec = recordSkill(history);
  const L = ledger(history, wage);
  const yourProb = legs.reduce((p, l) => p * Math.min(0.99, fairProb(l.odds, l.oppOdds) * rec.k), 1);
  const oneIn = Math.round(1 / s.fair);

  const sims = simulateSeasons(s.fair, stake, s.decimal);
  const pAhead = sims.filter((x) => x > 0).length / sims.length;

  return `
  <div class="facts">
    <h1>Bet Facts</h1>
    <div class="sub">${slipTitle(legs)} · Stake <b class="num">${money(stake, 2)}</b> · Pays <b class="num">${money(s.payout, 2)}</b> if it wins</div>

    <section>
      <h3>Chance this bet wins</h3>
      <div class="ln"><span>Fair chance (the book's odds with its margin removed)</span><b>${pct(s.fair)}</b></div>
      <div class="ln"><span>Chance you need to break even</span><b>${pct(s.implied)}</b></div>
      <div class="ln"><span>Chance if your past record holds</span><b>${pct(yourProb)}</b></div>
      <p class="note">About 1 in ${oneIn.toLocaleString()}. Your ${rec.n} past straight bets won ${rec.wins} times; fair odds predicted ${rec.expected.toFixed(1)}.
      That is ${rec.k.toFixed(2)}× the fair rate. With this few bets, the ratio is mostly noise (see “Your record” below).</p>
    </section>

    <section>
      <h3>Expected result</h3>
      <div class="headline loss">${signedMoney(s.ev)} <span style="font-size:15px">(${signedPct(s.evPct)} of stake)</span></div>
      <div class="ln"><span>If it wins</span><b class="gain">${signedMoney(s.profitIfWin)}</b></div>
      <div class="ln"><span>If it loses</span><b class="loss">${signedMoney(-stake)}</b></div>
      <div class="ln"><span>House edge on this bet</span><b>${pct(s.houseEdge)}</b></div>
      <div class="ln"><span>Stake in hours of your work (at ${money(wage)}/hr)</span><b>${(stake / wage).toFixed(1)} h</b></div>
      <p class="note">Expected result is what this bet is worth on average if the market's price is right. The book sets the price, and most bettors can't beat it.
      ${legs.length > 1 ? 'Each parlay leg adds its own margin, and the margins multiply.' : ''}</p>
    </section>

    <section>
      <h3>Expected return, compared</h3>
      ${compareHTML(s.evPct, legs)}
      <p class="note">Gambling returns are <b>per bet</b>. A bet settles in hours and the money is usually bet again, so the loss repeats.
      Investment returns are <b>per year</b>. The stock figure is a long-run historical average, not a promise.</p>
    </section>

    <section>
      <h3>Same ${money(stake)}, one year from now</h3>
      <div class="ln"><span>Place this bet once (expected)</span><b class="loss">${money(stake * (1 + s.evPct), 2)}</b></div>
      <div class="ln"><span>3-month T-bills, rolled over${cite('tbill')}</span><b>${money(stake * (1 + TBILL), 2)}</b></div>
      <div class="ln"><span>Stock index fund, historical average after inflation${cite('sp')}</span><b>${money(stake * (1 + INDEX_REAL), 2)}</b></div>
    </section>

    <section>
      <h3>If you place this bet every week for a year</h3>
      <div class="ln"><span>Total staked</span><b>${money(stake * 52)}</b></div>
      <div class="ln"><span>Expected result</span><b class="loss">${signedMoney(s.ev * 52, 0)}</b></div>
      <div class="ln"><span>Chance you're ahead after 52 weeks</span><b>${pct(pAhead, 0)}</b></div>
      <div class="ln ind"><span>Median year</span><b>${signedMoney(quantile(sims, 0.5), 0)}</b></div>
      <div class="ln ind"><span>Bad year (1 in 20 is worse)</span><b>${signedMoney(quantile(sims, 0.05), 0)}</b></div>
      <div class="ln ind"><span>Good year (1 in 20 is better)</span><b>${signedMoney(quantile(sims, 0.95), 0)}</b></div>
      ${histogramSVG(sims)}
      <p class="note">10,000 simulated years at the fair odds, i.e. assuming you pick exactly as well as the market. Winning years happen, and they're how people get hooked.
      The average across all years is still the expected result above.</p>
    </section>

    <section>
      <h3>Re-betting the same money</h3>
      <p class="callout">Put ${money(1000)} through bets like this one, re-betting whatever is left each week:
      after 52 bets the expected balance is <b class="num loss">${money(churn(1000, s.houseEdge, 52), 2)}</b>.
      The same ${money(1000)} in an index fund: <b class="num gain">${money(1000 * (1 + INDEX_REAL))}</b> after a year, on historical averages.</p>
      <p class="note">Most bettors don't re-bet their whole bankroll every week, so this is the upper limit. But winnings do usually go back in,
      which is why losses per dollar <i>deposited</i> run much higher than the house edge per dollar <i>bet</i>.</p>
    </section>

    ${recordHTML(L, rec, history, wage)}

    <section>
      <h3>What researchers found</h3>
      <p class="note" style="font-size:13px;color:var(--ink)">
      • Once online betting was legalized, households that bet cut their stock-market deposits by about <b>14%</b> and robo-advisor
        deposits by about <b>22%</b>. Low-savings households carried about <b>$368 (8%) more</b> credit-card debt and overdrew their accounts more often.${cite('nber')}<br>
      • In states with online betting, average credit scores fell and bankruptcies, debt collections and auto-loan delinquencies rose.${cite('hlp')}<br>
      • In UK operator data, the top 10% of accounts supplied <b>79%</b> of operator revenue.${cite('pop')}<br>
      • Books limit or restrict customers who win consistently (about 0.5% of bettors in Massachusetts, 4.3% of UK accounts).${cite('limits')}
      </p>
    </section>

    <section>
      <h3>Sources</h3>
      <ol>${SRC_ORDER.map((k) => `<li>${SOURCES[k].label}${SOURCES[k].url ? ` — <a href="${SOURCES[k].url}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('')}</ol>
      <p class="note">Odds, games and the betting history on this screen are simulated. The math and the cited figures are real.
      Fair odds use proportional devigging, and parlay legs are assumed independent (different games).</p>
    </section>
  </div>`;
}

function compareHTML(evPct, legs) {
  const rows = REFERENCE.map((r) => ({ ...r })).concat([{ name: `This bet (${slipTitle(legs)})`, ret: evPct, unit: 'per bet', you: true }]);
  rows.sort((a, b) => a.ret - b.ret);
  const lo = -0.4, hi = 0.1; // zero sits at 80%
  const x = (v) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  const z = x(0);
  return `<div class="cmp">${rows.map((r) => {
    const a = Math.min(x(r.ret), z), w = Math.abs(x(r.ret) - z);
    const color = r.ret < 0 ? 'var(--loss)' : 'var(--gain)';
    const clip = r.ret < lo ? '◀ ' : '';
    return `<div class="${r.you ? 'you' : ''}">${r.you ? '▶ ' : ''}${r.name}${r.src && r.src !== 'math' ? cite(r.src) : ''}</div>
      <div class="bar" style="--z:${z}%"><i style="left:${a}%;width:${Math.max(w, 0.8)}%;background:${r.you ? 'var(--ink)' : color}"></i></div>
      <div class="num ${r.you ? 'you' : ''}" style="text-align:right">${clip}${signedPct(r.ret)}<br><span class="unit ${r.unit.includes('YEAR') ? 'yr' : ''}">${r.unit}</span></div>`;
  }).join('')}</div>`;
}

function histogramSVG(sims) {
  const W = 320, H = 130, pad = 18, bins = 36;
  const lo = quantile(sims, 0.002), hi = quantile(sims, 0.998);
  const span = hi - lo || 1;
  const counts = new Array(bins).fill(0);
  for (const v of sims) {
    if (v < lo || v > hi) continue;
    counts[Math.min(bins - 1, Math.floor(((v - lo) / span) * bins))]++;
  }
  const max = Math.max(...counts);
  const bw = (W - 2 * pad) / bins;
  const X = (v) => pad + ((v - lo) / span) * (W - 2 * pad);
  const bars = counts.map((c, i) => {
    const mid = lo + (i + 0.5) * (span / bins);
    const h = (c / max) * (H - 40);
    return `<rect x="${pad + i * bw + 0.5}" y="${H - 22 - h}" width="${bw - 1}" height="${h}" fill="${mid > 0 ? 'var(--gain)' : 'var(--loss)'}" opacity="${mid > 0 ? 0.85 : 0.7}"/>`;
  }).join('');
  const zero = lo < 0 && hi > 0 ? `<line x1="${X(0)}" x2="${X(0)}" y1="6" y2="${H - 18}" stroke="var(--ink)" stroke-dasharray="3 2"/><text x="${X(0) + 3}" y="14" font-size="10">break even</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of one-year results">
    ${bars}${zero}
    <line x1="${pad}" x2="${W - pad}" y1="${H - 22}" y2="${H - 22}" stroke="var(--ink)"/>
    <text x="${pad}" y="${H - 6}" font-size="10">${signedMoney(lo, 0)}</text>
    <text x="${W - pad}" y="${H - 6}" font-size="10" text-anchor="end">${signedMoney(hi, 0)}</text>
  </svg>`;
}

function recordHTML(L, rec, history, wage) {
  const st = history.filter((b) => b.type === 'straight');
  const rets = st.map((b) => b.net / b.stake);
  const [m, sd] = meanSd(rets);
  const half = (1.96 * sd) / Math.sqrt(rets.length);
  const need = betsNeeded(0.03, betSd(0.5, 1.9091));
  const lossesInvested = futureValue(Math.max(0, -L.net), INDEX_REAL, 30);

  return `
    <section>
      <h3>Your record <span style="font-weight:400;text-transform:none">(simulated demo history)</span></h3>
      <div class="ln"><span>Bets placed</span><b>${L.n}</b></div>
      <div class="ln"><span>Total staked</span><b>${money(L.staked)}</b></div>
      <div class="ln"><span>Net result</span><b class="${L.net < 0 ? 'loss' : 'gain'}">${signedMoney(L.net, 0)}</b></div>
      <div class="ln"><span>Return on money bet</span><b class="${L.net < 0 ? 'loss' : 'gain'}">${signedPct(L.roi)}</b></div>
      <div class="ln ind"><span>Expected result if every pick had been a coin flip at the same prices</span><b>${signedMoney(L.zeroSkillEv, 0)}</b></div>
      <div class="ln"><span>Hours of work lost (at ${money(wage)}/hr)</span><b>${L.net < 0 ? L.hours.toFixed(0) : 0} h</b></div>
      <div class="ln"><span>Those losses, invested for 30 years at ~7%/yr after inflation</span><b>${money(lossesInvested)}</b></div>
      <p class="note" style="margin-top:10px"><b>Calibration.</b> How often your straight bets won, grouped by the fair chance the odds implied.
      Points below the line mean your picks won less often than the price said. Bars show 95% ranges.</p>
      ${calibrationSVG(st)}
      <p class="callout" style="font-size:14px">Your straight-bet return is <b class="num">${signedPct(m)}</b> per bet, with a 95% range of
      <b class="num">${signedPct(m - half)}</b> to <b class="num">${signedPct(m + half)}</b>. From ${rets.length} bets there's no way to tell skill from luck.
      To show a genuine +3% edge on −110 bets, you'd need about <b class="num">${need.toLocaleString()}</b> bets.</p>
    </section>`;
}

function calibrationSVG(st) {
  const W = 320, H = 230, L = 40, R = 12, T = 12, B = 34;
  const lo = 0.2, hi = 0.85;
  const X = (p) => L + ((p - lo) / (hi - lo)) * (W - L - R);
  const Y = (p) => H - B - ((Math.max(0, Math.min(1, p)) - lo) / (hi - lo)) * (H - T - B);
  const edges = [0.2, 0.36, 0.47, 0.53, 0.64, 0.85];
  const pts = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const inBin = st.filter((b) => b.fair >= edges[i] && b.fair < edges[i + 1]);
    if (inBin.length < 3) continue;
    const k = inBin.filter((b) => b.won).length;
    const fx = inBin.reduce((a, b) => a + b.fair, 0) / inBin.length;
    const [a, c] = wilson(k, inBin.length);
    pts.push({ fx, fy: k / inBin.length, a, c, n: inBin.length });
  }
  const ticks = [0.2, 0.4, 0.6, 0.8];
  const clampY = (p) => Math.max(T, Math.min(H - B, Y(p)));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration of past bets">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--hair)"/>
      <text x="${L - 6}" y="${Y(t) + 3}" font-size="10" text-anchor="end">${t * 100}%</text>
      <text x="${X(t)}" y="${H - B + 14}" font-size="10" text-anchor="middle">${t * 100}%</text>`).join('')}
    <line x1="${X(lo)}" y1="${Y(lo)}" x2="${X(hi)}" y2="${Y(hi)}" stroke="var(--ink)" stroke-dasharray="4 3"/>
    <text x="${X(0.66)}" y="${Y(0.7) - 4}" font-size="10" transform="rotate(-37 ${X(0.66)} ${Y(0.7) - 4})">fair odds</text>
    ${pts.map((p) => `<line x1="${X(p.fx)}" x2="${X(p.fx)}" y1="${clampY(p.a)}" y2="${clampY(p.c)}" stroke="var(--loss)" stroke-width="1.5"/>
      <circle cx="${X(p.fx)}" cy="${clampY(p.fy)}" r="${3 + Math.sqrt(p.n) / 2}" fill="${p.fy < p.fx ? 'var(--loss)' : 'var(--gain)'}" stroke="#fff"/>
      <text x="${X(p.fx) + 8}" y="${clampY(p.fy) + 12}" font-size="9">n=${p.n}</text>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 4}" font-size="10" text-anchor="middle">Fair chance from the odds</text>
    <text x="10" y="${(T + H - B) / 2}" font-size="10" text-anchor="middle" transform="rotate(-90 10 ${(T + H - B) / 2})">How often you won</text>
  </svg>`;
}
