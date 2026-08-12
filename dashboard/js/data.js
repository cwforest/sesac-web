// JSON fetch + 메모리 캐시. 동일 경로 재요청 방지.

const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(path, { cache: "no-cache" }).then((res) => {
    if (!res.ok) throw new Error(`데이터 로드 실패: ${path} (${res.status})`);
    return res.json();
  });
  cache.set(path, promise);
  try {
    return await promise;
  } catch (err) {
    cache.delete(path);
    throw err;
  }
}

export const loadMeta = () => loadJSON("./data/meta.json");
export const loadSummary = () => loadJSON("./data/summary.json");
export const loadByGu = () => loadJSON("./data/by_gu.json");
export const loadTimeseries = () => loadJSON("./data/timeseries.json");
export const loadGeo = () => loadJSON("./data/geo/seoul-gu.geojson");
