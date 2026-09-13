// 仮の予約フォーム（/reserve/）
// 入力チェックと完了画面まで。試作のため、実際にはどこにも送信しない。
// 本番では [data-reserve-form-block] の中身を Google Form の埋め込みかリンクに差し替える。

import {
  RESERVATION_RULES,
  earliestReservableDate,
  formatJapaneseDate,
  isReservableDate,
} from "./reserve-rules.js";

const form = document.querySelector("[data-reserve-form]");

if (form) {
  const summary = form.querySelector("[data-error-summary]");
  const summaryList = summary.querySelector("ul");
  const done = document.querySelector("[data-reserve-done]");
  const dateInput = form.elements.date;

  // 選べる来店日の下限を締め切りに合わせる（1分ごとに更新）
  const updateDateMin = () => {
    const min = earliestReservableDate();
    dateInput.min = min;
    form.querySelector("[data-earliest-date]").textContent = formatJapaneseDate(min);
  };
  updateDateMin();
  setInterval(updateDateMin, 60 * 1000);

  // 時間と人数の選択肢
  const timeSelect = form.elements.time;
  for (const slot of RESERVATION_RULES.timeSlots) {
    timeSelect.append(new Option(slot, slot));
  }
  const peopleSelect = form.elements.people;
  for (let n = 1; n <= RESERVATION_RULES.maxPeople; n++) {
    peopleSelect.append(new Option(`${n}名`, String(n)));
  }

  /** 項目ごとのチェック。問題があればメッセージ、なければ空文字を返す */
  const validators = {
    name: (v) => (v.trim() ? "" : "お名前を入力してください。"),
    tel: (v) => {
      if (!v.trim()) return "電話番号を入力してください。";
      const digits = v.replace(/[-\s()（）ー－]/g, "");
      return /^0\d{9,10}$/.test(digits) ? "" : "電話番号は 0 から始まる10〜11桁の数字で入力してください（例：090-1234-5678）。";
    },
    email: (v) => {
      if (!v.trim()) return "メールアドレスを入力してください。";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "メールアドレスの形式を確認してください（例：ohana@example.com）。";
    },
    date: (v) => {
      if (!v) return "来店日を選んでください。";
      if (isReservableDate(v)) return "";
      return `ネット予約は来店日の前日 ${RESERVATION_RULES.deadlineHour}:00 までです。${formatJapaneseDate(earliestReservableDate())}以降を選ぶか、お電話でご予約ください。`;
    },
    time: (v) => (v ? "" : "来店時間を選んでください。"),
    people: (v) => (v ? "" : "人数を選んでください。"),
    agree: (_, el) => (el.checked ? "" : "プライバシーポリシーへの同意が必要です。"),
  };

  const fieldOf = (name) => form.elements[name];
  const errorEl = (name) => form.querySelector(`[data-error-for="${name}"]`);

  function validateField(name) {
    const el = fieldOf(name);
    const message = validators[name](el.value ?? "", el);
    const error = errorEl(name);
    error.textContent = message;
    error.hidden = !message;
    el.setAttribute("aria-invalid", message ? "true" : "false");
    el.closest(".field")?.classList.toggle("is-invalid", Boolean(message));
    return message;
  }

  // 入力を終えたとき（フォーカスが外れたとき）にチェックし、
  // 一度エラーが出た項目は入力するたびに再チェックする
  for (const name of Object.keys(validators)) {
    const el = fieldOf(name);
    el.addEventListener("blur", () => validateField(name));
    el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
      if (el.getAttribute("aria-invalid") === "true") validateField(name);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const errors = Object.keys(validators)
      .map((name) => ({ name, message: validateField(name) }))
      .filter((e) => e.message);

    if (errors.length) {
      // エラーの一覧を先頭に出し、そこへフォーカスを移す
      summaryList.replaceChildren(
        ...errors.map(({ name, message }) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `#reserve-${name}`;
          a.textContent = message;
          a.addEventListener("click", (e) => {
            e.preventDefault();
            fieldOf(name).focus();
          });
          li.append(a);
          return li;
        }),
      );
      summary.hidden = false;
      summary.focus();
      return;
    }

    summary.hidden = true;
    showDone();
  });

  function showDone() {
    const data = new FormData(form);
    const rows = [
      ["お名前", data.get("name")],
      ["来店日時", `${formatJapaneseDate(data.get("date"))} ${data.get("time")}`],
      ["人数", `${data.get("people")}名`],
      ["お席", data.get("seat")],
      ["電話番号", data.get("tel")],
      ["メール", data.get("email")],
    ];
    const note = data.get("note")?.trim();
    if (note) rows.push(["ご要望", note]);

    const dl = done.querySelector("[data-reserve-summary]");
    dl.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      }),
    );

    form.hidden = true;
    done.hidden = false;

    // アクセス解析に送信完了を知らせる（個人情報は含めない）
    document.dispatchEvent(
      new CustomEvent("ohana:reserve-submitted", {
        detail: { people: Number(data.get("people")), seat: data.get("seat") },
      }),
    );
    const heading = done.querySelector("h2");
    heading.focus();
    heading.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // 完了画面から入力し直す
  done.querySelector("[data-reserve-reset]").addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
}
