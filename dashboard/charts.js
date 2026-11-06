// K-Content Market Pulse — 차트 모듈 (의존성 없음, SVG)
// 규칙: 얇은 마크, 2px 선, 4px 라운드 막대 끝, 2px 간격, 흐린 격자, y축 하나, 호버 툴팁

import { KOREA_W, KOREA_H, KOREA_INSET, KOREA_LABEL, KOREA_PATH } from "./korea-map.js";

const NS = "http://www.w3.org/2000/svg";
export const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function fmtWon(million) { // 백만원 → 조/억
  if (million == null || isNaN(million)) return "–";
  const jo = million / 1e6;
  if (Math.abs(jo) >= 1) return jo.toFixed(1) + "조";
  return Math.round(million / 100).toLocaleString("ko-KR") + "억";
}
export const fmtInt = (v) => (v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString("ko-KR"));
export const fmtPct = (v, d = 1) => (v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + v.toFixed(d) + "%");

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function tooltip(host) {
  let t = host.querySelector(".tip");
  if (!t) { t = document.createElement("div"); t.className = "tip"; host.appendChild(t); }
  return {
    show(html, x, y) {
      t.innerHTML = html; t.style.opacity = 1;
      const hw = host.clientWidth, tw = t.offsetWidth;
      t.style.left = Math.min(Math.max(x + 14, 0), hw - tw - 4) + "px";
      t.style.top = Math.max(y - t.offsetHeight - 10, 0) + "px";
    },
    hide() { t.style.opacity = 0; },
  };
}
function roundedBar(x, y, w, h, r, dir = "up") {
  r = Math.max(0, Math.min(r, dir === "up" ? h : w, dir === "up" ? w / 2 : h / 2));
  if (dir === "up") return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  // right-pointing (horizontal)
  return `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
}

/* ---------- 선 차트 ----------
   opts: { years:[], series:[{name, color, values:[]}], fmt, breaks:[연도], height, yLabel } */
export function lineChart(host, opts) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const rug = opts.rug || [], rugH = rug.length ? rug.length * 18 + 12 : 0; // 정책 이벤트 띠 (x축 아래)
  const W = Math.max(box.clientWidth, 320), H = (opts.height || 300) + rugH;
  const m = { l: rug.length ? 96 : 56, r: opts.series.length > 1 ? 92 : 24, t: 16, b: 32 + rugH };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img", "aria-label": opts.aria || "" }, box);
  const all = opts.series.flatMap((s) => s.values).filter((v) => v != null);
  const max = niceMax(Math.max(...all) * 1.05), yrs = opts.years;
  const x = (i) => m.l + (yrs.length === 1 ? iw / 2 : (i / (yrs.length - 1)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;
  const ink = css("--text-muted"), grid = css("--chart-grid"), axis = css("--chart-axis");
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: k ? grid : axis, "stroke-width": 1 }, svg);
    const t = svgEl("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end", "font-size": 11, fill: ink, class: "num" }, svg);
    t.textContent = opts.fmtAxis ? opts.fmtAxis(v) : opts.fmt(v);
  }
  const step = Math.ceil(yrs.length / Math.max(2, Math.floor(iw / 64)));
  yrs.forEach((yr, i) => {
    const mi = opts.markYear != null ? yrs.indexOf(opts.markYear) : -1; // 강조 연도 근처 라벨은 겹치므로 생략
    const last = yrs.length - 1;
    if ((i % step && i !== last) || (mi >= 0 && Math.abs(x(i) - x(mi)) < 34) || (i !== last && Math.abs(x(i) - x(last)) < 34)) return;
    const t = svgEl("text", { x: x(i), y: m.t + ih + 20, "text-anchor": "middle", "font-size": 11, fill: ink, class: "num" }, svg);
    t.textContent = yr;
  });
  const rugTip = rug.length ? tooltip(host) : null;
  rug.forEach((row, k) => {
    const ry = m.t + ih + 40 + k * 18;
    svgEl("line", { x1: m.l, x2: W - m.r, y1: ry, y2: ry, stroke: grid, "stroke-width": 1 }, svg);
    const lt = svgEl("text", { x: m.l - 8, y: ry + 4, "text-anchor": "end", "font-size": 11, fill: css("--text-secondary") }, svg);
    lt.textContent = row.name;
    row.events.forEach((ev) => {
      const i = yrs.indexOf(ev.year); if (i < 0) return;
      const shape = ev.major
        ? svgEl("path", { d: `M${x(i)},${ry - 6} L${x(i) + 6},${ry} L${x(i)},${ry + 6} L${x(i) - 6},${ry} Z`, fill: row.color, stroke: css("--ui-surface"), "stroke-width": 1.5 }, svg)
        : svgEl("circle", { cx: x(i), cy: ry, r: 4.5, fill: row.color, stroke: css("--ui-surface"), "stroke-width": 1.5 }, svg);
      const hit = svgEl("circle", { cx: x(i), cy: ry, r: 9, fill: "transparent" }, svg);
      hit.addEventListener("mousemove", (e) => { const hr = host.getBoundingClientRect(); rugTip.show(`<strong>${row.name} · ${ev.year}</strong>${ev.items.map((s) => `<div>${s}</div>`).join("")}`, e.clientX - hr.left, e.clientY - hr.top); });
      hit.addEventListener("mouseleave", () => rugTip.hide());
    });
  });
  // 특정 연도 강조 띠 (선보다 먼저 그려 선이 위에 오게)
  if (opts.markYear != null) {
    const i = yrs.indexOf(opts.markYear);
    if (i >= 0) {
      const bw = Math.max(18, yrs.length > 1 ? (iw / (yrs.length - 1)) * 0.7 : 40);
      svgEl("rect", { x: x(i) - bw / 2, y: m.t, width: bw, height: ih, rx: 6, fill: css("--brand-primary-soft") }, svg);
      const t = svgEl("text", { x: x(i), y: m.t + ih + 20, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: css("--brand-primary-ink"), class: "num" }, svg);
      t.textContent = opts.markYear;
    }
  }
  if (opts.markNote) { const t = svgEl("text", { x: W - m.r, y: m.t + ih - 8, "text-anchor": "end", "font-size": 11, fill: css("--text-muted") }, svg); t.textContent = opts.markNote; }
  // 개편 시점: 점선 세로선
  (opts.breaks || []).forEach((b) => {
    const i = yrs.indexOf(b); if (i < 1) return;
    const bx = (x(i) + x(i - 1)) / 2;
    svgEl("line", { x1: bx, x2: bx, y1: m.t, y2: m.t + ih, stroke: css("--status-warning"), "stroke-width": 1.5, "stroke-dasharray": "3 3" }, svg);
    const bi = (opts.breaks || []).indexOf(b), narrow = iw < 520; // 좁은 화면: 연도만, 위아래 번갈아 배치
    const t = svgEl("text", { x: bx + 4, y: m.t + 10 + (narrow && bi % 2 ? 12 : 0), "font-size": 10, fill: ink }, svg); t.textContent = narrow ? "⚠" + b : "⚠ " + b + " 개편";
  });
  // 선: 개편 경계 구간은 점선으로
  opts.series.forEach((s) => {
    for (let i = 1; i < yrs.length; i++) {
      const a = s.values[i - 1], b = s.values[i]; if (a == null || b == null) continue;
      const brk = (opts.breaks || []).includes(yrs[i]);
      svgEl("line", { x1: x(i - 1), y1: y(a), x2: x(i), y2: y(b), stroke: s.color, "stroke-width": 2, "stroke-linecap": "round", "stroke-dasharray": brk ? "2 4" : "none" }, svg);
    }
    s.values.forEach((v, i) => {
      if (v == null) return;
      const hit = yrs[i] === opts.markYear;
      svgEl("circle", { cx: x(i), cy: y(v), r: hit ? 5.5 : 3, fill: s.color, stroke: css("--ui-surface"), "stroke-width": hit ? 2 : 1.5 }, svg);
      if (hit && opts.series.length === 1) { const t = svgEl("text", { x: x(i), y: y(v) - 10, "text-anchor": i === 0 ? "start" : i === yrs.length - 1 ? "end" : "middle", "font-size": 12, "font-weight": 700, fill: css("--text-primary"), class: "num" }, svg); t.textContent = opts.fmt(v); }
    });
  });
  if (opts.series.length > 1) { // 직접 라벨 (<=4 계열) — 겹치지 않게 최소 14px 간격으로 밀어냄
    const labs = opts.series.map((s) => { let li = s.values.length - 1; while (li > 0 && s.values[li] == null) li--; return { s, x: x(li) + 8, y: y(s.values[li]) + 4 }; }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 16) labs[i].y = labs[i - 1].y + 16;
    const over = labs.length ? labs[labs.length - 1].y - (m.t + ih + 4) : 0;
    if (over > 0) labs.forEach((l) => (l.y -= over));
    labs.forEach((l) => { const t = svgEl("text", { x: l.x, y: l.y, "font-size": 12, fill: css("--text-secondary") }, svg); t.textContent = l.s.name; });
  }
  // 크로스헤어 + 툴팁
  const cross = svgEl("line", { y1: m.t, y2: m.t + ih, stroke: axis, "stroke-width": 1, opacity: 0 }, svg);
  const tip = tooltip(host);
  const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
  hit.addEventListener("mousemove", (e) => {
    const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(yrs.length - 1, Math.round(((px - m.l) / iw) * (yrs.length - 1))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
    const rows = opts.series.map((s) => `<div><i style="background:${s.color}"></i>${s.name} <b>${opts.fmt(s.values[i])}</b></div>`).join("");
    const brk = (opts.breaks || []).includes(yrs[i]) ? `<div class="tip-warn">⚠ 이 해에 조사 개편</div>` : "";
    const hr = host.getBoundingClientRect();
    tip.show(`<strong>${yrs[i]}</strong>${rows}${brk}`, e.clientX - hr.left, e.clientY - hr.top);
  });
  hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); tip.hide(); });
}

/* ---------- 가로 막대 (정렬된 지역 비교) ----------
   rows:[{label, value}], opts:{fmt, highlight, color, diverging:boolean} */
export function barH(host, rows, opts) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const rowH = 26, W = Math.max(box.clientWidth, 300), m = { l: Math.min(opts.labelW || 52, Math.max(box.clientWidth, 300) * 0.38), r: 72, t: 4, b: 8 };
  const H = m.t + m.b + rows.length * rowH, iw = W - m.l - m.r;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img", "aria-label": opts.aria || "" }, box);
  const vals = rows.map((r) => r.value).filter((v) => v != null);
  const div = opts.diverging, maxAbs = Math.max(...vals.map(Math.abs)) || 1;
  const max = div ? maxAbs : niceMax(Math.max(...vals));
  const zero = div ? m.l + iw / 2 : m.l;
  const scale = (v) => (div ? (v / max) * (iw / 2) : (v / max) * iw);
  if (div) svgEl("line", { x1: zero, x2: zero, y1: m.t, y2: H - m.b, stroke: css("--chart-axis") }, svg);
  const tip = tooltip(host);
  rows.forEach((r, i) => {
    const yy = m.t + i * rowH, bh = rowH - 10, hl = opts.highlight && r.label === opts.highlight;
    const lab = svgEl("text", { x: m.l - 8, y: yy + bh / 2 + 9, "text-anchor": "end", "font-size": 12, fill: hl ? css("--text-primary") : css("--text-secondary"), "font-weight": hl ? 700 : 400 }, svg);
    lab.textContent = r.label;
    if (r.value == null) return;
    const w = Math.abs(scale(r.value));
    let fill = r.color || opts.color || css("--genre-broadcast");
    if (div) fill = r.value >= 0 ? css("--div-pos-2") : css("--div-neg-2");
    const xx = div && r.value < 0 ? zero - w : zero;
    const p = svgEl("path", { d: roundedBar(xx, yy + 5, Math.max(w, 1), bh, 4, "right"), fill, opacity: opts.highlight && !hl ? 0.45 : 1 }, svg);
    if (div && r.value < 0) p.setAttribute("transform", `translate(${2 * xx + w},0) scale(-1,1)`);
    const vt = svgEl("text", { x: div ? (r.value >= 0 ? zero + w + 6 : zero + 6) : zero + w + 6, y: yy + bh / 2 + 9, "text-anchor": "start", "font-size": 11, fill: css("--text-secondary"), class: "num" }, svg);
    vt.textContent = opts.fmt(r.value);
    const hit = svgEl("rect", { x: 0, y: yy, width: W, height: rowH, fill: "transparent" }, svg);
    hit.addEventListener("mousemove", (e) => { const hr = host.getBoundingClientRect(); tip.show(`<strong>${r.label}</strong><div>${opts.fmt(r.value)}${r.note ? " · " + r.note : ""}</div>`, e.clientX - hr.left, e.clientY - hr.top); });
    hit.addEventListener("mouseleave", () => tip.hide());
  });
}

/* ---------- 100% 누적 가로 막대 (지역별 장르 구성) ----------
   rows:[{label, parts:{key:value}}], keys:[{key,name,color}] */
export function stacked100(host, rows, keys, opts = {}) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const rowH = 26, W = Math.max(box.clientWidth, 300), m = { l: 52, r: 8, t: 4, b: 8 };
  const H = m.t + m.b + rows.length * rowH, iw = W - m.l - m.r;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img", "aria-label": opts.aria || "" }, box);
  const tip = tooltip(host), surf = css("--ui-surface");
  rows.forEach((r, i) => {
    const yy = m.t + i * rowH + 5, bh = rowH - 10;
    const hl = opts.highlight && r.label === opts.highlight;
    const lab = svgEl("text", { x: m.l - 8, y: yy + bh / 2 + 4, "text-anchor": "end", "font-size": 12, fill: hl ? css("--text-primary") : css("--text-secondary"), "font-weight": hl ? 700 : 400 }, svg);
    lab.textContent = r.label;
    const total = keys.reduce((a, k) => a + (r.parts[k.key] || 0), 0);
    let cx = m.l;
    keys.forEach((k) => {
      const v = r.parts[k.key] || 0; if (!v) return;
      const w = (v / total) * iw;
      const dim = opts.focus && opts.focus !== k.key; // 업종 필터: 선택 업종만 진하게
      const seg = svgEl("rect", { x: cx, y: yy, width: Math.max(w - 2, 0.5), height: bh, fill: k.color, rx: 0, opacity: dim ? 0.22 : 1 }, svg); // 2px 간격
      seg.addEventListener("mousemove", (e) => { const hr = host.getBoundingClientRect(); tip.show(`<strong>${r.label} · ${k.name}</strong><div>${(v / total * 100).toFixed(1)}% · ${fmtWon(v)}원</div>`, e.clientX - hr.left, e.clientY - hr.top); seg.setAttribute("stroke", surf); seg.setAttribute("stroke-width", 2); });
      seg.addEventListener("mouseleave", () => { tip.hide(); seg.removeAttribute("stroke"); });
      if (w > 34 && !dim) { // 큰 조각에만 직접 라벨
        const dark = ["--genre-publish"].some((n) => css(n) === k.color);
        const t = svgEl("text", { x: cx + 5, y: yy + bh / 2 + 4, "font-size": 10, fill: dark ? "#121314" : "#fff", "pointer-events": "none", class: "num" }, svg);
        t.textContent = Math.round((v / total) * 100) + "%";
      }
      cx += w;
    });
  });
}

/* ---------- 산점도 (교차분석: 17개 시도) ----------
   pts:[{label, x, y}], opts:{xName, yName, fmtX, fmtY, highlight, log, trend, onPick, height} */
function niceTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || 10 * p;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}
export function scatter(host, pts, opts) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const W = Math.max(box.clientWidth, 320), H = opts.height || 380, m = { l: 70, r: 24, t: 16, b: 48 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img", "aria-label": opts.aria || "" }, box);
  const P = pts.filter((p) => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y) && (!opts.log || (p.x > 0 && p.y > 0)));
  if (!P.length) return;
  const t = opts.log ? Math.log10 : (v) => v;
  const dom = (vals) => { let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || Math.abs(hi) || 1) * 0.08; return [lo - pad, hi + pad]; };
  const [x0, x1] = dom(P.map((p) => t(p.x))), [y0, y1] = dom(P.map((p) => t(p.y)));
  const sx = (v) => m.l + ((t(v) - x0) / (x1 - x0)) * iw, sy = (v) => m.t + ih - ((t(v) - y0) / (y1 - y0)) * ih;
  const ink = css("--text-muted"), grid = css("--chart-grid");
  const ticks = (a, b) => (opts.log
    ? [...Array(Math.ceil(b) - Math.floor(a) + 1)].flatMap((_, i) => [1, 2, 5].map((k) => k * Math.pow(10, Math.floor(a) + i))).filter((v) => Math.log10(v) >= a && Math.log10(v) <= b)
    : niceTicks(a, b));
  ticks(y0, y1).forEach((v) => {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), stroke: grid }, svg);
    const tt = svgEl("text", { x: m.l - 8, y: sy(v) + 4, "text-anchor": "end", "font-size": 11, fill: ink, class: "num" }, svg); tt.textContent = (opts.fmtYAxis || opts.fmtY)(v);
  });
  const xt = ticks(x0, x1), every = Math.ceil(xt.length / Math.max(2, Math.floor(iw / 80)));
  xt.forEach((v, i) => {
    svgEl("line", { x1: sx(v), x2: sx(v), y1: m.t, y2: m.t + ih, stroke: grid }, svg);
    if (i % every) return;
    const tt = svgEl("text", { x: sx(v), y: m.t + ih + 18, "text-anchor": "middle", "font-size": 11, fill: ink, class: "num" }, svg); tt.textContent = (opts.fmtXAxis || opts.fmtX)(v);
  });
  const xl = svgEl("text", { x: m.l + iw / 2, y: H - 6, "text-anchor": "middle", "font-size": 12, fill: css("--text-secondary") }, svg); xl.textContent = opts.xName + (opts.log ? " (로그)" : "");
  const yl = svgEl("text", { x: 14, y: m.t + ih / 2, "text-anchor": "middle", "font-size": 12, fill: css("--text-secondary"), transform: `rotate(-90 14 ${m.t + ih / 2})` }, svg); yl.textContent = opts.yName + (opts.log ? " (로그)" : "");
  if (opts.trend !== false && P.length > 2) { // 최소제곱 추세선 (변환한 값 기준)
    const xs = P.map((p) => t(p.x)), ys = P.map((p) => t(p.y)), n = xs.length;
    const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1), a = my - b * mx;
    const yAt = (xx) => m.t + ih - ((a + b * xx - y0) / (y1 - y0)) * ih, clampY = (v) => Math.max(m.t, Math.min(m.t + ih, v));
    svgEl("line", { x1: m.l, y1: clampY(yAt(x0)), x2: m.l + iw, y2: clampY(yAt(x1)), stroke: css("--chart-axis"), "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svg);
  }
  const tip = tooltip(host), color = css("--genre-broadcast");
  P.forEach((p) => {
    const hl = opts.highlight === p.label, cx = sx(p.x), cy = sy(p.y);
    const c = svgEl("circle", { cx, cy, r: hl ? 7 : 5, fill: hl ? css("--genre-game") : color, stroke: css("--ui-surface"), "stroke-width": 1.5, style: opts.onPick ? "cursor:pointer" : "" }, svg);
    const right = cx < m.l + iw - 40;
    const lt = svgEl("text", { x: cx + (right ? 8 : -8), y: cy - 6, "text-anchor": right ? "start" : "end", "font-size": hl ? 12 : 11, "font-weight": hl ? 700 : 400, fill: hl ? css("--text-primary") : css("--text-secondary"), "pointer-events": "none" }, svg); lt.textContent = p.label;
    c.addEventListener("mousemove", (e) => { const hr = host.getBoundingClientRect(); tip.show(`<strong>${p.label}</strong><div>${opts.xName} <b>${opts.fmtX(p.x)}</b></div><div>${opts.yName} <b>${opts.fmtY(p.y)}</b></div>`, e.clientX - hr.left, e.clientY - hr.top); });
    c.addEventListener("mouseleave", () => tip.hide());
    if (opts.onPick) c.addEventListener("click", () => opts.onPick(p.label));
  });
}

/* ---------- 표 보기 (모든 차트 공통 대체 수단) ---------- */
export function table(host, head, rows) {
  const box = host.querySelector(".tableview");
  box.innerHTML = `<table class="dt"><thead><tr>${head.map((h, i) => `<th class="${i ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/* ---------- 법령 개정 타임라인 (스윔레인) ----------
   laws:[{name, color, events:[{date:"YYYY-MM-DD", kind, no, title}]}], opts:{from, to}
   모양으로 구분: ◆ 제정·전부개정, ● 일부개정, ○ 타법개정(다른 법 개정에 따른 자동 반영) */
export function lawTimeline(host, laws, opts) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const laneH = 44, W = Math.max(box.clientWidth, 320), m = { l: 132, r: 16, t: 8, b: 28 };
  const H = m.t + m.b + laws.length * laneH, iw = W - m.l - m.r;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, role: "img", "aria-label": "법령 개정 타임라인" }, box);
  const t0 = Date.UTC(opts.from, 0, 1), t1 = Date.UTC(opts.to, 11, 31);
  const x = (d) => m.l + ((Date.parse(d) - t0) / (t1 - t0)) * iw;
  const ink = css("--text-muted"), grid = css("--chart-grid"), surf = css("--ui-surface");
  const step = iw < 500 ? 4 : 2;
  for (let y = opts.from; y <= opts.to; y++) {
    const xx = x(`${y}-01-01`);
    if ((y - opts.from) % step === 0) {
      svgEl("line", { x1: xx, x2: xx, y1: m.t, y2: H - m.b, stroke: grid }, svg);
      const t = svgEl("text", { x: xx, y: H - 8, "text-anchor": "middle", "font-size": 11, fill: ink, class: "num" }, svg); t.textContent = y;
    }
  }
  const tip = tooltip(host);
  laws.forEach((law, k) => {
    const cy = m.t + k * laneH + laneH / 2;
    svgEl("line", { x1: m.l, x2: W - m.r, y1: cy, y2: cy, stroke: css("--chart-axis") }, svg);
    const lt = svgEl("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", "font-size": 12, fill: css("--text-primary"), "font-weight": 500 }, svg); lt.textContent = law.name;
    law.events.filter((e) => e.date >= `${opts.from}-01-01` && e.date <= `${opts.to}-12-31`).forEach((e) => {
      const xx = x(e.date), major = /제정|전부개정/.test(e.kind), own = /일부개정/.test(e.kind);
      let mark;
      if (major) mark = svgEl("path", { d: `M${xx},${cy - 8} L${xx + 8},${cy} L${xx},${cy + 8} L${xx - 8},${cy} Z`, fill: law.color, stroke: surf, "stroke-width": 1.5 }, svg);
      else if (own) mark = svgEl("circle", { cx: xx, cy, r: 5.5, fill: law.color, stroke: surf, "stroke-width": 1.5 }, svg);
      else mark = svgEl("circle", { cx: xx, cy, r: 3.5, fill: surf, stroke: law.color, "stroke-width": 1.5 }, svg);
      const hit = svgEl("circle", { cx: xx, cy, r: 10, fill: "transparent" }, svg);
      hit.addEventListener("mousemove", (ev) => { const hr = host.getBoundingClientRect(); tip.show(`<strong>${e.title}</strong><div>${e.kind} · 법률 ${e.no}</div><div>시행 ${e.date} · 공포 ${e.pub}</div>`, ev.clientX - hr.left, ev.clientY - hr.top); });
      hit.addEventListener("mouseleave", () => tip.hide());
    });
  });
}

/* ---------- 시도 지도 (17개 시도, 실제 경계) ----------
   items:[{label, value}], opts:{fmt, mode:'seq'|'div', highlight, onPick(label), note(label)}
   작은 광역시(서울·인천·세종·대전·광주·대구·울산·부산)는 이름표를 바깥으로 빼고 지시선으로 잇는다. */
// 이름표 위치: 지역 중심에서 얼마나 옮길지 (지도 좌표, 520×646 기준). 없으면 중심에 표시
const CALLOUT = {
  인천: [-78, 6], 서울: [-62, -58], 세종: [-112, -6], 대전: [-74, 58],
  광주: [-96, 4], 대구: [84, -52], 울산: [62, 2], 부산: [58, 44],
};
const NUDGE = { 경기: [22, -38], 충남: [-12, 30], 경북: [10, -6], 전남: [14, 14], 충북: [6, -8], 경남: [-14, 8] }; // 큰 지역 이름표를 광역시와 안 겹치게 살짝 옮김
export function geoMap(host, items, opts) {
  const box = host.querySelector(".plot"); box.innerHTML = "";
  const narrow = box.clientWidth > 0 && box.clientWidth < 480; // 좁은 화면은 글자를 키움
  const W = KOREA_W, H = KOREA_H, fs = narrow ? 25 : 13, fv = narrow ? 0 : 11.5; // 좁은 화면은 이름만 (값은 툴팁·표·오른쪽 요약)
  const padL = narrow ? 44 : 24, padR = narrow ? 70 : 60; // 바깥으로 뺀 이름표가 잘리지 않게 여백
  const svg = svgEl("svg", { viewBox: `${-padL} 0 ${W + padL + padR} ${H}`, width: "100%", role: "group", "aria-label": opts.aria || "시도별 지도" }, box);
  svg.style.maxHeight = "680px"; svg.style.display = "block"; svg.style.margin = "0 auto";
  const vals = items.map((d) => d.value).filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  // 색 구간: 순차는 5분위, 발산은 고정 경계(±2, ±10)
  let bins, colors;
  if (opts.mode === "div") {
    bins = [-10, -2, 2, 10];
    colors = ["--div-neg-3", "--div-neg-1", "--div-mid", "--div-pos-1", "--div-pos-3"].map(css);
  } else {
    bins = [0.2, 0.4, 0.6, 0.8].map((q) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]);
    colors = ["--seq-150", "--seq-300", "--seq-450", "--seq-550", "--seq-650"].map(css);
  }
  const binOf = (v) => { let i = 0; while (i < bins.length && v >= bins[i]) i++; return i; };
  const darkText = opts.mode === "div" ? [false, true, true, true, false] : [true, true, false, false, false];
  const surf = css("--ui-surface"), ink0 = css("--text-primary"), muted = css("--text-muted");
  const tip = tooltip(host);
  const [ix, iy, iw, ih] = KOREA_INSET; // 울릉도·독도 인셋
  svgEl("rect", { x: ix, y: iy, width: iw, height: ih, rx: 4, fill: "none", stroke: css("--chart-axis"), "stroke-dasharray": "3 3" }, svg);
  // 테두리 강조는 도형 위의 별도 층에 그림 — 도형을 맨 위로 옮기면(DOM 이동) 브라우저가 클릭을 취소함
  const shapes = svgEl("g", {}, svg), edges = svgEl("g", { "pointer-events": "none" }, svg), labels = svgEl("g", { "pointer-events": "none" }, svg);
  const hovEdge = svgEl("path", { fill: "none", stroke: ink0, "stroke-width": 1.5, "stroke-linejoin": "round", opacity: 0 }, edges);
  const selEdge = svgEl("path", { fill: "none", stroke: ink0, "stroke-width": 2.5, "stroke-linejoin": "round", opacity: 0 }, edges);
  const pick = (label) => opts.onPick && opts.onPick(label);
  const textW = (t, est) => { try { return t.getComputedTextLength() || est; } catch { return est; } };
  items.forEach((d) => {
    const path = KOREA_PATH[d.label]; if (!path) return;
    const has = d.value != null && isFinite(d.value), bi = has ? binOf(d.value) : -1, sel = opts.highlight === d.label;
    const g = svgEl("g", { tabindex: 0, role: "button", "aria-label": `${d.label} ${has ? opts.fmt(d.value) : "자료 없음"}`, style: "cursor:pointer" }, shapes);
    svgEl("path", { d: path, fill: has ? colors[bi] : css("--ui-surface-2"), stroke: surf, "stroke-width": 1, "stroke-linejoin": "round" }, g);
    if (sel) { selEdge.setAttribute("d", path); selEdge.setAttribute("opacity", 1); }
    const show = (e) => { const hr = host.getBoundingClientRect(); tip.show(`<strong>${d.label}</strong><div>${has ? opts.fmt(d.value) : "자료 없음"}</div>${opts.note ? `<div>${opts.note(d.label)}</div>` : ""}<div style="opacity:.7">눌러서 이 지역 선택</div>`, e.clientX - hr.left, e.clientY - hr.top); };
    const hover = (on) => { hovEdge.setAttribute("d", path); hovEdge.setAttribute("opacity", on && !sel ? 1 : 0); };
    g.addEventListener("mousemove", show);
    g.addEventListener("mouseenter", () => hover(true));
    g.addEventListener("mouseleave", () => { tip.hide(); hover(false); });
    g.addEventListener("focus", () => hover(true));
    g.addEventListener("blur", () => hover(false));
    g.addEventListener("click", () => pick(d.label));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(d.label); } });

    // 이름표
    const [cx, cy] = KOREA_LABEL[d.label], off = CALLOUT[d.label], nud = NUDGE[d.label] || [0, 0];
    const vtxt = has ? opts.fmt(d.value) : "–";
    if (off) {
      const lx = cx + off[0], ly = cy + off[1], right = off[0] > 0, padL = 14, padR = 10;
      const th = fs + (fv ? fv + 12 : 10), by = ly - th / 2;
      const line = svgEl("line", { x1: cx, y1: cy, y2: ly, stroke: muted, "stroke-width": 1 }, labels);
      svgEl("circle", { cx, cy, r: 2.5, fill: ink0 }, labels);
      const box = svgEl("rect", { y: by, height: th, rx: 6, fill: surf, stroke: sel ? ink0 : css("--ui-border"), "stroke-width": sel ? 2 : 1, opacity: 0.96 }, labels);
      const sw = svgEl("rect", { y: by + 5, width: 4, height: th - 10, rx: 2, fill: has ? colors[bi] : css("--ui-surface-2") }, labels);
      const t1 = svgEl("text", { y: by + fs + 2, "font-size": fs, "font-weight": 700, fill: ink0 }, labels); t1.textContent = d.label;
      let t2 = null;
      if (fv) { t2 = svgEl("text", { y: by + fs + fv + 5, "font-size": fv, fill: css("--text-secondary"), class: "num" }, labels); t2.textContent = vtxt; }
      // 칸 너비 = 실제로 그려진 글자 폭에 맞춤 (못 재면 글자 수로 어림)
      const tw = Math.max(textW(t1, d.label.length * fs), t2 ? textW(t2, vtxt.length * fv * 0.62) : 0) + padL + padR;
      const bx = right ? lx : lx - tw;
      line.setAttribute("x2", right ? bx : bx + tw);
      box.setAttribute("x", bx); box.setAttribute("width", tw);
      sw.setAttribute("x", bx + 5);
      t1.setAttribute("x", bx + padL); if (t2) t2.setAttribute("x", bx + padL);
      // 이름표도 눌러서 고를 수 있게
      const hit = svgEl("rect", { x: bx, y: by, width: tw, height: th, fill: "transparent", style: "cursor:pointer", "pointer-events": "all" }, labels);
      hit.addEventListener("click", () => pick(d.label));
      hit.addEventListener("mousemove", show);
      hit.addEventListener("mouseenter", () => hover(true));
      hit.addEventListener("mouseleave", () => { tip.hide(); hover(false); });
    } else {
      const lx = cx + nud[0], ly = cy + nud[1];
      const ink = has && !darkText[bi] ? "#ffffff" : ink0;
      const t1 = svgEl("text", { x: lx, y: fv ? ly - 2 : ly + fs / 3, "text-anchor": "middle", "font-size": fs, "font-weight": 700, fill: has ? ink : muted }, labels); t1.textContent = d.label;
      if (fv) { const t2 = svgEl("text", { x: lx, y: ly + fv + 1, "text-anchor": "middle", "font-size": fv, fill: has ? ink : muted, class: "num" }, labels); t2.textContent = vtxt; }
    }
  });
  // 범례
  const leg = host.querySelector(".map-legend");
  if (leg) {
    const fmtB = opts.legendFmt || opts.fmt;
    const labels = opts.mode === "div" ? ["−10% 미만", "−10~−2%", "−2~2%", "2~10%", "10% 이상"]
      : colors.map((_, i) => (i === 0 ? `${fmtB(bins[0])} 미만` : i === colors.length - 1 ? `${fmtB(bins[i - 1])} 이상` : `${fmtB(bins[i - 1])}~`));
    leg.innerHTML = colors.map((c, i) => `<span><i style="background:${c}"></i>${labels[i]}</span>`).join("") + `<span><i style="background:${css("--ui-surface-2")}"></i>자료 없음</span>`;
  }
}
