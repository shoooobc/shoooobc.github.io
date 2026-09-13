// スマホ・タブレットの固定アクションバー

/**
 * 固定アクションバー
 * <nav data-action-bar data-show-after="セレクタ" data-hide-on="セレクタ, セレクタ">
 * - show-after の要素が画面の上に抜けたら表示する（指定がなければ最初から表示）
 * - hide-on の要素のどれかが画面に入っている間は隠す（同じボタンが画面にあるため）
 */
export function initActionBar() {
  const bar = document.querySelector("[data-action-bar]");
  if (!bar) return;

  const showAfter = bar.dataset.showAfter ? document.querySelector(bar.dataset.showAfter) : null;
  const hideTargets = bar.dataset.hideOn
    ? [...document.querySelectorAll(bar.dataset.hideOn)]
    : [];

  let passedShowTarget = !showAfter;
  const visibleHideTargets = new Set();

  const render = () => {
    const visible = passedShowTarget && visibleHideTargets.size === 0;
    bar.dataset.state = visible ? "visible" : "hidden";
    // 隠れている間は Tab で移動できないようにする
    bar.inert = !visible;
  };

  if (showAfter) {
    new IntersectionObserver(([entry]) => {
      // 画面の上に抜けた（下にある場合は抜けていない）
      passedShowTarget = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      render();
    }).observe(showAfter);
  }

  if (hideTargets.length) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleHideTargets.add(entry.target);
        else visibleHideTargets.delete(entry.target);
      }
      render();
    }, { rootMargin: "0px 0px -15% 0px" });
    hideTargets.forEach((el) => observer.observe(el));
  }

  render();
}
