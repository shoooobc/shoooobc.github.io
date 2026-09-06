/* ==========================================================================
   珈琲の店 もっく
   ライブラリは使わない。素の DOM API と CSS transition だけで組む。
   動きの定義は REQUIREMENTS-v2.md §5 にある。
   ========================================================================== */

'use strict';

/* --- 取得先。Apps Script ができたら、この1行を差し替えるだけで動く。 --- */
const BEANS_URL = './data/beans.json'; // TODO: Apps Script のURLに差し替え

const CACHE_MS = 5 * 60 * 1000;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   計測
   送信先ができるまでは console に出すだけ。呼ぶ場所は変えなくてよい。
   ========================================================================== */

function trackEvent(action, source) {
  // TODO: Apps Script のエンドポイントに POST してスプレッドシートに追記
  console.log('[track]', action, source, new Date().toISOString());
}

/* 流入元は、そのセッションで最初に開いたページの referrer で決める。
   サイト内を回るたびに「直接」に化けないようにするため。 */
function visitSource() {
  try {
    const saved = sessionStorage.getItem('mokku_source');
    if (saved) return saved;
  } catch (e) { /* プライベートモードなど。無視してよい */ }

  const ref = document.referrer || '';
  let source = '直接';
  if (ref) {
    if (/google\./i.test(ref)) source = 'Google';
    else if (/instagram\./i.test(ref)) source = 'Instagram';
    else if (/tabelog\./i.test(ref)) source = '食べログ';
    else if (!ref.includes(location.host)) source = 'その他';
    else source = '';
  }

  if (source) {
    try { sessionStorage.setItem('mokku_source', source); } catch (e) {}
    return source;
  }
  return '直接';
}

const SOURCE = visitSource();

function bindTracking() {
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-track]');
    if (el) trackEvent(el.dataset.track, SOURCE);
  });
}

/* ==========================================================================
   取得（5分キャッシュ・失敗してもサイトは壊さない）
   ========================================================================== */

async function loadJSON(url, key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const hit = JSON.parse(raw);
      if (Date.now() - hit.at < CACHE_MS) return hit.data;
    }
  } catch (e) {}

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) {}
    return data;
  } catch (e) {
    return null; // 画面にエラーは出さない
  }
}

/* ==========================================================================
   豆
   ========================================================================== */

const ROAST_COLOR = {
  '浅煎り':   '#8A5A32',
  '中煎り':   '#6B3F22',
  '中深煎り': '#4A2A17',
  '深煎り':   '#2E1A10'
};

const SHELVES = [
  { key: 'upper', label: 'UPPER SHELF', ja: '上の段' },
  { key: 'lower', label: 'LOWER SHELF', ja: '下の段' }
];

function daysSince(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const FMT_MD = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric' });
const FMT_YMDW = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
});

function jaDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return FMT_MD.format(d);
}

/* beans.html — 豆の帯を並べる
   beans.html には同じ形の帯が静的に書いてある。取得できたらここで描き直す。
   取得に失敗しても、静的な帯がそのまま残る。 */
function renderShelves(beans) {
  const wrap = document.getElementById('shelves');
  if (!wrap) return;

  wrap.textContent = '';

  SHELVES.forEach(function (shelf) {
    const list = beans.filter(function (b) { return (b.shelf || 'upper') === shelf.key; });
    if (!list.length) return;

    const sec = document.createElement('section');
    sec.className = 'shelf';

    const h2 = document.createElement('h2');
    h2.className = 'shelf__label';
    h2.innerHTML = '<span translate="no">' + shelf.label + '</span>' +
                   '<span class="sr-only">（' + shelf.ja + '）</span>';
    sec.appendChild(h2);

    const ul = document.createElement('ul');
    ul.className = 'beans';

    list.forEach(function (bean, i) {
      const id = 'bean-' + shelf.key + '-' + i;

      const li = document.createElement('li');
      li.className = 'bean reveal' + (bean.soldOut ? ' bean--empty' : '');
      if (i < 6) li.dataset.i = String(i);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bean__row';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id);
      btn.innerHTML = beanRowHTML(bean);

      const detail = document.createElement('div');
      detail.className = 'bean__detail';
      detail.id = id;
      detail.innerHTML = '<div><p class="bean__spec">' + beanSpecHTML(bean) + '</p></div>';

      btn.addEventListener('click', function () { openBean(btn, detail); });

      li.appendChild(btn);
      li.appendChild(detail);
      ul.appendChild(li);
    });

    sec.appendChild(ul);
    wrap.appendChild(sec);
  });

  observeReveals();
}

/* 帯の頭。焙煎度の色バー・名前・焙煎日・店主のひとこと（1行）。 */
function beanRowHTML(bean) {
  const days = daysSince(bean.roastedOn);
  const fresh = !bean.soldOut && days !== null && days <= 7;

  let when;
  if (bean.soldOut) {
    when = '<b>切らしています</b>';
  } else if (fresh) {
    when = '<b>焼きたて</b><i>/</i>' + esc(jaDate(bean.roastedOn)) + ' 焙煎';
  } else {
    when = '<b>' + esc(jaDate(bean.roastedOn)) + ' 焙煎</b>';
  }
  if (bean.roast) when += '<i>/</i>' + esc(bean.roast);

  return '<span class="bean__bar" aria-hidden="true"' +
           (bean.soldOut ? '' :
             ' style="--roast:' + (ROAST_COLOR[bean.roast] || '#4A2A17') + '"') + '></span>' +
         '<span class="bean__id">' +
           '<span class="bean__en" translate="no">' + esc(bean.nameEn || bean.name) + '</span>' +
           '<span class="bean__ja">' + esc(bean.name) + '</span>' +
         '</span>' +
         '<span class="bean__when' + (fresh ? ' bean__when--fresh' : '') + '">' + when + '</span>' +
         '<span class="bean__say">' + esc(bean.comment || '') + '</span>';
}

/* 開いたときに出る、産地の1行。 */
function beanSpecHTML(bean) {
  const spec = [bean.origin, bean.farm, bean.process, bean.notes]
    .filter(Boolean)
    .map(function (v) { return '<span>' + esc(v) + '</span>'; })
    .join('<i aria-hidden="true">　/　</i>');

  return spec;
}

/* 帯の開閉。このサイトで唯一、人の操作に返す動き。 */
function openBean(btn, detail) {
  const already = btn.getAttribute('aria-expanded') === 'true';

  document.querySelectorAll('.bean__row[aria-expanded="true"]').forEach(function (b) {
    b.setAttribute('aria-expanded', 'false');
    const d = document.getElementById(b.getAttribute('aria-controls'));
    if (d) d.classList.remove('is-open');
  });

  if (already) return;

  btn.setAttribute('aria-expanded', 'true');
  detail.classList.add('is-open');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ページに埋めてある控え。fetch が使えない環境（ローカルで直接開いたときなど）でも
   瓶が開くようにするため。 */
function seedBeans() {
  const el = document.getElementById('beans-seed');
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
}

async function renderBeans() {
  if (!document.getElementById('shelves')) return;

  const data = (await loadJSON(BEANS_URL, 'mokku_beans')) || seedBeans();
  if (!data || !Array.isArray(data.beans) || !data.beans.length) return; // 静的な棚をそのまま残す

  renderShelves(data.beans);
}

/* ==========================================================================
   スクロール表示（1種類だけ。一度出したら二度と動かさない）
   ========================================================================== */

let revealObserver = null;

function observeReveals() {
  if (REDUCED) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12%' });
  }
  document.querySelectorAll('.reveal:not(.is-in)').forEach(function (el) {
    revealObserver.observe(el);
  });
}

/* ==========================================================================
   ヒーローの写真（クロスフェード）
   ========================================================================== */

/* ヒーローを見送ったらヘッダーを出す。ヒーローがないページでは最初から出す。 */
function watchHero() {
  const hero = document.querySelector('.hero');
  if (!hero) { document.body.classList.add('is-scrolled'); return; }
  if (!('IntersectionObserver' in window)) { document.body.classList.add('is-scrolled'); return; }

  new IntersectionObserver(function (entries) {
    document.body.classList.toggle('is-scrolled', !entries[0].isIntersecting);
  }, { rootMargin: '-70% 0px 0px 0px' }).observe(hero);
}

function heroCrossfade() {
  const hero = document.querySelector('.hero');
  const shots = document.querySelectorAll('.hero__photo');
  if (!hero || shots.length < 2 || REDUCED) return; // 動きを減らす設定では1枚目で固定

  // ヒーローが画面の外に出たら止める。見えていないものを動かし続けない。
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(hero);
  }

  let i = 0;
  setInterval(function () {
    if (document.hidden || !visible) return;
    shots[i].classList.remove('is-on');
    i = (i + 1) % shots.length;
    shots[i].classList.add('is-on');
  }, 6000);
}

/* ==========================================================================
   ページ内リンクはゆっくり動かす（1100ms）
   ========================================================================== */

let scrollRun = 0; // 走っているアニメーションの番号。増やせば前のものは止まる。

function stopScrollAnim() { scrollRun++; }

function slowAnchors() {
  // 人が自分で動かしたら、こちらの動きは譲る
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, stopScrollAnim, { passive: true });
  });

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return; // スキップリンクはブラウザに任せる（焦点も移る）
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;

    e.preventDefault();

    // 位置を測るのは1回だけ。あとは書き込むだけにする。
    // 固定ヘッダーの高さだけ手前で止める（scroll-padding は scrollTo に効かない）。
    const head = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--head')) || 0;
    const from = window.scrollY;
    const to = Math.max(0, target.getBoundingClientRect().top + from - head - 16);

    if (REDUCED) { window.scrollTo(0, to); return; }

    const mine = ++scrollRun;
    const dist = to - from;
    const dur = 1100;
    const start = performance.now();

    requestAnimationFrame(function step(now) {
      if (mine !== scrollRun) return; // 割り込まれた
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic。CSS と同じ気持ちで動かす
      window.scrollTo(0, from + dist * eased);
      if (t < 1) requestAnimationFrame(step);
    });
  });
}

/* ==========================================================================
   スマホのメニュー
   ========================================================================== */

function setupMenu() {
  const btn = document.getElementById('burger');
  const panel = document.getElementById('menupanel');
  if (!btn || !panel) return;

  /* Tab で回る輪。ハンバーガーは面の上に見えたままなので、輪の先頭に入れる。 */
  function ring() {
    return [btn].concat(Array.prototype.slice.call(
      panel.querySelectorAll('a[href], button:not([disabled])')
    ));
  }

  function open() {
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-menuopen');
    const first = panel.querySelector('a[href]');
    if (first) first.focus();
  }

  function close(focusBack) {
    panel.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-menuopen');
    if (REDUCED) { panel.hidden = true; }
    else { setTimeout(function () { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 400); }
    if (focusBack) btn.focus();
  }

  btn.addEventListener('click', function () {
    if (btn.getAttribute('aria-expanded') === 'true') close(false); else open();
  });

  // 中の行き先を選んだら閉じる
  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') close(true);
  });

  /* 面はページ全体を覆って body のスクロールも止めている。
     見えていない後ろのリンクへ Tab が抜けないよう、輪の中で折り返す。 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    if (btn.getAttribute('aria-expanded') !== 'true') return;
    const f = ring();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // 画面が広がってナビが横に並ぶようになったら、開いた状態を畳む
  // （この 1024px は style.css のナビ切り替えと同じ幅。ずらすと畳み損ねる）
  window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) {
    if (m.matches && btn.getAttribute('aria-expanded') === 'true') close(false);
  });
}

/* ==========================================================================
   メニューの開閉（スマホのみ）
   3つのまとまりを畳んでおく。開いたものだけが伸びるので、余白が残らない。
   PC は全部開いたまま、操作もしない。
   ========================================================================== */

function setupMenuGroups() {
  const toggles = Array.prototype.slice.call(document.querySelectorAll('.menu__toggle'));
  if (!toggles.length) return;

  const wide = window.matchMedia('(min-width: 768px)');

  function body(t) { return document.getElementById(t.getAttribute('aria-controls')); }

  function sync() {
    toggles.forEach(function (t, i) {
      const b = body(t);
      if (!b) return;
      if (wide.matches) {
        // 幅があるときは全部見せる。ボタンとしても働かせない。
        t.setAttribute('aria-expanded', 'true');
        t.disabled = true;
        b.classList.add('is-open');
      } else {
        t.disabled = false;
        const open = i === 0;
        t.setAttribute('aria-expanded', String(open));
        b.classList.toggle('is-open', open);
      }
    });
  }

  toggles.forEach(function (t) {
    t.addEventListener('click', function () {
      if (wide.matches) return;
      const b = body(t);
      const open = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-expanded', String(!open));
      if (b) b.classList.toggle('is-open', !open);
    });
  });

  wide.addEventListener('change', sync);
  sync();
}

/* ==========================================================================
   ギフトボックス（中身の切り替え）
   ========================================================================== */

function setupGift() {
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.gift__tab'));
  if (tabs.length < 2) return;

  const panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
  const shots = Array.prototype.slice.call(document.querySelectorAll('.gift__shot'));

  function select(i, moveFocus) {
    tabs.forEach(function (t, n) {
      t.setAttribute('aria-selected', String(n === i));
      t.tabIndex = n === i ? 0 : -1;
      if (panels[n]) panels[n].hidden = n !== i;
      if (shots[n]) shots[n].classList.toggle('is-on', n === i);
    });
    if (moveFocus) tabs[i].focus();
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, false); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((i + 1) % tabs.length, true); }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      if (e.key === 'End')  { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });

  select(0, false);
}

/* ==========================================================================
   ご注文の予約フォーム
   品目の選択も金額の計算もしない（REQUIREMENTS-v2 §4-6）
   ========================================================================== */

function submitOrder(formData) {
  // TODO: Apps Script のエンドポイントに POST
}

/* 受け取りの日と時間。
   休みの日を「選べない」ようにしたいので、input[type=date] ではなく
   選べる日だけを入れた select にしている。datetime-local は iOS の実機で
   横にはみ出るのと、定休日を落とせないのとで、2つに分けた。 */
const CLOSED_DAYS  = [2, 3];                                  // 火・水は定休
const CLOSED_DATES = ['12-31', '01-01', '01-02', '01-03'];    // 年末年始
const PICKUP_FROM  = 10 * 60;          // 10:00
const PICKUP_TO    = 17 * 60 + 30;     // 17:30
const PICKUP_STEP  = 30;               // 30分刻み
const PICKUP_LEAD  = 60;               // 当日は「いまから1時間後」より後だけ
const PICKUP_MONTHS = 1;               // 1か月先まで
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function ymd(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function isClosedDay(d) {
  if (CLOSED_DAYS.indexOf(d.getDay()) !== -1) return true;
  return CLOSED_DATES.indexOf(pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())) !== -1;
}

/* その日に選べる最初の時刻（分）。当日だけ、いまから1時間後に繰り上がる。 */
function earliestMinutes(dateStr) {
  const now = new Date();
  if (dateStr !== ymd(now)) return PICKUP_FROM;
  const m = now.getHours() * 60 + now.getMinutes() + PICKUP_LEAD;
  return Math.max(PICKUP_FROM, Math.ceil(m / PICKUP_STEP) * PICKUP_STEP);
}

function minutesToHM(m) { return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); }

/* 日の候補。当日から1か月先まで。休みの日と、もう間に合わない当日は入れない。 */
function fillPickupDates(dateSel) {
  const keep = dateSel.value;
  dateSel.textContent = '';
  dateSel.appendChild(new Option('選んでください', ''));

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setMonth(to.getMonth() + PICKUP_MONTHS);
  // 1/31 の1か月後が 3/3 になるのを避け、月末に丸める
  if (to.getDate() !== from.getDate()) to.setDate(0);

  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (isClosedDay(d)) continue;
    const value = ymd(d);
    if (earliestMinutes(value) > PICKUP_TO) continue;   // 今日はもう間に合わない
    const label = (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEKDAY_JA[d.getDay()] + '）';
    dateSel.appendChild(new Option(label, value));
  }

  // 選び直しの手間を増やさない。まだ選べる日なら選択を残す。
  if (keep) dateSel.value = keep;
}

/* 時間の候補。選ばれた日によって、始まりが変わる。 */
function fillPickupTimes(timeSel, dateStr) {
  const keep = timeSel.value;
  timeSel.textContent = '';

  if (!dateStr) {
    timeSel.appendChild(new Option('日をお選びください', ''));
    timeSel.disabled = true;
    return;
  }

  timeSel.disabled = false;
  timeSel.appendChild(new Option('選んでください', ''));
  for (let m = earliestMinutes(dateStr); m <= PICKUP_TO; m += PICKUP_STEP) {
    const hm = minutesToHM(m);
    timeSel.appendChild(new Option(hm, hm));
  }
  if (keep) timeSel.value = keep;
}

/* ページを開きっぱなしにしていると、候補が古くなる。送る前にもう一度見る。 */
function pickupProblem(form) {
  const dateSel = form.querySelector('#f-date');
  const timeSel = form.querySelector('#f-time');
  if (!dateSel || !timeSel || !dateSel.required) return '';   // 配送のときは見ない
  if (!dateSel.value || !timeSel.value) return '';            // 未入力はブラウザが止める

  const ymdPart = dateSel.value.split('-').map(Number);
  const hmPart  = timeSel.value.split(':').map(Number);
  const picked = new Date(ymdPart[0], ymdPart[1] - 1, ymdPart[2], hmPart[0], hmPart[1]);

  if (picked.getTime() < Date.now() + PICKUP_LEAD * 60000) {
    return 'お選びいただいた日時が、いまから1時間以内になりました。選び直してください。';
  }
  return '';
}

function setupOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;

  const msg     = document.getElementById('order-msg');   // 送信中などの状態（role="status"）
  const whenErr = document.getElementById('when-error');  // 受け取り日時の不備（role="alert"）
  const dateSel = form.querySelector('#f-date');
  const timeSel = form.querySelector('#f-time');
  const whenWrap = document.getElementById('f-when-wrap');
  const addrWrap = document.getElementById('f-addr-wrap');

  function clearWhenError() {
    if (whenErr) whenErr.textContent = '';
    if (dateSel) dateSel.removeAttribute('aria-invalid');
    if (timeSel) timeSel.removeAttribute('aria-invalid');
  }

  if (dateSel && timeSel) {
    fillPickupDates(dateSel);
    fillPickupTimes(timeSel, dateSel.value);
    dateSel.addEventListener('change', function () {
      fillPickupTimes(timeSel, dateSel.value);
      clearWhenError();
      if (msg) msg.textContent = '';
    });
  }

  /* 受け取り方法で、そのあとに聞くことが変わる。
     店頭 → 日時を聞く。配送 → 配送先を聞く。まだ選んでいなければ、どちらも出さない。
     隠したままの required は送信を止めてしまうので、必ず一緒に外す。 */
  const addrEl = form.querySelector('#f-addr');

  function syncDelivery() {
    const picked = form.querySelector('input[name="giftDelivery"]:checked');
    const mode = picked ? picked.value : '';
    const toShop = mode === '店頭';
    const toShip = mode === '配送';

    if (whenWrap) whenWrap.hidden = !toShop;
    if (dateSel) { dateSel.required = toShop; dateSel.disabled = !toShop; }
    if (timeSel) { timeSel.required = toShop; }
    if (addrWrap) addrWrap.hidden = !toShip;
    if (addrEl)  { addrEl.required = toShip; }
    clearWhenError();
    if (msg) msg.textContent = '';
  }

  form.querySelectorAll('input[name="giftDelivery"]').forEach(function (r) {
    r.addEventListener('change', syncDelivery);
  });
  syncDelivery();

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // 必須項目の確認はブラウザが済ませている

    // 開きっぱなしのあいだに時間が過ぎていないか、ここでもう一度見る
    const problem = pickupProblem(form);
    if (problem) {
      fillPickupDates(dateSel);
      fillPickupTimes(timeSel, dateSel.value);
      // 直す場所のすぐ下に出す。ボタンの下に書くと、飛んだ先から文章が見えない。
      if (whenErr) whenErr.textContent = problem;
      if (msg) msg.textContent = '';
      dateSel.setAttribute('aria-invalid', 'true');
      timeSel.setAttribute('aria-invalid', 'true');
      dateSel.focus();
      return;
    }

    trackEvent('order_submit', SOURCE);
    keepOrderSummary(form);
    submitOrder(new FormData(form));
    if (msg) msg.textContent = 'お預かりしています…';
    // Apps Script につないだら、POST の完了を待ってからここへ来る
    location.href = 'thanks.html';
  });
}

/* 送った内容を thanks.html で出すために預ける。
   静的サイトなのでサーバに聞けない。タブを閉じたら消える sessionStorage に置く。 */
const ORDER_KEY = 'mokku_order';

function keepOrderSummary(form) {
  // ラジオは RadioNodeList。value がそのまま選ばれている方を返す。
  const get = function (name) {
    const el = form.elements[name];
    return el && el.value ? String(el.value).trim() : '';
  };

  const toShop = get('giftDelivery') === '店頭';
  const rows = [
    ['お名前', get('name')],
    ['電話番号', get('tel')],
    ['メールアドレス', get('email')],
    ['中身の組み合わせ', get('giftContent')],
    ['白い帯', get('giftBand')],
    ['受け取り方法', get('giftDelivery')],
    [toShop ? '受け取り希望' : '', toShop ? pickupLabel(get('date'), get('time')) : ''],
    [toShop ? '' : '配送先', toShop ? '' : get('address')],
    ['中身のご希望', get('memo')]
  ].filter(function (r) { return r[0] && r[1]; });

  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(rows));
  } catch (e) { /* プライベートモードなど。thanks.html は控えなしで出す */ }
}

function pickupLabel(dateStr, timeStr) {
  if (!dateStr) return '';
  const p = dateStr.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEKDAY_JA[d.getDay()] + '）' +
         (timeStr ? '　' + timeStr : '');
}

/* thanks.html — 送った内容の控え。無ければ何も出さない。 */
function renderOrderRecap() {
  const wrap = document.getElementById('order-recap');
  if (!wrap) return;

  let rows;
  try { rows = JSON.parse(sessionStorage.getItem(ORDER_KEY) || 'null'); } catch (e) { rows = null; }
  if (!Array.isArray(rows) || !rows.length) return;

  const dl = document.createElement('dl');
  dl.className = 'recap__list';
  rows.forEach(function (r) {
    const dt = document.createElement('dt');
    dt.textContent = r[0];
    const dd = document.createElement('dd');
    dd.textContent = r[1];
    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  wrap.appendChild(dl);
  wrap.hidden = false;
}

/* ==========================================================================
   クーポン
   静的サイトなので「一人一回」は保証できない。
   日付を出すこと、前の日に開いていたら記録が残ること、この2つだけ担保する。
   ========================================================================== */

function setupCoupon() {
  const dateEl = document.getElementById('today');
  if (!dateEl) return;

  const now = new Date();
  dateEl.textContent = FMT_YMDW.format(now);

  const key = 'mokku_coupon_used';
  const todayKey = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

  try {
    const first = localStorage.getItem(key);
    // 同じ日に何度開いても券面はそのまま。別の日に開いていた形跡があるときだけ知らせる。
    if (first && first !== todayKey) {
      document.getElementById('used').hidden = false;
    }
    if (!first) localStorage.setItem(key, todayKey);
  } catch (e) { /* プライベートモードなど。券面は普通に出す */ }

  // 券面が実際に画面に出た時点で1回。レジで見せた可能性が高いのはこちら。
  trackEvent('coupon_shown', SOURCE);
}

/* ==========================================================================
   起動
   静的な表示は fetch の完了を待たない。
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  bindTracking();
  observeReveals();
  slowAnchors();
  setupOrderForm();
  renderOrderRecap();
  setupMenu();
  setupMenuGroups();
  setupGift();
  setupCoupon();
  watchHero();
  heroCrossfade();

  // ヒーローと券面の登場。ローディング画面は作らないので、ここが第一印象になる。
  requestAnimationFrame(function () {
    document.body.classList.add('is-ready');
  });

  if (document.getElementById('shelves')) trackEvent('beans_view', SOURCE);
  if (document.body.classList.contains('coupon-page')) trackEvent('coupon_view', SOURCE);

  renderBeans();
});
