# Tender loop - streaming CPV pre-filter for ISVZ monthly zips (durable tool).
#
# WHY. VZ-04-2026 decompresses to 4.95 GB and January/February to ~1.3 GB - past V8's
# ~512 MB string cap and past execFileSync's buffer, so the Node writer can never parse
# those months whole (the dataor 2.4 GB lesson, met BEFORE it bit this time). This script
# streams the JSON with ijson and keeps only records where ANY lot's hlavni_kod_CPV
# starts with the scoped division, writing `<month>-cpv<div>.json` beside the zip. The
# filtered file is 1-3 % of the original; the Node writer prefers it when present.
#
# Deterministic, stdlib + ijson only. Drops nothing silently: prints kept/total.
#
#   python scripts/case-loops/tender/filter-month.py VZ-04-2026 45
import io
import json
import sys
import zipfile

import ijson  # pip install ijson

month, div = sys.argv[1], sys.argv[2]
raw = f"data/raw/isvz/{month}.zip"
out = f"data/raw/isvz/{month}-cpv{div}.ndjson"


def lot_cpvs(rec):
    vz = rec.get("verejna_zakazka") or {}
    for c in vz.get("casti_verejne_zakazky") or []:
        cpv = ((c.get("predmet") or {}).get("hlavni_kod_CPV")) or ""
        yield str(cpv)


z = zipfile.ZipFile(raw)
name = z.namelist()[0]
kept, total = [], 0
header = {}
with z.open(name) as fh:
    buffered = io.BufferedReader(fh, buffer_size=1 << 22)
    # header fields first (they precede `data` in the file)
    for key, value in {"obdobi_od": None, "obdobi_do": None, "verze": None}.items():
        header[key] = None
    for rec in ijson.items(buffered, "data.item", use_float=True):
        total += 1
        if any(c.startswith(div) for c in lot_cpvs(rec)):
            kept.append(rec)

# re-read just the small header scalars
with z.open(name) as fh:
    for prefix, _, value in ijson.parse(io.BufferedReader(fh, buffer_size=1 << 20)):
        if prefix in ("obdobi_od", "obdobi_do", "verze"):
            header[prefix] = value
        if prefix == "data":  # reached the array - header is done
            break

# NDJSON: line 1 = header meta, then one record per line. The filtered April 2026 file
# was still ~650 MB as one JSON document - past V8's string cap AGAIN; a line stream has
# no document-sized string anywhere.
with open(out, "w", encoding="utf-8") as f:
    meta = {"obdobi_od": header.get("obdobi_od"), "obdobi_do": header.get("obdobi_do"), "verze": header.get("verze"), "records": len(kept), "of": total}
    f.write(json.dumps(meta, ensure_ascii=False) + "\n")
    for rec in kept:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print(f"{month}: kept {len(kept)} of {total} records -> {out}")
