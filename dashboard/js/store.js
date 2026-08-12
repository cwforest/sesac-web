// 전역 상태 + URL 해시 동기화 + pub/sub.
// 해시 형식: #/overview?deal=sale&period=all&metric=ppp&bands=all

const DEFAULTS = { deal: "sale", period: "all", metric: "ppp", bands: "all" };

function parseHash() {
  const raw = location.hash.slice(1) || "/overview";
  const [path, queryStr] = raw.split("?");
  const params = new URLSearchParams(queryStr || "");
  return {
    path: path || "/overview",
    deal: params.get("deal") || DEFAULTS.deal,
    period: params.get("period") || DEFAULTS.period,
    metric: params.get("metric") || DEFAULTS.metric,
    bands: params.get("bands") || DEFAULTS.bands,
  };
}

class Store {
  constructor() {
    this.state = parseHash();
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  syncFromHash() {
    this.state = parseHash();
    this.notify();
  }

  /** path/query 일부를 갱신하고 해시를 다시 씀 (hashchange가 syncFromHash를 트리거) */
  update(partial) {
    const next = { ...this.state, ...partial };
    const params = new URLSearchParams();
    if (next.deal !== DEFAULTS.deal) params.set("deal", next.deal);
    if (next.period !== DEFAULTS.period) params.set("period", next.period);
    if (next.metric !== DEFAULTS.metric) params.set("metric", next.metric);
    if (next.bands !== DEFAULTS.bands) params.set("bands", next.bands);
    const qs = params.toString();
    location.hash = `${next.path}${qs ? "?" + qs : ""}`;
  }

  navigate(path) {
    this.update({ path });
  }

  get selectedBands() {
    return this.state.bands === "all" ? null : this.state.bands.split(",");
  }
}

export const store = new Store();
