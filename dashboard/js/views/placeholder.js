export function mountPlaceholder(container, title) {
  container.innerHTML = `
    <div class="grid">
      <div class="placeholder card">
        <h2>${title}</h2>
        <p>이 화면은 다음 단계에서 제공될 예정입니다. 지금은 <a href="#/overview" style="color:var(--accent)">개요 화면</a>에서 지역별 시세를 확인해 주세요.</p>
      </div>
    </div>
  `;
  return () => {};
}

export function mountAbout(container, meta) {
  container.innerHTML = `
    <div class="grid">
      <div class="card" style="grid-column: span 12; max-width: 760px;">
        <h2>데이터 정보</h2>
        <p style="color:var(--text-secondary); margin: 0 0 var(--sp-4)">
          국토교통부 실거래가 공개시스템 기반 데이터(<code class="mono">seoul-apt-latest.csv</code>)를 사용합니다.
          기간: ${meta ? `${meta.period.start} ~ ${meta.period.end}` : "2025-07 ~ 2026-06"},
          총 ${meta ? meta.row_count.toLocaleString("ko-KR") : "약 32만"}건.
        </p>
        <h2>지표 정의</h2>
        <p style="color:var(--text-secondary); margin: 0 0 var(--sp-4)">
          평당가는 원본 <code class="mono">price_per_pyeong</code> 컬럼(매매) 또는 보증금 기준으로 재계산한 값(전세·월세)입니다.
          1평 = 3.3058㎡, 금액 단위는 만원입니다.
        </p>
        <h2>한계</h2>
        <p style="color:var(--text-secondary); margin: 0 0 var(--sp-4)">
          신고 지연으로 최근 월 데이터가 과소집계될 수 있고, 해제(취소)된 거래가 반영되어 있을 수 있습니다.
          표본이 10건 미만인 구간은 통계적 신뢰도가 낮아 회색으로 표시하거나 값을 생략합니다.
          본 대시보드는 개인 참고용이며 투자 자문이 아닙니다.
        </p>
        <h2>색상 규칙</h2>
        <p style="color:var(--text-secondary); margin: 0">
          상승은 <span style="color:var(--pos)">적색</span>, 하락은 <span style="color:var(--neg)">청색</span>으로 표시합니다 (한국 금융 UI 관행).
        </p>
      </div>
    </div>
  `;
  return () => {};
}
