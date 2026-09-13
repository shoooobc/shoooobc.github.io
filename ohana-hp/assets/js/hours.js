// 営業時間 — サイト内で営業時間のデータを持つのはこのファイルだけ
//
// 時刻は "HH:MM"。24時を過ぎる閉店は "25:00" のように書く（現行サイトと同じ表記）。
// 深夜 0:00〜閉店までは「前日の営業」として扱う。
// 定休日にしたい曜日は null にする。

export const TIME_ZONE = "Asia/Tokyo";

/** 0 = 日曜 … 6 = 土曜 */
export const WEEKLY_HOURS = [
  { open: "18:00", close: "25:00" }, // 日
  { open: "18:00", close: "25:00" }, // 月
  { open: "18:00", close: "25:00" }, // 火
  { open: "18:00", close: "25:00" }, // 水
  { open: "18:00", close: "25:00" }, // 木
  { open: "18:00", close: "26:00" }, // 金
  { open: "18:00", close: "26:00" }, // 土
];

export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** 開店のこの分数前から「まもなく営業」と表示する */
export const SOON_MINUTES = 60;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** 指定したタイムゾーンでの曜日と、0時からの経過分数 */
export function zonedClock(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * いまの営業状態を返す
 * @returns {{
 *   state: "open" | "soon" | "later" | "closed",
 *   day: number,          // 表示の基準にする営業日（深夜は前日）
 *   open: string | null,
 *   close: string | null,
 * }}
 */
export function getHoursStatus(date = new Date(), hours = WEEKLY_HOURS, timeZone = TIME_ZONE) {
  const { day, minutes } = zonedClock(date, timeZone);

  // 1. 前日の営業が深夜まで続いているか
  const prevDay = (day + 6) % 7;
  const prev = hours[prevDay];
  if (prev && minutes + 24 * 60 < toMinutes(prev.close)) {
    return { state: "open", day: prevDay, open: prev.open, close: prev.close };
  }

  // 2. 本日の営業
  const today = hours[day];
  if (!today) {
    return { state: "closed", day, open: null, close: null };
  }

  const openAt = toMinutes(today.open);
  const closeAt = toMinutes(today.close);

  if (minutes >= openAt && minutes < closeAt) {
    return { state: "open", day, open: today.open, close: today.close };
  }
  if (minutes < openAt) {
    const state = openAt - minutes <= SOON_MINUTES ? "soon" : "later";
    return { state, day, open: today.open, close: today.close };
  }
  // 24時前に閉店する設定の場合のみ到達する
  return { state: "closed", day, open: null, close: null };
}

/** 曜日ごとの営業時間を、同じ時間の曜日をまとめて返す（例：「月〜木・日」） */
export function groupWeeklyHours(hours = WEEKLY_HOURS) {
  const order = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまりで表示
  const groups = [];
  for (const d of order) {
    const h = hours[d];
    const key = h ? `${h.open}-${h.close}` : "closed";
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, days: [], open: h?.open ?? null, close: h?.close ?? null };
      groups.push(group);
    }
    group.days.push(d);
  }
  return groups.map((g) => ({ ...g, label: formatDayRange(g.days, order) }));
}

function formatDayRange(days, order) {
  // 連続する曜日を「月〜木」にまとめる
  const idx = days.map((d) => order.indexOf(d)).sort((a, b) => a - b);
  const runs = [];
  for (const i of idx) {
    const last = runs.at(-1);
    if (last && i === last.at(-1) + 1) last.push(i);
    else runs.push([i]);
  }
  return runs
    .map((run) => {
      const first = DAY_LABELS[order[run[0]]];
      const end = DAY_LABELS[order[run.at(-1)]];
      if (run.length === 1) return first;
      if (run.length === 2) return `${first}・${end}`;
      return `${first}〜${end}`;
    })
    .join("・");
}
