"""
서울 아파트 실거래가 대시보드용 데이터 빌드 스크립트.

seoul-apt-latest.csv(약 32만 행)를 한 번 읽어 메모리에 적재한 뒤,
프론트엔드(dashboard/)가 그대로 fetch할 수 있는 경량 JSON을 생성한다.
표준 라이브러리만 사용한다 (csv, json, statistics, collections, datetime).

MVP 범위: meta.json, summary.json, by_gu.json, timeseries.json
(단지/구상세/개별거래 JSON은 이후 단계에서 별도 스크립트로 추가)

실행: python build_data.py
"""

import csv
import json
import statistics
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

CSV_PATH = Path("seoul-apt-latest.csv")
OUT_DIR = Path("dashboard/data")

DEAL_TYPE_CODE = {"매매": "sale", "전세": "jeonse", "월세": "wolse"}
PYEONG = 3.3058

AREA_BANDS = [
    {"code": "a60", "label": "~60㎡", "min": 0, "max": 60},
    {"code": "a85", "label": "60~85㎡", "min": 60, "max": 85},
    {"code": "a102", "label": "85~102㎡", "min": 85, "max": 102},
    {"code": "a135", "label": "102~135㎡", "min": 102, "max": 135},
    {"code": "a135p", "label": "135㎡~", "min": 135, "max": None},
]

MIN_SAMPLE = 10


def area_band_code(area_m2):
    for band in AREA_BANDS:
        lo, hi = band["min"], band["max"]
        if area_m2 >= lo and (hi is None or area_m2 < hi):
            return band["code"]
    return AREA_BANDS[-1]["code"]


def load_rows():
    """CSV를 한 번 순회하며 필요한 필드만 뽑은 dict 리스트로 반환."""
    rows = []
    skipped = 0
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            deal_code = DEAL_TYPE_CODE.get(r["deal_type"])
            if deal_code is None:
                skipped += 1
                continue
            try:
                area_m2 = float(r["area_m2"])
            except ValueError:
                skipped += 1
                continue
            if area_m2 <= 0:
                skipped += 1
                continue

            if deal_code == "sale":
                if not r["price"]:
                    skipped += 1
                    continue
                amount = float(r["price"])
            else:
                if not r["deposit"]:
                    skipped += 1
                    continue
                amount = float(r["deposit"])

            ppp = amount / (area_m2 / PYEONG)
            monthly_rent = float(r["monthly_rent"]) if r["monthly_rent"] else None

            rows.append(
                {
                    "deal": deal_code,
                    "month": r["contract_ym"],
                    "gu": r["gu"],
                    "dong": r["dong"],
                    "complex": r["complex"],
                    "amount": amount,
                    "ppp": ppp,
                    "area_m2": area_m2,
                    "area_band": area_band_code(area_m2),
                    "monthly_rent": monthly_rent,
                }
            )
    print(f"로드 완료: {len(rows)}행 (스킵 {skipped}행)")
    return rows


def round_or_none(value, ndigits=0):
    if value is None:
        return None
    return round(value, ndigits) if ndigits else int(round(value))


def pct_change(new, old):
    if new is None or old is None or old == 0:
        return None
    return round((new - old) / old * 100, 2)


def stats_for(values):
    """(avg, median, min, max) — values는 amount 또는 ppp 리스트."""
    if not values:
        return None, None, None, None
    return (
        round_or_none(sum(values) / len(values)),
        round_or_none(statistics.median(values)),
        round_or_none(min(values)),
        round_or_none(max(values)),
    )


def build_meta(rows, months):
    gu_set = sorted({r["gu"] for r in rows})
    dong_by_gu = defaultdict(set)
    deal_counts = defaultdict(int)
    for r in rows:
        dong_by_gu[r["gu"]].add(r["dong"])
        deal_counts[r["deal"]] += 1

    kst = timezone(timedelta(hours=9))
    return {
        "generated_at": datetime.now(kst).isoformat(timespec="seconds"),
        "source_file": str(CSV_PATH),
        "row_count": len(rows),
        "period": {"start": months[0], "end": months[-1], "months": months},
        "gu_list": gu_set,
        "dong_by_gu": {gu: sorted(dongs) for gu, dongs in dong_by_gu.items()},
        "deal_types": [
            {"code": "sale", "label": "매매", "count": deal_counts["sale"]},
            {"code": "jeonse", "label": "전세", "count": deal_counts["jeonse"]},
            {"code": "wolse", "label": "월세", "count": deal_counts["wolse"]},
        ],
        "area_bands": AREA_BANDS,
        "units": {"price": "만원", "area": "㎡", "price_per_pyeong": "만원/평"},
    }


def period_months(months, code):
    if code == "all":
        return months
    if code == "m6":
        return months[-6:]
    if code == "m3":
        return months[-3:]
    raise ValueError(code)


def monthly_series(rows_dt, months, gu=None):
    """deal_type으로 필터된 rows에서 (avg_ppp, median_ppp, avg_amount, deal_count) 월별 배열 계산."""
    by_month_ppp = defaultdict(list)
    by_month_amount = defaultdict(list)
    for r in rows_dt:
        if gu is not None and r["gu"] != gu:
            continue
        by_month_ppp[r["month"]].append(r["ppp"])
        by_month_amount[r["month"]].append(r["amount"])

    avg_ppp, median_ppp, avg_amount, deal_count = [], [], [], []
    for m in months:
        vals_ppp = by_month_ppp.get(m, [])
        vals_amt = by_month_amount.get(m, [])
        deal_count.append(len(vals_ppp))
        if vals_ppp:
            avg_ppp.append(round_or_none(sum(vals_ppp) / len(vals_ppp)))
            median_ppp.append(round_or_none(statistics.median(vals_ppp)))
            avg_amount.append(round_or_none(sum(vals_amt) / len(vals_amt)))
        else:
            avg_ppp.append(None)
            median_ppp.append(None)
            avg_amount.append(None)
    return avg_ppp, median_ppp, avg_amount, deal_count


def change_pcts(avg_ppp_series):
    """월별 평당가 배열에서 mom/3m/6m/12m 변동률(%) 계산 (마지막 값 기준)."""
    last = avg_ppp_series[-1] if avg_ppp_series else None

    def at(offset):
        idx = len(avg_ppp_series) - 1 - offset
        if idx < 0:
            return None
        return avg_ppp_series[idx]

    return {
        "mom_pct": pct_change(last, at(1)),
        "chg_3m_pct": pct_change(last, at(3)),
        "chg_6m_pct": pct_change(last, at(6)),
        "chg_12m_pct": pct_change(last, at(11)),
    }


def build_summary(rows, months):
    result = {}
    for deal in ("sale", "jeonse", "wolse"):
        rows_dt = [r for r in rows if r["deal"] == deal]
        avg_ppp_series, median_ppp_series, avg_amount_series, count_series = monthly_series(rows_dt, months)
        chg = change_pcts(avg_ppp_series)
        sparkline = avg_ppp_series

        deal_result = {}
        for period_code in ("all", "m6", "m3"):
            pm = set(period_months(months, period_code))
            period_rows = [r for r in rows_dt if r["month"] in pm]

            amounts = [r["amount"] for r in period_rows]
            ppps = [r["ppp"] for r in period_rows]
            avg_amount, median_amount, _, _ = stats_for(amounts)
            avg_ppp, median_ppp, _, _ = stats_for(ppps)

            by_gu_ppp = defaultdict(list)
            for r in period_rows:
                by_gu_ppp[r["gu"]].append(r["ppp"])
            gu_avg = {
                gu: sum(v) / len(v)
                for gu, v in by_gu_ppp.items()
                if len(v) >= MIN_SAMPLE
            }
            top_gu = max(gu_avg.items(), key=lambda kv: kv[1]) if gu_avg else None
            bottom_gu = min(gu_avg.items(), key=lambda kv: kv[1]) if gu_avg else None

            block = {
                "deal_count": len(period_rows),
                "avg_price": avg_amount,
                "median_price": median_amount,
                "avg_price_per_pyeong": avg_ppp,
                "median_price_per_pyeong": median_ppp,
                **chg,
                "top_gu": {"gu": top_gu[0], "value": round_or_none(top_gu[1])} if top_gu else None,
                "bottom_gu": {"gu": bottom_gu[0], "value": round_or_none(bottom_gu[1])} if bottom_gu else None,
                "sparkline": sparkline,
            }
            if deal == "wolse":
                rents = [r["monthly_rent"] for r in period_rows if r["monthly_rent"] is not None]
                block["avg_monthly_rent"] = round_or_none(sum(rents) / len(rents)) if rents else None
            deal_result[period_code] = block
        result[deal] = deal_result
    return result


def build_by_gu(rows, months, gu_list):
    result = {}
    for deal in ("sale", "jeonse", "wolse"):
        rows_dt = [r for r in rows if r["deal"] == deal]
        deal_result = {}
        for period_code in ("all", "m6", "m3"):
            pm = set(period_months(months, period_code))
            period_rows = [r for r in rows_dt if r["month"] in pm]

            rows_by_gu = defaultdict(list)
            for r in period_rows:
                rows_by_gu[r["gu"]].append(r)

            gu_blocks = {}
            ppp_avg_by_gu = {}
            for gu in gu_list:
                grows = rows_by_gu.get(gu, [])
                amounts = [r["amount"] for r in grows]
                ppps = [r["ppp"] for r in grows]
                avg_amount, median_amount, min_amount, max_amount = stats_for(amounts)
                avg_ppp, median_ppp, _, _ = stats_for(ppps)

                gu_avg_series, *_ = monthly_series(rows_dt, months, gu=gu)
                chg = change_pcts(gu_avg_series)

                by_band = {}
                band_rows = defaultdict(list)
                for r in grows:
                    band_rows[r["area_band"]].append(r)
                for band in AREA_BANDS:
                    brows = band_rows.get(band["code"], [])
                    if len(brows) < MIN_SAMPLE:
                        by_band[band["code"]] = {
                            "deal_count": len(brows),
                            "avg_price_per_pyeong": None,
                            "avg_price": None,
                        }
                    else:
                        bavg_amount, _, _, _ = stats_for([r["amount"] for r in brows])
                        bavg_ppp, _, _, _ = stats_for([r["ppp"] for r in brows])
                        by_band[band["code"]] = {
                            "deal_count": len(brows),
                            "avg_price_per_pyeong": bavg_ppp,
                            "avg_price": bavg_amount,
                        }

                if len(grows) >= MIN_SAMPLE:
                    ppp_avg_by_gu[gu] = avg_ppp

                gu_blocks[gu] = {
                    "gu": gu,
                    "deal_count": len(grows),
                    "avg_price": avg_amount,
                    "median_price": median_amount,
                    "avg_price_per_pyeong": avg_ppp if len(grows) >= MIN_SAMPLE else None,
                    "median_price_per_pyeong": median_ppp if len(grows) >= MIN_SAMPLE else None,
                    "min_price": min_amount,
                    "max_price": max_amount,
                    **chg,
                    "rank_ppp": None,
                    "jeonse_ratio_pct": None,
                    "by_area_band": by_band,
                }

            # rank_ppp: 평당가 높은 순
            ranked = sorted(ppp_avg_by_gu.items(), key=lambda kv: kv[1], reverse=True)
            for rank, (gu, _) in enumerate(ranked, start=1):
                gu_blocks[gu]["rank_ppp"] = rank

            deal_result[period_code] = gu_blocks
        result[deal] = deal_result

    # jeonse_ratio_pct: sale 블록에만 채운다 (같은 period 기준 avg(jeonse deposit)/avg(sale price))
    for period_code in ("all", "m6", "m3"):
        sale_blocks = result["sale"][period_code]
        jeonse_blocks = result["jeonse"][period_code]
        for gu in gu_list:
            sale_avg = sale_blocks[gu]["avg_price"]
            jeonse_avg = jeonse_blocks[gu]["avg_price"]
            if sale_avg and jeonse_avg and sale_blocks[gu]["deal_count"] >= MIN_SAMPLE and jeonse_blocks[gu]["deal_count"] >= MIN_SAMPLE:
                sale_blocks[gu]["jeonse_ratio_pct"] = round(jeonse_avg / sale_avg * 100, 2)

    return result


def build_timeseries(rows, months, gu_list):
    result = {"months": months}
    for deal in ("sale", "jeonse", "wolse"):
        rows_dt = [r for r in rows if r["deal"] == deal]
        deal_result = {}
        avg_ppp, median_ppp, avg_amount, deal_count = monthly_series(rows_dt, months)
        deal_result["seoul"] = {
            "avg_price_per_pyeong": avg_ppp,
            "median_price_per_pyeong": median_ppp,
            "avg_price": avg_amount,
            "deal_count": deal_count,
        }
        for gu in gu_list:
            avg_ppp, median_ppp, avg_amount, deal_count = monthly_series(rows_dt, months, gu=gu)
            deal_result[gu] = {
                "avg_price_per_pyeong": avg_ppp,
                "median_price_per_pyeong": median_ppp,
                "avg_price": avg_amount,
                "deal_count": deal_count,
            }
        result[deal] = deal_result
    return result


def write_json(name, data):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    size_kb = len(text.encode("utf-8")) / 1024
    flag = "  ⚠ 2MB 초과" if size_kb > 2048 else ""
    print(f"  {path} — {size_kb:.1f} KB{flag}")


def main():
    rows = load_rows()
    months = sorted({r["month"] for r in rows})
    gu_list = sorted({r["gu"] for r in rows})
    assert len(months) == 12, f"예상과 다른 개월 수: {len(months)}"
    assert len(gu_list) == 25, f"예상과 다른 구 개수: {len(gu_list)}"

    print("\n생성 파일:")
    write_json("meta.json", build_meta(rows, months))
    write_json("summary.json", build_summary(rows, months))
    write_json("by_gu.json", build_by_gu(rows, months, gu_list))
    write_json("timeseries.json", build_timeseries(rows, months, gu_list))

    # 회귀 검증: analyze.py가 산출한 도봉구 평균 물건금액(약 5.7억)과 비교
    with (OUT_DIR / "by_gu.json").open(encoding="utf-8") as f:
        by_gu = json.load(f)
    dobong_avg_man = by_gu["sale"]["all"]["도봉구"]["avg_price"]
    print(f"\n검증: 도봉구 매매 평균 물건금액 = {dobong_avg_man/10000:.2f}억 원 (analyze.py 기준 약 5.7억과 비교)")


if __name__ == "__main__":
    main()
