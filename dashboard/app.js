import { initLock } from "./lock.js";
import { css, fmtWon, fmtInt, fmtPct, lineChart, barH, stacked100, table, lawTimeline, geoMap } from "./charts.js";
import { SOURCES, KINDS } from "./sources.js";
import { initPages, renderGenre, renderDemand, renderCross, renderReportControls, buildReport, initReport, addPair } from "./pages.js";

const REGIONS = ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const SIDO = REGIONS.slice(1);
const GENRES = [ // 순서 = 색 슬롯 순서 (파생색은 기본색 바로 뒤)
  { key: "방송및영상", name: "방송·영상", v: "--genre-broadcast" },
  { key: "게임", name: "게임", v: "--genre-game" },
  { key: "음악", name: "음악", v: "--genre-music" },
  { key: "출판", name: "출판", v: "--genre-publish" },
  { key: "만화", name: "만화", v: "--genre-comics", sib: true },
  { key: "캐릭터", name: "캐릭터", v: "--genre-character" },
  { key: "애니메이션", name: "애니메이션", v: "--genre-animation", sib: true },
  { key: "지식정보", name: "지식정보", v: "--genre-knowledge" },
  { key: "콘텐츠솔루션", name: "콘텐츠솔루션", v: "--genre-solution", sib: true },
  { key: "영화", name: "영화", v: "--genre-film" },
  { key: "광고", name: "광고", v: "--genre-ad" },
];
const BREAKS_CONTENT = [2012, 2014, 2020, 2023];
const BREAKS_BUDGET = [2019, 2023];

const FILES = {
  rev: "01_콘텐츠매출_지역별_합계_2010-2024.csv",
  mix: "02_콘텐츠매출_지역별_장르별_2024.csv",
  estemp: "03_콘텐츠_지역별_사업체수_종사자수_2016-2024.csv",
  bdJ: "04_기업생멸_정보통신업J_시도별_2016-2024.csv",
  bdR: "05_기업생멸_예술스포츠여가R_시도별_2016-2024.csv",
  start: "06_창업기업수_정보통신업_예술여가_시도별_2016-2025.csv",
  budget: "07_지자체_총예산_문화예산_문화예술예산_시도별_2016-2024.csv",
  laws: "08_법령연혁_콘텐츠·문화산업·지역문화.csv",
  nat: "09_국가결산_콘텐츠관련_단위사업_2020-2025.csv",
  dept: "10_부처별_세출결산_2020-2025_예산_2026.csv",
  local: "11_지자체_세출총계_시도별_2020-2026.csv",
  prog26: "12_재정사업_문화및관광_세부사업_2026.csv",
  fund: "13_모태펀드_문화·영화계정_선정결과_2023-2026.csv",
  fin: "14_지자체_문화및관광_재원별_세출예산_시도별_2020-2026.csv",
  pop: "16_인구_전체인구_고령인구비율_시도별_2016-2025.csv",
  genreNat: "17_콘텐츠매출_장르별_전국_2010-2024.csv",
  estMix: "18_콘텐츠사업체수_지역별_장르별_2024.csv",
  inc: "19_1인당개인소득_시도별_2015-2022.csv",
};
const OPTIONAL = { lic: "15_콘텐츠업종_인허가_개폐업_시도별_연도별.csv" }; // tools/collect_licenses.py 실행 후 생김
const FIN_GROUPS = [ // 재원 묶음 → 범주 슬롯
  { key: "국비", cols: ["국고보조금", "지특보조금", "기금보조금"], v: "--series-1" },
  { key: "교부세 등", cols: ["특별교부세", "소방안전교부세", "지방대응소멸기금"], v: "--series-2" },
  { key: "시도비", cols: ["시도비"], v: "--series-3" },
  { key: "시군구비", cols: ["시군구비"], v: "--series-4" },
  { key: "기타", cols: ["특별교부금", "지방채", "민자", "기타"], v: "--series-5" },
];
const FUND_GROUPS = [ // 분야그룹 → 범주 슬롯 순서
  { key: "IP", v: "--series-1" }, { key: "수출", v: "--series-2" }, { key: "신기술·CT", v: "--series-3" },
  { key: "M&A·세컨더리", v: "--series-4" }, { key: "문화일반·성장", v: "--series-5" }, { key: "상생·지역", v: "--series-6" },
  { key: "청년·장르특화", v: "--series-7" }, { key: "영화(영화계정)", v: "--series-8" },
];
const LAWS = [
  { name: "콘텐츠산업 진흥법", short: "콘텐츠산업진흥법", v: "--genre-broadcast" },
  { name: "문화산업진흥 기본법", short: "문화산업기본법", v: "--genre-game" },
  { name: "지역문화진흥법", short: "지역문화진흥법", v: "--genre-music" },
];
const NAT_CATS = [
  { key: "문화콘텐츠 진흥(문체부 일반회계)", short: "문화콘텐츠 진흥", v: "--genre-broadcast" },
  { key: "지역 문화·콘텐츠", short: "지역 문화·콘텐츠", v: "--genre-game" },
  { key: "방송통신 등 기타 콘텐츠", short: "방송통신 등", v: "--genre-music" },
  { key: "콘텐츠 기술 R&D", short: "기술 R&D", v: "--genre-publish" },
];

function parseCSV(text) { // 따옴표로 감싼 칸(쉼표 포함)도 처리
  const rows = []; let row = [], cell = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c !== "")) rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((c) => c !== "")) rows.push(row); }
  const head = rows[0];
  return rows.slice(1).map((c) => { const o = {}; head.forEach((h, i) => (o[h] = c[i])); return o; });
}
const yearsOf = (row) => Object.keys(row).filter((k) => /^\d{4}$/.test(k)).map(Number);
const num = (v) => (v === "" || v == null ? null : Number(v));
// rows → { [groupKey]: { [region]: {years:[], values:[]} } }
function index(rows, groupCols) {
  const out = {};
  for (const r of rows) {
    const g = groupCols.map((c) => r[c]).join("|") || "_";
    const yrs = yearsOf(r);
    (out[g] ||= {})[r["지역"]] = { years: yrs, values: yrs.map((y) => num(r[y])) };
  }
  return out;
}
const at = (s, y) => (s ? s.values[s.years.indexOf(y)] ?? null : null);
const pct = (a, b) => (a == null || b == null || !b ? null : ((a - b) / b) * 100);

const YEAR_MIN = 2010, YEAR_MAX = 2026, PRESET_END = 2025;
const state = { exSeoul: false, region: "전국", metric: "rev", ind: "J", licGroup: "전체", from: YEAR_MIN, to: YEAR_MAX, genre: "전체", mapMetric: "rev", crossX: "pop", crossY: "rev", crossExSeoul: false, crossLog: false, perCap: "revPc", lqKind: "rev" };
const yr = (lo, hi) => Math.max(lo, Math.min(hi, state.to)); // 자료별 수록 범위 안에서 '기간 끝 연도'
const LIC_OF_GENRE = { 출판: "출판", 만화: "출판", 음악: "음악", 게임: "게임", 영화: "영화·비디오", 애니메이션: "영화·비디오", 방송및영상: "영화·비디오", 대중문화예술기획: "대중문화예술기획" };
const genreName = (k) => (GENRES.find((g) => g.key === k) || { name: k }).name;

// 기간 필터를 적용한 선 차트 (기간 밖 연도는 잘라내고, 남는 점이 2개 미만이면 안내)
function lc(host, opts) {
  if (state.from === state.to) { // 특정 연도 선택: 전체 추이 + 그 연도 강조
    const y = state.from, inRange = opts.years.includes(y);
    lineChart(host, { ...opts, markYear: inRange ? y : null, markNote: inRange ? null : `${y}년 자료 없음 (수록 ${opts.years[0]}–${opts.years[opts.years.length - 1]})` });
    return;
  }
  const keep = opts.years.map((y, i) => (y >= state.from && y <= state.to ? i : -1)).filter((i) => i >= 0);
  if (keep.length < 2) {
    host.querySelector(".plot").innerHTML = `<div class="upload" style="margin:0"><b>선택한 기간에 볼 자료가 부족합니다</b>이 자료는 ${opts.years[0]}–${opts.years[opts.years.length - 1]}년이 수록돼 있습니다. 기간을 넓혀 보세요.</div>`;
    return;
  }
  lineChart(host, {
    ...opts,
    years: keep.map((i) => opts.years[i]),
    series: opts.series.map((x) => ({ ...x, values: keep.map((i) => x.values[i]) })),
    breaks: (opts.breaks || []).filter((b) => b > state.from && b <= state.to),
    rug: opts.rug && opts.rug.map((r) => ({ ...r, events: r.events.filter((e) => e.year >= state.from && e.year <= state.to) })),
  });
}
let D = {};

async function load() {
  const base = "../data/";
  // 한글 파일 이름은 올린 환경(Windows/Mac)에 따라 자모 표기(NFC/NFD)가 달라질 수 있어 둘 다 시도
  const get = async (f) => {
    for (const name of new Set([f.normalize("NFC"), f.normalize("NFD")])) { const r = await fetch(base + encodeURIComponent(name)); if (r.ok) return r.text(); }
    throw new Error(`${f} 파일을 찾지 못했습니다`);
  };
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, f]) => [k, parseCSV(await get(f))]));
  const lic = await get(OPTIONAL.lic).catch(() => null);
  D.lic = lic ? parseCSV(lic) : null;
  const raw = Object.fromEntries(entries);
  D.rev = index(raw.rev, [])._;
  D.mix = Object.fromEntries(raw.mix.map((r) => [r["지역"], Object.fromEntries(GENRES.map((g) => [g.key, num(r[g.key])]))]));
  const ee = index(raw.estemp, ["구분"]); D.est = ee["사업체수"]; D.emp = ee["종사자수"];
  const j = index(raw.bdJ, ["구분"]), rr = index(raw.bdR, ["구분"]);
  D.bd = { J: { birth: j["신생"], death: j["소멸"], active: j["활동"] }, R: { birth: rr["신생"], death: rr["소멸"], active: rr["활동"] } };
  const st = index(raw.start, ["업종"]); D.start = { J: st["정보통신업"], R: st["예술스포츠여가"] };
  const b = index(raw.budget, ["구분"]); D.budget = { total: b["총예산"], culture: b["문화예산"], arts: b["문화예술예산"] };
  const pp = index(raw.pop, ["구분"]); D.pop = pp["전체인구"]; D.old = pp["고령인구비율"]; D.inc = index(raw.inc, [])._;
  D.genreNat = Object.fromEntries(raw.genreNat.map((r) => { const ys = yearsOf(r); return [r["장르"], { years: ys, values: ys.map((y) => num(r[y])) }]; }));
  D.estMix = Object.fromEntries(raw.estMix.map((r) => [r["지역"], Object.fromEntries(GENRES.map((g) => [g.key, num(r[g.key])]))]));
  D.laws = raw.laws; D.nat = raw.nat; D.dept = raw.dept; D.local = index(raw.local, [])._; D.prog26 = raw.prog26; D.fund = raw.fund; D.fin = raw.fin;
}

/* ---------- KPI 레일 ---------- */
function deltaHTML(cur, prev, label = "전년 대비", invert = false) {
  const p = pct(cur, prev);
  if (p == null) return `<span class="delta flat">${label} –</span>`;
  const dir = p > 0.05 ? 1 : p < -0.05 ? -1 : 0; // 화살표 = 방향, 색 = 좋고 나쁨 (소멸처럼 줄면 좋은 지표는 invert)
  const good = invert ? -dir : dir;
  const cls = good > 0 ? "up" : good < 0 ? "down" : "flat";
  const arrow = dir > 0 ? "▲" : dir < 0 ? "▼" : "■";
  return `<span class="delta ${cls}">${arrow} ${label} ${fmtPct(p)}</span>`;
}
function renderKPIs() {
  const R = state.region, y = yr(2017, 2024);
  const rev = D.rev[R], est = D.est[R], emp = D.emp[R];
  const bJ = D.bd.J.birth[R], dR = D.bd.R.death[R], cul = D.budget.culture[R];
  const share = R === "전국" ? null : (at(rev, y) / at(D.rev["전국"], y)) * 100;
  const wonParts = (m) => { const s = fmtWon(m); return s.replace(/(조|억)$/, "<small>$1 원</small>"); };
  const cards0 = [
    { eb: "매출", h: "콘텐츠산업 매출", big: wonParts(at(rev, y)), d: deltaHTML(at(rev, y), at(rev, y - 1)), src: "콘텐츠산업조사 · " + y },
    share != null && { eb: "비중", h: "전국 매출 중 비중", big: share.toFixed(1) + "<small>%</small>", d: `<span class="delta flat">전국 ${fmtWon(at(D.rev["전국"], y))}원 중</span>`, src: "콘텐츠산업조사 · " + y },
    { eb: "사업체", h: "콘텐츠 사업체 수", big: fmtInt(at(est, y)) + "<small>개</small>", d: deltaHTML(at(est, y), at(est, y - 1)), src: "콘텐츠산업조사 · " + y },
    { eb: "고용", h: "콘텐츠 종사자 수", big: fmtInt(at(emp, y)) + "<small>명</small>", d: deltaHTML(at(emp, y), at(emp, y - 1)), src: "콘텐츠산업조사 · " + y },
    { eb: "창업", h: "정보통신업 신생기업", big: fmtInt(at(bJ, y)) + "<small>개</small>", d: deltaHTML(at(bJ, y), at(bJ, y - 1)), src: "기업생멸행정통계 · " + y },
    { eb: "소멸", h: "예술·여가 소멸기업", big: fmtInt(at(dR, y)) + "<small>개</small>", d: deltaHTML(at(dR, y), at(dR, y - 1), "전년 대비", true), src: "기업생멸행정통계 · " + y },
    { eb: "예산", h: "지자체 문화예산", big: wonParts(at(cul, y)), d: deltaHTML(at(cul, y), at(cul, y - 1)), src: "공연예술조사 · " + y },
    GENRES.some((g) => g.key === state.genre) && D.mix[R] && { eb: "업종", h: `${genreName(state.genre)} 매출`, big: wonParts(D.mix[R][state.genre]), d: `<span class="delta flat">${R} 콘텐츠 매출의 ${((D.mix[R][state.genre] / GENRES.reduce((a, g) => a + (D.mix[R][g.key] || 0), 0)) * 100).toFixed(1)}%</span>`, src: "콘텐츠산업조사 · 2024 (장르별은 2024만)" },
  ].filter(Boolean);
  const cards = cards0[cards0.length - 1].eb === "업종" ? [cards0[cards0.length - 1], ...cards0.slice(0, -1)] : cards0;
  document.getElementById("kpiRail").innerHTML = cards.map((c) => `<article class="feature"><span class="eyebrow">${c.eb}</span><h4>${c.h}</h4><div class="big num">${c.big}</div>${c.d}<span class="src">${c.src}</span></article>`).join("");
  document.getElementById("kpiTitle").textContent = `${R} · ${y}년 핵심 지표 (증감은 같은 통계표의 ${y - 1}년 대비)`;
}

/* ---------- 매출 ---------- */
function renderSales() {
  const R = state.region, s = D.rev[R];
  const host = document.getElementById("cSalesTrend");
  document.getElementById("tSalesTrend").textContent = `${R} 매출 추이 (${Math.max(state.from, 2010)}–${Math.min(state.to, 2024)})`;
  lc(host, { years: s.years, series: [{ name: R, color: css("--genre-broadcast"), values: s.values }], fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), breaks: BREAKS_CONTENT, aria: `${R} 콘텐츠산업 매출 추이` });
  table(host, ["연도", "매출(백만원)", "비고"], s.years.map((y, i) => [y, fmtInt(s.values[i]), BREAKS_CONTENT.includes(y) ? "⚠ 개편" : ""]));

  const mixHost = document.getElementById("cGenreMix");
  const keys = GENRES.map((g) => ({ key: g.key, name: g.name, color: css(g.v) }));
  document.getElementById("genreLegend").innerHTML = GENRES.map((g) => `<span class="${g.sib ? "sib" : ""}"><i style="background:${css(g.v)}"></i>${g.name}</span>`).join("");
  const F = GENRES.some((g) => g.key === state.genre) ? state.genre : null;
  const shareOf = (r) => (F ? (D.mix[r][F] || 0) / GENRES.reduce((a, g) => a + (D.mix[r][g.key] || 0), 0) : 0);
  const rows = (F ? ["전국", ...SIDO.slice().sort((a, b) => shareOf(b) - shareOf(a))] : REGIONS).map((r) => ({ label: r, parts: D.mix[r] }));
  stacked100(mixHost, rows, keys, { highlight: R, focus: F, aria: "지역별 장르 매출 구성" });
  table(mixHost, ["지역", ...GENRES.map((g) => g.name)], REGIONS.map((r) => {
    const p = D.mix[r], tot = GENRES.reduce((a, g) => a + (p[g.key] || 0), 0);
    return [r, ...GENRES.map((g) => (p[g.key] == null ? "–" : ((p[g.key] / tot) * 100).toFixed(1) + "%"))];
  }));
}

/* ---------- 지역 ---------- */
const METRIC = {
  rev: { name: "매출", src: () => D.rev, fmt: (v) => fmtWon(v) + "원", unit: "백만원" },
  est: { name: "사업체 수", src: () => D.est, fmt: (v) => fmtInt(v) + "개", unit: "개" },
  emp: { name: "종사자 수", src: () => D.emp, fmt: (v) => fmtInt(v) + "명", unit: "명" },
};
function renderRegion() {
  const M = METRIC[state.metric], src = M.src(), Y = yr(2017, 2024);
  const LIST = state.exSeoul ? SIDO.filter((r) => r !== "서울") : SIDO;
  const rows = LIST.map((r) => ({ label: r, value: at(src[r], Y) })).sort((a, b) => b.value - a.value);
  document.getElementById("tRegRank").textContent = `시도별 ${M.name} (${Y})`;
  const top = rows[0], nat = at(src["전국"], Y);
  document.getElementById("capRegRank").textContent = state.exSeoul ? `서울 제외 16개 시도 · 서울은 전국의 ${((at(src["서울"], Y) / nat) * 100).toFixed(1)}%` : `1위 ${top.label} · 전국의 ${((top.value / nat) * 100).toFixed(1)}%`;
  const rh = document.getElementById("cRegRank");
  barH(rh, rows, { fmt: M.fmt, highlight: state.region, color: css("--genre-broadcast"), aria: `시도별 ${M.name}` });
  table(rh, ["지역", `${Y} ${M.name}(${M.unit})`, "전국 대비"], rows.map((r) => [r.label, fmtInt(r.value), ((r.value / nat) * 100).toFixed(1) + "%"]));

  const drows = LIST.map((r) => ({ label: r, value: pct(at(src[r], Y), at(src[r], Y - 1)) })).sort((a, b) => b.value - a.value);
  document.getElementById("tRegDelta").textContent = `${M.name} 전년 대비 증감률 (${Y - 1}→${Y})`;
  const dh = document.getElementById("cRegDelta");
  barH(dh, drows, { fmt: (v) => fmtPct(v), highlight: state.region, diverging: true, aria: `시도별 ${M.name} 증감률` });
  table(dh, ["지역", String(Y - 1), String(Y), "증감률"], drows.map((r) => [r.label, fmtInt(at(src[r.label], Y - 1)), fmtInt(at(src[r.label], Y)), fmtPct(r.value)]));
}

/* ---------- 창업·소멸 ---------- */
function renderBiz() {
  const R = state.region, I = state.ind, indName = I === "J" ? "정보통신업" : "예술·스포츠·여가업";
  const b = D.bd[I].birth[R], d = D.bd[I].death[R];
  const c1 = css("--genre-broadcast"), c2 = css("--genre-game");
  document.getElementById("tBirthDeath").textContent = `${R} ${indName} 신생·소멸 기업 수`;
  document.getElementById("bdLegend").innerHTML = `<span><i style="background:${c1}"></i>신생</span><span><i style="background:${c2}"></i>소멸</span>`;
  const h = document.getElementById("cBirthDeath");
  lc(h, { years: b.years, series: [{ name: "신생", color: c1, values: b.values }, { name: "소멸", color: c2, values: d.values }], fmt: (v) => fmtInt(v) + "개", aria: "신생·소멸 기업 추이" });
  table(h, ["연도", "신생", "소멸", "순증(신생−소멸)"], b.years.map((y, i) => [y, fmtInt(b.values[i]), fmtInt(d.values[i]), fmtInt(b.values[i] - d.values[i])]));

  const s = D.start[I][R], sh = document.getElementById("cStartup");
  document.getElementById("tStartup").textContent = `${R} ${indName} 창업기업 수`;
  lc(sh, { years: s.years, series: [{ name: "창업기업", color: c1, values: s.values }], fmt: (v) => fmtInt(v) + "개", aria: "창업기업 수 추이" });
  table(sh, ["연도", "창업기업 수"], s.years.map((y, i) => [y, fmtInt(s.values[i])]));
}

/* ---------- 예산 ---------- */
function renderBudget() {
  const R = state.region, Yb = yr(2016, 2024), cu = D.budget.culture[R], ar = D.budget.arts[R];
  const c1 = css("--genre-broadcast"), c2 = css("--genre-game");
  document.getElementById("tBudgetTrend").textContent = `${R} 지자체 문화예산 추이`;
  document.getElementById("budLegend").innerHTML = `<span><i style="background:${c1}"></i>문화예산</span><span><i style="background:${c2}"></i>문화예술예산</span>`;
  const h = document.getElementById("cBudgetTrend");
  lc(h, { years: cu.years, series: [{ name: "문화예산", color: c1, values: cu.values }, { name: "문화예술예산", color: c2, values: ar.values }], fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), breaks: BREAKS_BUDGET, aria: "문화예산 추이" });
  table(h, ["연도", "문화예산(백만원)", "문화예술예산(백만원)"], cu.years.map((y, i) => [y, fmtInt(cu.values[i]), fmtInt(ar.values[i])]));

  const rows = SIDO.map((r) => ({ label: r, value: (at(D.budget.culture[r], Yb) / at(D.budget.total[r], Yb)) * 100 })).sort((a, b) => b.value - a.value);
  const sh = document.getElementById("cBudgetShare");
  document.getElementById("tBudgetShare").textContent = `총예산 대비 문화예산 비중 (${Yb})`;
  barH(sh, rows, { fmt: (v) => v.toFixed(1) + "%", highlight: R, color: css("--genre-broadcast"), aria: "총예산 대비 문화예산 비중" });
  table(sh, ["지역", "총예산(백만원)", "문화예산(백만원)", "비중"], rows.map((r) => [r.label, fmtInt(at(D.budget.total[r.label], Yb)), fmtInt(at(D.budget.culture[r.label], Yb)), r.value.toFixed(1) + "%"]));
}

/* ---------- 정책 ---------- */
function renderPolicy() {
  const R = state.region;
  const c1 = css("--genre-broadcast"), c2 = css("--genre-game");

  // 1) 법령 타임라인
  const laws = LAWS.map((L) => ({ name: L.name, color: css(L.v), events: D.laws.filter((r) => r["법령"] === L.name).map((r) => ({ date: r["시행일"], pub: r["공포일"], kind: r["구분"], no: r["법률번호"], title: r["당시명칭"] })) }));
  const lh = document.getElementById("cLaw");
  lh.querySelector("h3").textContent = `법령 개정 타임라인 (${Math.min(state.from, state.to - 1)}–${state.to})`;
  lawTimeline(lh, laws, { from: Math.min(state.from, state.to - 1), to: state.to });
  table(lh, ["법령", "시행일", "공포일", "법률번호", "구분"], D.laws.filter((r) => r["시행일"] >= "2010").sort((a, b) => b["시행일"].localeCompare(a["시행일"])).map((r) => [r["당시명칭"], r["시행일"], r["공포일"], r["법률번호"], r["구분"]]));

  // 2) 매출 + 정책 이벤트 띠 (자체 개정만: 제정·전부개정·일부개정)
  const s = D.rev[R];
  const rug = LAWS.map((L) => {
    const by = {};
    D.laws.filter((r) => r["법령"] === L.name && !/타법/.test(r["구분"])).forEach((r) => { const y = +r["시행일"].slice(0, 4); (by[y] ||= []).push(`${r["구분"]} · 시행 ${r["시행일"]}`); });
    return { name: L.short, color: css(L.v), events: Object.entries(by).map(([y, items]) => ({ year: +y, items, major: items.some((t) => /제정|전부개정/.test(t)) })) };
  });
  document.getElementById("tPolicyOverlay").textContent = `정책 이벤트와 ${R} 콘텐츠 매출`;
  lc(document.getElementById("cPolicyOverlay"), { years: s.years, series: [{ name: R, color: c1, values: s.values }], fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), breaks: BREAKS_CONTENT, rug, height: 240, aria: "정책 이벤트와 매출" });

  // 3) 국가 결산 분류별 합계 (단위사업 지출액 합산)
  const yrs = [2020, 2021, 2022, 2023, 2024, 2025];
  const sumBy = (cat) => yrs.map((y) => D.nat.filter((r) => +r["연도"] === y && r["분류"] === cat).reduce((a, r) => a + Number(r["지출액"]), 0));
  document.getElementById("natLegend").innerHTML = NAT_CATS.map((c) => `<span><i style="background:${css(c.v)}"></i>${c.key}</span>`).join("");
  const nh = document.getElementById("cNatSpend");
  lc(nh, { years: yrs, series: NAT_CATS.map((c) => ({ name: c.short, color: css(c.v), values: sumBy(c.key) })), fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), aria: "콘텐츠 관련 사업 결산 지출액" });
  table(nh, ["연도", "분류", "회계(기금)", "단위사업", "지출액(백만원)"], D.nat.filter((r) => !/모태/.test(r["분류"])).sort((a, b) => b["연도"] - a["연도"] || a["분류"].localeCompare(b["분류"])).map((r) => [r["연도"], r["분류"], r["회계(기금)"], r["단위사업명"], fmtInt(+r["지출액"])]));

  // 4) 모태조합 출자
  const fund = yrs.map((y) => D.nat.filter((r) => +r["연도"] === y && /모태/.test(r["분류"])).reduce((a, r) => a + Number(r["지출액"]), 0));
  const fh = document.getElementById("cFund");
  barH(fh, yrs.map((y, i) => ({ label: String(y), value: fund[i] })), { fmt: (v) => fmtWon(v) + "원", color: c1, aria: "모태조합 출자" });
  table(fh, ["연도", "회계(기금)", "지출액(백만원)"], D.nat.filter((r) => /모태/.test(r["분류"])).map((r) => [r["연도"], r["회계(기금)"], fmtInt(+r["지출액"])]));

  // 5) 문체부 결산
  const mc = D.dept.filter((r) => r["부처"] === "문화체육관광부" && r["구분"] === "결산").sort((a, b) => a["연도"] - b["연도"]);
  const K_AVAIL = "예산현액(결산)/총계(예산)", K_BUD = "예산액(결산)/총지출(예산)";
  document.getElementById("mcstLegend").innerHTML = `<span><i style="background:${c1}"></i>예산현액</span><span><i style="background:${c2}"></i>지출액</span>`;
  const mh = document.getElementById("cMcst");
  lc(mh, { years: mc.map((r) => +r["연도"]), series: [{ name: "예산현액", color: c1, values: mc.map((r) => +r[K_AVAIL]) }, { name: "지출액", color: c2, values: mc.map((r) => +r["지출액"]) }], fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), aria: "문체부 세출 결산" });
  table(mh, ["연도", "예산액", "예산현액", "지출액", "집행률"], mc.map((r) => [r["연도"], fmtInt(+r[K_BUD]), fmtInt(+r[K_AVAIL]), fmtInt(+r["지출액"]), ((+r["지출액"] / +r[K_AVAIL]) * 100).toFixed(1) + "%"]));
  const m26 = D.dept.find((r) => r["부처"] === "문화체육관광부" && +r["연도"] === 2026);
  document.getElementById("mcst26").textContent = m26 ? fmtWon(+m26[K_BUD]) + "원" : "–";

  // 4-1) 모태펀드 출자 분야 구성 (결성예정액, 억원 → 백만원으로 바꿔 공통 포맷 사용)
  const fyears = [...new Set(D.fund.map((r) => r["연도"]))].sort();
  const fkeys = FUND_GROUPS.map((g) => ({ key: g.key, name: g.key, color: css(g.v) }));
  document.getElementById("fundMixLegend").innerHTML = FUND_GROUPS.map((g) => `<span><i style="background:${css(g.v)}"></i>${g.key}</span>`).join("");
  const fmRows = fyears.map((y) => { const parts = {}; D.fund.filter((r) => r["연도"] === y).forEach((r) => { parts[r["분야그룹"]] = (parts[r["분야그룹"]] || 0) + Number(r["결성예정액(억원)"]) * 100; }); return { label: y, parts }; });
  const fmh = document.getElementById("cFundMix");
  stacked100(fmh, fmRows, fkeys, { aria: "모태펀드 출자 분야 구성" });
  table(fmh, ["연도", "공고", "계정", "출자분야", "분야그룹", "결성예정액(억)", "출자요청액(억)"], D.fund.map((r) => [r["연도"], r["공고"], r["계정"], r["출자분야"], r["분야그룹"], r["결성예정액(억원)"], r["출자요청액(억원)"] || "원문 확인 필요"]));

  // 4-2) 2026 문체부 콘텐츠 세부사업
  const progs = D.prog26.filter((r) => r["소관"] === "문화체육관광부" && (/콘텐츠산업 육성|문화미디어산업육성/.test(r["프로그램"])) && !/운영비|인건비|기본경비/.test(r["세부사업"]));
  const isRegional = (r) => /지역콘텐츠/.test(r["세부사업"]);
  const top = progs.map((r) => ({ label: r["세부사업"].replace(/\(R&D\)|\(정보화\)/g, "").slice(0, 11), full: r["세부사업"], value: Number(r["예산액(백만원)"]), color: isRegional(r) ? css("--genre-game") : null, note: r["회계"] }))
    .sort((a, b) => b.value - a.value).slice(0, 15);
  const ph = document.getElementById("cProg26");
  barH(ph, top, { labelW: 150, fmt: (v) => fmtWon(v) + "원", color: css("--genre-broadcast"), aria: "2026 콘텐츠 세부사업 예산" });
  table(ph, ["세부사업", "회계", "단위사업", "예산(백만원)"], progs.sort((a, b) => b["예산액(백만원)"] - a["예산액(백만원)"]).map((r) => [r["세부사업"], r["회계"], r["단위사업"], fmtInt(+r["예산액(백만원)"])]));
  const reg = D.prog26.filter(isRegional).reduce((a, r) => a + Number(r["예산액(백만원)"]), 0);
  document.getElementById("regionalProg").textContent = fmtWon(reg) + "원";

  // 6) 지자체 세출예산 총계 (선택 지역)
  const ls = D.local[R], lsh = document.getElementById("cLocalSpend");
  document.getElementById("tLocalSpend").textContent = `${R} 지자체 세출예산 총계`;
  lc(lsh, { years: ls.years, series: [{ name: R, color: c1, values: ls.values }], fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), aria: "지자체 세출예산 총계" });
  table(lsh, ["연도", "세출총계(백만원)", "전년 대비"], ls.years.map((y, i) => [y, fmtInt(ls.values[i]), i ? fmtPct(pct(ls.values[i], ls.values[i - 1])) : "–"]));
}

/* ---------- 지방 문화및관광 재원 (지방재정365) ---------- */
function finSum(year, region, field) { // region "전국"이면 전체 합, 금액 단위 백만원
  const rows = D.fin.filter((r) => r["회계연도"] === String(year) && r["분야"] === field && (region === "전국" || r["지역명"] === region));
  const g = {}; FIN_GROUPS.forEach((G) => (g[G.key] = rows.reduce((a, r) => a + G.cols.reduce((b, c) => b + Number(r[c] || 0), 0), 0)));
  g.total = rows.reduce((a, r) => a + Number(r["합계"]), 0);
  return g;
}
function renderFin() {
  const Y = String(yr(2020, 2026)), R = state.region;
  const keys = FIN_GROUPS.map((G) => ({ key: G.key, name: G.key, color: css(G.v) }));
  const leg = FIN_GROUPS.map((G) => `<span><i style="background:${css(G.v)}"></i>${G.key}</span>`).join("");
  document.getElementById("finLegend").innerHTML = leg;
  document.getElementById("finTrendLegend").innerHTML = leg;

  // 1) 시도별 재원 구성 (선택 연도)
  document.getElementById("tFinMix").textContent = `시도별 문화및관광 예산의 재원 구성 (${Y})`;
  const mixRows = REGIONS.map((r) => ({ label: r, parts: finSum(Y, r, "문화및관광") }));
  const mh = document.getElementById("cFinMix");
  stacked100(mh, mixRows, keys, { highlight: R, aria: "시도별 문화및관광 재원 구성" });
  table(mh, ["지역", ...FIN_GROUPS.map((G) => G.key + "(백만원)"), "합계", "국비 비중"], mixRows.map((r) => [r.label, ...FIN_GROUPS.map((G) => fmtInt(r.parts[G.key])), fmtInt(r.parts.total), ((r.parts["국비"] / r.parts.total) * 100).toFixed(1) + "%"]));

  // 2) 선택 지역 재원별 추이
  const yrs = [2020, 2021, 2022, 2023, 2024, 2025, 2026], series = yrs.map((y) => finSum(y, R, "문화및관광"));
  document.getElementById("tFinTrend").textContent = `${R} 문화및관광 예산 재원별 추이`;
  const th = document.getElementById("cFinTrend");
  const main = FIN_GROUPS.filter((G) => G.key !== "기타"); // 선 4개까지 (기타는 표에서)
  lc(th, { years: yrs, series: main.map((G) => ({ name: G.key, color: css(G.v), values: series.map((g) => g[G.key]) })), fmt: (v) => fmtWon(v) + "원", fmtAxis: (v) => fmtWon(v), aria: "재원별 추이" });
  table(th, ["연도", ...FIN_GROUPS.map((G) => G.key), "합계"], yrs.map((y, i) => [y, ...FIN_GROUPS.map((G) => fmtInt(series[i][G.key])), fmtInt(series[i].total)]));

  // 3) 전체 세출 중 문화및관광 비중 (선택 연도)
  document.getElementById("tFinShare").textContent = `전체 세출 중 문화및관광 비중 (${Y})`;
  const shareRows = SIDO.map((r) => { const c = finSum(Y, r, "문화및관광").total, t = finSum(Y, r, "전체").total; return { label: r, value: (c / t) * 100, c, t }; }).sort((a, b) => b.value - a.value);
  const sh = document.getElementById("cFinShare");
  barH(sh, shareRows, { fmt: (v) => v.toFixed(1) + "%", highlight: R, color: css("--genre-broadcast"), aria: "문화및관광 비중" });
  table(sh, ["지역", "문화및관광(백만원)", "전 분야(백만원)", "비중"], shareRows.map((r) => [r.label, fmtInt(r.c), fmtInt(r.t), r.value.toFixed(1) + "%"]));
}

/* ---------- 콘텐츠 업종 인허가 (개업·폐업) ---------- */
function renderLic() {
  const hosts = ["cLic", "cLicStock"].map((id) => document.getElementById(id));
  if (!D.lic) {
    hosts.forEach((h) => { h.querySelector(".plot").innerHTML = `<div class="upload" style="margin:0"><b>데이터 수집 전</b>공공데이터포털 인증키를 프로젝트 폴더의 <code>.datagokr_key</code>에 넣고 <code>python tools/collect_licenses.py</code>를 실행하면 이 카드가 채워집니다.</div>`; h.querySelector(".tableview").innerHTML = ""; });
    document.getElementById("licLegend").innerHTML = "";
    return;
  }
  const R = state.region, G = state.licGroup, yrs = Array.from({ length: 26 }, (_, i) => 2000 + i);
  const rows = D.lic.filter((r) => r["업종그룹"] === G && r["업종"] === "_소계" && r["지역"] === R);
  const by = Object.fromEntries(rows.map((r) => [+r["연도"], r]));
  const val = (y, k) => (by[y] ? Number(by[y][k]) : 0);
  const c1 = css("--genre-broadcast"), c2 = css("--genre-game");
  const label = G === "전체" ? "콘텐츠 업종" : G;
  document.getElementById("tLic").textContent = `${R} ${label} 개업·폐업 (인허가 기준, ${Math.max(state.from, 2000)}–${Math.min(state.to, 2025)})`;
  document.getElementById("licLegend").innerHTML = `<span><i style="background:${c1}"></i>개업</span><span><i style="background:${c2}"></i>폐업</span>`;
  const [h1, h2] = hosts;
  lc(h1, { years: yrs, series: [{ name: "개업", color: c1, values: yrs.map((y) => val(y, "개업(인허가)")) }, { name: "폐업", color: c2, values: yrs.map((y) => val(y, "폐업")) }], fmt: (v) => fmtInt(v) + "개", aria: "콘텐츠 업종 개업·폐업" });
  table(h1, ["연도", "개업", "폐업", "순증"], yrs.map((y) => [y, fmtInt(val(y, "개업(인허가)")), fmtInt(val(y, "폐업")), fmtInt(val(y, "개업(인허가)") - val(y, "폐업"))]));
  document.getElementById("tLicStock").textContent = `${R} ${label} 연말 영업 중 업체 수 (추정)`;
  lc(h2, { years: yrs, series: [{ name: "영업 중", color: c1, values: yrs.map((y) => val(y, "연말영업(추정)")) }], fmt: (v) => fmtInt(v) + "개", aria: "연말 영업 업체 수" });
  table(h2, ["연도", "연말 영업(추정)"], yrs.map((y) => [y, fmtInt(val(y, "연말영업(추정)"))]));
}

/* ---------- 한눈에: 시도 지도 ---------- */
const licSum = (region, group) => { // 기간 안 인허가 개업 합계 (2000–2025)
  if (!D.lic) return null;
  const a = Math.max(state.from, 2000), b = Math.min(state.to, 2025);
  return D.lic.filter((r) => r["업종그룹"] === group && r["업종"] === "_소계" && r["지역"] === region && +r["연도"] >= a && +r["연도"] <= b)
    .reduce((s, r) => s + Number(r["개업(인허가)"]), 0);
};
const MAP_METRICS = [
  { k: "rev", name: "매출", Y: () => yr(2010, 2024), get: (r, Y) => at(D.rev[r], Y), fmt: (v) => fmtWon(v) + "원", legendFmt: (v) => fmtWon(v), src: "콘텐츠산업조사" },
  { k: "revd", name: "매출 증감률", mode: "div", Y: () => yr(2011, 2024), get: (r, Y) => pct(at(D.rev[r], Y), at(D.rev[r], Y - 1)), fmt: (v) => fmtPct(v), src: "콘텐츠산업조사", warn: (Y) => (BREAKS_CONTENT.includes(Y) ? `⚠ ${Y}년 조사 개편 — 전년 대비 변화에 개편 영향이 섞여 있을 수 있습니다.` : "") },
  { k: "genre", name: "선택 업종 매출", need: () => GENRES.some((g) => g.key === state.genre), Y: () => 2024, get: (r) => D.mix[r] && D.mix[r][state.genre], fmt: (v) => fmtWon(v) + "원", legendFmt: (v) => fmtWon(v), src: "콘텐츠산업조사 (장르별은 2024만)", title: () => `${genreName(state.genre)} 매출` },
  { k: "est", name: "사업체", Y: () => yr(2016, 2024), get: (r, Y) => at(D.est[r], Y), fmt: (v) => fmtInt(v) + "개", src: "콘텐츠산업조사" },
  { k: "birth", name: "신생기업", Y: () => yr(2016, 2024), get: (r, Y) => at(D.bd.J.birth[r], Y), fmt: (v) => fmtInt(v) + "개", src: "기업생멸행정통계 (정보통신업)" },
  { k: "lic", name: "인허가 개업", need: () => !!D.lic, Y: () => `${Math.max(state.from, 2000)}–${Math.min(state.to, 2025)}`, get: (r) => licSum(r, state.licGroup), fmt: (v) => fmtInt(v) + "건", src: "지방행정 인허가 (기간 합계)", title: () => `${state.licGroup === "전체" ? "콘텐츠 업종" : state.licGroup} 인허가 개업` },
  { k: "fin", name: "문화관광 예산", Y: () => yr(2020, 2026), get: (r, Y) => finSum(Y, r, "문화및관광").total, fmt: (v) => fmtWon(v) + "원", legendFmt: (v) => fmtWon(v), src: "지방재정365 (당초예산, 총계)" },
  { k: "pop", name: "인구", Y: () => yr(2016, 2025), get: (r, Y) => at(D.pop[r], Y), fmt: (v) => fmtInt(v) + "명", legendFmt: (v) => (v >= 1e6 ? (v / 1e4).toFixed(0) + "만" : fmtInt(v)), src: "주민등록인구(e-지방지표)" },
  { k: "revPc", name: "1인당 매출", Y: () => yr(2016, 2024), get: (r, Y) => (at(D.rev[r], Y) / at(D.pop[r], Y)) * 1e6, fmt: (v) => (v / 1e4).toFixed(0) + "만원", src: "콘텐츠산업조사 ÷ 주민등록인구 (서로 다른 통계표로 계산 — 정의가 상이할 수 있음)" },
  { k: "old", name: "고령인구비율", Y: () => yr(2016, 2025), get: (r, Y) => at(D.old[r], Y), fmt: (v) => v.toFixed(1) + "%", src: "주민등록인구(e-지방지표) 65세 이상 비율" },
  { k: "gov", name: "국비 비중", Y: () => yr(2020, 2026), get: (r, Y) => { const g = finSum(Y, r, "문화및관광"); return (g["국비"] / g.total) * 100; }, fmt: (v) => v.toFixed(1) + "%", src: "지방재정365 (문화및관광 중 국고·지특·기금 보조금)" },
];
function pickRegion(label) {
  state.region = state.region === label ? "전국" : label; // 같은 타일을 다시 누르면 전국으로
  document.getElementById("regionSel").value = state.region;
  renderAll();
}
function renderMap() {
  const seg = document.getElementById("mapMetric");
  let M = MAP_METRICS.find((m) => m.k === state.mapMetric);
  if (M.need && !M.need()) { state.mapMetric = "rev"; M = MAP_METRICS[0]; }
  seg.innerHTML = MAP_METRICS.filter((m) => !m.need || m.need()).map((m) => `<button aria-pressed="${m.k === M.k}" data-k="${m.k}">${m.k === "genre" ? genreName(state.genre) : m.name}</button>`).join("");
  const Y = M.Y(), title = M.title ? M.title() : M.name;
  const items = SIDO.map((r) => ({ label: r, value: M.get(r, Y) }));
  const host = document.getElementById("cMap");
  document.getElementById("tMap").textContent = `시도별 ${title} (${Y})`;
  document.getElementById("capMap").textContent = M.mode === "div" ? "파랑 = 증가, 빨강 = 감소 · 지역을 누르면 선택" : "진할수록 큼 (5단계, 시도 순위 기준) · 지역을 누르면 선택";
  document.getElementById("footMap").innerHTML = `<span>${M.warn ? M.warn(Y) : ""}</span><span>출처: ${M.src} · 경계: 통계청 2013 시도 경계(<a href="#sources">데이터 소스</a>). 작은 광역시는 이름표를 바다 쪽으로 빼서 표시했습니다.</span>`;
  geoMap(host, items, { fmt: M.fmt, legendFmt: M.legendFmt, mode: M.mode, highlight: state.region, onPick: pickRegion, aria: `시도별 ${title} 지도` });
  const sorted = items.filter((d) => d.value != null && isFinite(d.value)).sort((a, b) => b.value - a.value);
  table(host, ["순위", "지역", title], sorted.map((d, i) => [i + 1, d.label, M.fmt(d.value)]));

  // 오른쪽: 선택 지역 요약
  const R = state.region, side = document.getElementById("cMapSide");
  const nat = M.get("전국", Y), mine = R === "전국" ? nat : M.get(R, Y);
  const rank = R === "전국" ? null : sorted.findIndex((d) => d.label === R) + 1;
  const big = mine == null || !isFinite(mine) ? "–" : M.fmt(mine).replace(/(원|개|건|%)$/, "<small>$1</small>");
  const Yr = yr(2016, 2024), Yf = yr(2020, 2026);
  const fin = finSum(Yf, R, "문화및관광");
  const rows = [
    [`콘텐츠 매출 (${yr(2010, 2024)})`, fmtWon(at(D.rev[R], yr(2010, 2024))) + "원"],
    [`사업체 수 (${Yr})`, fmtInt(at(D.est[R], Yr)) + "개"],
    [`종사자 수 (${Yr})`, fmtInt(at(D.emp[R], Yr)) + "명"],
    [`문화관광 예산 (${Yf})`, fmtWon(fin.total) + "원"],
    [`그중 국비 (${Yf})`, ((fin["국비"] / fin.total) * 100).toFixed(1) + "%"],
    D.lic && [`인허가 개업 (${Math.max(state.from, 2000)}–${Math.min(state.to, 2025)})`, fmtInt(licSum(R, state.licGroup)) + "건"],
  ].filter(Boolean);
  side.innerHTML = `
    <span class="eyebrow" style="font-size:var(--fs-xs);font-weight:700;color:var(--text-secondary)">${R === "전국" ? "전국 · 지도에서 지역을 눌러 선택" : "선택한 지역"}</span>
    <h3 style="font-size:var(--fs-h2);margin:4px 0 0">${R}</h3>
    <div class="cap" style="margin-top:var(--sp-3)">${title} (${Y})</div>
    <div class="side-big num">${big}</div>
    <div class="cap">${rank ? `17개 시도 중 ${rank}위` : sorted.length ? `1위 ${sorted[0].label} · ${M.fmt(sorted[0].value)}` : ""}${R !== "전국" && M.k !== "revd" && M.k !== "gov" && nat ? ` · 전국의 ${((mine / nat) * 100).toFixed(1)}%` : ""}</div>
    <ul class="side-list">${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join("")}</ul>
    <a href="#sales" class="btn" style="display:inline-block;margin-top:var(--sp-4);text-decoration:none">이 지역 매출 페이지 열기 →</a>`;
}

/* ---------- 상단 필터 바: 기간 달력 · 지역 · 업종 ---------- */
function renderFilterNote() {
  document.getElementById("periodTxt").textContent = state.from === state.to ? `${state.from}년` : `${state.from} – ${state.to}`;
  const notes = [];
  if (state.to > 2024) notes.push("KOSIS 자료는 2024년까지라 그 이후는 2024년 값으로 봅니다");
  if (state.genre !== "전체" && !LIC_OF_GENRE[state.genre]) notes.push(`${genreName(state.genre)}은 인허가 업종이 없어 인허가 카드는 전체로 봅니다`);
  if (state.genre === "대중문화예술기획") notes.push("대중문화예술기획은 인허가 자료에만 있습니다");
  document.getElementById("fNote").textContent = notes.join(" · ");
}
function initFilters(sel) {
  const btn = document.getElementById("periodBtn"), cal = document.getElementById("cal"), grid = document.getElementById("calGrid"), hint = document.getElementById("calHint");
  let pick = null, mode = "range";
  const setMode = (m) => {
    mode = m; pick = null; cal.classList.toggle("mode-year", m === "year");
    cal.querySelectorAll(".cal-mode button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
    draw();
  };
  cal.querySelector(".cal-mode").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); });
  const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
  const draw = () => {
    grid.innerHTML = years.map((y) => {
      const edge = pick != null ? y === pick : y === state.from || y === state.to;
      const inside = pick == null && y > state.from && y < state.to;
      return `<button type="button" data-y="${y}" class="${edge ? "edge" : inside ? "in" : ""}" aria-pressed="${edge || inside}">${y}</button>`;
    }).join("");
    hint.textContent = mode === "year" ? "볼 연도를 누르세요. 추이 차트는 전체를 보여주고 그 연도를 강조합니다."
      : pick == null ? "시작 연도를 누른 뒤 끝 연도를 누르세요." : `${pick}년부터 — 끝 연도를 누르세요.`;
  };
  const open = (v) => { cal.hidden = !v; btn.setAttribute("aria-expanded", v); if (v) { setMode(state.from === state.to ? "year" : "range"); grid.querySelector("button.edge")?.focus(); } };
  const apply = (a, b) => { state.from = Math.min(a, b); state.to = Math.max(a, b); open(false); btn.focus(); renderAll(); };
  btn.addEventListener("click", () => open(cal.hidden));
  grid.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const y = +b.dataset.y; if (mode === "year") apply(y, y); else if (pick == null) { pick = y; draw(); } else apply(pick, y); });
  cal.querySelector(".cal-pre").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const n = b.dataset.pre; n === "all" ? apply(YEAR_MIN, YEAR_MAX) : apply(PRESET_END - Number(n) + 1, PRESET_END); });
  document.addEventListener("click", (e) => { if (!cal.hidden && !e.target.closest(".fgroup")) open(false); });
  cal.addEventListener("keydown", (e) => { if (e.key === "Escape") { open(false); btn.focus(); } });

  const gs = document.getElementById("genreSel");
  gs.innerHTML = `<option value="전체">전체</option>` + GENRES.map((g) => `<option value="${g.key}">${g.name}</option>`).join("") + `<option value="대중문화예술기획">대중문화예술기획 (인허가)</option>`;
  const syncLic = () => { document.querySelectorAll("#licGroup button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === state.licGroup)); };
  gs.addEventListener("change", () => {
    state.genre = gs.value; state.licGroup = LIC_OF_GENRE[state.genre] || "전체"; syncLic();
    if (GENRES.some((g) => g.key === state.genre)) state.mapMetric = "genre";
    else if (state.mapMetric === "genre") state.mapMetric = "rev";
    renderAll();
  });
  document.getElementById("mapMetric").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.mapMetric = b.dataset.k; renderMap(); });
  document.getElementById("fReset").addEventListener("click", () => {
    Object.assign(state, { from: YEAR_MIN, to: YEAR_MAX, region: "전국", genre: "전체", licGroup: "전체", mapMetric: "rev", exSeoul: false });
    document.getElementById("exSeoul").setAttribute("aria-pressed", false);
    sel.value = "전국"; gs.value = "전체"; syncLic(); renderAll();
  });
}

/* ---------- 페이지 분리: 메인(한눈에) / 상세 5개 페이지 (#sales 등) ---------- */
const PAGES = { sales: "매출", genre: "업종", region: "지역", biz: "창업과 소멸", budget: "예산", demand: "인구와 수요", policy: "정책", cross: "교차분석", report: "보고서", sources: "데이터 소스" };
const currentPage = () => (PAGES[location.hash.slice(1)] ? location.hash.slice(1) : null);
const isShown = (id) => !document.getElementById(id).hidden;
function applyRoute() {
  const page = currentPage();
  document.getElementById("overview").hidden = !!page;
  document.getElementById("pages").hidden = !!page;
  document.querySelector(".page-head").hidden = !!page;
  document.getElementById("fbar").hidden = page === "sources"; // 출처 페이지에는 필터가 적용되지 않음
  Object.keys(PAGES).forEach((id) => (document.getElementById(id).hidden = id !== page));
  document.querySelectorAll(".chapter a").forEach((a) => {
    const id = a.getAttribute("href").slice(1) || null;
    a.toggleAttribute("aria-current", (id === "overview" ? null : id) === page);
    if (a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
  });
  document.title = `${page ? PAGES[page] + " · " : ""}K-Content Market Pulse`;
  requestAnimationFrame(() => window.scrollTo(0, 0)); // 브라우저의 앵커 자동 스크롤을 덮어씀
}
function initRouter() {
  Object.keys(PAGES).forEach((id) => { // 각 상세 페이지 맨 위에 '한눈에로' 링크
    document.getElementById(id).insertAdjacentHTML("afterbegin", `<a class="backlink" href="#">← 한눈에로 돌아가기</a>`);
  });
  window.addEventListener("hashchange", () => { applyRoute(); renderAll(); });
  applyRoute();
}

/* 메인 아래: 상세 페이지 바로가기 카드 (현재 필터 기준 핵심 숫자 1개씩) */
function renderPageLinks() {
  const R = state.region, Y = yr(2016, 2024), Yf = yr(2020, 2026);
  const rankTop = SIDO.map((r) => [r, at(D.rev[r], yr(2010, 2024))]).sort((a, b) => b[1] - a[1])[0];
  const lawN = D.laws.filter((r) => !/타법/.test(r["구분"]) && +r["시행일"].slice(0, 4) >= state.from && +r["시행일"].slice(0, 4) <= state.to).length;
  const items = [
    ["sales", "매출 추이와 장르 구성", `${R} 매출 ${fmtWon(at(D.rev[R], yr(2010, 2024)))}원 (${yr(2010, 2024)})`],
    ["region", "17개 시도 순위와 증감", `매출 1위 ${rankTop[0]} · 서울 제외 보기 지원`],
    ["biz", "신생·소멸, 창업, 콘텐츠 업종 인허가", `${R} 정보통신업 신생 ${fmtInt(at(D.bd.J.birth[R], Y))}개 (${Y})`],
    ["budget", "지자체 문화예산과 국비·시도비", `${R} 문화관광 예산 ${fmtWon(finSum(Yf, R, "문화및관광").total)}원 (${Yf})`],
    ["policy", "법령 개정·정책자금·재정", `기간 내 자체 법령 개정 ${lawN}건`],
    ["genre", "장르 순위·추이·지역 특화도", `전국 매출 1위 장르 ${GENRES.slice().sort((a, b) => (D.mix["전국"][b.key] || 0) - (D.mix["전국"][a.key] || 0))[0].name} (2024)`],
    ["demand", "인구·고령화·소득, 1인당 지표", `${R} 인구 ${fmtInt(at(D.pop[R], yr(2016, 2025)))}명 (${yr(2016, 2025)})`],
    ["cross", "두 지표를 골라 시도별 상관 보기", "산점도 · 상관계수 · 보고서에 추가"],
    ["report", "영역을 골라 인쇄용 보고서 만들기", "인쇄 · PDF 저장"],
    ["sources", "출처·수록 기간·해석 주의", `자료 ${SOURCES.filter((x) => !x.group).length}종 · 참고문헌 형식`],
  ];
  document.getElementById("pageCards").innerHTML = items.map(([id, sub, stat]) => `
    <a class="feature pagecard" href="#${id}">
      <span class="eyebrow">${sub}</span><h4>${PAGES[id]}</h4>
      <div class="pc-stat">${stat}</div><span class="pc-go">페이지 열기 →</span></a>`).join("");
}

/* ---------- 데이터 소스 (참고문헌) ---------- */
let sourcesDone = false;
function renderSources() {
  if (sourcesDone) return; // 필터와 무관한 고정 내용
  sourcesDone = true;
  const kind = (k) => `<span class="kind kind-${k}">${KINDS[k].name}</span>`;
  document.getElementById("srcKinds").innerHTML = Object.keys(KINDS).map((k) => `<span>${kind(k)} ${KINDS[k].desc}</span>`).join("");
  let n = 0, open = false, html = "";
  for (const s of SOURCES) {
    if (s.group) { html += `${open ? "</ol>" : ""}<h3 class="src-group">${s.group}</h3><ol class="refs">`; open = true; continue; }
    n += 1;
    const pub = s.author.startsWith(s.publisher) ? "" : ` ${s.publisher}.`;
    const files = s.files.length ? s.files.map((f) => `<code>${f}</code>`).join(" ") : "– (설명문에만 인용)";
    html += `<li id="${s.id}"><span class="no">[${n}]</span><div>
      <p class="cite">${s.author}. 「${s.title}」 ${s.table}.${pub} ${s.tbl ? `통계표 ${s.tbl}. ` : ""}<a href="${s.url}" target="_blank" rel="noopener">${s.url}</a> (${s.accessed} 접속).</p>
      <dl>
        <dt>자료 성격</dt><dd>${kind(s.kind)}${s.methodKind ? " " + kind(s.methodKind) : ""}</dd>
        <dt>수록 기간 · 단위</dt><dd>${s.period} · ${s.unit}</dd>
        <dt>대시보드 파일</dt><dd>${files}</dd>
        <dt>쓰인 곳</dt><dd>${s.used}</dd>
        ${s.method ? `<dt>가공 방식</dt><dd>${s.method}</dd>` : ""}
        <dt>해석 주의</dt><dd><ul class="notes">${s.notes.map((t) => `<li>${t}</li>`).join("")}</ul></dd>
      </dl></div></li>`;
  }
  document.getElementById("srcList").innerHTML = html + (open ? "</ol>" : "");
}

function renderAll() {
  renderFilterNote();
  if (isShown("overview")) { renderMap(); renderPageLinks(); }
  if (isShown("sales")) { renderKPIs(); renderSales(); }
  if (isShown("region")) renderRegion();
  if (isShown("biz")) { renderBiz(); renderLic(); }
  if (isShown("budget")) { renderBudget(); renderFin(); }
  if (isShown("policy")) renderPolicy();
  if (isShown("genre")) renderGenre();
  if (isShown("demand")) renderDemand();
  if (isShown("cross")) renderCross();
  if (isShown("report")) { renderReportControls(); buildReport(); }
  if (isShown("sources")) renderSources();
}

/* ---------- 업종·인구와 수요·교차분석·보고서 페이지 컨트롤 ---------- */
function initNewPages() {
  const gs = document.getElementById("genreSel");
  document.getElementById("genreSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; gs.value = b.dataset.k; gs.dispatchEvent(new Event("change")); });
  document.getElementById("lqKind").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.lqKind = b.dataset.k; e.currentTarget.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderGenre(); });
  document.getElementById("perCapSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.perCap = b.dataset.k; renderDemand(); });
  const cx = document.getElementById("crossX"), cy = document.getElementById("crossY");
  cx.addEventListener("change", () => { state.crossX = cx.value; renderCross(); });
  cy.addEventListener("change", () => { state.crossY = cy.value; renderCross(); });
  document.getElementById("crossSwap").addEventListener("click", () => { [state.crossX, state.crossY] = [state.crossY, state.crossX]; renderCross(); });
  document.getElementById("crossSuggest").addEventListener("click", (e) => { const b = e.target.closest("button[data-x]"); if (!b) return; state.crossX = b.dataset.x; state.crossY = b.dataset.y; renderCross(); });
  const tog = (id, key) => { const b = document.getElementById(id); b.addEventListener("click", () => { state[key] = !state[key]; b.setAttribute("aria-pressed", state[key]); renderCross(); }); };
  tog("crossExSeoul", "crossExSeoul"); tog("crossLog", "crossLog");
  const add = document.getElementById("crossAdd");
  add.addEventListener("click", () => { addPair(state.crossX, state.crossY); add.textContent = "보고서에 추가함 ✓"; setTimeout(() => (add.textContent = "보고서에 추가"), 1500); });
  initReport();
}

/* ---------- 컨트롤 ---------- */
function bindSeg(id, key) {
  document.getElementById(id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    state[key] = b.dataset.k; key === "metric" ? renderRegion() : renderBiz();
  });
}
async function main() {
  await load();
  initPages({ D, state, at, pct, yr, lc, finSum, GENRES, SIDO, REGIONS, BREAKS_CONTENT, BREAKS_BUDGET, genreName, pickRegion });
  const sel = document.getElementById("regionSel");
  sel.innerHTML = REGIONS.map((r) => `<option>${r}</option>`).join("");
  sel.addEventListener("change", () => { state.region = sel.value; renderAll(); });
  bindSeg("regMetric", "metric"); bindSeg("bizInd", "ind");
  const ex = document.getElementById("exSeoul");
  ex.addEventListener("click", () => { state.exSeoul = !state.exSeoul; ex.setAttribute("aria-pressed", state.exSeoul); renderRegion(); });
  initRouter();
  const lg = document.getElementById("licGroup");
  lg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; lg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b)); state.licGroup = b.dataset.k; renderLic(); });
  initFilters(sel);
  initNewPages();
  document.querySelectorAll(".card .view").forEach((b) => b.addEventListener("click", () => {
    const c = b.closest(".card"); c.classList.toggle("show-table"); b.textContent = c.classList.contains("show-table") ? "차트로 보기" : "표로 보기";
  }));
  document.querySelectorAll("[data-rail]").forEach((b) => b.addEventListener("click", () => document.getElementById("kpiRail").scrollBy({ left: 320 * Number(b.dataset.rail), behavior: "smooth" })));
  const tb = document.getElementById("theme"), root = document.documentElement;
  tb.addEventListener("click", () => { const d = root.dataset.theme === "dark"; root.dataset.theme = d ? "light" : "dark"; tb.textContent = d ? "다크 모드" : "라이트 모드"; renderAll(); });
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderAll, 150); });
  renderAll();
}
// 잠금을 통과한 뒤에 데이터를 불러옴
const start = () => main().catch((e) => { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p style="padding:24px;color:var(--status-critical)">데이터를 불러오지 못했습니다: ${e.message}. 프로젝트 폴더에서 서버를 실행했는지 확인하세요.</p>`); console.error(e); });
initLock().then((open) => (open ? start() : window.addEventListener("dashboard:unlocked", start, { once: true })));
