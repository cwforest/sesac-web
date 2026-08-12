import { store } from "./store.js";
import { registerSeoulDarkTheme } from "./theme.js";
import { mountOverview } from "./views/overview.js";
import { mountPlaceholder, mountAbout } from "./views/placeholder.js";
import { loadMeta } from "./data.js";

window.__toast = (msg) => {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:10px 18px;border-radius:8px;font-size:12px;z-index:100;box-shadow:var(--shadow-card);";
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.style.opacity = "1";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (box.style.opacity = "0"), 2500);
};

const app = document.getElementById("app");
let unmount = null;
let metaCache = null;

const NAV_LABELS = {
  "/overview": "개요",
  "/compare": "비교",
  "/explore": "탐색",
  "/about": "정보",
};

function updateActiveNav() {
  document.querySelectorAll(".topbar nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-path") === store.state.path);
  });
}

function updateControls() {
  document.querySelectorAll("#deal-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.value === store.state.deal);
  });
  document.querySelectorAll("#metric-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.value === store.state.metric);
  });
  document.getElementById("period-select").value = store.state.period;
}

async function render() {
  if (unmount) {
    unmount();
    unmount = null;
  }
  updateActiveNav();
  updateControls();

  const path = store.state.path;
  if (path === "/overview") {
    unmount = await mountOverview(app);
  } else if (path === "/about") {
    if (!metaCache) metaCache = await loadMeta().catch(() => null);
    unmount = mountAbout(app, metaCache);
  } else {
    const title = path.startsWith("/gu/")
      ? `${decodeURIComponent(path.slice(4))} 상세`
      : NAV_LABELS[path] || "화면";
    unmount = mountPlaceholder(app, `${title} (준비 중)`);
  }
}

function bootstrap() {
  if (!window.echarts) {
    app.innerHTML = `<div class="placeholder card"><h2>차트 라이브러리 로드 실패</h2><p>ECharts CDN을 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.</p></div>`;
    return;
  }
  registerSeoulDarkTheme();

  document.getElementById("deal-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) store.update({ deal: btn.dataset.value });
  });
  document.getElementById("metric-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) store.update({ metric: btn.dataset.value });
  });
  document.getElementById("period-select").addEventListener("change", (e) => {
    store.update({ period: e.target.value });
  });

  window.addEventListener("hashchange", () => {
    store.syncFromHash();
    render();
  });

  render();
}

bootstrap();
