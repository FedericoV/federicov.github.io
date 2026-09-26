import { GAMES, INDEX_REAL, SOURCES, generateHistory } from './data.js';
import { fmtAmerican, futureValue, money, pct, signedMoney, slipStats } from './math.js';
import { factsHTML, ledger, slipTitle } from './facts.js';

// ---- params & state ---------------------------------------------------------
const P = new URLSearchParams(location.search);
const FAST = P.has('fast') ? 0.4 : 1; // shorter timers, used for the recorded demo
const FORCED = P.get('outcome'); // 'win' | 'lose'
const T = (ms) => ms * FAST;

const DEMO_HISTORY = generateHistory();
const DEFAULT = {
  screen: 'landing', cookies: false,
  user: null, balance: 0, deposit: 0,
  slip: [], stake: 50, bets: [], quizStep: 0,
};
let S = load();
const $app = document.getElementById('app');
const $overlay = document.getElementById('overlay');
const $toasts = document.getElementById('toasts');
let timers = [];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem('negev') || 'null');
    if (s) { s.bets.forEach((b) => (b.date = new Date(b.date))); return { ...DEFAULT, ...s }; }
  } catch { /* storage blocked: start fresh */ }
  return structuredClone(DEFAULT);
}
function save() { try { localStorage.setItem('negev', JSON.stringify(S)); } catch { /* ignore */ } }
const history = () => DEMO_HISTORY.concat(S.bets);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const later = (fn, ms) => timers.push(setTimeout(fn, T(ms)));

function go(screen) {
  timers.forEach(clearTimeout); timers = [];
  S.screen = screen; save();
  $app.style.paddingBottom = '';
  $overlay.innerHTML = '';
  document.getElementById('frame').classList.toggle('paperbg', screen === 'facts');
  (SCREENS[screen] || SCREENS.landing)();
  window.scrollTo(0, 0);
}

// ---- effects ----------------------------------------------------------------
function toast(title, body, { icon = '🔔', gray = false, ms = 3800 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (gray ? ' gray' : '');
  el.innerHTML = `<span style="font-size:20px">${icon}</span><div><b>${title}</b>${body}</div>`;
  $toasts.append(el);
  setTimeout(() => el.remove(), ms);
}

function modal(html) { $overlay.innerHTML = `<div class="modal">${html}</div>`; return $overlay.firstElementChild; }

function confetti({ colors = ['#ff3ea5', '#ffcf3f', '#35e39a', '#7b61ff'], emojis = [], count = 140, x = null, y = null, spread = null } = {}) {
  const rect = document.getElementById('frame').getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const emoji = emojis.length && Math.random() < 0.35 ? emojis[i % emojis.length] : null;
    if (emoji) { el.textContent = emoji; el.style.fontSize = '20px'; }
    else Object.assign(el.style, { width: '8px', height: '12px', background: colors[i % colors.length], borderRadius: '2px' });
    const sx = x ?? rect.left + Math.random() * Math.min(rect.width, innerWidth);
    const sy = y ?? -20;
    el.style.left = `${sx}px`; el.style.top = `${sy}px`;
    document.body.append(el);
    let to;
    if (spread) {
      const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
      to = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r + 120}px) rotate(${Math.random() * 720}deg)`;
    } else {
      to = `translate(${(Math.random() - 0.5) * 160}px, ${innerHeight + 40}px) rotate(${Math.random() * 900}deg)`;
    }
    el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: to, opacity: spread ? 0 : 1 }],
      { duration: 1600 + Math.random() * 1600, easing: 'cubic-bezier(.15,.6,.4,1)', delay: Math.random() * 300 })
      .onfinish = () => el.remove();
  }
}

function fireworks() {
  const rect = document.getElementById('frame').getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    setTimeout(() => confetti({
      count: 60, spread: 140,
      colors: [['#35e39a', '#b6ffd9'], ['#ffcf3f', '#fff3b0'], ['#7bd3ff', '#ffffff']][i % 3],
      x: rect.left + 60 + Math.random() * Math.max(100, Math.min(rect.width, innerWidth) - 120),
      y: 120 + Math.random() * 200,
    }), i * 350);
  }
}

let audio;
function sadTrombone() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audio.currentTime;
    [[392, 0], [370, 0.32], [349, 0.64], [330, 0.96]].forEach(([f, t], i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0 + t);
      const dur = i === 3 ? 1.0 : 0.3;
      if (i === 3) for (let k = 0; k < 8; k++) o.frequency.setValueAtTime(f + (k % 2 ? -8 : 8), t0 + t + k * 0.1);
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0 + t); o.stop(t0 + t + dur + 0.05);
    });
  } catch { /* no audio, no problem */ }
}

// ---- shared chrome ------------------------------------------------------------
const logo = `<div class="logo">Neg<span>EV</span><small>The sportsbook that shows its math</small></div>`;
function topbar() {
  return `<div class="topbar">${logo}
    <div class="row" style="align-items:center">
      <div class="bal">Balance<b>${money(S.balance, 2)}</b></div>
      <button class="quit" data-go="cashout">Cash out &amp;<br>quit forever</button>
    </div></div>`;
}
function bindGo(root = $app) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

function ensureUser() {
  S.user ??= { name: 'Dave', wage: 32, rent: 1800 };
  if (S.balance <= 0 && !S.deposit) { S.balance = 200; S.deposit = 200; }
}

// ---- screens ----------------------------------------------------------------
const SCREENS = {};

SCREENS.landing = () => {
  $app.innerHTML = `
    <div class="topbar">${logo}</div>
    <div class="hero">
      <div class="big">Bet on sports.<br><em>See the math.</em></div>
      <p class="muted">NegEV is a parody sportsbook. Every bet shows exactly how much it costs you. All money is fake.</p>
    </div>
    <div class="ticker" id="tick">● LIVE: 3,412 people are losing money right now*</div>
    <p class="tiny muted">*Made up. Probably low.</p>
    <div class="stack" style="margin-top:24px">
      <button class="btn primary" id="signup">Sign up &amp; claim your $0 welcome bonus</button>
      <button class="btn ghost" id="skip">Skip the sign-up gags and go straight to betting →</button>
      <a class="btn ghost" href="negev-demo.mp4" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">▶ Or watch a 2-minute demo</a>
    </div>
    <div class="card" style="margin-top:24px">
      <b>Why NegEV?</b>
      <ul class="muted" style="padding-left:18px;font-size:14px;line-height:1.6">
        <li>Odds shown with the house's cut included</li>
        <li>Your real win rate, not the one you remember</li>
        <li>Withdrawals in one click. Deposits in seven.</li>
      </ul>
    </div>`;
  let n = 3412;
  const tick = setInterval(() => {
    const el = document.getElementById('tick');
    if (!el) return clearInterval(tick);
    n += Math.floor(Math.random() * 9) - 2;
    el.textContent = `● LIVE: ${n.toLocaleString()} people are losing money right now*`;
  }, 900);
  timers.push(tick);
  document.getElementById('signup').onclick = () => go('signup');
  document.getElementById('skip').onclick = () => { ensureUser(); S.cookies = true; go('lobby'); };
  if (!S.cookies) cookieBanner();
};

function cookieBanner() {
  const el = document.createElement('div');
  el.className = 'cookie';
  el.innerHTML = `<p>🍪 We use cookies to track exactly how much you lose and to remember it forever.</p>
    <div class="row"><button class="btn primary" id="ck-ok">Accept all losses</button><button class="btn ghost" id="ck-manage">Manage losses</button></div>`;
  $app.append(el);
  const accept = () => {
    S.cookies = true; save(); el.remove(); $overlay.innerHTML = '';
    toast('Cookies accepted', 'Your losses are now being tracked. (They already were.)', { icon: '🍪' });
  };
  el.querySelector('#ck-ok').onclick = accept;
  el.querySelector('#ck-manage').onclick = () => {
    const m = modal(`<h2>Manage loss preferences</h2>
      ${['Track every loss (required)', 'Share losses with shareholders (required)', 'Remember your rent amount (required)',
        'Personalized “you’re due” notifications (required)', 'Sell your data to other sportsbooks (required)',
        'Let you forget how much you’ve lost (unavailable)'].map((t) => `<div class="toggle"><span>${t}</span><i></i></div>`).join('')}
      <p class="tiny muted">All toggles are locked. That's how it works on the real sites too, just less honestly.</p>
      <button class="btn primary" id="ck-save">Save preferences</button>`);
    m.querySelector('#ck-save').onclick = accept;
  };
}

SCREENS.signup = () => {
  $app.innerHTML = `<div class="topbar">${logo}</div>
    <h1>Create your account</h1>
    <div class="stack">
      <div><label>First name</label><input type="text" id="name" autocomplete="off" placeholder="Dave"></div>
      <div class="row">
        <div style="flex:1"><label>Hourly take-home pay</label><input type="number" id="wage" placeholder="32" min="1"></div>
        <div style="flex:1"><label>Monthly rent</label><input type="number" id="rent" placeholder="1800" min="1"></div>
      </div>
      <p class="tiny muted" style="margin:4px 0 0">We'll convert every bet into hours of your life and fractions of your rent.</p>
      <div><label>Password</label><input type="password" id="pw" autocomplete="new-password">
        <div id="rules" class="tiny" style="margin-top:6px;line-height:1.7"></div></div>
      <div><label>Beneficiary of your deposits</label>
        <select id="ben"><option>NegEV shareholders</option></select>
        <p class="tiny muted" style="margin:4px 0 0">This is the only option. It's the only option everywhere else too.</p></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" checked disabled> Email me a monthly statement of my losses</label>
      <div class="err" id="err"></div>
      <button class="btn primary" id="go">Continue</button>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const rules = () => {
    const pw = $('pw').value, rent = $('rent').value.trim();
    const list = [
      [pw.length >= 8, 'At least 8 characters'],
      [/\d/.test(pw), 'Contains a number'],
      [rent && pw.includes(rent), `Contains your monthly rent${rent ? ` (“${esc(rent)}”)` : ''}`],
      [!/lucky/i.test(pw), 'Does not contain “lucky”'],
    ];
    $('rules').innerHTML = list.map(([ok, t]) => `<div class="${ok ? 'ok' : 'muted'}">${ok ? '✓' : '○'} ${t}</div>`).join('');
    return list.every(([ok]) => ok);
  };
  ['pw', 'rent'].forEach((id) => $(id).addEventListener('input', rules));
  rules();
  $('go').onclick = () => {
    const name = $('name').value.trim(), wage = +$('wage').value, rent = +$('rent').value;
    if (!name || !(wage > 0) || !(rent > 0)) return ($('err').textContent = 'We need your name, wage and rent. For the math.');
    if (!rules()) return ($('err').textContent = 'Password doesn’t meet the requirements.');
    S.user = { name, wage, rent }; save(); go('captcha');
  };
};

const TILES = [
  { e: '🧔', t: 'Guy from your group chat', ok: false, why: 'He’s down $3,100. He only posts the wins.' },
  { e: '👔', t: 'Sportsbook CEO', ok: true },
  { e: '🧑‍🎓', t: 'Stats major with a model', ok: false, why: 'Her account got limited to $12 max bets after three weeks.' },
  { e: '👵', t: 'Your grandma', ok: false, why: 'Grandma is down $40 on the Browns and very upset about it.' },
  { e: '📈', t: 'Sportsbook shareholders', ok: true },
  { e: '🧑', t: 'You', ok: false, why: 'Let’s not get ahead of ourselves.' },
  { e: '📺', t: 'Guy selling picks, $99/mo', ok: true },
  { e: '👷', t: 'Kevin from work', ok: false, why: 'Kevin is fine. Kevin just doesn’t talk about it.' },
  { e: '🏛️', t: 'The state (betting tax)', ok: true },
];
SCREENS.captcha = () => {
  const sel = new Set();
  $app.innerHTML = `<div class="topbar">${logo}</div>
    <h2>Quick check that you're human</h2>
    <div class="captcha">
      <header>Select all squares with<b>someone who got rich from sports betting</b></header>
      <div class="grid3">${TILES.map((x, i) => `<button class="tile" data-i="${i}">${x.e}<small>${x.t}</small></button>`).join('')}</div>
      <div class="err" id="err"></div>
      <footer><span style="font-size:22px">🔄 🎧</span><button class="btn" id="verify">VERIFY</button></footer>
    </div>`;
  $app.querySelectorAll('.tile').forEach((b) => b.onclick = () => {
    const i = +b.dataset.i;
    sel.has(i) ? sel.delete(i) : sel.add(i);
    b.classList.toggle('sel');
  });
  document.getElementById('verify').onclick = () => {
    const wrong = [...sel].map((i) => TILES[i]).find((x) => !x.ok);
    const missed = TILES.find((x, i) => x.ok && !sel.has(i));
    const err = document.getElementById('err');
    if (wrong) err.textContent = `Incorrect: “${wrong.t}.” ${wrong.why}`;
    else if (missed) err.textContent = `Almost. You missed “${missed.t}.” They get paid whether you win or lose.`;
    else { toast('Verified', 'You know who gets rich. Continuing.', { icon: '✅' }); go('tos'); }
  };
};

const QUIZ = [
  { q: 'At standard −110 odds, what share of your bets must win just to break even?',
    a: ['50%', '52.4%', '55%', '60%'], right: 1,
    why: 'You risk $110 to win $100, so you need 110 / 210 = 52.4%. A coin-flip picker loses about 4.5% of every dollar bet.' },
  { q: 'In Illinois in 2025, what share of all money bet on parlays did sportsbooks keep?',
    a: ['2%', '5%', '18%', '50%'], right: 2,
    why: '$889.9M kept from $4.86B wagered: 18.3%, per the Illinois Gaming Board. Single bets were closer to 5%.' },
  { q: 'You bet $100 at −110 on a true 50/50 game. What’s your expected result?',
    a: ['$0', '−$4.55', '−$10', '+$4.55'], right: 1,
    why: 'Half the time +$90.91, half the time −$100. Average: −$4.55.' },
];
SCREENS.tos = () => {
  const i = S.quizStep, item = QUIZ[i];
  $app.innerHTML = `<div class="topbar">${logo}</div>
    <h2>Terms of Service</h2>
    <div class="card muted" style="font-size:13px;line-height:1.5">Summary: the odds are set so that, on average, you lose.
    To confirm you read this, please pass a short quiz.</div>
    <p class="muted tiny" style="margin-top:16px">Question ${i + 1} of ${QUIZ.length}</p>
    <h2 style="font-size:17px">${item.q}</h2>
    <div id="opts">${item.a.map((a, j) => `<button class="opt" data-j="${j}">${a}</button>`).join('')}</div>
    <p id="why" class="muted" style="font-size:14px;line-height:1.5"></p>
    <button class="btn primary" id="next" style="display:none">Next</button>`;
  $app.querySelectorAll('.opt').forEach((b) => b.onclick = () => {
    const j = +b.dataset.j;
    const why = document.getElementById('why');
    if (j === item.right) {
      b.classList.add('right');
      why.textContent = `Correct. ${item.why}`;
      $app.querySelectorAll('.opt').forEach((o) => (o.disabled = true));
      document.getElementById('next').style.display = 'block';
    } else {
      b.classList.add('wrong');
      why.textContent = 'Not quite. Try again. (A real sportsbook would be happy for you to get this wrong.)';
    }
  });
  document.getElementById('next').onclick = () => {
    if (i + 1 < QUIZ.length) { S.quizStep = i + 1; go('tos'); } else { S.quizStep = 0; go('deposit'); }
  };
};

SCREENS.deposit = () => {
  ensureUserSoft();
  const u = S.user;
  $app.innerHTML = `${topbar()}
    <h1>Make a deposit</h1>
    <label>Amount: <b id="amt" style="color:var(--gold);font-size:18px">$0</b></label>
    <input type="range" class="slider" id="slider" min="0" max="1000" step="10" value="0">
    <div class="conv" style="margin-top:12px">
      <div><b id="c-h">0.0</b><span>hours of your work</span></div>
      <div><b id="c-r">0%</b><span>of your monthly rent</span></div>
      <div><b id="c-b">0</b><span>burritos ($12)</span></div>
      <div><b id="c-d">0</b><span>days of groceries ($15/day)</span></div>
    </div>
    <div class="future" style="margin-top:12px">If you invested this instead, in 30 years it would be worth about <b id="c-f">$0</b> in today's dollars.
      <div class="tiny muted" style="margin-top:4px">At the stock market's ~7%/yr historical average after inflation. Not guaranteed. Better odds than this, though.</div></div>
    <button class="btn primary" id="dep" style="margin-top:16px" disabled>Deposit $0</button>`;
  const $ = (id) => document.getElementById(id);
  $('slider').oninput = (e) => {
    const v = +e.target.value;
    $('amt').textContent = money(v);
    $('c-h').textContent = (v / u.wage).toFixed(1);
    $('c-r').textContent = pct(v / u.rent, 0);
    $('c-b').textContent = Math.floor(v / 12);
    $('c-d').textContent = Math.floor(v / 15);
    $('c-f').textContent = money(futureValue(v, INDEX_REAL, 30));
    $('dep').disabled = v === 0;
    $('dep').textContent = `Deposit ${money(v)}`;
  };
  $('dep').onclick = () => { S.pendingDeposit = +$('slider').value; go('confirm'); };
};
function ensureUserSoft() { S.user ??= { name: 'Dave', wage: 32, rent: 1800 }; }

const PHRASE = 'I understand I will probably lose this money';
SCREENS.confirm = () => {
  $app.innerHTML = `${topbar()}
    <h2>Confirm your deposit of ${money(S.pendingDeposit)}</h2>
    <p class="muted" style="font-size:14px">Type the following to continue:</p>
    <div class="card" style="font-family:var(--mono);font-size:14px;user-select:none">${PHRASE}</div>
    <input type="text" id="ph" autocomplete="off" style="margin-top:10px" placeholder="Type it. Feel it.">
    <div class="err" id="err"></div>
    <button class="btn primary" id="ok" disabled>Confirm deposit</button>`;
  const ph = document.getElementById('ph'), ok = document.getElementById('ok');
  ph.addEventListener('paste', (e) => { e.preventDefault(); document.getElementById('err').textContent = 'Nice try. Pasting is disabled. Type it out.'; });
  ph.oninput = () => (ok.disabled = ph.value.trim().toLowerCase() !== PHRASE.toLowerCase());
  ok.onclick = () => go('ad');
};

SCREENS.ad = () => {
  let left = Math.round(T(10000) / 1000);
  $app.innerHTML = `${topbar()}
    <p class="muted tiny">Your deposit will continue after this message from our sponsor.</p>
    <div class="ad">
      <span class="adtag">Ad · <span id="cd">${left}</span></span>
      <div style="font-family:var(--sans);font-size:12px;letter-spacing:2px">BORING INDEX FUND™</div>
      <h2>It just sits there.</h2>
      <svg class="chart" viewBox="0 0 300 90" preserveAspectRatio="none"><path d="M0,85 C40,80 60,70 90,72 S140,55 170,50 S220,40 240,28 S280,15 300,8" fill="none" stroke="#2e6b3f" stroke-width="3"/></svg>
      <p>No live odds. No push notifications. No “boosts.” It holds a slice of every big company and waits.</p>
      <p>The S&amp;P 500 has averaged about 7% a year after inflation since 1926. Some decades were bad; over long stretches it has gone up.</p>
      <p style="font-size:12px;opacity:.7">Past performance does not guarantee future results. Still beats −18.3%.</p>
    </div>
    <button class="btn ghost" id="skip" style="margin-top:12px" disabled>Skip ad in ${left}…</button>`;
  const iv = setInterval(() => {
    left--;
    const cd = document.getElementById('cd'), sk = document.getElementById('skip');
    if (!cd) return clearInterval(iv);
    cd.textContent = Math.max(left, 0);
    if (left > 0) sk.textContent = left > 3 ? `Skip ad in ${left}…` : `Skip ad in ${left}… (just kidding, you can’t)`;
    else { clearInterval(iv); sk.disabled = false; sk.textContent = 'Continue to deposit'; sk.onclick = () => go('processing'); }
  }, 1000 * FAST);
  timers.push(iv);
};

SCREENS.processing = () => {
  $app.innerHTML = `${topbar()}
    <h2>Processing deposit…</h2>
    <div class="progress"><i id="bar"></i></div>
    <p id="msg" class="muted" style="margin-top:12px">Contacting your bank…</p>`;
  const steps = [
    [80, 'Contacting your bank…', 900],
    [60, 'Reconsidering…', 1600],
    [35, 'Still reconsidering. Last chance to keep it.', 1700],
    [100, 'Fine.', 1500],
  ];
  let t = 200;
  steps.forEach(([w, m, d]) => {
    later(() => { document.getElementById('bar').style.width = `${w}%`; document.getElementById('msg').textContent = m; }, t);
    t += d;
  });
  later(() => {
    S.balance += S.pendingDeposit; S.deposit += S.pendingDeposit;
    toast('Deposit complete', `${money(S.pendingDeposit)} (fake) added. Good luck. You’ll need it.`, { icon: '💸' });
    S.pendingDeposit = 0; go('lobby');
  }, t);
};

// ---- lobby / slip -----------------------------------------------------------
const NOTIFS = [
  ['Priya', 'Your friend Priya just put $50 into an index fund. Priya is doing great.', '📈'],
  ['Streak', '🔥 Don’t break your streak! You’ve been a donor for 81 weeks straight.', '🦉'],
  ['Reminder', 'Your rent is due in 6 days.', '🏠'],
  ['Mom', 'Mom: “are you betting on football again?”', '💬'],
];
SCREENS.lobby = () => {
  ensureUserSoft();
  const L = ledger(history(), S.user.wage);
  $app.innerHTML = `${topbar()}
    <div class="tabs"><button class="on">Sportsbook</button><button data-go="charity">💚 Charity bets</button><button data-go="sources">Sources</button></div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <span class="chip pink">🔥 Donor streak: 81 weeks</span>
      <span class="chip gold">🥈 Silver Donor · ${money(Math.max(0, 2000 + L.net))} more to Platinum Whale</span>
      ${S.wins ? `<span class="chip" style="color:var(--green)">🏆 Real wins: ${S.wins} (${money(S.donated)} to GiveWell)</span>` : ''}
    </div>
    <p class="tiny muted" style="margin:8px 0 0">Hi ${esc(S.user.name)}. Lifetime net: <b style="color:var(--red)">${signedMoney(L.net, 0)}</b> (demo history)</p>
    ${GAMES.map(gameHTML).join('')}
    <div id="slip"></div>`;
  bindGo();
  $app.querySelectorAll('.odd').forEach((b) => b.onclick = () => toggleLeg(b.dataset.g, b.dataset.m, +b.dataset.s));
  renderSlip();
  NOTIFS.forEach(([t, body, icon], i) => later(() => toast(t, body, { icon }), 6000 + i * 11000));
};

function gameHTML(g) {
  const cell = (m, s) => {
    const o = g[m][s];
    const on = S.slip.some((l) => l.g === g.id && l.m === m && l.s === s);
    return `<button class="odd ${on ? 'on' : ''}" data-g="${g.id}" data-m="${m}" data-s="${s}">${o.label}<b>${fmtAmerican(o.odds)}</b></button>`;
  };
  return `<div class="card game">
    <div class="teams"><div>${g.away} @ ${g.home}</div><span>Sun ${g.time}</span></div>
    <div class="mk"><div class="hd">Spread</div><div class="hd">Moneyline</div><div class="hd">Total</div>
      ${cell('spread', 0)}${cell('ml', 0)}${cell('total', 0)}${cell('spread', 1)}${cell('ml', 1)}${cell('total', 1)}</div></div>`;
}

function toggleLeg(g, m, s) {
  const game = GAMES.find((x) => x.id === g);
  const idx = S.slip.findIndex((l) => l.g === g && l.m === m && l.s === s);
  const before = S.slip.length;
  if (idx >= 0) S.slip.splice(idx, 1);
  else {
    // One leg per game: same-game legs are correlated and this app doesn't price that.
    S.slip = S.slip.filter((l) => l.g !== g);
    const o = game[m][s], opp = game[m][1 - s];
    S.slip.push({ g, m, s, label: o.label, odds: o.odds, oppOdds: opp.odds, game: `${game.away} @ ${game.home}` });
    if (S.slip.length >= 2 && S.slip.length > before) sadTrombone();
  }
  save();
  $app.querySelectorAll('.odd').forEach((b) => {
    b.classList.toggle('on', S.slip.some((l) => l.g === b.dataset.g && l.m === b.dataset.m && l.s === +b.dataset.s));
  });
  renderSlip();
}

function renderSlip() {
  const el = document.getElementById('slip');
  $app.style.paddingBottom = S.slip.length ? '400px' : '';
  if (!S.slip.length) { el.innerHTML = ''; return; }
  const chain = S.slip.map((_, i) => slipStats(S.slip.slice(0, i + 1), 1).fair);
  const st = slipStats(S.slip, S.stake);
  el.innerHTML = `<div class="slip">
    <div class="row" style="justify-content:space-between;align-items:center"><b>Bet slip · ${S.slip.length} ${S.slip.length > 1 ? 'legs (parlay)' : 'leg'}</b>
      <button class="btn small ghost" id="clear">Clear</button></div>
    <div class="legs">${S.slip.map((l, i) => `<div class="leg"><span>${l.label} <span class="muted">${fmtAmerican(l.odds)} · ${l.game}</span></span><button data-i="${i}">✕</button></div>`).join('')}</div>
    <div class="drain">Chance to win: ${chain.map((p, i) => (i === chain.length - 1 ? `<b>${pct(p)}</b>` : pct(p, 0))).join(' → ')}
      ${S.slip.length > 1 ? `<br>House edge: ${pct(st.houseEdge)} and growing with every leg` : ''}</div>
    <div class="stake"><label style="margin:0">Stake $</label><input type="number" id="stake" min="1" value="${S.stake}">
      <span class="muted tiny">= ${(S.stake / S.user.wage).toFixed(1)} h of work · pays ${money(st.payout, 2)}</span></div>
    <button class="btn primary" id="review">Review Bet Facts →</button>
    <button class="btn iwin" id="iwin" style="margin-top:8px">🏆 I win: give ${money(S.stake)} to GiveWell instead</button></div>`;
  el.querySelector('#iwin').onclick = iWin;
  el.querySelectorAll('.leg button').forEach((b) => b.onclick = () => { S.slip.splice(+b.dataset.i, 1); save(); SCREENS.lobby(); });
  el.querySelector('#clear').onclick = () => { S.slip = []; save(); SCREENS.lobby(); };
  el.querySelector('#stake').onchange = (e) => { S.stake = Math.max(1, Math.round(+e.target.value || 1)); save(); renderSlip(); };
  el.querySelector('#review').onclick = () => go('facts');
}

// ---- bet facts: quiet, plain, no jokes ----------------------------------------
SCREENS.facts = () => {
  if (!S.slip.length) return go('lobby');
  $app.innerHTML = `<div class="paper">
      <button class="back" id="back">← Back to bet slip</button>
      ${factsHTML({ legs: S.slip, stake: S.stake, history: history(), wage: S.user.wage })}
    </div>
    <div class="decide">
      <p>You decide. Every button does exactly what it says.</p>
      <div class="row"><button class="btn" id="no">Don't place bet</button><button class="btn" id="yes">Place ${money(S.stake)} bet</button></div>
      <button class="btn iwin-paper" id="iwin">I win: give ${money(S.stake)} to GiveWell instead</button>
    </div>`;
  document.getElementById('iwin').onclick = iWin;
  document.getElementById('back').onclick = () => go('lobby');
  document.getElementById('no').onclick = () => { toast('Bet not placed', `${money(S.stake)} is still yours.`, { icon: '✓', gray: true }); go('lobby'); };
  document.getElementById('yes').onclick = placeBet;
};

function placeBet() {
  if (S.stake > S.balance) {
    toast('Insufficient (fake) funds', 'Let’s go through the deposit process again. All seven steps.', { icon: '💳' });
    return go('deposit');
  }
  const st = slipStats(S.slip, S.stake);
  const won = FORCED ? FORCED === 'win' : Math.random() < st.fair;
  S.balance -= S.stake;
  if (won) S.balance += st.payout;
  S.bets.push({
    date: new Date(), type: S.slip.length > 1 ? 'parlay' : 'straight', desc: slipTitle(S.slip), legs: S.slip.length,
    odds: S.slip.length === 1 ? S.slip[0].odds : null, fair: st.fair, decimal: st.decimal, stake: S.stake, won,
    net: won ? st.profitIfWin : -S.stake,
  });
  S.last = { won, stake: S.stake, ev: st.ev, profit: st.profitIfWin, title: slipTitle(S.slip) };
  S.slip = [];
  go('settling');
}

SCREENS.settling = () => {
  $app.innerHTML = `${topbar()}<div class="result"><div class="emoji">⏳</div><h2>Fast-forwarding to Sunday night…</h2>
    <p class="muted">${esc(S.last.title)}</p></div>`;
  later(() => go('result'), 2200);
};

SCREENS.result = () => {
  const r = S.last, L = ledger(history(), S.user.wage);
  if (r.won) {
    $app.innerHTML = `${topbar()}<div class="result" style="opacity:.8">
      <p class="muted">Bet settled: ${esc(r.title)}</p>
      <div class="card" style="text-align:left;background:#2b2b2b;border-color:#444">
        <b>You won ${money(r.profit, 2)}.</b>
        <p class="muted" style="font-size:14px;line-height:1.5">That was variance. The bet was still worth ${signedMoney(r.ev)} before it was settled.
        Your lifetime net is ${signedMoney(L.net, 0)}.</p>
        <p class="muted tiny">No confetti. Wins aren't evidence of skill, and we'd rather you didn't learn from this one.</p>
      </div>
      ${afterButtons()}</div>`;
    toast('Win', 'Please don’t read into it.', { icon: '🌧️', gray: true });
  } else {
    const yacht = Math.min(99, 60 + Math.round(r.stake / 5));
    $app.innerHTML = `${topbar()}<div class="result">
      <div class="emoji">🎉</div>
      <h1>Congratulations to The House!</h1>
      <p>Your ${money(r.stake)} has been allocated to:</p>
      <div class="card yacht"><div style="font-size:48px">🛥️</div><b>The CEO's third yacht</b>
        <div class="meter" style="margin-top:10px"><i style="width:${yacht}%"></i></div>
        <p class="tiny muted">Yacht fund: ${yacht}% funded, thanks to people like you</p></div>
      <p class="muted" style="font-size:13px;line-height:1.5">Honest version: the expected loss on this bet was ${money(-r.ev, 2)}. You lost ${money(r.stake)}.
      Over many bets, losses land close to the expected amount.</p>
      ${afterButtons()}</div>`;
    confetti({ emojis: ['🛥️', '💸', '🏦'] });
  }
  bindGo();
};
const afterButtons = () => `<div class="stack" style="margin-top:20px">
  <button class="btn green" data-go="cashout">Cash out &amp; quit forever</button>
  <button class="btn ghost" data-go="lobby">Bet again</button></div>`;

// ---- "I win": the one bet with a guaranteed payoff ----------------------------
const GIVEWELL_URL = 'https://www.givewell.org/top-charities-fund';
function iWin() {
  const st = slipStats(S.slip, S.stake);
  S.lastGift = { amount: S.stake, ev: st.ev, title: slipTitle(S.slip) };
  S.balance = Math.max(0, S.balance - S.stake);
  S.donated = (S.donated || 0) + S.stake;
  S.wins = (S.wins || 0) + 1;
  S.slip = [];
  go('givewell');
}

SCREENS.givewell = () => {
  const g = S.lastGift || { amount: S.stake, ev: 0, title: 'your bet' };
  $app.innerHTML = `${topbar()}
    <div class="result">
      <div class="emoji">🏆</div>
      <h1 style="color:var(--green)">You win.</h1>
      <p>Chance of winning: <b>100%</b>. It was never in doubt.</p>
      <div class="card" style="text-align:left;font-size:14px;line-height:1.6;margin-top:16px">
        Instead of <b>${esc(g.title)}</b>, ${money(g.amount)} goes to GiveWell's Top Charities Fund <span class="muted">(pretend money, like everything here)</span>.
        <div class="conv" style="margin-top:12px">
          <div><b style="color:var(--red)">${signedMoney(g.ev)}</b><span>expected value of the bet, for you</span></div>
          <div><b style="color:var(--green)">+${money(g.amount, 2)}</b><span>to charity, win or lose</span></div>
        </div>
        <p class="muted" style="font-size:13px;margin:12px 0 0">GiveWell estimates its top charities have typically saved a life for about
        $3,000–$5,500. ${money(g.amount)} is roughly ${pct(g.amount / 5500, 0)}–${pct(g.amount / 3000, 0)} of one.</p>
      </div>
      <p class="muted tiny" style="margin-top:12px">Lifetime wins: ${S.wins || 1} · Total given (pretend): ${money(S.donated || g.amount)}</p>
      <div class="stack" style="margin-top:16px">
        <a class="btn green" href="${GIVEWELL_URL}" target="_blank" rel="noopener" style="display:block;text-decoration:none">Do it for real at GiveWell ↗</a>
        <button class="btn ghost" data-go="lobby">Back to the sportsbook</button>
      </div>
    </div>`;
  bindGo();
  confetti({ colors: ['#35e39a', '#ffffff', '#ffcf3f'], emojis: ['🏆', '💚'] });
};

// ---- the only frictionless path ----------------------------------------------
SCREENS.cashout = () => {
  ensureUserSoft();
  const amount = S.balance, L = ledger(history(), S.user.wage);
  S.balance = 0; save();
  $app.innerHTML = `<div class="topbar">${logo}</div>
    <div class="result">
      <div class="emoji">🎆</div>
      <h1 style="color:var(--green)">${money(amount, 2)} withdrawn</h1>
      <p>That took one click. No forms, no “are you sure?”, no 3–5 business days.</p>
      <p class="muted" style="font-size:14px">Leaving is the one thing this app makes easy.</p>
      <div class="card" style="text-align:left;margin-top:20px;font-size:14px;line-height:1.6">
        Lifetime result (demo history + this session): <b style="color:var(--red)">${signedMoney(L.net, 0)}</b><br>
        That's ${L.net < 0 ? L.hours.toFixed(0) : 0} hours of work at ${money(S.user.wage)}/hr.<br>
        Invested for 30 years at ~7%/yr after inflation: <b style="color:var(--gold)">${money(futureValue(Math.max(0, -L.net), INDEX_REAL, 30))}</b>
      </div>
      <div class="stack" style="margin-top:20px">
        <button class="btn green" id="del">Delete my account (also one click)</button>
        <button class="btn ghost" data-go="lobby">Actually, keep betting</button>
      </div>
    </div>`;
  bindGo();
  fireworks();
  document.getElementById('del').onclick = () => {
    S = structuredClone(DEFAULT); S.cookies = true; save();
    go('deleted');
  };
};

SCREENS.deleted = () => {
  $app.innerHTML = `<div class="topbar">${logo}</div>
    <div class="result">
      <div class="emoji">🕊️</div>
      <h1>Account deleted.</h1>
      <p>Best bet you'll make on this app, and it had positive expected value.</p>
      <div class="card muted" style="text-align:left;font-size:13px;line-height:1.6;margin-top:24px">
        <b style="color:var(--text)">If betting has stopped being fun</b><br>
        US: call or text <b>1-800-GAMBLER</b> (National Problem Gambling Helpline, 24/7).<br>
        UK: <b>GamCare</b>, 0808 8020 133.
      </div>
      <div class="stack" style="margin-top:20px">
        <button class="btn ghost" data-go="sources">Where the numbers come from</button>
        <button class="btn ghost" data-go="landing">Start over (why?)</button>
      </div>
    </div>`;
  bindGo();
  confetti({ colors: ['#35e39a', '#ffffff', '#b6ffd9'], count: 80 });
};

// ---- charity mode: the only nice-looking bet ----------------------------------
const CHARITIES = ['GiveDirectly', 'Against Malaria Foundation', 'Your local food bank', 'Doctors Without Borders'];
SCREENS.charity = () => {
  ensureUserSoft();
  $app.innerHTML = `${topbar()}
    <div class="tabs"><button data-go="lobby">Sportsbook</button><button class="on">💚 Charity bets</button><button data-go="sources">Sources</button></div>
    <div class="charity">
      <h2>Bet a friend. Loser donates.</h2>
      <p style="font-size:14px;line-height:1.5">No house, no vig, no odds. You and a friend pick sides, and whoever loses gives the stake to charity.</p>
      <div class="stack">
        <div><label>Friend</label><input type="text" id="fr" placeholder="Kevin from work"></div>
        <div><label>Game</label><select id="gm">${GAMES.map((g) => `<option>${g.away} @ ${g.home}</option>`).join('')}</select></div>
        <div class="row"><div style="flex:1"><label>Stake</label><input type="number" id="amt" value="50" min="1"></div>
          <div style="flex:2"><label>Charity</label><select id="ch">${CHARITIES.map((c) => `<option>${c}</option>`).join('')}</select></div></div>
      </div>
      <div class="ev"><span>Expected value for charity</span><b id="ev">+$50.00</b>
        <span style="font-size:12px">Guaranteed. Whoever loses, someone gets helped. House edge: 0%.</span></div>
      <button class="btn" id="send">Send challenge</button>
    </div>`;
  bindGo();
  const amt = document.getElementById('amt');
  amt.oninput = () => (document.getElementById('ev').textContent = signedMoney(Math.max(0, +amt.value || 0)));
  document.getElementById('send').onclick = () => {
    const fr = document.getElementById('fr').value.trim() || 'your friend';
    toast('Challenge sent', `${esc(fr)} has been challenged. (Not really, it's a prototype. Do it for real anyway.)`, { icon: '💚' });
  };
};

SCREENS.sources = () => {
  $app.innerHTML = `${topbar()}
    <div class="tabs"><button data-go="lobby">Sportsbook</button><button data-go="charity">💚 Charity bets</button><button class="on">Sources</button></div>
    <h2>Where the numbers come from</h2>
    <p class="muted" style="font-size:14px;line-height:1.5">The jokes are jokes. The Bet Facts screen isn't: expected values are computed from the odds,
    and real-world loss rates come from state regulators and peer-reviewed or working papers. Games, odds and the demo betting history are simulated.</p>
    <ol class="sources">${Object.values(SOURCES).filter((s) => s.url).map((s) => `<li>${s.label}<br><a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></li>`).join('')}</ol>
    <p class="muted tiny">Help: 1-800-GAMBLER (US) · GamCare 0808 8020 133 (UK)</p>`;
  bindGo();
};

// ---- boot -------------------------------------------------------------------
const start = P.get('start');
if (start) { ensureUser(); S.cookies = true; }
if (start === 'facts' && !S.slip.length) {
  S.slip = [GAMES[0], GAMES[2], GAMES[3]].map((g) => ({ g: g.id, m: 'spread', s: 0, label: g.spread[0].label, odds: g.spread[0].odds, oppOdds: g.spread[1].odds, game: `${g.away} @ ${g.home}` }));
}
go(start || (['settling', 'processing', 'ad', 'confirm'].includes(S.screen) ? 'lobby' : S.screen));
