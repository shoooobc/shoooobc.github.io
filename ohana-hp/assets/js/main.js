// 全ページ共通のエントリーポイント

import { initHoursStatus, initHoursTable } from "./hours-status.js";
import { initNav } from "./nav.js";
import { initActionBar } from "./action-bar.js";
import { initAnalytics } from "./analytics.js";

// 横にスクロールする領域は、キーボードでも動かせるように Tab で止まれるようにする（スクロールできる幅のときだけ）
function initScrollableRegions() {
  const regions = [...document.querySelectorAll("[data-scroll-region]")];
  const update = () => {
    for (const el of regions) {
      if (el.scrollWidth > el.clientWidth + 1) el.setAttribute("tabindex", "0");
      else el.removeAttribute("tabindex");
    }
  };
  update();
  window.addEventListener("resize", update, { passive: true });
}

// 地図（iframe）の中にフォーカスが移ったことは親ページの CSS では拾えないので、クラスで示す
function initIframeFocus() {
  const frames = [...document.querySelectorAll(".access__map iframe")];
  if (!frames.length) return;
  const update = () => {
    for (const frame of frames) frame.parentElement.classList.toggle("is-focused", document.activeElement === frame);
  };
  window.addEventListener("blur", () => setTimeout(update, 0));
  window.addEventListener("focus", update);
  document.addEventListener("focusin", update);
}

// コピーライトの年を自動で更新する（放置されても古くならないように）
for (const el of document.querySelectorAll("[data-current-year]")) {
  el.textContent = String(new Date().getFullYear());
}

initHoursStatus();
initHoursTable();
initNav();
initActionBar();
initAnalytics();
initScrollableRegions();
initIframeFocus();
