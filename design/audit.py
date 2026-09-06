import re, os, json, collections, pathlib
SRC = pathlib.Path("src")
files = [p for p in SRC.rglob("*.tsx")]
screens = sorted([p for p in SRC.rglob("page.tsx")])

def route(p):
    r = str(p.parent).replace("src/app","") or "/"
    return r if r.startswith("/") else "/"+r

agg = collections.defaultdict(collections.Counter)
per_file = {}

pats = {
 "svg":            re.compile(r"<svg\b"),
 "stroke":         re.compile(r'strokeWidth=[{"]\s*"?([\d.]+)'),
 "rounded_px":     re.compile(r"rounded-\[(\d+)px\]"),
 "rounded_token":  re.compile(r"rounded-(inner|outer|card|pill|full|xl|2xl|lg|md|sm)\b"),
 "text_px":        re.compile(r"text-\[(\d+(?:\.\d+)?)px\]"),
 "hex":            re.compile(r"#[0-9a-fA-F]{6}\b"),
 "icon_size":      re.compile(r'\b(?:w|h)-(\d+(?:\.\d+)?)\s'),
 "gap":            re.compile(r"\bgap-(\[\d+px\]|\d+(?:\.\d+)?)"),
 "px":             re.compile(r"\bp[xy]?-(\[\d+px\]|\d+(?:\.\d+)?)"),
 "shadow":         re.compile(r"\bshadow-(\[[^\]]+\]|\w+)"),
}

for p in files:
    t = p.read_text(encoding="utf-8", errors="ignore")
    c = {}
    for k, rx in pats.items():
        m = rx.findall(t)
        c[k] = m
        for v in m:
            agg[k][v if isinstance(v,str) else v] += 1
    c["svg_n"] = len(pats["svg"].findall(t))
    per_file[str(p)] = c

def top(k, n=20):
    return agg[k].most_common(n)

out = []
out.append(f"화면(page.tsx): {len(screens)}개")
out.append(f"tsx 파일 전체: {len(files)}개")
out.append(f"인라인 <svg> 총계: {sum(v['svg_n'] for v in per_file.values())}개")
out.append("")
out.append("── 획 굵기(strokeWidth) 분포 ──")
for v,n in sorted(agg["stroke"].items(), key=lambda x:-x[1]): out.append(f"  {v:>5} : {n}회")
out.append("")
out.append("── 모서리: 하드코딩 rounded-[Npx] ──")
for v,n in sorted(agg["rounded_px"].items(), key=lambda x:-x[1]): out.append(f"  {v+'px':>7} : {n}회")
out.append("── 모서리: 토큰/유틸 ──")
for v,n in sorted(agg["rounded_token"].items(), key=lambda x:-x[1]): out.append(f"  rounded-{v:<8} : {n}회")
out.append("")
out.append("── 글자 크기 하드코딩 text-[Npx] ──")
for v,n in sorted(agg["text_px"].items(), key=lambda x:-float(x[0])): out.append(f"  {v+'px':>8} : {n}회")
out.append("")
out.append("── 하드코딩 hex 색 ──")
for v,n in agg["hex"].most_common(30): out.append(f"  {v} : {n}회")
out.append("")
out.append("── 그림자 ──")
for v,n in agg["shadow"].most_common(15): out.append(f"  shadow-{v[:40]:<40} : {n}회")
out.append("")
out.append("── 아이콘/요소 크기 w-/h- 상위 ──")
for v,n in agg["icon_size"].most_common(15): out.append(f"  {v:>5} : {n}회")
out.append("")
out.append("── svg가 많은 파일 상위 15 ──")
for f,c in sorted(per_file.items(), key=lambda x:-x[1]["svg_n"])[:15]:
    if c["svg_n"]: out.append(f"  {c['svg_n']:>3}개  {f}")
out.append("")
out.append("── 화면 목록 ──")
for s in screens: out.append("  "+route(s))
print("\n".join(out))
