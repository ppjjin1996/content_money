// 업종 · 인구와 수요 · 교차분석 · 보고서 페이지
// app.js 가 initPages(ctx)로 데이터(D)·필터 상태·공통 도우미를 넘겨줌
import { css, fmtWon, fmtInt, fmtPct, barH, table, geoMap, scatter } from "./charts.js";
import { SOURCES } from "./sources.js";

let X = null;
export const initPages = (ctx) => { X = ctx; };

const won = (v) => fmtWon(v) + "원";
const man = (v) => (v == null || !isFinite(v) ? "–" : (v / 1e4).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "만원"); // 원 → 만원
const p1 = (v) => (v == null || !isFinite(v) ? "–" : v.toFixed(1) + "%");
const div = (a, b, k = 1) => (a == null || b == null || !b ? null : (a / b) * k);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isGenre = (g) => X.GENRES.some((x) => x.key === g);
const gsum = (parts) => X.GENRES.reduce((a, g) => a + (parts?.[g.key] || 0), 0);
const legend = (host, items) => { const el = host.querySelector(".legend"); if (el) el.innerHTML = items.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join(""); };

/* ======================= 지표 목록 (교차분석·보고서 공통) =======================
   range = 이 지표가 수록된 연도, derived = 서로 다른 통계표로 계산한 값 */
const SRC_OF = { rev: "src-rev", est: "src-estemp", emp: "src-estemp", birthJ: "src-bd", startJ: "src-start", lic: "src-lic", cul: "src-budget", culShare: "src-budget", fin: "src-fin", gov: "src-fin", pop: "src-pop", old: "src-pop", inc: "src-inc" };
export function indicators() {
  const { D, at, finSum } = X;
  const pop = (r, y) => at(D.pop[r], y);
  const licYear = (r, y) => D.lic && D.lic.filter((x) => x["업종그룹"] === "전체" && x["업종"] === "_소계" && x["지역"] === r && +x["연도"] === y).reduce((s, x) => s + Number(x["개업(인허가)"]), 0);
  const list = [
    { k: "rev", grp: "시장", name: "콘텐츠 매출", range: [2010, 2024], get: (r, y) => at(D.rev[r], y), fmt: won, axis: (v) => fmtWon(v) },
    { k: "est", grp: "시장", name: "콘텐츠 사업체 수", range: [2016, 2024], get: (r, y) => at(D.est[r], y), fmt: (v) => fmtInt(v) + "개" },
    { k: "emp", grp: "시장", name: "콘텐츠 종사자 수", range: [2016, 2024], get: (r, y) => at(D.emp[r], y), fmt: (v) => fmtInt(v) + "명" },
    { k: "birthJ", grp: "창업", name: "정보통신업 신생기업", range: [2016, 2024], get: (r, y) => at(D.bd.J.birth[r], y), fmt: (v) => fmtInt(v) + "개" },
    { k: "startJ", grp: "창업", name: "정보통신업 창업기업", range: [2016, 2025], get: (r, y) => at(D.start.J[r], y), fmt: (v) => fmtInt(v) + "개" },
    D.lic && { k: "lic", grp: "창업", name: "콘텐츠 업종 인허가 개업", range: [2000, 2025], get: licYear, fmt: (v) => fmtInt(v) + "건" },
    { k: "cul", grp: "예산", name: "지자체 문화예산", range: [2016, 2024], get: (r, y) => at(D.budget.culture[r], y), fmt: won, axis: (v) => fmtWon(v) },
    { k: "culShare", grp: "예산", name: "총예산 대비 문화예산 비중", range: [2016, 2024], get: (r, y) => div(at(D.budget.culture[r], y), at(D.budget.total[r], y), 100), fmt: p1 },
    { k: "fin", grp: "예산", name: "문화및관광 예산", range: [2020, 2026], get: (r, y) => finSum(y, r, "문화및관광").total, fmt: won, axis: (v) => fmtWon(v) },
    { k: "gov", grp: "예산", name: "문화및관광 예산 중 국비 비중", range: [2020, 2026], get: (r, y) => { const g = finSum(y, r, "문화및관광"); return div(g["국비"], g.total, 100); }, fmt: p1 },
    { k: "pop", grp: "인구·수요", name: "인구", range: [2016, 2025], get: pop, fmt: (v) => fmtInt(v) + "명", axis: (v) => (v >= 1e4 ? fmtInt(v / 1e4) + "만" : fmtInt(v)) },
    { k: "old", grp: "인구·수요", name: "고령인구비율(65세 이상)", range: [2016, 2025], get: (r, y) => at(D.old[r], y), fmt: p1 },
    { k: "inc", grp: "인구·수요", name: "1인당 개인소득", range: [2015, 2022], get: (r, y) => { const v = at(D.inc[r], y); return v == null ? null : v * 1000; }, fmt: man },
    { k: "revPc", grp: "1인당·밀도", name: "1인당 콘텐츠 매출", derived: ["rev", "pop"], range: [2016, 2024], get: (r, y) => div(at(D.rev[r], y), pop(r, y), 1e6), fmt: man },
    { k: "estPer", grp: "1인당·밀도", name: "인구 1만 명당 콘텐츠 사업체", derived: ["est", "pop"], range: [2016, 2024], get: (r, y) => div(at(D.est[r], y), pop(r, y), 1e4), fmt: (v) => (v == null ? "–" : v.toFixed(1) + "개") },
    { k: "empPer", grp: "1인당·밀도", name: "인구 1천 명당 콘텐츠 종사자", derived: ["emp", "pop"], range: [2016, 2024], get: (r, y) => div(at(D.emp[r], y), pop(r, y), 1e3), fmt: (v) => (v == null ? "–" : v.toFixed(1) + "명") },
    { k: "culPc", grp: "1인당·밀도", name: "1인당 지자체 문화예산", derived: ["cul", "pop"], range: [2016, 2024], get: (r, y) => div(at(D.budget.culture[r], y), pop(r, y), 1e6), fmt: man },
    { k: "finPc", grp: "1인당·밀도", name: "1인당 문화및관광 예산", derived: ["fin", "pop"], range: [2020, 2025], get: (r, y) => div(finSum(y, r, "문화및관광").total, pop(r, y), 1e6), fmt: man },
  ];
  const g = X.state.genre;
  if (isGenre(g)) {
    const n = X.genreName(g);
    list.push({ k: "gRev", grp: "선택 업종", name: `${n} 매출`, range: [2024, 2024], get: (r) => D.mix[r]?.[g] ?? null, fmt: won, axis: (v) => fmtWon(v), src: ["src-rev"] });
    list.push({ k: "gEst", grp: "선택 업종", name: `${n} 사업체 수`, range: [2024, 2024], get: (r) => D.estMix[r]?.[g] ?? null, fmt: (v) => fmtInt(v) + "개", src: ["src-estemp"] });
  }
  return list.filter(Boolean).map((i) => ({ ...i, src: i.src || (i.derived || [i.k]).map((k) => SRC_OF[k]) }));
}
const ind = (k) => indicators().find((i) => i.k === k);

// 두 지표가 함께 있는 연도 중 선택 기간의 끝 연도 (없으면 null + 이유)
export function pairYear(list) {
  const lo = Math.max(...list.map((i) => i.range[0])), hi = Math.min(...list.map((i) => i.range[1]));
  const { from, to } = X.state;
  const a = Math.max(lo, from), b = Math.min(hi, to);
  if (lo > hi) return { year: null, reason: `${list.map((i) => `${i.name}(${i.range[0]}–${i.range[1]})`).join(", ")} — 함께 수록된 연도가 없습니다.` };
  if (a > b) return { year: null, reason: `두 지표가 함께 있는 ${lo}–${hi}년이 선택 기간(${from}–${to})과 겹치지 않습니다.` };
  return { year: b, reason: "" };
}
const rankIn = (I, R, Y) => { const s = X.SIDO.map((r) => [r, I.get(r, Y)]).filter((d) => d[1] != null).sort((a, b) => b[1] - a[1]); return { rank: s.findIndex((d) => d[0] === R) + 1, n: s.length, top: s[0] }; };

/* ---------- 상관계수 ---------- */
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let ab = 0, aa = 0, bb = 0;
  a.forEach((v, i) => { ab += (v - ma) * (b[i] - mb); aa += (v - ma) ** 2; bb += (b[i] - mb) ** 2; });
  return aa && bb ? ab / Math.sqrt(aa * bb) : null;
}
function ranks(a) { // 동순위는 평균 순위
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
const strength = (r) => { const a = Math.abs(r); return a >= 0.7 ? "강한" : a >= 0.4 ? "중간 정도의" : a >= 0.2 ? "약한" : null; };
const describe = (r) => (r == null ? "계산할 수 없음" : strength(r) ? `${strength(r)} ${r > 0 ? "양(+)의" : "음(−)의"} 상관` : "뚜렷한 상관 없음");

export function cross(xk, yk, opt = {}) {
  const I = indicators(), xi = I.find((i) => i.k === xk), yi = I.find((i) => i.k === yk);
  if (!xi || !yi) return { ok: false, reason: "선택한 지표를 지금 쓸 수 없습니다(업종 필터를 확인하세요)." };
  if (xk === yk) return { ok: false, reason: "서로 다른 두 지표를 고르세요." };
  const { year, reason } = pairYear([xi, yi]);
  if (!year) return { ok: false, xi, yi, reason };
  const regions = opt.exSeoul ? X.SIDO.filter((r) => r !== "서울") : X.SIDO;
  const pts = regions.map((r) => ({ label: r, x: xi.get(r, year), y: yi.get(r, year) })).filter((p) => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y));
  if (pts.length < 5) return { ok: false, xi, yi, reason: `${year}년에 두 값이 모두 있는 시도가 ${pts.length}곳뿐이라 분석하지 않습니다.` };
  const r = pearson(pts.map((p) => p.x), pts.map((p) => p.y)), rho = pearson(ranks(pts.map((p) => p.x)), ranks(pts.map((p) => p.y)));
  const derived = !!(xi.derived || yi.derived) || xi.src[0] !== yi.src[0];
  return { ok: true, xi, yi, year, pts, r, rho, n: pts.length, derived, exSeoul: !!opt.exSeoul };
}
function crossBullets(c) {
  const out = [
    `${c.year}년 ${c.n}개 시도 기준, 피어슨 r = <b>${c.r.toFixed(2)}</b> (${describe(c.r)}), 순위상관 ρ = <b>${c.rho.toFixed(2)}</b> (${describe(c.rho)}).`,
  ];
  if (Math.abs(c.r - c.rho) >= 0.3) out.push("r과 ρ의 차이가 커서 서울·제주 같은 일부 극단값이 결과를 좌우하고 있을 수 있습니다. '서울 제외'나 순위상관(ρ)을 함께 보세요.");
  out.push("17개 시도라 표본이 작고, 상관은 인과를 뜻하지 않습니다. 함께 움직이는 경향을 짚는 출발점으로만 쓰세요.");
  return out;
}
function drawCross(host, c, opt = {}) {
  scatter(host, c.pts, { xName: c.xi.name, yName: c.yi.name, fmtX: c.xi.fmt, fmtY: c.yi.fmt, fmtXAxis: c.xi.axis, fmtYAxis: c.yi.axis, highlight: X.state.region, log: !!opt.log, onPick: opt.onPick, height: opt.height, aria: `${c.xi.name}와 ${c.yi.name}의 산점도` });
  table(host, ["지역", c.xi.name, c.yi.name], c.pts.map((p) => [p.label, c.xi.fmt(p.x), c.yi.fmt(p.y)]));
}

/* ======================= 업종 페이지 ======================= */
let topGenre = null;
const genreOrTop = () => (isGenre(X.state.genre) ? X.state.genre : (topGenre ||= X.GENRES.slice().sort((a, b) => (X.D.mix["전국"][b.key] || 0) - (X.D.mix["전국"][a.key] || 0))[0].key));
function drawGenreRank(host, Y) {
  const g = X.state.genre, nat = X.D.genreNat;
  const rows = X.GENRES.map((G) => ({ label: G.name, value: X.at(nat[G.key], Y) })).sort((a, b) => b.value - a.value);
  barH(host, rows, { labelW: 92, fmt: won, highlight: isGenre(g) ? X.genreName(g) : null, color: css("--genre-broadcast"), aria: "장르별 매출" });
  const tot = rows.reduce((a, r) => a + (r.value || 0), 0);
  table(host, ["장르", `${Y} 매출(백만원)`, "비중"], rows.map((r) => [r.label, fmtInt(r.value), p1((r.value / tot) * 100)]));
}
function drawGenreTrend(host) {
  const nat = X.D.genreNat, g = X.state.genre, Y = X.yr(2010, 2024);
  const keys = isGenre(g) ? [g] : X.GENRES.slice().sort((a, b) => X.at(nat[b.key], Y) - X.at(nat[a.key], Y)).slice(0, 4).map((G) => G.key);
  const series = keys.map((k) => ({ name: X.genreName(k), color: css(X.GENRES.find((G) => G.key === k).v), values: nat[k].values }));
  legend(host, series.map((s) => [s.name, s.color]));
  X.lc(host, { years: nat[keys[0]].years, series, fmt: won, fmtAxis: (v) => fmtWon(v), breaks: X.BREAKS_CONTENT, aria: "장르별 매출 추이" });
  table(host, ["연도", ...series.map((s) => s.name)], nat[keys[0]].years.map((y, i) => [y, ...series.map((s) => fmtInt(s.values[i]))]));
}
function drawGenreRegion(host, g, kind) {
  const src = kind === "est" ? X.D.estMix : X.D.mix, fmt = kind === "est" ? (v) => fmtInt(v) + "개" : won;
  const rows = X.SIDO.map((r) => ({ label: r, value: src[r]?.[g] ?? null })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  barH(host, rows, { fmt, highlight: X.state.region, color: css(X.GENRES.find((G) => G.key === g).v), aria: `시도별 ${X.genreName(g)} ${kind === "est" ? "사업체 수" : "매출"}` });
  const nat = src["전국"][g];
  table(host, ["지역", kind === "est" ? "사업체 수" : "매출(백만원)", "전국 대비"], rows.map((r) => [r.label, r.value == null ? "원표 값 없음" : fmtInt(r.value), r.value == null ? "–" : p1((r.value / nat) * 100)]));
}
export function lqTable(kind = "rev") { // 입지계수 = (지역 내 장르 비중) ÷ (전국 장르 비중)
  const src = kind === "est" ? X.D.estMix : X.D.mix, nat = src["전국"], natTot = gsum(nat);
  return X.SIDO.map((r) => { const tot = gsum(src[r]); return { region: r, lq: Object.fromEntries(X.GENRES.map((G) => [G.key, src[r]?.[G.key] == null || !tot ? null : (src[r][G.key] / tot) / (nat[G.key] / natTot)])) }; });
}
function drawLQ(host, kind = "rev") {
  const rows = lqTable(kind), g = X.state.genre, R = X.state.region;
  const color = (v) => (v == null ? css("--ui-surface-2") : v >= 2 ? css("--div-pos-3") : v >= 1.25 ? css("--div-pos-1") : v > 0.8 ? css("--div-mid") : v > 0.5 ? css("--div-neg-1") : css("--div-neg-3"));
  const dark = (v) => v != null && (v >= 2 || v <= 0.5);
  host.querySelector(".plot").innerHTML = `<div class="lq-wrap"><table class="lq"><thead><tr><th>지역</th>${X.GENRES.map((G) => `<th class="${G.key === g ? "on" : ""}">${G.name}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr class="${row.region === R ? "on" : ""}"><th>${row.region}</th>${X.GENRES.map((G) => { const v = row.lq[G.key]; return `<td style="background:${color(v)};color:${dark(v) ? "#fff" : "inherit"}" class="${G.key === g ? "on" : ""}" title="${row.region} · ${G.name} 특화도 ${v == null ? "원표 값 없음" : v.toFixed(2)}">${v == null ? "–" : v.toFixed(1)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
  host.querySelector(".tableview").innerHTML = "";
  const lg = host.querySelector(".map-legend");
  if (lg) lg.innerHTML = [["0.5 이하", color(0.4)], ["0.5–0.8", color(0.6)], ["0.8–1.25 (전국 수준)", color(1)], ["1.25–2", color(1.5)], ["2 이상 (특화)", color(2.5)]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("");
}
function drawGenreEff(host) { // 2024 사업체당 매출 (같은 조사의 매출표 ÷ 사업체표)
  const rows = X.GENRES.map((G) => ({ label: G.name, value: div(X.D.mix["전국"][G.key], X.D.estMix["전국"][G.key]) })).sort((a, b) => b.value - a.value);
  barH(host, rows, { labelW: 92, fmt: (v) => (v >= 100 ? (v / 100).toFixed(1) + "억원" : fmtInt(v * 100) + "만원"), highlight: isGenre(X.state.genre) ? X.genreName(X.state.genre) : null, color: css("--genre-broadcast"), aria: "장르별 사업체당 매출" });
  table(host, ["장르", "매출(백만원)", "사업체 수", "사업체당 매출(백만원)"], X.GENRES.map((G) => [G.name, fmtInt(X.D.mix["전국"][G.key]), fmtInt(X.D.estMix["전국"][G.key]), fmtInt(div(X.D.mix["전국"][G.key], X.D.estMix["전국"][G.key]))]));
}
export function renderGenre() {
  const g = X.state.genre, gk = genreOrTop(), Y = X.yr(2010, 2024), gn = X.genreName(gk);
  const seg = document.getElementById("genreSeg");
  seg.innerHTML = `<button data-k="전체" aria-pressed="${!isGenre(g)}">전체</button>` + X.GENRES.map((G) => `<button data-k="${G.key}" aria-pressed="${G.key === g}">${G.name}</button>`).join("");
  document.getElementById("genreLead").textContent = isGenre(g)
    ? `${gn}을(를) 중심으로 봅니다. 위 필터의 '업종'과 같은 값입니다.`
    : `11개 장르를 함께 봅니다. 장르를 고르면 아래 시도별 카드가 그 장르로 바뀝니다(지금은 전국 매출 1위 ${gn}).`;
  document.getElementById("tGenreRank").textContent = `장르별 매출 (전국, ${Y})`;
  drawGenreRank(document.getElementById("cGenreRank"), Y);
  document.getElementById("tGenreTrend").textContent = isGenre(g) ? `${gn} 매출 추이 (전국)` : "매출 상위 4개 장르 추이 (전국)";
  drawGenreTrend(document.getElementById("cGenreTrend"));
  document.getElementById("tGenreRegRev").textContent = `시도별 ${gn} 매출 (2024)`;
  drawGenreRegion(document.getElementById("cGenreRegRev"), gk, "rev");
  document.getElementById("tGenreRegEst").textContent = `시도별 ${gn} 사업체 수 (2024)`;
  drawGenreRegion(document.getElementById("cGenreRegEst"), gk, "est");
  drawLQ(document.getElementById("cLQ"), X.state.lqKind || "rev");
  drawGenreEff(document.getElementById("cGenreEff"));
}

/* ======================= 인구와 수요 페이지 ======================= */
function drawPop(host, R) {
  const s = X.D.pop[R];
  X.lc(host, { years: s.years, series: [{ name: R, color: css("--genre-broadcast"), values: s.values }], fmt: (v) => fmtInt(v) + "명", fmtAxis: (v) => (v >= 1e6 ? (v / 1e4).toFixed(0) + "만" : fmtInt(v)), aria: `${R} 인구 추이` });
  table(host, ["연도", "인구(명)", "전년 대비"], s.years.map((y, i) => [y, fmtInt(s.values[i]), i ? fmtPct(X.pct(s.values[i], s.values[i - 1]), 2) : "–"]));
}
function drawVsNation(host, key, R, fmt, name) {
  const s = X.D[key][R], n = X.D[key]["전국"], c1 = css("--genre-broadcast"), c2 = css("--chart-axis");
  const series = R === "전국" ? [{ name: "전국", color: c1, values: n.values }] : [{ name: R, color: c1, values: s.values }, { name: "전국", color: c2, values: n.values }];
  legend(host, series.map((x) => [x.name, x.color]));
  X.lc(host, { years: s.years, series, fmt, aria: `${R} ${name}` });
  table(host, ["연도", R, "전국"], s.years.map((y, i) => [y, fmt(s.values[i]), fmt(n.values[i])]));
}
const PERCAP = ["revPc", "estPer", "empPer", "culPc", "finPc"];
function drawPerCap(host, k) {
  const I = ind(k), { year, reason } = pairYear([I]);
  const t = host.querySelector("h3"); if (t) t.textContent = year ? `시도별 ${I.name} (${year})` : `시도별 ${I.name}`;
  if (!year) { host.querySelector(".plot").innerHTML = `<div class="upload" style="margin:0"><b>선택한 기간에 볼 수 없습니다</b>${reason}</div>`; host.querySelector(".tableview").innerHTML = ""; return; }
  const rows = X.SIDO.map((r) => ({ label: r, value: I.get(r, year) })).sort((a, b) => b.value - a.value);
  barH(host, rows, { fmt: I.fmt, highlight: X.state.region, color: css("--genre-broadcast"), aria: I.name });
  table(host, ["지역", I.name, "전국 평균 대비"], rows.map((r) => [r.label, I.fmt(r.value), p1((r.value / I.get("전국", year)) * 100)]));
  const note = host.querySelector(".pcnote"); if (note) note.textContent = `전국 평균 ${I.fmt(I.get("전국", year))}`;
}
function marketIndex(Y) { // 매출·사업체 비중 ÷ 인구 비중
  const { D, at } = X, P = (r) => at(D.pop[r], Y);
  return X.SIDO.map((r) => {
    const ps = div(P(r), P("전국"), 100), rs = div(at(D.rev[r], Y), at(D.rev["전국"], Y), 100), es = div(at(D.est[r], Y), at(D.est["전국"], Y), 100);
    return { label: r, ps, rs, es, ri: div(rs, ps), ei: div(es, ps) };
  });
}
function drawMarketIndex(host, Y) {
  const rows = marketIndex(Y).sort((a, b) => b.ei - a.ei);
  barH(host, rows.map((r) => ({ label: r.label, value: r.ei })), { fmt: (v) => v.toFixed(2) + "배", highlight: X.state.region, color: css("--genre-broadcast"), aria: "인구 대비 사업체 집중도" });
  table(host, ["지역", "인구 비중", "매출 비중", "사업체 비중", "매출 지수", "사업체 지수"], rows.map((r) => [r.label, p1(r.ps), p1(r.rs), p1(r.es), r.ri.toFixed(2), r.ei.toFixed(2)]));
}
export function renderDemand() {
  const R = X.state.region;
  document.getElementById("tPop").textContent = `${R} 인구 추이`;
  drawPop(document.getElementById("cPop"), R);
  document.getElementById("tOld").textContent = `${R} 고령인구비율 (65세 이상)`;
  drawVsNation(document.getElementById("cOld"), "old", R, p1, "고령인구비율");
  document.getElementById("tInc").textContent = `${R} 1인당 개인소득`;
  drawVsNation(document.getElementById("cInc"), "inc", R, (v) => man(v * 1000), "1인당 개인소득");
  const k = X.state.perCap || "revPc";
  document.getElementById("perCapSeg").innerHTML = PERCAP.map((x) => `<button data-k="${x}" aria-pressed="${x === k}">${ind(x).name.replace(/^인구 /, "")}</button>`).join("");
  drawPerCap(document.getElementById("cPerCap"), k);
  const Y = X.yr(2016, 2024);
  document.getElementById("tMktIdx").textContent = `인구 대비 콘텐츠 사업체 집중도 (${Y})`;
  drawMarketIndex(document.getElementById("cMktIdx"), Y);
}

/* ======================= 교차분석 페이지 ======================= */
const SUGGEST = [["pop", "rev"], ["inc", "revPc"], ["old", "estPer"], ["culPc", "estPer"], ["gov", "revPc"], ["pop", "startJ"]];
function optionList(selected, other) {
  const I = indicators(), o = I.find((i) => i.k === other), groups = [...new Set(I.map((i) => i.grp))];
  return groups.map((grp) => `<optgroup label="${grp}">${I.filter((i) => i.grp === grp).map((i) => {
    const bad = o && (i.k === other || !pairYear([i, o]).year);
    return `<option value="${i.k}" ${i.k === selected ? "selected" : ""} ${bad ? "disabled" : ""}>${i.name} (${i.range[0] === i.range[1] ? i.range[0] : i.range.join("–")})${bad && i.k !== other ? " · 기간 안 겹침" : ""}</option>`;
  }).join("")}</optgroup>`).join("");
}
export function renderCross() {
  const s = X.state, I = indicators();
  if (!I.some((i) => i.k === s.crossX)) s.crossX = "pop";
  if (!I.some((i) => i.k === s.crossY)) s.crossY = "rev";
  document.getElementById("crossX").innerHTML = optionList(s.crossX, s.crossY);
  document.getElementById("crossY").innerHTML = optionList(s.crossY, s.crossX);
  document.getElementById("crossSuggest").innerHTML = SUGGEST.filter(([a, b]) => ind(a) && ind(b)).map(([a, b]) => {
    const ok = pairYear([ind(a), ind(b)]).year;
    return `<button class="chip" data-x="${a}" data-y="${b}" ${ok ? "" : "disabled title='선택한 기간에 함께 있는 연도가 없습니다'"}>${ind(a).name} × ${ind(b).name}</button>`;
  }).join("");
  const host = document.getElementById("cCross"), c = cross(s.crossX, s.crossY, { exSeoul: s.crossExSeoul });
  const stats = document.getElementById("crossStats");
  document.getElementById("crossAdd").disabled = !c.ok;
  if (!c.ok) {
    document.getElementById("tCross").textContent = "교차분석";
    host.querySelector(".plot").innerHTML = `<div class="upload" style="margin:0"><b>이 조합은 지금 분석할 수 없습니다</b>${c.reason}</div>`;
    host.querySelector(".tableview").innerHTML = ""; stats.innerHTML = ""; return;
  }
  document.getElementById("tCross").textContent = `${c.xi.name} × ${c.yi.name} (${c.year})`;
  drawCross(host, c, { log: s.crossLog, onPick: X.pickRegion });
  stats.innerHTML = `
    <div class="stat"><span>피어슨 r</span><b class="num">${c.r.toFixed(2)}</b><small>${describe(c.r)}</small></div>
    <div class="stat"><span>순위상관 ρ</span><b class="num">${c.rho.toFixed(2)}</b><small>${describe(c.rho)}</small></div>
    <div class="stat"><span>분석 단위</span><b class="num">${c.n}개 시도</b><small>${c.year}년${c.exSeoul ? " · 서울 제외" : ""}</small></div>
    <ul class="side-notes">${crossBullets(c).slice(1).map((t) => `<li>${t}</li>`).join("")}${c.derived ? `<li><span class="warnbadge">⚠ 통계표 연결 주의</span> 서로 다른 통계표(또는 같은 조사의 다른 통계표)를 함께 쓴 분석입니다. 통계표 간 정의가 상이할 수 있으므로 주의가 필요합니다.</li>` : ""}</ul>`;
  document.getElementById("crossSrc").innerHTML = `출처: ${srcCite([...c.xi.src, ...c.yi.src])}`;
}

/* ======================= 보고서 페이지 ======================= */
export const REPORT_AREAS = [
  { k: "summary", name: "핵심 요약", desc: "선택 지역의 핵심 숫자와 시도별 지도" },
  { k: "sales", name: "매출", desc: "매출 추이와 장르 구성" },
  { k: "genre", name: "업종", desc: "장르 순위·추이, 지역 특화도" },
  { k: "region", name: "지역 비교", desc: "17개 시도 순위와 증감" },
  { k: "biz", name: "창업과 소멸", desc: "신생·소멸, 창업, 인허가" },
  { k: "budget", name: "예산", desc: "지자체 문화예산과 재원" },
  { k: "demand", name: "인구와 수요", desc: "인구·고령화·소득과 1인당 지표" },
  { k: "policy", name: "정책", desc: "기간 내 법령 개정·정책자금" },
  { k: "cross", name: "교차분석", desc: "아래에서 고른 지표 조합" },
  { k: "sources", name: "데이터 출처", desc: "보고서에 쓴 자료의 참고문헌" },
];
const RP = { areas: new Set(["summary", "sales", "genre", "demand", "cross", "sources"]), pairs: [["pop", "rev"], ["inc", "revPc"]], title: "" };
export const addPair = (x, y) => { if (!RP.pairs.some(([a, b]) => a === x && b === y)) RP.pairs.push([x, y]); RP.areas.add("cross"); };

function srcCite(ids) {
  const list = SOURCES.filter((s) => !s.group), uniq = [...new Set(ids)].filter((id) => list.some((s) => s.id === id));
  return uniq.map((id) => { const s = list.find((x) => x.id === id), n = list.indexOf(s) + 1; const t = s.table.length > 28 ? s.table.slice(0, 27) + "…" : s.table; return `[${n}] 「${s.title}」 ${t}`; }).join(" · ");
}
const fig = (id, title, cap = "") => `<figure class="card rp-fig" id="${id}"><figcaption><b>${esc(title)}</b>${cap ? `<span>${cap}</span>` : ""}</figcaption><div class="legend"></div><div class="map-legend"></div><div class="plot"></div><div class="tableview"></div></figure>`;

// 영역별 보고서 내용: { bullets, figs:[{title, cap, draw(host)}], src:[...] , html }
function areaContent(k) {
  const { D, at, pct, yr, state, finSum, SIDO, BREAKS_CONTENT } = X, R = state.region;
  const I = Object.fromEntries(indicators().map((i) => [i.k, i]));
  const rk = (key, Y) => { const r = rankIn(I[key], R, Y); return R === "전국" ? "" : ` · 17개 시도 중 ${r.rank}위`; };
  const share = (key, Y) => (R === "전국" ? "" : ` · 전국의 ${p1((I[key].get(R, Y) / I[key].get("전국", Y)) * 100)}`);
  const brkIn = (a, b) => BREAKS_CONTENT.filter((y) => y > a && y <= b);
  switch (k) {
    case "summary": {
      const Y = yr(2016, 2024), Yp = yr(2016, 2025), Yf = yr(2020, 2026);
      const f = finSum(Yf, R, "문화및관광");
      return {
        bullets: [
          `콘텐츠 매출 <b>${won(I.rev.get(R, Y))}</b> (${Y})${share("rev", Y)}${rk("rev", Y)}.`,
          `콘텐츠 사업체 ${fmtInt(I.est.get(R, Y))}개, 종사자 ${fmtInt(I.emp.get(R, Y))}명 (${Y})${rk("est", Y)}(사업체).`,
          `인구 ${fmtInt(I.pop.get(R, Yp))}명 (${Yp}), 고령인구비율 ${p1(I.old.get(R, Yp))} (전국 ${p1(I.old.get("전국", Yp))}).`,
          `1인당 콘텐츠 매출 ${man(I.revPc.get(R, Y))} (전국 평균 ${man(I.revPc.get("전국", Y))}, ${Y}).`,
          `문화및관광 예산 ${won(f.total)} (${Yf} 당초), 그중 국비 ${p1((f["국비"] / f.total) * 100)}.`,
        ],
        figs: [{ title: `시도별 콘텐츠 매출 (${Y})`, cap: "진할수록 큼 (5단계)", draw: (h) => geoMap(h, SIDO.map((r) => ({ label: r, value: I.rev.get(r, Y) })), { fmt: won, legendFmt: (v) => fmtWon(v), highlight: R, aria: "시도별 매출 지도" }) }],
        src: ["src-rev", "src-estemp", "src-pop", "src-fin", "src-map"],
      };
    }
    case "sales": {
      const Y = yr(2010, 2024), s = D.rev[R], a = Math.max(state.from, 2010), brk = brkIn(a, Y);
      const mix = D.mix[R], tot = gsum(mix), top = X.GENRES.map((G) => [G.name, mix[G.key] || 0]).sort((x, y) => y[1] - x[1]).slice(0, 3);
      return {
        bullets: [
          `${R} 콘텐츠 매출은 ${Y}년 <b>${won(at(s, Y))}</b>, 전년 대비 ${fmtPct(pct(at(s, Y), at(s, Y - 1)))}${BREAKS_CONTENT.includes(Y) ? ` (⚠ ${Y}년 조사 개편 — 개편 영향이 섞여 있을 수 있음)` : ""}.`,
          brk.length ? `선택 기간에 조사 개편(${brk.join("·")}년)이 있어 기간 전체 증감률은 제시하지 않습니다.` : a < Y ? `${a}→${Y}년 ${fmtPct(pct(at(s, Y), at(s, a)))} 변화.` : null,
          `2024년 장르 구성 상위: ${top.map(([n, v]) => `${n} ${p1((v / tot) * 100)}`).join(", ")}.`,
          R === "제주" ? "제주 매출에는 본사가 제주에 있는 대형 플랫폼 기업 실적이 반영된 것으로 보여 지역 생태계 규모로 그대로 읽으면 안 됩니다." : null,
        ].filter(Boolean),
        figs: [
          { title: `${R} 콘텐츠 매출 추이`, cap: "점선 = 조사 개편 경계", draw: (h) => X.lc(h, { years: s.years, series: [{ name: R, color: css("--genre-broadcast"), values: s.values }], fmt: won, fmtAxis: (v) => fmtWon(v), breaks: BREAKS_CONTENT, height: 240 }) },
          { title: `${R} 장르별 매출 (2024)`, draw: (h) => barH(h, X.GENRES.map((G) => ({ label: G.name, value: mix[G.key] })).filter((r) => r.value != null).sort((x, y) => y.value - x.value), { labelW: 92, fmt: won, color: css("--genre-broadcast") }) },
        ],
        src: ["src-rev"],
      };
    }
    case "genre": {
      const Y = yr(2010, 2024), nat = D.genreNat, rank = X.GENRES.map((G) => [G, at(nat[G.key], Y)]).sort((a, b) => b[1] - a[1]);
      const gk = genreOrTop(), gn = X.genreName(gk), lq = lqTable().find((r) => r.region === R);
      const spec = lq ? Object.entries(lq.lq).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
      return {
        bullets: [
          `${Y}년 전국 장르별 매출 상위: ${rank.slice(0, 3).map(([G, v]) => `${G.name} ${won(v)}`).join(", ")}.`,
          `${gn} 매출 ${won(at(nat[gk], Y))} (전국, ${Y}), 전년 대비 ${fmtPct(pct(at(nat[gk], Y), at(nat[gk], Y - 1)))}.`,
          R !== "전국" && D.mix[R][gk] != null ? `${R}의 ${gn} 매출은 ${won(D.mix[R][gk])} (2024), 전국 ${gn} 매출의 ${p1((D.mix[R][gk] / D.mix["전국"][gk]) * 100)}.` : null,
          R !== "전국" && spec.length ? `${R}의 매출 특화 장르(입지계수 상위): ${spec.map(([k, v]) => `${X.genreName(k)} ${v.toFixed(2)}`).join(", ")}. 1보다 크면 전국 평균보다 그 장르 비중이 높습니다.` : null,
          "방송·영상(2012), 캐릭터(2021) 등은 분류·조사 변경으로 값이 크게 뛰거나 줄어든 해가 있어 추이 해석에 주의하세요.",
        ].filter(Boolean),
        figs: [
          { title: `장르별 매출 (전국, ${Y})`, draw: (h) => drawGenreRank(h, Y) },
          { title: `시도별 ${gn} 매출 (2024)`, draw: (h) => drawGenreRegion(h, gk, "rev") },
          { title: "지역 × 장르 특화도 (입지계수, 매출 2024)", cap: "(지역 내 장르 비중) ÷ (전국 장르 비중)", draw: (h) => drawLQ(h, "rev") },
        ],
        src: ["src-rev", "src-estemp"],
      };
    }
    case "region": {
      const Y = yr(2010, 2024), rows = SIDO.map((r) => ({ label: r, value: at(D.rev[r], Y) })).sort((a, b) => b.value - a.value), nat = at(D.rev["전국"], Y);
      const top3 = rows.slice(0, 3).reduce((a, r) => a + r.value, 0);
      return {
        bullets: [
          `${Y}년 매출 1위 ${rows[0].label}(${p1((rows[0].value / nat) * 100)}), 상위 3개 시도가 전국의 ${p1((top3 / nat) * 100)}를 차지합니다.`,
          R !== "전국" ? `${R}은(는) 17개 시도 중 ${rows.findIndex((r) => r.label === R) + 1}위입니다.` : null,
          `전년 대비 증가율 1위: ${SIDO.map((r) => [r, pct(at(D.rev[r], Y), at(D.rev[r], Y - 1))]).sort((a, b) => b[1] - a[1])[0].map((v, i) => (i ? fmtPct(v) : v)).join(" ")}.`,
        ].filter(Boolean),
        figs: [
          { title: `시도별 콘텐츠 매출 (${Y})`, draw: (h) => barH(h, rows, { fmt: won, highlight: R, color: css("--genre-broadcast") }) },
          { title: `전년 대비 증감률 (${Y - 1}→${Y})`, draw: (h) => barH(h, SIDO.map((r) => ({ label: r, value: pct(at(D.rev[r], Y), at(D.rev[r], Y - 1)) })).sort((a, b) => b.value - a.value), { fmt: (v) => fmtPct(v), highlight: R, diverging: true }) },
        ],
        src: ["src-rev"],
      };
    }
    case "biz": {
      const Y = yr(2016, 2024), b = D.bd.J.birth[R], d = D.bd.J.death[R], st = D.start.J[R], Ys = yr(2016, 2025);
      const lic = D.lic ? (y) => D.lic.filter((x) => x["업종그룹"] === "전체" && x["업종"] === "_소계" && x["지역"] === R && +x["연도"] === y)[0] : null;
      const Yl = yr(2000, 2025), L = lic && lic(Yl);
      const c1 = css("--genre-broadcast"), c2 = css("--genre-game");
      return {
        bullets: [
          `정보통신업 신생기업 ${fmtInt(at(b, Y))}개, 소멸기업 ${fmtInt(at(d, Y))}개 (${Y}, 기업생멸행정통계).`,
          `정보통신업 창업기업 ${fmtInt(at(st, Ys))}개 (${Ys}, 창업기업동향 — 신생기업과 정의가 달라 따로 봅니다).`,
          L ? `콘텐츠 업종 인허가 개업 ${fmtInt(+L["개업(인허가)"])}건, 폐업 ${fmtInt(+L["폐업"])}건 (${Yl}).` : null,
          "정보통신업은 콘텐츠 외 업종이 섞인 산업대분류라 대리지표입니다.",
        ].filter(Boolean),
        figs: [
          { title: `${R} 정보통신업 신생·소멸 기업`, draw: (h) => { legend(h, [["신생", c1], ["소멸", c2]]); X.lc(h, { years: b.years, series: [{ name: "신생", color: c1, values: b.values }, { name: "소멸", color: c2, values: d.values }], fmt: (v) => fmtInt(v) + "개", height: 240 }); } },
          lic && { title: `${R} 콘텐츠 업종 인허가 개업·폐업`, draw: (h) => { const ys = Array.from({ length: 26 }, (_, i) => 2000 + i), v = (y, key) => { const r = lic(y); return r ? +r[key] : 0; }; legend(h, [["개업", c1], ["폐업", c2]]); X.lc(h, { years: ys, series: [{ name: "개업", color: c1, values: ys.map((y) => v(y, "개업(인허가)")) }, { name: "폐업", color: c2, values: ys.map((y) => v(y, "폐업")) }], fmt: (x) => fmtInt(x) + "건", height: 240 }); } },
        ].filter(Boolean),
        src: ["src-bd", "src-start", "src-lic"],
      };
    }
    case "budget": {
      const Y = yr(2016, 2024), Yf = yr(2020, 2026), cu = D.budget.culture[R], f = finSum(Yf, R, "문화및관광");
      return {
        bullets: [
          `지자체 문화예산 ${won(at(cu, Y))} (${Y}), 총예산 대비 ${p1(I.culShare.get(R, Y))}${rk("culShare", Y)}(비중).`,
          `문화및관광 당초예산 ${won(f.total)} (${Yf}) — 국비 ${p1((f["국비"] / f.total) * 100)}, 시도비 ${p1((f["시도비"] / f.total) * 100)}, 시군구비 ${p1((f["시군구비"] / f.total) * 100)}.`,
          "두 예산은 출처(공연예술조사·지방재정365)와 범위가 달라 같은 선에 잇지 않습니다.",
        ],
        figs: [
          { title: `${R} 지자체 문화예산 추이`, cap: "공연예술조사", draw: (h) => X.lc(h, { years: cu.years, series: [{ name: "문화예산", color: css("--genre-broadcast"), values: cu.values }], fmt: won, fmtAxis: (v) => fmtWon(v), breaks: X.BREAKS_BUDGET, height: 240 }) },
          { title: `시도별 문화및관광 예산 중 국비 비중 (${Yf})`, cap: "지방재정365", draw: (h) => barH(h, SIDO.map((r) => ({ label: r, value: I.gov.get(r, Yf) })).sort((a, b) => b.value - a.value), { fmt: p1, highlight: R, color: css("--genre-broadcast") }) },
        ],
        src: ["src-budget", "src-fin"],
      };
    }
    case "demand": {
      const Yp = yr(2016, 2025), a = Math.max(state.from, 2016), Y = yr(2016, 2024), Yi = yr(2015, 2022);
      const P = D.pop[R], mi = marketIndex(Y).find((m) => m.label === R);
      return {
        bullets: [
          `인구 ${fmtInt(at(P, Yp))}명 (${Yp})${a < Yp ? `, ${a}년 대비 ${fmtPct(pct(at(P, Yp), at(P, a)))}` : ""}.`,
          `고령인구비율 ${p1(I.old.get(R, Yp))} — 전국 ${p1(I.old.get("전국", Yp))}${rk("old", Yp)}(높은 순).`,
          `1인당 개인소득 ${man(I.inc.get(R, Yi))} (${Yi}, 전국 ${man(I.inc.get("전국", Yi))}) — 지역소득 통계는 ${Yi}년까지 받았습니다.`,
          `1인당 콘텐츠 매출 ${man(I.revPc.get(R, Y))}, 인구 1만 명당 사업체 ${I.estPer.fmt(I.estPer.get(R, Y))} (${Y})${rk("estPer", Y)}(사업체 밀도).`,
          mi ? `인구 비중 ${p1(mi.ps)} 대비 사업체 비중 ${p1(mi.es)} → 집중도 ${mi.ei.toFixed(2)}배 (1보다 크면 인구에 비해 콘텐츠 사업체가 많음).` : null,
          "1인당·밀도 지표는 서로 다른 통계표(콘텐츠산업조사 ÷ 주민등록인구)로 계산했습니다. 통계표 간 정의가 상이할 수 있으므로 주의가 필요합니다.",
        ].filter(Boolean),
        figs: [
          { title: `${R} 인구 추이`, draw: (h) => drawPop(h, R) },
          { title: `시도별 1인당 콘텐츠 매출 (${Y})`, draw: (h) => drawPerCap(h, "revPc") },
        ],
        src: ["src-pop", "src-inc", "src-rev", "src-estemp"],
      };
    }
    case "policy": {
      const laws = D.laws.filter((r) => !/타법/.test(r["구분"]) && +r["시행일"].slice(0, 4) >= state.from && +r["시행일"].slice(0, 4) <= state.to).sort((a, b) => a["시행일"].localeCompare(b["시행일"]));
      return {
        bullets: [
          `선택 기간(${state.from}–${state.to}) 자체 개정(제정·전부개정·일부개정) ${laws.length}건 — 다른 법 개정에 따른 타법개정은 뺐습니다.`,
          "법령 개정 시점과 매출 변화가 겹쳐도 정책의 효과라고 단정할 수 없습니다.",
        ],
        html: laws.length ? `<table class="dt rp-table"><thead><tr><th>시행일</th><th>법령(당시 명칭)</th><th>구분</th><th>법률번호</th></tr></thead><tbody>${laws.map((r) => `<tr><td>${r["시행일"]}</td><td>${esc(r["당시명칭"])}</td><td>${r["구분"]}</td><td>${r["법률번호"]}</td></tr>`).join("")}</tbody></table>` : "",
        figs: [],
        src: ["src-law"],
      };
    }
    case "cross": {
      const res = RP.pairs.map(([x, y]) => cross(x, y));
      const ok = res.filter((c) => c.ok), bad = res.filter((c) => !c.ok);
      return {
        bullets: ok.length ? [] : ["고른 지표 조합 가운데 지금 기간에 분석할 수 있는 것이 없습니다."],
        sub: ok.map((c) => ({ title: `${c.xi.name} × ${c.yi.name}`, bullets: [...crossBullets(c).slice(0, 2), c.derived ? "서로 다른 통계표를 함께 쓴 분석입니다. 통계표 간 정의가 상이할 수 있으므로 주의가 필요합니다." : null].filter(Boolean), fig: { title: `${c.xi.name} × ${c.yi.name} (${c.year})`, draw: (h) => drawCross(h, c, { height: 320 }) } })),
        html: bad.length ? `<p class="rp-skip">제외한 조합: ${bad.map((c) => `${c.xi ? `${c.xi.name} × ${c.yi.name}` : "–"} (${c.reason})`).join(" / ")}</p>` : "",
        figs: [],
        src: ok.flatMap((c) => [...c.xi.src, ...c.yi.src]),
      };
    }
  }
  return null;
}

function renderPairs() {
  const box = document.getElementById("rpPairs");
  box.innerHTML = RP.pairs.length ? RP.pairs.map(([x, y], i) => {
    const xi = ind(x), yi = ind(y), py = xi && yi ? pairYear([xi, yi]) : { year: null, reason: "업종 필터를 바꿔 이 지표를 쓸 수 없습니다." };
    return `<li class="${py.year ? "" : "off"}"><span>${xi ? xi.name : x} × ${yi ? yi.name : y}</span><small>${py.year ? `${py.year}년 기준 분석 가능` : `분석 불가 — ${py.reason}`}</small><button class="fbtn ghost" data-del="${i}" aria-label="이 조합 빼기">빼기</button></li>`;
  }).join("") : `<li class="off"><span>아직 고른 조합이 없습니다.</span></li>`;
  document.getElementById("rpX").innerHTML = optionList(document.getElementById("rpX").value || "pop", document.getElementById("rpY").value || "rev");
  document.getElementById("rpY").innerHTML = optionList(document.getElementById("rpY").value || "rev", document.getElementById("rpX").value || "pop");
}
export function renderReportControls() {
  const box = document.getElementById("rpAreas");
  box.innerHTML = REPORT_AREAS.map((a) => `<label class="rp-area"><input type="checkbox" value="${a.k}" ${RP.areas.has(a.k) ? "checked" : ""}><span><b>${a.name}</b><small>${a.desc}</small></span></label>`).join("");
  renderPairs();
  const s = X.state;
  document.getElementById("rpScope").textContent = `지역 ${s.region} · 기간 ${s.from === s.to ? s.from + "년" : `${s.from}–${s.to}`}${isGenre(s.genre) ? ` · 업종 ${X.genreName(s.genre)}` : ""}`;
}
export function buildReport() {
  const s = X.state, doc = document.getElementById("reportDoc");
  const areas = REPORT_AREAS.filter((a) => RP.areas.has(a.k));
  const title = (document.getElementById("rpTitle").value || "").trim() || `${s.region} 콘텐츠 시장 보고서`;
  const today = new Date().toISOString().slice(0, 10);
  const draws = [], used = [];
  let html = `<header class="rp-cover"><div class="logo"><i></i>K-Content Market Pulse</div><h1>${esc(title)}</h1>
    <p class="rp-meta">대상 지역 <b>${s.region}</b> · 기간 <b>${s.from === s.to ? s.from + "년" : `${s.from}–${s.to}`}</b>${isGenre(s.genre) ? ` · 업종 <b>${X.genreName(s.genre)}</b>` : ""} · 작성일 ${today}</p>
    <p class="rp-note">이 보고서는 대시보드가 공개 통계로 자동 작성했습니다. 자료마다 수록 연도가 달라 각 문장·그림에 기준 연도를 적었습니다. 수치 해석은 참고용입니다.</p>
    <ol class="rp-toc">${areas.map((a) => `<li>${a.name}</li>`).join("")}</ol></header>`;
  let n = 0;
  areas.forEach((a) => {
    n += 1;
    if (a.k === "sources") return; // 마지막에
    const c = areaContent(a.k); if (!c) return;
    used.push(...c.src);
    html += `<section class="rp-sec"><h2>${n}. ${a.name}</h2>${c.bullets.length ? `<ul class="rp-bullets">${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}${c.html || ""}`;
    if (c.figs.length) html += `<div class="rp-figs">${c.figs.map((f, i) => { const id = `rp-${a.k}-${i}`; draws.push([id, f.draw]); return fig(id, f.title, f.cap); }).join("")}</div>`;
    (c.sub || []).forEach((sb, i) => { const id = `rp-${a.k}-s${i}`; draws.push([id, sb.fig.draw]); html += `<div class="rp-sub"><h3>${esc(sb.title)}</h3><ul class="rp-bullets">${sb.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>${fig(id, sb.fig.title)}</div>`; });
    html += `<p class="rp-src">출처: ${srcCite(c.src)}</p></section>`;
  });
  if (RP.areas.has("sources")) {
    const list = SOURCES.filter((x) => !x.group), ids = [...new Set(used)];
    const refs = list.filter((x) => ids.includes(x.id));
    html += `<section class="rp-sec rp-refs"><h2>${areas.findIndex((a) => a.k === "sources") + 1}. 데이터 출처</h2><ol>${refs.map((x) => `<li value="${list.indexOf(x) + 1}">${x.author}. 「${x.title}」 ${x.table}. ${x.tbl ? `통계표 ${x.tbl}. ` : ""}${x.url} (${x.accessed} 접속).</li>`).join("")}</ol></section>`;
  }
  if (!areas.length) html += `<p class="rp-skip">위에서 보고서에 넣을 영역을 하나 이상 고르세요.</p>`;
  doc.innerHTML = html;
  draws.forEach(([id, draw]) => { const h = document.getElementById(id); if (h) draw(h); });
  document.getElementById("rpPrint").disabled = !areas.length;
}
export function initReport() {
  document.getElementById("rpAreas").addEventListener("change", (e) => { const v = e.target.value; e.target.checked ? RP.areas.add(v) : RP.areas.delete(v); buildReport(); });
  document.getElementById("rpAll").addEventListener("click", () => { const all = RP.areas.size < REPORT_AREAS.length; REPORT_AREAS.forEach((a) => (all ? RP.areas.add(a.k) : RP.areas.delete(a.k))); renderReportControls(); buildReport(); });
  document.getElementById("rpPairs").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; RP.pairs.splice(+b.dataset.del, 1); renderPairs(); buildReport(); });
  ["rpX", "rpY"].forEach((id) => document.getElementById(id).addEventListener("change", renderPairs));
  document.getElementById("rpAddPair").addEventListener("click", () => {
    const x = document.getElementById("rpX").value, y = document.getElementById("rpY").value;
    if (x === y) return; addPair(x, y); renderReportControls(); buildReport();
  });
  document.getElementById("rpTitle").addEventListener("input", () => { clearTimeout(initReport.t); initReport.t = setTimeout(buildReport, 300); });
  document.getElementById("rpPrint").addEventListener("click", () => {
    const root = document.documentElement, wasDark = root.dataset.theme === "dark";
    if (wasDark) { root.dataset.theme = "light"; buildReport(); } // 인쇄는 밝은 테마로
    root.classList.add("printing");
    const done = () => { root.classList.remove("printing"); if (wasDark) { root.dataset.theme = "dark"; buildReport(); } window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 50);
  });
}
