"""
서울 자치구 경계 GeoJSON을 대시보드용으로 정규화한다.

원본: tools/seoul_gu_raw.geojson
  (출처: southkorea/seoul-maps, kostat/2013/json/seoul_municipalities_geo_simple.json,
   MIT 라이선스 공개 저장소에서 1회성으로 내려받아 저장소에 커밋해둔 것.
   런타임에는 외부 URL을 호출하지 않는다.)

출력: dashboard/data/geo/seoul-gu.geojson
  - properties를 {name, code}로 축소
  - 좌표를 소수점 5자리로 반올림해 용량을 줄임
  - properties.name 25개가 dashboard/data/meta.json의 gu_list와 정확히 일치하는지 검증

실행: python tools/prepare_geo.py
"""

import json
from pathlib import Path

RAW_PATH = Path("tools/seoul_gu_raw.geojson")
OUT_PATH = Path("dashboard/data/geo/seoul-gu.geojson")
META_PATH = Path("dashboard/data/meta.json")


def round_coords(coords, ndigits=5):
    if isinstance(coords[0], (int, float)):
        return [round(c, ndigits) for c in coords]
    return [round_coords(c, ndigits) for c in coords]


def main():
    raw = json.loads(RAW_PATH.read_text(encoding="utf-8"))

    features = []
    names = []
    for feat in raw["features"]:
        props = feat["properties"]
        name = props["name"]
        names.append(name)
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "code": props.get("code")},
                "geometry": {
                    "type": feat["geometry"]["type"],
                    "coordinates": round_coords(feat["geometry"]["coordinates"]),
                },
            }
        )

    out = {"type": "FeatureCollection", "features": features}

    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    gu_list = set(meta["gu_list"])
    geo_names = set(names)
    assert len(names) == 25, f"구 개수가 25가 아님: {len(names)}"
    assert geo_names == gu_list, (
        f"GeoJSON 구명과 meta.json.gu_list 불일치\n"
        f"  GeoJSON에만 있음: {geo_names - gu_list}\n"
        f"  meta.json에만 있음: {gu_list - geo_names}"
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    OUT_PATH.write_text(text, encoding="utf-8")
    size_kb = len(text.encode("utf-8")) / 1024
    print(f"검증 통과: 25개 구명 일치")
    print(f"{OUT_PATH} — {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
