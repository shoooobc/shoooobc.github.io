// 「本日の営業時間」の表示
// <div data-hours-status> の中身を、いまの営業状態に合わせて書き換える。
// JS が無効なときは HTML に書いた全曜日の表記がそのまま残る。

import { DAY_LABELS, WEEKLY_HOURS, getHoursStatus } from "./hours.js";

const isEveryDayOpen = WEEKLY_HOURS.every(Boolean);

/** "25:00" → "深夜1時" / "24:00" → "24時" */
function lateNightLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  if (h < 24 || (h === 24 && m === 0)) return null;
  return `深夜${h - 24}時${m ? `${m}分` : ""}`;
}

function describe(status, now) {
  const { state, day, open, close } = status;
  const range = open && close ? `${open}〜${close}` : "";
  const todayDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(now);
  const isAfterMidnight = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(todayDay) !== day;

  switch (state) {
    case "open": {
      const late = lateNightLabel(close);
      return {
        badge: "営業中",
        main: `${close}まで`,
        sub: late
          ? `${isAfterMidnight ? `${DAY_LABELS[day]}曜の営業・` : ""}${late}まで営業しています`
          : `本日 ${range}`,
      };
    }
    case "soon":
      return { badge: "まもなく営業", main: `${open}から`, sub: `本日 ${range}` };
    case "later":
      return {
        badge: "本日の営業",
        main: range,
        sub: isEveryDayOpen ? "毎日営業・定休日なし" : `${DAY_LABELS[day]}曜日`,
      };
    default:
      return { badge: "本日はお休み", main: "定休日", sub: "" };
  }
}

function render(el) {
  const now = new Date();
  const status = getHoursStatus(now);
  const { badge, main, sub } = describe(status, now);

  el.dataset.state = status.state;
  el.querySelector("[data-hours-badge]").textContent = badge;
  el.querySelector("[data-hours-main]").textContent = main;
  el.querySelector("[data-hours-sub]").textContent = sub;
}

export function initHoursStatus(root = document) {
  const targets = [...root.querySelectorAll("[data-hours-status]")];
  if (!targets.length) return;

  for (const el of targets) {
    el.querySelectorAll("[data-hours-live]").forEach((node) => (node.hidden = false));
    el.querySelector("[data-hours-fallback]").hidden = true;
    render(el);
  }

  // 開いたままのタブでも表示が古くならないように、1分ごとに更新する
  setInterval(() => targets.forEach(render), 60 * 1000);
}

/** "25:00" → "翌1:00" */
function nextDayLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h >= 24 ? `翌${h - 24}:${String(m).padStart(2, "0")}` : null;
}

// 全曜日の営業時間の表
// <tbody data-hours-table> の中身を hours.js のデータから作り直し、本日の行を強調する。
// JS が無効なときは HTML に書いた表がそのまま残る。
export function initHoursTable(root = document) {
  const tbodies = [...root.querySelectorAll("[data-hours-table]")];
  if (!tbodies.length) return;

  const order = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまり

  const render = () => {
    const { day: today } = getHoursStatus(new Date());
    for (const tbody of tbodies) {
      tbody.replaceChildren(
        ...order.map((d) => {
          const hours = WEEKLY_HOURS[d];
          const tr = document.createElement("tr");
          if (d === today) {
            tr.className = "is-today";
            tr.setAttribute("aria-current", "date");
          }

          const th = document.createElement("th");
          th.scope = "row";
          th.textContent = `${DAY_LABELS[d]}曜日`;
          if (d === today) {
            const badge = document.createElement("span");
            badge.className = "hours-table__today";
            badge.textContent = "本日";
            th.append(badge);
          }

          const td = document.createElement("td");
          td.className = "nums";
          if (hours) {
            td.textContent = `${hours.open}〜${hours.close}`;
            const next = nextDayLabel(hours.close);
            if (next) {
              const small = document.createElement("small");
              small.textContent = `（${next}）`;
              td.append(small);
            }
          } else {
            td.textContent = "定休日";
          }

          tr.append(th, td);
          return tr;
        }),
      );
    }
  };

  render();
  setInterval(render, 60 * 1000);
}
