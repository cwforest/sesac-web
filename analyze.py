"""
서울 아파트 실거래가 CSV 분석: 도봉구 vs 다른 자치구

⚠️ 참고: 원래 요청하신 seoul_apt_2026H1.csv(컬럼: 자치구명/법정동명/건물명/계약일/
물건금액(만원)/건물면적(㎡)/층/건축년도)가 경로에 없어서, 대신 있던
seoul-apt-latest.csv를 사용합니다. 이 파일의 컬럼은 영어(gu, dong, complex,
contract_date, price, area_m2, floor, deal_type)이고 건축년도 컬럼은 없습니다.
또한 deal_type이 매매/전세/월세로 섞여 있어서, "물건금액" 분석은 매매(deal_type == '매매')
거래만 사용합니다.
"""

import csv
from collections import defaultdict

CSV_PATH = r"C:\Users\lim\Projects\sesac-web\seoul-apt-latest.csv"
TARGET_GU = "도봉구"


def load_sale_rows(path):
    """매매(deal_type == '매매') 거래만 읽어서 리스트로 반환."""
    rows = []
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["deal_type"] != "매매":
                continue
            if not row["price"]:
                continue
            rows.append(row)
    return rows


def average_price_by_gu(rows):
    """구별 물건금액(만원) 평균을 딕셔너리로 반환."""
    total_by_gu = defaultdict(float)
    count_by_gu = defaultdict(int)
    for row in rows:
        gu = row["gu"]
        price = float(row["price"])
        total_by_gu[gu] += price
        count_by_gu[gu] += 1

    return {
        gu: total_by_gu[gu] / count_by_gu[gu]
        for gu in total_by_gu
    }


def average_price_by_month(rows, gu):
    """특정 구의 계약년월(contract_ym)별 물건금액(만원) 평균을 반환."""
    total_by_month = defaultdict(float)
    count_by_month = defaultdict(int)
    for row in rows:
        if row["gu"] != gu:
            continue
        month = row["contract_ym"]
        price = float(row["price"])
        total_by_month[month] += price
        count_by_month[month] += 1

    months = sorted(total_by_month)
    averages = [total_by_month[m] / count_by_month[m] for m in months]
    return months, averages


def man_to_eok(price_man):
    """만원 단위 금액을 억원 단위로 변환 (1억 = 10000만원)."""
    return price_man / 10000


def main():
    rows = load_sale_rows(CSV_PATH)
    print(f"매매 거래 데이터 {len(rows)}건 로드 완료\n")

    # 1. 도봉구 평균 물건금액
    avg_by_gu = average_price_by_gu(rows)
    dobong_avg_man = avg_by_gu[TARGET_GU]
    dobong_avg_eok = man_to_eok(dobong_avg_man)
    print(f"1. {TARGET_GU} 평균 물건금액: 약 {round(dobong_avg_eok, 2)}억 원")
    print()

    # 2. 다른 구들과 비교 (평균 물건금액 높은 순 정렬)
    print("2. 자치구별 평균 물건금액 비교 (높은 순)")
    ranked = sorted(avg_by_gu.items(), key=lambda x: x[1], reverse=True)
    for rank, (gu, avg_man) in enumerate(ranked, start=1):
        mark = " <-- 도봉구" if gu == TARGET_GU else ""
        print(f"  {rank:2d}. {gu:5s} {round(man_to_eok(avg_man), 2):6.2f}억{mark}")
    print()

    # 3. 도봉구 시계열 (월별 평균 물건금액) 그래프
    months, averages_man = average_price_by_month(rows, TARGET_GU)
    averages_eok = [man_to_eok(a) for a in averages_man]

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams["axes.unicode_minus"] = False
    for font_name in ["Malgun Gothic", "AppleGothic", "NanumGothic"]:
        try:
            plt.rcParams["font.family"] = font_name
            break
        except Exception:
            continue

    plt.figure(figsize=(10, 5))
    plt.plot(months, averages_eok, marker="o")
    plt.title(f"{TARGET_GU} 월별 평균 물건금액 추이")
    plt.xlabel("계약년월")
    plt.ylabel("평균 물건금액 (억 원)")
    plt.xticks(rotation=45, ha="right")
    plt.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()

    output_path = "도봉구_평균물건금액_시계열.png"
    plt.savefig(output_path, dpi=150)
    print(f"3. 시계열 그래프 저장 완료: {output_path}")


if __name__ == "__main__":
    main()
