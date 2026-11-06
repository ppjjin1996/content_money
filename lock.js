// 접속 암호 화면 (브라우저 안에서만 동작하는 간단한 잠금)
// - 암호 두 갈래: 일반 사용자(초기 0000) / 관리자(초기 admin0000). 둘 다 SHA-256 해시로 비교, 평문은 저장하지 않음
// - 해시는 auth.json 에 있음 → 이 파일을 바꿔 배포하면 모든 사람에게 적용
// - 비밀번호 변경은 관리자로 들어왔을 때만 가능. 바꾸면 이 브라우저에는 바로 적용(localStorage)되고,
//   모두에게 적용할 auth.json 을 내려받을 수 있음
// - 한 번 열면 브라우저 탭을 닫을 때까지 유지(sessionStorage)
// ※ 서버 인증이 아니므로 data 폴더의 CSV 를 주소로 직접 열면 볼 수 있습니다. 외부 공개 시에는 호스팅 쪽 접근 제어를 함께 쓰세요.

const KEY_ROLE = "kcmp.role", KEY_FAIL = "kcmp.failUntil";
const KEY_LOCAL = { user: "kcmp.pwHash.user", admin: "kcmp.pwHash.admin" };
const KEY_LEGACY = "kcmp.pwHash"; // 예전 버전(암호 하나)에서 이 브라우저에 바꿔 둔 값 → 일반 사용자 암호로 취급
const DEFAULT = { // auth.json 을 못 읽을 때 쓰는 초기값
  user: "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0", // sha256("0000")
  admin: "53d6316bd7b9044e6bb5deaa87fe8316c2fde3938b78f8448875b08e551ccc95", // sha256("admin0000")
};
const ROLE_NAME = { user: "일반 사용자", admin: "관리자" };
let shared = { ...DEFAULT };

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function loadShared() {
  try {
    const r = await fetch("auth.json", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); if (j.user && j.admin) shared = { user: j.user, admin: j.admin }; }
  } catch { /* 초기값 사용 */ }
}
const hashOf = (role) => localStorage.getItem(KEY_LOCAL[role]) || (role === "user" && localStorage.getItem(KEY_LEGACY)) || shared[role];
const roleOf = (h) => (h === hashOf("admin") ? "admin" : h === hashOf("user") ? "user" : null);
export const currentRole = () => sessionStorage.getItem(KEY_ROLE);

function applyRole(role) {
  document.documentElement.dataset.role = role;
  const pw = document.getElementById("pwChange"), badge = document.getElementById("roleBadge");
  if (pw) pw.hidden = role !== "admin";
  if (badge) { badge.hidden = !role; badge.textContent = ROLE_NAME[role] || ""; }
}

function unlock(role) {
  sessionStorage.setItem(KEY_ROLE, role);
  applyRole(role);
  document.documentElement.classList.remove("locked");
  document.getElementById("lock")?.remove();
  window.dispatchEvent(new Event("dashboard:unlocked"));
}

function lockScreen() {
  const el = document.createElement("div");
  el.id = "lock";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "lockTitle");
  el.innerHTML = `
    <form class="lock-card" autocomplete="off">
      <div class="logo"><i></i>K-Content Market Pulse</div>
      <h1 id="lockTitle">콘텐츠 시장 대시보드</h1>
      <p class="lock-sub">접속 암호를 입력하세요. 관리자 암호로 들어오면 비밀번호를 바꿀 수 있습니다.</p>
      <label class="sr" for="lockPw">암호</label>
      <input id="lockPw" type="password" placeholder="암호" required>
      <button class="btn btn-primary" type="submit">들어가기</button>
      <p class="lock-msg" id="lockMsg" role="alert"></p>
    </form>`;
  document.body.appendChild(el);
  const form = el.querySelector("form"), input = el.querySelector("#lockPw"), msg = el.querySelector("#lockMsg");
  let fails = 0;
  setTimeout(() => input.focus(), 50);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const until = Number(sessionStorage.getItem(KEY_FAIL) || 0);
    if (Date.now() < until) { msg.textContent = `잠시 후 다시 시도하세요 (${Math.ceil((until - Date.now()) / 1000)}초).`; return; }
    const role = roleOf(await sha256(input.value));
    if (role) { unlock(role); return; }
    fails += 1; input.value = ""; input.focus();
    if (fails >= 5) { sessionStorage.setItem(KEY_FAIL, String(Date.now() + 30000)); fails = 0; msg.textContent = "5번 틀려서 30초 동안 입력할 수 없습니다."; }
    else msg.textContent = `암호가 맞지 않습니다. (${fails}/5)`;
  });
}

function downloadAuth() {
  const body = JSON.stringify({ user: hashOf("user"), admin: hashOf("admin") }, null, 2) + "\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  a.download = "auth.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function changeDialog() {
  if (currentRole() !== "admin") return; // 관리자만
  const d = document.createElement("div");
  d.id = "pwDialog";
  d.setAttribute("role", "dialog");
  d.setAttribute("aria-modal", "true");
  d.setAttribute("aria-labelledby", "pwTitle");
  d.innerHTML = `
    <form class="lock-card" autocomplete="off">
      <h2 id="pwTitle">비밀번호 변경 <span class="role-badge">관리자</span></h2>
      <div class="seg pw-target" role="group" aria-label="바꿀 비밀번호">
        <button type="button" data-t="user" aria-pressed="true">일반 사용자용</button><button type="button" data-t="admin" aria-pressed="false">관리자용</button></div>
      <p class="lock-sub" id="pwHint"></p>
      <input type="password" name="cur" placeholder="관리자 비밀번호 확인" required>
      <input type="password" name="next" placeholder="새 비밀번호 (4자 이상)" minlength="4" required>
      <input type="password" name="again" placeholder="새 비밀번호 확인" minlength="4" required>
      <div class="row2"><button class="btn" type="button" data-close>닫기</button><button class="btn btn-primary" type="submit">변경</button></div>
      <p class="lock-msg" role="alert"></p>
      <div class="pw-done" hidden>
        <p>이 브라우저에는 바로 적용했습니다. <b>모든 사람에게 적용</b>하려면 아래 파일을 내려받아 <code>dashboard/auth.json</code>을 바꾼 뒤 커밋·푸시하세요.</p>
        <button class="btn" type="button" data-dl>auth.json 내려받기</button>
      </div>
    </form>`;
  document.body.appendChild(d);
  const f = d.querySelector("form"), msg = d.querySelector(".lock-msg"), hint = d.querySelector("#pwHint"), done = d.querySelector(".pw-done");
  let target = "user";
  const setTarget = (t) => {
    target = t;
    d.querySelectorAll(".pw-target button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t));
    hint.textContent = t === "user" ? "대시보드를 보는 모든 사람이 쓰는 암호입니다." : "비밀번호를 바꿀 수 있는 관리자 암호입니다.";
    msg.textContent = "";
  };
  setTarget("user");
  d.querySelector(".pw-target").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setTarget(b.dataset.t); });
  const close = () => d.remove();
  d.querySelector("[data-close]").addEventListener("click", close);
  d.querySelector("[data-dl]").addEventListener("click", downloadAuth);
  d.addEventListener("keydown", (e) => e.key === "Escape" && close());
  setTimeout(() => f.cur.focus(), 50);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if ((await sha256(f.cur.value)) !== hashOf("admin")) { msg.textContent = "관리자 비밀번호가 맞지 않습니다."; return; }
    if (f.next.value !== f.again.value) { msg.textContent = "새 비밀번호가 서로 다릅니다."; return; }
    if (f.next.value.length < 4) { msg.textContent = "4자 이상으로 정해 주세요."; return; }
    const h = await sha256(f.next.value), other = target === "user" ? "admin" : "user";
    if (h === hashOf(other)) { msg.textContent = "일반 사용자용과 관리자용 비밀번호는 서로 달라야 합니다."; return; }
    localStorage.setItem(KEY_LOCAL[target], h);
    if (target === "user") localStorage.removeItem(KEY_LEGACY);
    f.cur.value = f.next.value = f.again.value = "";
    msg.textContent = `${ROLE_NAME[target]}용 비밀번호를 바꿨습니다.`;
    done.hidden = false;
  });
}

export async function initLock() {
  document.getElementById("pwChange")?.addEventListener("click", changeDialog);
  document.getElementById("lockNow")?.addEventListener("click", () => { sessionStorage.removeItem(KEY_ROLE); location.reload(); });
  sessionStorage.removeItem("kcmp.unlocked"); // 예전 버전의 열림 표시는 역할이 없으므로 다시 입력받음
  const role = currentRole();
  if (role === "user" || role === "admin") { applyRole(role); document.documentElement.classList.remove("locked"); loadShared(); return true; }
  applyRole(null);
  if (!window.crypto?.subtle) { // http://IP 주소 등 보안 컨텍스트가 아니면 해시 계산 불가
    document.body.insertAdjacentHTML("beforeend", `<div id="lock"><div class="lock-card"><h1>열 수 없습니다</h1><p class="lock-sub">이 대시보드는 https 또는 localhost 주소에서 열어야 합니다.</p></div></div>`);
    return false;
  }
  await loadShared();
  lockScreen();
  return false;
}
