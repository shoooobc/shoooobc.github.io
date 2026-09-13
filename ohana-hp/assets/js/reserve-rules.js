// ネット予約のルール — 予約ページとフォームのチェックで使う値はここだけに置く
// 仮: 締め切り・人数・時間帯はオーナー確認

import { TIME_ZONE } from "./hours.js";

export const RESERVATION_RULES = {
  /** 来店日の「前日」この時刻までネット予約を受け付ける */
  deadlineHour: 17,
  maxPeople: 6,
  /** 来店時間の選択肢 */
  timeSlots: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"],
};

/** 日本時間での年月日と時 */
function tokyoParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

const pad = (n) => String(n).padStart(2, "0");

/** 年月日に日数を足して "YYYY-MM-DD" を返す（月末・年末をまたいでも正しく計算する） */
function addDays({ year, month, day }, days) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * ネット予約できる一番早い来店日（"YYYY-MM-DD"）
 * 前日の締め切り時刻より前なら明日、過ぎていたら明後日
 */
export function earliestReservableDate(now = new Date(), rules = RESERVATION_RULES) {
  const t = tokyoParts(now);
  return addDays(t, t.hour < rules.deadlineHour ? 1 : 2);
}

/** "YYYY-MM-DD" の来店日がネット予約の締め切りに間に合うか */
export function isReservableDate(ymd, now = new Date(), rules = RESERVATION_RULES) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd >= earliestReservableDate(now, rules);
}

/** "2026-09-14" → "9月14日（月）" */
export function formatJapaneseDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${dow}）`;
}
