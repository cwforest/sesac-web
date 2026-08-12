// 숫자/금액 표기 유틸. 원본 단위는 항상 "만원"(정수) / 평당가는 "만원/평".

export function formatEok(manwon) {
  if (manwon === null || manwon === undefined) return "–";
  const eok = manwon / 10000;
  if (Math.abs(eok) >= 100) return `${Math.round(eok).toLocaleString("ko-KR")}억`;
  return `${eok.toFixed(1)}억`;
}

export function formatManwon(manwon) {
  if (manwon === null || manwon === undefined) return "–";
  return `${Math.round(manwon).toLocaleString("ko-KR")}만`;
}

export function formatPpp(ppp) {
  if (ppp === null || ppp === undefined) return "–";
  return `${Math.round(ppp).toLocaleString("ko-KR")}만/평`;
}

export function formatCount(n) {
  if (n === null || n === undefined) return "–";
  return `${n.toLocaleString("ko-KR")}건`;
}

export function formatPct(p, { withSign = true } = {}) {
  if (p === null || p === undefined) return "–";
  const sign = withSign && p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

export function pctClass(p) {
  if (p === null || p === undefined) return "val-muted";
  return p > 0 ? "val-pos" : p < 0 ? "val-neg" : "";
}

export function formatMonth(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${y.slice(2)}.${m}`;
}
