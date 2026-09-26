import { mulberry32, americanToDecimal, fairProb } from './math.js';

// A fictional Sunday slate. Lines are invented but priced like real US books
// (−110 spreads/totals, moneylines with ~4–5% overround).
export const GAMES = [
  { id: 'g1', time: '1:00 PM', away: 'Bills', home: 'Dolphins',
    spread: [{ label: 'BUF −3.5', odds: -110 }, { label: 'MIA +3.5', odds: -110 }],
    ml: [{ label: 'BUF', odds: -180 }, { label: 'MIA', odds: 150 }],
    total: [{ label: 'O 47.5', odds: -110 }, { label: 'U 47.5', odds: -110 }] },
  { id: 'g2', time: '1:00 PM', away: 'Packers', home: 'Bears',
    spread: [{ label: 'GB −2.5', odds: -115 }, { label: 'CHI +2.5', odds: -105 }],
    ml: [{ label: 'GB', odds: -140 }, { label: 'CHI', odds: 118 }],
    total: [{ label: 'O 44.5', odds: -110 }, { label: 'U 44.5', odds: -110 }] },
  { id: 'g3', time: '4:25 PM', away: 'Chiefs', home: 'Broncos',
    spread: [{ label: 'KC −6.5', odds: -110 }, { label: 'DEN +6.5', odds: -110 }],
    ml: [{ label: 'KC', odds: -285 }, { label: 'DEN', odds: 230 }],
    total: [{ label: 'O 43.5', odds: -108 }, { label: 'U 43.5', odds: -112 }] },
  { id: 'g4', time: '4:25 PM', away: 'Eagles', home: 'Cowboys',
    spread: [{ label: 'PHI −1.5', odds: -110 }, { label: 'DAL +1.5', odds: -110 }],
    ml: [{ label: 'PHI', odds: -125 }, { label: 'DAL', odds: 105 }],
    total: [{ label: 'O 49.5', odds: -110 }, { label: 'U 49.5', odds: -110 }] },
  { id: 'g5', time: '8:20 PM', away: '49ers', home: 'Seahawks',
    spread: [{ label: 'SF −3', odds: -120 }, { label: 'SEA +3', odds: 100 }],
    ml: [{ label: 'SF', odds: -165 }, { label: 'SEA', odds: 140 }],
    total: [{ label: 'O 45.5', odds: -110 }, { label: 'U 45.5', odds: -110 }] },
  { id: 'g6', time: 'MON 8:15', away: 'Ravens', home: 'Steelers',
    spread: [{ label: 'BAL −4.5', odds: -110 }, { label: 'PIT +4.5', odds: -110 }],
    ml: [{ label: 'BAL', odds: -210 }, { label: 'PIT', odds: 175 }],
    total: [{ label: 'O 41.5', odds: -110 }, { label: 'U 41.5', odds: -110 }] },
];

// Reference returns. `unit` is shown everywhere these appear: per-bet vs per-year
// is the whole point.
export const REFERENCE = [
  { name: 'Blackjack (basic strategy)', ret: -0.005, unit: 'per hand', src: 'math' },
  { name: 'Single bet at −110', ret: -0.0455, unit: 'per bet', src: 'math' },
  { name: 'Illinois non-parlay bets, 2025 actual', ret: -0.055, unit: 'per $ bet', src: 'il' },
  { name: 'American roulette', ret: -0.0526, unit: 'per spin', src: 'math' },
  { name: 'Nevada slot machines, 2025 actual', ret: -0.0715, unit: 'per $ played', src: 'nv' },
  { name: 'Illinois parlays, 2025 actual', ret: -0.183, unit: 'per $ bet', src: 'il' },
  { name: 'New Jersey parlays, Nov 2025 actual', ret: -0.229, unit: 'per $ bet', src: 'nj' },
  { name: 'State lottery tickets (≈)', ret: -0.37, unit: 'per ticket $', src: 'lotto' },
  { name: '3-month T-bill (Sep 2026)', ret: 0.0419, unit: 'per YEAR', src: 'tbill' },
  { name: 'S&P 500, 1926–today avg, after inflation', ret: 0.07, unit: 'per YEAR', src: 'sp' },
];

export const INDEX_REAL = 0.07;
export const TBILL = 0.0419;

export const SOURCES = {
  math: { label: 'Arithmetic on the posted odds', url: null },
  il: { label: 'Illinois Gaming Board, CY2025 sports wagering (parlays: $4.86B handle, $889.9M revenue, 18.3% hold; all bets: $15.65B handle, $1.48B revenue)', url: 'https://www.ingame.com/illinois-december-2025-sportsbook-revenue/' },
  nj: { label: 'NJ Division of Gaming Enforcement, Nov 2025 (parlays: $457.1M handle, $104.6M revenue)', url: 'https://www.ingame.com/new-jersey-november-sports-betting-revenue/' },
  nv: { label: 'Nevada Gaming Control Board, 2025 statewide slot hold 7.15%', url: 'https://www.gaming.nv.gov/siteassets/content/about/info-sheet/2025-info-sheet.pdf' },
  lotto: { label: 'US Census 2024 state lottery finances: prizes ≈ 60–65% of sales', url: 'https://stateline.org/2026/04/09/state-lottery-ticket-sales-nearly-double-to-over-100b/' },
  tbill: { label: 'FRED DGS3MO, 4.19% on 25 Sep 2026', url: 'https://fred.stlouisfed.org/series/DGS3MO' },
  sp: { label: 'S&P 500 total return since 1926: ≈10% nominal, ≈7% after inflation (historical average, not a promise)', url: 'https://www.officialdata.org/us/stocks/s-p-500/1926' },
  nber: { label: 'Baker et al. (2024), "Gambling Away Stability", NBER WP 33108', url: 'https://www.nber.org/papers/w33108' },
  hlp: { label: 'Hollenbeck, Larsen & Proserpio (2025), "The Financial Consequences of Legalized Sports Gambling", Management Science', url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4903302' },
  pop: { label: 'NatCen / GambleAware, "Patterns of Play" (2021–23)', url: 'https://natcen.ac.uk/publications/patterns-play' },
  givewell: { label: 'GiveWell: top charities have typically cost $3,000–$5,500 per life saved', url: 'https://www.givewell.org/how-much-does-it-cost-to-save-a-life' },
  limits: { label: 'Sportsbook limits on winning bettors (MA Gaming Commission, UKGC)', url: 'https://igamingbusiness.com/sports-betting/new-york-fair-play-act-sportsbooks-limiting-ban/' },
};

// ---- Simulated demo history ------------------------------------------------
// 18 months of a recreational bettor. Picks hit at SKILL × the fair rate
// (a mild negative edge on top of the vig). Seeded, so identical for everyone.
export const SKILL = 0.97;
const ML_PAIRS = [[-150, 130], [-200, 170], [-125, 105], [-280, 230], [-165, 140], [-110, -110]];

export function generateHistory(seed = 20260926) {
  const rng = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const start = Date.UTC(2025, 2, 2); // Sun 2 Mar 2025
  const bets = [];
  for (let week = 0; week < 81; week++) {
    const n = 1 + Math.floor(rng() * 3.2);
    for (let i = 0; i < n; i++) {
      const date = new Date(start + (week * 7 + (rng() < 0.8 ? 0 : 1)) * 864e5);
      if (rng() < 0.7) {
        const kind = rng();
        let odds, opp, desc;
        if (kind < 0.55) { odds = -110; opp = -110; desc = 'Spread'; }
        else if (kind < 0.75) { odds = -110; opp = -110; desc = 'Total'; }
        else {
          const [a, b] = pick(ML_PAIRS);
          [odds, opp] = rng() < 0.62 ? [a, b] : [b, a]; // public likes favorites
          desc = 'Moneyline';
        }
        const fair = fairProb(odds, opp);
        const decimal = americanToDecimal(odds);
        const stake = 5 * Math.round((20 + rng() * 80) / 5);
        const won = rng() < fair * SKILL;
        bets.push({ date, type: 'straight', desc, legs: 1, odds, fair, decimal, stake, won,
          net: won ? stake * (decimal - 1) : -stake });
      } else {
        const legs = pick([3, 3, 4, 4, 5, 6]);
        const decimal = americanToDecimal(-110) ** legs;
        const fair = 0.5 ** legs;
        let won = true;
        for (let l = 0; l < legs; l++) if (rng() >= 0.5 * SKILL) won = false;
        const stake = 5 * Math.round((10 + rng() * 15) / 5);
        bets.push({ date, type: 'parlay', desc: `${legs}-leg parlay`, legs, odds: null, fair, decimal, stake, won,
          net: won ? stake * (decimal - 1) : -stake });
      }
    }
  }
  return bets;
}
