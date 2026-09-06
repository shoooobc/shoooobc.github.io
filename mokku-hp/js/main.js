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

/* beans.html — 棚に並べる
   beans.html には同じ形の棚が静的に書いてある。取得できたらここで描き直す。
   取得に失敗しても、静的な棚がそのまま残る。 */
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

    const unit = document.createElement('div');
    unit.className = 'shelf__unit';

    const jars = document.createElement('div');
    jars.className = 'jars';

    const panel = document.createElement('div');
    panel.className = 'beanpanel';
    panel.id = 'panel-' + shelf.key;
    panel.innerHTML = '<div class="beanpanel__in"><div class="beanpanel__pad"></div></div>';
    const pad = panel.querySelector('.beanpanel__pad');

    list.forEach(function (bean, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jar reveal' + (bean.soldOut ? ' jar--empty' : '');
      if (i < 6) btn.dataset.i = String(i);
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', panel.id);

      const days = daysSince(bean.roastedOn);
      let state, fresh = false;
      if (bean.soldOut) {
        state = '切らしています';
      } else if (days !== null && days <= 7) {
        state = '焼きたて';
        fresh = true;
      } else {
        state = jaDate(bean.roastedOn) + ' 焙煎';
      }

      btn.innerHTML =
        '<span class="jar__lid" aria-hidden="true"></span>' +
        '<span class="jar__glass">' +
          (bean.soldOut ? '' :
            '<span class="jar__beans" style="--roast:' +
              (ROAST_COLOR[bean.roast] || '#4A2A17') + '"></span>') +
          '<span class="jar__shine" aria-hidden="true"></span>' +
          '<span class="jar__label" translate="no">' + esc(bean.nameEn || bean.name) + '</span>' +
        '</span>' +
        '<span class="jar__name">' + esc(bean.name) +
          '<span class="jar__state' + (fresh ? ' jar__state--fresh' : '') + '">' +
            esc(state) + '</span>' +
        '</span>';

      btn.addEventListener('click', function () {
        openBean(btn, bean, panel, pad);
      });

      jars.appendChild(btn);
    });

    const board = document.createElement('div');
    board.className = 'shelf__board';
    board.setAttribute('aria-hidden', 'true');
    const edge = document.createElement('div');
    edge.className = 'shelf__edge';
    edge.setAttribute('aria-hidden', 'true');

    unit.appendChild(jars);
    unit.appendChild(board);
    unit.appendChild(edge);

    sec.appendChild(unit);
    sec.appendChild(panel);
    wrap.appendChild(sec);
  });

  observeReveals();
}

/* 瓶の開閉。このサイトで唯一、人の操作に返す動き。 */
function openBean(btn, bean, panel, pad) {
  const already = btn.getAttribute('aria-expanded') === 'true';

  document.querySelectorAll('.jar[aria-expanded="true"]').forEach(function (b) {
    b.setAttribute('aria-expanded', 'false');
  });

  if (already) {
    panel.classList.remove('is-open');
    return;
  }

  btn.setAttribute('aria-expanded', 'true');

  const spec = [
    bean.origin,
    bean.farm,
    bean.process,
    bean.roast,
    bean.roastedOn ? jaDate(bean.roastedOn) + ' 焙煎' : ''
  ].filter(Boolean).join('　/　');

  pad.innerHTML =
    '<p class="beanpanel__comment">' + esc(bean.comment || '') + '</p>' +
    (bean.notes ? '<p class="beanpanel__spec">' + esc(bean.notes) + '</p>' : '') +
    '<p class="beanpanel__spec">' + esc(spec) + '</p>' +
    (bean.soldOut
      ? '<p class="beanpanel__sold">いまは切らしています。焼き上がったらまた瓶に入れます。</p>'
      : '');

  panel.classList.add('is-open');
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

  function open() {
    panel.hidden = false;
    requestAnimationFrame(function () { panel.classList.add('is-open'); });
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-menuopen');
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

  // 画面が広がってメニューが並ぶようになったら、開いた状態を畳む
  window.matchMedia('(min-width: 768px)').addEventListener('change', function (m) {
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

function setupOrderForm() {
  const form = document.getElementById('order-form');
  if (!form) return;

  // 配送先は「配送してもらう」を選んだときだけ出す
  const addrWrap = document.getElementById('f-addr-wrap');
  form.querySelectorAll('input[name="giftDelivery"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (addrWrap) addrWrap.hidden = r.value !== '配送' || !r.checked;
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // 必須項目の確認はブラウザが済ませている
    trackEvent('order_submit', SOURCE);
    submitOrder(new FormData(form));
    document.getElementById('order-msg').textContent = 'お預かりしています…';
    // Apps Script につないだら、POST の完了を待ってからここへ来る
    location.href = 'thanks.html';
  });
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
