import { loadMeta, loadSummary, loadByGu, loadTimeseries, loadGeo } from "../data.js";
import { store } from "../store.js";
import { seq, cvar } from "../theme.js";
import {
  formatEok,
  formatPpp,
  formatCount,
  formatPct,
  pctClass,
  formatMonth,
} from "../format.js";

const DEAL_LABEL = { sale: "매매", jeonse: "전세", wolse: "월세" };
const METRIC_LABEL = { ppp: "평당가", amount: "거래금액" };

let charts = []; // 언마운트 시 dispose

/** area band 다중 선택을 반영한 구별 값 계산 (선택 없으면 전체 집계 그대로 사용) */
function guValue(guBlock, metric, selectedBands) {
  if (!selectedBands) {
    return {
      value: metric === "ppp" ? guBlock.avg_price_per_pyeong : guBlock.avg_price,
      deal_count: guBlock.deal_count,
    };
  }
  let countSum = 0;
  let pppWeighted = 0;
  let pppCount = 0;
  let amountWeighted = 0;
  let amountCount = 0;
  for (const code of selectedBands) {
    const b = guBlock.by_area_band[code];
    if (!b) continue;
    countSum += b.deal_count;
    if (b.avg_price_per_pyeong !== null) {
      pppWeighted += b.avg_price_per_pyeong * b.deal_count;
      pppCount += b.deal_count;
    }
    if (b.avg_price !== null) {
      amountWeighted += b.avg_price * b.deal_count;
      amountCount += b.deal_count;
    }
  }
  const ppp = pppCount ? pppWeighted / pppCount : null;
  const amount = amountCount ? amountWeighted / amountCount : null;
  return { value: metric === "ppp" ? ppp : amount, deal_count: countSum };
}

function fmtValue(metric, value) {
  return metric === "ppp" ? formatPpp(value) : formatEok(value);
}

export async function mountOverview(container) {
  container.innerHTML = `
    <div class="grid" id="ov-root">
      <div class="kpi card"><div class="kpi-label">서울 평균 ${METRIC_LABEL[store.state.metric]}</div><div class="kpi-value" id="kpi-avg">–</div><div class="kpi-sub" id="kpi-avg-sub"></div></div>
      <div class="kpi card"><div class="kpi-label">총 거래건수</div><div class="kpi-value" id="kpi-count">–</div><div class="kpi-sub" id="kpi-count-sub"></div></div>
      <div class="kpi card"><div class="kpi-label">전월 대비</div><div class="kpi-value" id="kpi-mom">–</div><div class="kpi-sub" id="kpi-mom-sub">최근 12개월 평당가 추이</div></div>
      <div class="kpi card"><div class="kpi-label">최고 / 최저 구</div><div class="kpi-value" id="kpi-extreme" style="font-size:15px;line-height:1.5">–</div></div>

      <div class="card col-map" style="grid-column: span 7;">
        <h2>자치구별 ${METRIC_LABEL[store.state.metric]} 지도</h2>
        <div class="chart h-map" id="chart-map"><div class="chart-loading">지도 불러오는 중…</div></div>
      </div>
      <div class="card col-rank" style="grid-column: span 5;">
        <h2>구별 랭킹</h2>
        <div class="chart h-bar" id="chart-rank"><div class="chart-loading">불러오는 중…</div></div>
      </div>

      <div class="card" style="grid-column: span 12;">
        <h2>서울 전체 월별 추이</h2>
        <div class="chart h-combo" id="chart-combo"><div class="chart-loading">불러오는 중…</div></div>
      </div>

      <div class="page-note" id="ov-note"></div>
    </div>
  `;

  const [meta, summary, byGu, timeseries, geo] = await Promise.all([
    loadMeta(),
    loadSummary(),
    loadByGu(),
    loadTimeseries(),
    loadGeo(),
  ]).catch((err) => {
    container.innerHTML = `<div class="placeholder card"><h2>데이터를 불러오지 못했습니다</h2><p>${err.message}</p></div>`;
    throw err;
  });

  if (!window.echarts.getMap || !window.echarts.getMap("seoul")) {
    window.echarts.registerMap("seoul", geo);
  }

  const state = { meta, summary, byGu, timeseries };
  render(state);

  return () => {
    charts.forEach((c) => c.dispose());
    charts = [];
  };
}

function render(state) {
  const { meta, summary, byGu, timeseries } = state;
  const { deal, period, metric } = store.state;
  const selectedBands = store.selectedBands;

  const mapTitle = document.querySelector("#chart-map").closest(".card").querySelector("h2");
  if (mapTitle) mapTitle.textContent = `자치구별 ${METRIC_LABEL[metric]} 지도`;
  const kpiLabel = document.querySelector("#kpi-avg").closest(".kpi").querySelector(".kpi-label");
  if (kpiLabel) kpiLabel.textContent = `서울 평균 ${METRIC_LABEL[metric]}`;

  renderKPIs(summary, deal, period, metric);
  renderMap(byGu, meta, deal, period, metric, selectedBands);
  renderRank(byGu, deal, period, metric, selectedBands);
  renderCombo(timeseries, deal, metric);

  const note = document.getElementById("ov-note");
  if (note) {
    note.textContent = `${DEAL_LABEL[deal]} 기준 · 기간: ${
      period === "all" ? "전체 12개월" : period === "m6" ? "최근 6개월" : "최근 3개월"
    } · 데이터: ${meta.period.start} ~ ${meta.period.end} (${meta.row_count.toLocaleString("ko-KR")}건) · 회색/음영 구는 표본 10건 미만`;
  }
}

function renderKPIs(summary, deal, period, metric) {
  const block = summary[deal][period];
  const avgEl = document.getElementById("kpi-avg");
  const avgSubEl = document.getElementById("kpi-avg-sub");
  const countEl = document.getElementById("kpi-count");
  const countSubEl = document.getElementById("kpi-count-sub");
  const momEl = document.getElementById("kpi-mom");
  const momSubEl = document.getElementById("kpi-mom-sub");
  const extremeEl = document.getElementById("kpi-extreme");

  const avgVal = metric === "ppp" ? block.avg_price_per_pyeong : block.avg_price;
  avgEl.textContent = fmtValue(metric, avgVal);
  avgSubEl.textContent = metric === "ppp" ? "만원/평" : "평균 거래금액";

  countEl.textContent = formatCount(block.deal_count);
  countSubEl.textContent = "선택 조건 내 거래";

  const mom = block.mom_pct;
  momEl.textContent = formatPct(mom);
  momEl.className = `kpi-value ${mom > 0 ? "pos" : mom < 0 ? "neg" : ""}`;
  momSubEl.textContent = "직전월 대비 평당가 변동";

  if (block.top_gu && block.bottom_gu) {
    extremeEl.innerHTML = `최고: <b>${block.top_gu.gu}</b> (${formatPpp(block.top_gu.value)})<br>최저: <b>${block.bottom_gu.gu}</b> (${formatPpp(block.bottom_gu.value)})`;
  } else {
    extremeEl.textContent = "표본 부족";
  }
}

function renderMap(byGu, meta, deal, period, metric, selectedBands) {
  const container = document.getElementById("chart-map");
  container.innerHTML = "";
  const chart = window.echarts.init(container, "seoul-dark");
  charts.push(chart);

  const guBlocks = byGu[deal][period];
  const values = [];
  let min = Infinity;
  let max = -Infinity;

  for (const gu of meta.gu_list) {
    const { value, deal_count } = guValue(guBlocks[gu], metric, selectedBands);
    values.push({
      name: gu,
      value: deal_count < 10 ? null : value,
      dealCount: deal_count,
      raw: value,
    });
    if (value !== null && deal_count >= 10) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  chart.setOption({
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const d = p.data || {};
        if (d.dealCount < 10) {
          return `<b>${p.name}</b><br/>표본 부족 (n=${d.dealCount})`;
        }
        return `<b>${p.name}</b><br/>${METRIC_LABEL[metric]}: ${fmtValue(metric, d.raw)}<br/>거래건수: ${formatCount(d.dealCount)}`;
      },
    },
    visualMap: {
      min: isFinite(min) ? min : 0,
      max: isFinite(max) ? max : 1,
      show: true,
      orient: "horizontal",
      left: "center",
      bottom: 4,
      textStyle: { color: cvar("--text-tertiary"), fontSize: 10 },
      inRange: { color: [seq(1), seq(2), seq(3), seq(4), seq(5), seq(6)] },
    },
    series: [
      {
        type: "map",
        map: "seoul",
        roam: true,
        nameProperty: "name",
        label: { show: true, fontSize: 10, color: cvar("--text-secondary") },
        itemStyle: { borderColor: cvar("--border-default"), borderWidth: 1, areaColor: cvar("--seq-null") },
        emphasis: {
          label: { color: cvar("--text-primary") },
          itemStyle: { areaColor: cvar("--accent") },
        },
        data: values,
      },
    ],
  });

  chart.on("click", (params) => {
    if (params.data && params.data.dealCount >= 10) {
      window.__toast(`"${params.name}" 상세 화면은 다음 단계에서 제공될 예정입니다.`);
    }
  });

  new ResizeObserver(() => chart.resize()).observe(container);
}

function renderRank(byGu, deal, period, metric, selectedBands) {
  const container = document.getElementById("chart-rank");
  container.innerHTML = "";
  const chart = window.echarts.init(container, "seoul-dark");
  charts.push(chart);

  const guBlocks = byGu[deal][period];
  const rows = Object.keys(guBlocks)
    .map((gu) => {
      const { value, deal_count } = guValue(guBlocks[gu], metric, selectedBands);
      return { gu, value, deal_count };
    })
    .filter((r) => r.deal_count >= 10 && r.value !== null)
    .sort((a, b) => a.value - b.value);

  chart.setOption({
    grid: { left: 70, right: 50, top: 10, bottom: 20, containLabel: false },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.gu),
      axisLabel: { fontSize: 11 },
    },
    tooltip: {
      trigger: "item",
      formatter: (p) => `<b>${p.name}</b><br/>${METRIC_LABEL[metric]}: ${fmtValue(metric, p.value)}`,
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => r.value),
        itemStyle: { color: cvar("--accent"), borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: "right",
          color: cvar("--text-secondary"),
          fontSize: 10,
          formatter: (p) => fmtValue(metric, p.value),
        },
        barMaxWidth: 14,
      },
    ],
  });

  new ResizeObserver(() => chart.resize()).observe(container);
}

function renderCombo(timeseries, deal, metric) {
  const container = document.getElementById("chart-combo");
  container.innerHTML = "";
  const chart = window.echarts.init(container, "seoul-dark");
  charts.push(chart);

  const months = timeseries.months;
  const series = timeseries[deal].seoul;
  const primary = metric === "ppp" ? series.avg_price_per_pyeong : series.avg_price;

  chart.setOption({
    grid: { left: 60, right: 60, top: 20, bottom: 40, containLabel: false },
    tooltip: { trigger: "axis" },
    legend: { data: [METRIC_LABEL[metric], "거래건수"], top: 0, textStyle: { fontSize: 11 } },
    xAxis: {
      type: "category",
      data: months.map(formatMonth),
      axisLabel: { fontSize: 11 },
    },
    yAxis: [
      { type: "value", name: METRIC_LABEL[metric], axisLabel: { fontSize: 10 } },
      { type: "value", name: "거래건수", axisLabel: { fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      {
        name: METRIC_LABEL[metric],
        type: "line",
        data: primary,
        smooth: false,
        symbolSize: 5,
        lineStyle: { color: cvar("--accent"), width: 2 },
        itemStyle: { color: cvar("--accent") },
      },
      {
        name: "거래건수",
        type: "bar",
        yAxisIndex: 1,
        data: series.deal_count,
        itemStyle: { color: cvar("--bg-hover") },
        barMaxWidth: 20,
      },
    ],
  });

  new ResizeObserver(() => chart.resize()).observe(container);
}
