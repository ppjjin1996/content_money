"""
콘텐츠 업종 인허가(개업·폐업) 수집기 — 공공데이터포털 오픈API (행정안전부_문화_○○ 조회서비스)

사용법
  1) 공공데이터포털(data.go.kr) 로그인 → 아래 11개 '조회서비스' 각각 [활용신청] (개발계정, 자동승인)
  2) 마이페이지 → 개인 API인증키(Decoding 키)를 복사
  3) 프로젝트 폴더에 `.datagokr_key` 파일을 만들고 키 한 줄만 붙여넣기
     (또는 환경변수 DATA_GO_KR_KEY 로 지정)
  4) 프로젝트 폴더에서 실행:  python tools/collect_licenses.py
     - 중간에 끊겨도 다시 실행하면 받아둔 페이지는 건너뜁니다.
     - 결과: data/raw_인허가/<업종>.csv (원자료), data/15_콘텐츠업종_인허가_개폐업_시도별_연도별.csv (집계)

API: https://apis.data.go.kr/1741000/<slug>/info  (numOfRows 최대 100, 개발계정 일 10,000건/서비스)
"""
import csv, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict

for _s in (sys.stdout, sys.stderr):  # Windows 콘솔(cp949)에서도 한글·기호 출력이 깨지지 않게
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw_인허가")
CACHE = os.path.join(RAW, "_pages")

SERVICES = [  # (업종그룹, 업종명, slug, 공공데이터포털 파일데이터 행 수(2026-02 기준, 참고용))
    ("게임", "게임물제작업", "game_producers", 11767),
    ("게임", "게임물배급업", "game_distributors", 5825),
    ("음악", "음반및음악영상물제작업", "music_video_producers", 3461),
    ("음악", "음반및음악영상물배급업", "music_video_distributors", 1043),
    ("음악", "온라인음악서비스제공업", "online_music_services", 142),
    ("영화·비디오", "영화제작업", "film_producers", 8771),
    ("영화·비디오", "영화배급업", "film_distributors", 2814),
    ("영화·비디오", "비디오물제작업", "video_producers", 18959),
    ("영화·비디오", "비디오물배급업", "video_distributors", 2011),
    ("대중문화예술기획", "대중문화예술기획업", "pop_culture_art_planners", 7537),
    ("출판", "출판사", "publishers", 123653),
]
FIELDS = ["OPN_ATMY_GRP_CD", "MNG_NO", "BPLC_NM", "SALS_STTS_CD", "SALS_STTS_NM", "DTL_SALS_STTS_CD", "DTL_SALS_STTS_NM",
          "LCPMT_YMD", "LCPMT_RTRCN_YMD", "CLSBIZ_YMD", "TCBIZ_BGNG_YMD", "TCBIZ_END_YMD", "ROAD_NM_ADDR", "LOTNO_ADDR",
          "CULTR_BZMN_SE_NM", "CULTR_SPTS_TPBIZ_NM", "FBCTN_HNDL_ITEM_CN", "DAT_UPDT_SE", "DAT_UPDT_PNT", "LAST_MDFCN_PNT"]
# 개인정보 최소화: 전화번호·좌표 등은 저장하지 않음
SIDO = {"서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천", "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
        "경기": "경기", "강원": "강원", "충청북": "충북", "충북": "충북", "충청남": "충남", "충남": "충남", "전라북": "전북", "전북": "전북",
        "전라남": "전남", "전남": "전남", "경상북": "경북", "경북": "경북", "경상남": "경남", "경남": "경남", "제주": "제주"}


def read_key():
    k = os.environ.get("DATA_GO_KR_KEY", "").strip()
    p = os.path.join(ROOT, ".datagokr_key")
    if not k and os.path.exists(p):
        raw = open(p, "rb").read()
        for enc in ("utf-8-sig", "utf-16"):  # PowerShell echo 는 UTF-16 으로 저장함
            try:
                k = raw.decode(enc).strip().strip('"').strip("'")
                break
            except UnicodeDecodeError:
                continue
    if not k:
        sys.exit("인증키가 없습니다. 프로젝트 폴더에 .datagokr_key 파일을 만들거나 DATA_GO_KR_KEY 환경변수를 설정하세요.")
    if k in ("여기에_키",) or len(k) < 20:
        sys.exit(".datagokr_key 에 실제 인증키가 아닌 값이 들어 있습니다. 예시 문구 대신 공공데이터포털의 Decoding 키를 붙여넣어 주세요.")
    return k


def fetch_page(key, slug, page):
    os.makedirs(CACHE, exist_ok=True)
    cp = os.path.join(CACHE, f"{slug}_{page:05d}.json")
    if os.path.exists(cp):
        return json.load(open(cp, encoding="utf-8"))
    q = {"pageNo": page, "numOfRows": 100, "returnType": "json"}
    sk = key if "%" in key else urllib.parse.quote(key, safe="")  # Encoding/Decoding 키 모두 허용
    url = f"https://apis.data.go.kr/1741000/{slug}/info?serviceKey={sk}&" + urllib.parse.urlencode(q)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "content-dashboard/1.0"}), timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            if "OpenAPI_ServiceResponse" in data:
                msg = data["OpenAPI_ServiceResponse"]["cmmMsgHeader"]
                sys.exit(f"[{slug}] API 거부: {msg.get('errMsg')} ({msg.get('returnAuthMsg')}) — 이 서비스에 활용신청을 했는지 확인하세요.")
            code = str(data["response"]["header"]["resultCode"])
            if code not in ("0", "00", "000"):
                raise RuntimeError(f"resultCode {code} {data['response']['header'].get('resultMsg')}")
            json.dump(data, open(cp, "w", encoding="utf-8"), ensure_ascii=False)
            return data
        except SystemExit:
            raise
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise PermissionError(f"{slug}: HTTP {e.code} — 이 서비스의 활용신청(승인)이 아직 안 된 것 같습니다.")
            wait = 2 ** attempt
            print(f"  ! {slug} p{page} 재시도 {attempt + 1}/5 (HTTP {e.code}) — {wait}s 대기")
            time.sleep(wait)
        except Exception as e:
            wait = 2 ** attempt
            print(f"  ! {slug} p{page} 재시도 {attempt + 1}/5 ({e}) — {wait}s 대기")
            time.sleep(wait)
    sys.exit(f"[{slug}] p{page} 를 받지 못했습니다. 잠시 후 다시 실행하세요(받은 페이지는 이어받기 됩니다).")


def items_of(data):
    it = data["response"]["body"].get("items") or {}
    it = it.get("item", []) if isinstance(it, dict) else it
    return it if isinstance(it, list) else [it]


def collect(key, slug):
    first = fetch_page(key, slug, 1)
    total = int(first["response"]["body"]["totalCount"])
    pages = (total + 99) // 100
    rows = items_of(first)
    for p in range(2, pages + 1):
        rows += items_of(fetch_page(key, slug, p))
        if p % 50 == 0:
            print(f"  {slug}: {p}/{pages} 페이지")
        time.sleep(0.15)
    return total, rows


def sido_of(r):
    for a in (r.get("ROAD_NM_ADDR") or "", r.get("LOTNO_ADDR") or ""):
        a = a.strip()
        for k, v in SIDO.items():
            if a.startswith(k):
                return v
    return "미상"


def ymd_year(v):
    v = (v or "").replace("-", "").strip()
    return int(v[:4]) if len(v) >= 4 and v[:4].isdigit() else None


def closed_year(r):
    """폐업 연도: 폐업일자 → 없으면 인허가취소일자. 영업 중이면 None."""
    st = (r.get("SALS_STTS_NM") or "") + (r.get("DTL_SALS_STTS_NM") or "")
    y = ymd_year(r.get("CLSBIZ_YMD")) or ymd_year(r.get("LCPMT_RTRCN_YMD"))
    if y:
        return y
    return "날짜없음" if any(k in st for k in ("폐업", "취소", "말소", "폐쇄")) else None


def aggregate(all_rows, year_from=2000, year_to=2026):
    agg = defaultdict(lambda: [0, 0, 0])  # 개업, 폐업, 연말영업
    nodate = defaultdict(int)
    for grp, name, r in all_rows:
        sd = sido_of(r)
        oy, cy = ymd_year(r.get("LCPMT_YMD")), closed_year(r)
        for reg in (sd, "전국"):
            for g, n in ((grp, name), (grp, "_소계"), ("전체", "_소계")):
                if oy and year_from <= oy <= year_to:
                    agg[(g, n, reg, oy)][0] += 1
                if isinstance(cy, int) and year_from <= cy <= year_to:
                    agg[(g, n, reg, cy)][1] += 1
                if cy == "날짜없음":
                    nodate[(g, n, reg)] += 1
                for y in range(year_from, year_to + 1):  # 연말 영업(추정): 그해 말까지 인허가 & 그해 말까지 폐업 안 함
                    if oy and oy <= y and not (isinstance(cy, int) and cy <= y) and cy != "날짜없음":
                        agg[(g, n, reg, y)][2] += 1
    return agg, nodate


def main():
    key = read_key()
    os.makedirs(RAW, exist_ok=True)
    all_rows, skipped = [], []
    for grp, name, slug, ref in SERVICES:
        print(f"▶ {name} ({slug}) 수집 중…", flush=True)
        try:
            total, rows = collect(key, slug)
        except (PermissionError, SystemExit) as e:
            print(f"  ✖ 건너뜀: {e}", flush=True)
            skipped.append(name)
            continue
        print(f"  {name}: API totalCount {total:,} / 받은 행 {len(rows):,} / 포털 파일 행 수(참고) {ref:,}")
        with open(os.path.join(RAW, f"{name}.csv"), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS + ["시도"], extrasaction="ignore")
            w.writeheader()
            for r in rows:
                w.writerow({**{k: r.get(k, "") for k in FIELDS}, "시도": sido_of(r)})
        all_rows += [(grp, name, r) for r in rows]

    agg, nodate = aggregate(all_rows)
    out = os.path.join(ROOT, "data", "15_콘텐츠업종_인허가_개폐업_시도별_연도별.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["업종그룹", "업종", "지역", "연도", "개업(인허가)", "폐업", "연말영업(추정)"])
        for (g, n, reg, y), v in sorted(agg.items()):
            w.writerow([g, n, reg, y] + v)
    print(f"✔ 집계 저장: {out}")
    if skipped:
        print(f"  ⚠ 받지 못한 업종: {', '.join(skipped)} — 활용신청 승인 후 다시 실행하면 이어서 받습니다.")
        with open(os.path.join(RAW, "_skipped.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(skipped))
    elif os.path.exists(os.path.join(RAW, "_skipped.txt")):
        os.remove(os.path.join(RAW, "_skipped.txt"))
    if nodate:
        print("  참고: 폐업 상태지만 폐업일자가 없는 건수(연도 집계에서 제외):",
              {f"{g}/{n}": c for (g, n, reg), c in nodate.items() if reg == "전국" and n == "_소계"})


if __name__ == "__main__":
    main()
