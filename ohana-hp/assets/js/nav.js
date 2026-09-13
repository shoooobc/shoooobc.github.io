// スマホ・タブレットのドロワーメニュー
// - 開いている間はページの他の部分を inert にし、背景のスクロールを止める
// - Esc・背景のタップ・閉じるボタン・リンクのタップで閉じ、フォーカスをメニューボタンに戻す

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function initNav() {
  const button = document.querySelector(".menu-button[aria-controls]");
  const drawer = button && document.getElementById(button.getAttribute("aria-controls"));
  if (!drawer) return;

  const panel = drawer.querySelector(".drawer__panel");
  const label = button.querySelector(".visually-hidden");
  const outside = [...document.body.children].filter((el) => el !== drawer && el.tagName !== "SCRIPT");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let closeTimer;

  const isOpen = () => button.getAttribute("aria-expanded") === "true";

  /** 閉じるアニメーションが終わるのを待つ（動きを減らす設定では待たない） */
  const afterTransition = (callback) => {
    clearTimeout(closeTimer);
    if (reducedMotion.matches) return callback();
    const done = () => {
      clearTimeout(closeTimer);
      panel.removeEventListener("transitionend", done);
      callback();
    };
    panel.addEventListener("transitionend", done, { once: true });
    closeTimer = setTimeout(done, 600); // transitionend が来ない場合の保険
  };

  function open() {
    if (isOpen()) return;
    clearTimeout(closeTimer);
    drawer.hidden = false;
    // hidden を外した直後にクラスを付けると動きが出ないので、1フレーム待つ
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add("is-open")));

    button.setAttribute("aria-expanded", "true");
    if (label) label.textContent = "メニューを閉じる";
    document.documentElement.classList.add("is-drawer-open");
    // パネルがメニューボタンの上に重なるので、ヘッダーを含めてドロワーの外はすべて操作できなくする
    outside.forEach((el) => (el.inert = true));

    // 閉じるボタンにフォーカスを移す（開いたことがスクリーンリーダーにも伝わる）
    panel.querySelector(".drawer__close")?.focus();
  }

  function close({ returnFocus = true } = {}) {
    if (!isOpen()) return;
    drawer.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    if (label) label.textContent = "メニューを開く";
    document.documentElement.classList.remove("is-drawer-open");
    outside.forEach((el) => (el.inert = false));

    afterTransition(() => {
      if (!isOpen()) drawer.hidden = true;
    });
    if (returnFocus) button.focus();
  }

  button.addEventListener("click", () => (isOpen() ? close() : open()));

  drawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) {
      close();
      return;
    }
    // リンクをタップしたら閉じる（移動はそのままブラウザに任せる）
    const link = event.target.closest("a[href]");
    if (link) close({ returnFocus: false });
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    // Tab でドロワーの中だけを行き来する（inert を使えない古いブラウザ向けの保険）
    if (event.key === "Tab") {
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // PC 幅に広げたら閉じる
  matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
    if (event.matches) close({ returnFocus: false });
  });
}
