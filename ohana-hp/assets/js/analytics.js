// アクセス解析（GA4）
//
// - 測定 ID が仮（G-XXXXXXXXXX）のままなら、Google には何も送らない
//   （イベントは window.__ohanaEvents に貯めるだけ。?debug_analytics を付けるとコンソールに出す）
// - クリックはページ全体で1か所だけ受け取り、リンク先から種類を判定する
//   → HTML にボタンを増やしても、計測の書き漏れが起きない

// 仮: GA4 の測定 ID（オーナー確認後に差し替える）
export const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

const isPlaceholderId = (id) => !/^G-[A-Z0-9]{6,}$/.test(id) || /^G-X+$/.test(id);
const debug = new URLSearchParams(location.search).has("debug_analytics");

window.__ohanaEvents = window.__ohanaEvents || [];

function loadGtag(id) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

/** イベントを送る（仮の ID のときは貯めるだけ） */
export function track(name, params = {}) {
  const event = { name, params: { page: location.pathname, ...params } };
  window.__ohanaEvents.push(event);
  if (debug) console.info("[analytics]", event.name, event.params);
  if (typeof window.gtag === "function") window.gtag("event", name, event.params);
}

/** クリックされた場所の名前（どのボタンから押されたかを比べるため） */
function placeOf(el) {
  const named = el.closest("[data-track-place]");
  if (named) return named.dataset.trackPlace;
  if (el.closest(".action-bar")) return "action_bar";
  if (el.closest(".drawer")) return "drawer";
  if (el.closest(".site-info")) return "info_bar";
  if (el.closest(".site-header")) return "header";
  if (el.closest(".site-footer")) return "footer";
  if (el.closest(".hero, .banana-hero")) return "hero";
  if (el.closest(".today-call")) return "today_call";
  const section = el.closest("article[id], section[id]");
  return section ? section.id : "other";
}

/** リンクからイベントの種類を判定する。対象外なら null */
function classify(link) {
  const href = link.getAttribute("href") || "";
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }

  if (url.protocol === "tel:") return ["tel_click", {}];
  if (url.origin === location.origin && url.pathname.endsWith("/reserve/")) return ["reserve_click", {}];
  if (url.pathname.endsWith(".pdf")) return ["menu_pdf_open", { file: url.pathname }];
  if (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith("/maps")) return ["map_open", {}];
  if (url.hostname.endsWith("ubereats.com")) return ["delivery_click", { service: "uber_eats" }];
  if (url.hostname.endsWith("demae-can.com")) return ["delivery_click", { service: "demaecan" }];
  if (url.hostname.endsWith("instagram.com")) return ["instagram_click", {}];
  if (url.hostname.endsWith("youtube.com")) return ["youtube_click", {}];
  return null;
}

export function initAnalytics() {
  if (!isPlaceholderId(GA_MEASUREMENT_ID)) loadGtag(GA_MEASUREMENT_ID);
  else if (debug) console.info("[analytics] 測定 ID が仮のため、Google には送信しません");

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link) return;
      const result = classify(link);
      if (!result) return;
      const [name, params] = result;
      track(name, { place: placeOf(link), ...params });
    },
    { capture: true }, // ドロワーを閉じる処理などより先に、クリックの場所を記録する
  );

  // 予約フォームの送信完了（reserve-form.js が発火する）
  document.addEventListener("ohana:reserve-submitted", (event) => {
    track("reserve_form_submit", event.detail || {});
  });
}
