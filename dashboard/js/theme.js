// ECharts 다크 테마 등록. 색상은 tokens.css의 CSS 변수에서 읽는다.

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function registerSeoulDarkTheme() {
  const categorical = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => cssVar(`--cat-${i}`));
  const axisLabel = cssVar("--axis-label");
  const axisLine = cssVar("--axis-line");
  const gridLine = cssVar("--grid-line");
  const textPrimary = cssVar("--text-primary");
  const bgElevated = cssVar("--bg-elevated");
  const borderDefault = cssVar("--border-default");

  window.echarts.registerTheme("seoul-dark", {
    color: categorical,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "Pretendard, sans-serif", color: textPrimary },
    title: { textStyle: { color: textPrimary } },
    categoryAxis: {
      axisLine: { lineStyle: { color: axisLine } },
      axisLabel: { color: axisLabel, fontSize: 11 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisLabel: { color: axisLabel, fontSize: 11 },
      splitLine: { lineStyle: { color: gridLine } },
    },
    tooltip: {
      backgroundColor: bgElevated,
      borderColor: borderDefault,
      borderWidth: 1,
      textStyle: { color: textPrimary, fontSize: 12 },
    },
    legend: { textStyle: { color: cssVar("--text-secondary") } },
  });
}

export function seq(i) {
  return cssVar(`--seq-${i}`);
}
export function cvar(name) {
  return cssVar(name);
}
