#!/usr/bin/env python3
"""Read Rizki's CTT exports, prepare review notes, and compare CTT 1 vs CTT 2.

This tool does NOT calculate CTT. It reads CTT results produced by the CTT module.
"""
from __future__ import annotations
import argparse
import csv
import json
import math
import sys
from pathlib import Path
from typing import Any

REQUIRED = {
    "question_id", "item_version", "total_responses", "difficulty_index",
    "discrimination_index", "correct_option", "option_A_count",
    "option_B_count", "option_C_count", "option_D_count"
}
OPTIONS = ("A", "B", "C", "D")

class EvaluationError(Exception):
    pass


def _number(value: str, column: str, row_no: int, integer: bool = False):
    value = (value or "").strip()
    if value == "":
        return None
    try:
        result = int(value) if integer else float(value)
    except ValueError as exc:
        raise EvaluationError(f"Baris {row_no}: kolom {column} harus berupa angka.") from exc
    if not math.isfinite(result) or (integer and result < 0):
        raise EvaluationError(f"Baris {row_no}: nilai {column} tidak valid.")
    return result


def load_ctt(path: str | Path) -> dict[str, dict[str, Any]]:
    path = Path(path)
    if not path.exists():
        raise EvaluationError(f"File tidak ditemukan: {path}")
    result = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise EvaluationError(f"CSV tidak memiliki header: {path}")
        missing = REQUIRED - set(reader.fieldnames)
        if missing:
            raise EvaluationError("Kolom wajib tidak ada: " + ", ".join(sorted(missing)))
        for row_no, row in enumerate(reader, start=2):
            qid = (row.get("question_id") or "").strip()
            version = (row.get("item_version") or "").strip()
            if not qid or not version:
                raise EvaluationError(f"Baris {row_no}: question_id dan item_version wajib diisi.")
            if qid in result:
                raise EvaluationError(f"ID soal {qid} duplikat dalam satu file CTT.")
            n = _number(row.get("total_responses", ""), "total_responses", row_no, True)
            if n is None:
                raise EvaluationError(f"Baris {row_no}: total_responses wajib diisi.")
            key = (row.get("correct_option") or "").strip().upper()
            if key not in OPTIONS:
                raise EvaluationError(f"Baris {row_no}: correct_option harus A/B/C/D.")
            counts = {}
            for opt in OPTIONS:
                count = _number(row.get(f"option_{opt}_count", ""), f"option_{opt}_count", row_no, True)
                if count is None:
                    raise EvaluationError(f"Baris {row_no}: option_{opt}_count wajib diisi.")
                counts[opt] = count
            p = _number(row.get("difficulty_index", ""), "difficulty_index", row_no)
            if p is not None and not 0 <= p <= 1:
                raise EvaluationError(
                    f"Baris {row_no}: difficulty_index harus proporsi 0-1, bukan persen 0-100."
                )
            d = _number(row.get("discrimination_index", ""), "discrimination_index", row_no)
            result[qid] = {
                "question_id": qid, "item_version": version, "total_responses": n,
                "difficulty_index": p, "discrimination_index": d,
                "correct_option": key, "option_counts": counts
            }
    return result


def load_pairs(ctt1, ctt2, mapping_path=None):
    pairs, used1, used2 = [], set(), set()
    if mapping_path:
        with Path(mapping_path).open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            needed = {"ctt1_question_id", "ctt2_question_id", "relation"}
            if not reader.fieldnames or not needed.issubset(reader.fieldnames):
                raise EvaluationError("Mapping wajib memiliki ctt1_question_id, ctt2_question_id, relation.")
            for row in reader:
                a, b = (row.get("ctt1_question_id") or "").strip(), (row.get("ctt2_question_id") or "").strip()
                relation = (row.get("relation") or "").strip().lower()
                if a not in ctt1 or b not in ctt2:
                    raise EvaluationError(f"Mapping menunjuk ID yang tidak ditemukan: {a} -> {b}")
                if a in used1 or b in used2:
                    raise EvaluationError("ID soal pada mapping tidak boleh dipasangkan lebih dari sekali.")
                if relation not in {"revised", "replacement"}:
                    raise EvaluationError("relation harus 'revised' atau 'replacement'.")
                pairs.append({"old": a, "new": b, "relation": relation, "notes": (row.get("notes") or "").strip()})
                used1.add(a); used2.add(b)
    else:
        for qid in sorted(set(ctt1) & set(ctt2)):
            pairs.append({"old": qid, "new": qid, "relation": "revised", "notes": "Dipadankan otomatis berdasarkan ID yang sama."})
            used1.add(qid); used2.add(qid)
    unmatched = ([{"period": "CTT1", "question_id": q, "note": "Tidak memiliki pasangan pada CTT2/mapping."} for q in sorted(set(ctt1)-used1)] +
                 [{"period": "CTT2", "question_id": q, "note": "Tidak memiliki pasangan pada CTT1/mapping."} for q in sorted(set(ctt2)-used2)])
    return pairs, unmatched


def proportion(count, total):
    return round(count / total, 4) if total else None


def initial_review(ctt1):
    rows = []
    for qid, item in sorted(ctt1.items()):
        n, key, counts = item["total_responses"], item["correct_option"], item["option_counts"]
        observations, followup = [], []
        if n == 0:
            observations.append("Tidak ada respons; hasil belum dapat ditafsirkan.")
            followup.append("Periksa ketersediaan data respons.")
        else:
            unused = [o for o in OPTIONS if o != key and counts[o] == 0]
            if unused:
                observations.append("Pengecoh tidak dipilih pada sampel ini: " + ", ".join(unused) + ".")
                followup.append("Tinjau kewajaran pengecoh dan karakteristik/ukuran sampel.")
            if sum(counts.values()) != n:
                observations.append(f"Jumlah pilihan ({sum(counts.values())}) tidak sama dengan total_responses ({n}).")
                followup.append("Konfirmasi aturan respons kosong dan definisi total respons dengan Rizki.")
        d = item["discrimination_index"]
        if d is not None and d < 0:
            observations.append("Daya pembeda bernilai negatif menurut angka yang diterima.")
            followup.append("Tinjau kunci, redaksi, materi, dan metode indeks bersama Rizki/dosen.")
        if item["difficulty_index"] is None:
            observations.append("Indeks kesulitan tidak tersedia.")
            followup.append("Konfirmasi ketersediaan indeks kesulitan pada ekspor CTT.")
        else:
            observations.append("Interpretasikan indeks kesulitan dengan pedoman tim/ahli; tidak ada cut-off otomatis.")
        rows.append({
            "question_id": qid, "item_version": item["item_version"], "total_responses": n,
            "difficulty_index": item["difficulty_index"], "discrimination_index": d,
            "correct_option": key,
            **{f"option_{o}_count": counts[o] for o in OPTIONS},
            **{f"option_{o}_proportion": proportion(counts[o], n) for o in OPTIONS},
            "observations": " ".join(observations) or "Tetap lakukan telaah isi soal.",
            "suggested_follow_up": " ".join(followup) or "Telaah isi soal dan catat keputusan reviewer.",
            "reviewer_decision": "", "recommendation_to_dzikri": ""
        })
    return rows


def compare(ctt1, ctt2, pairs):
    rows = []
    for pair in pairs:
        a, b = ctt1[pair["old"]], ctt2[pair["new"]]
        p1, p2 = a["difficulty_index"], b["difficulty_index"]
        d1, d2 = a["discrimination_index"], b["discrimination_index"]
        notes = []
        if pair["relation"] == "replacement":
            notes.append("Replacement: butir CTT2 adalah pengganti; jangan menyebutnya peningkatan butir yang sama.")
        else:
            notes.append("Revised: interpretasikan hati-hati jika peserta/kondisi ujian berbeda.")
        if a["total_responses"] != b["total_responses"]:
            notes.append("Jumlah respons berbeda antara CTT1 dan CTT2.")
        if a["correct_option"] != b["correct_option"]:
            notes.append("Kunci berubah; verifikasi perubahan kunci.")
        if p1 is not None and p2 is not None:
            notes.append("Indeks kesulitan naik berarti proporsi benar naik (soal relatif lebih mudah), bukan otomatis lebih baik.")
        if d1 is not None and d2 is not None:
            notes.append("Arah perubahan daya pembeda harus ditafsirkan sesuai metode/konvensi indeks Rizki.")
        row = {
            "ctt1_question_id": a["question_id"], "ctt1_version": a["item_version"],
            "ctt2_question_id": b["question_id"], "ctt2_version": b["item_version"],
            "relation": pair["relation"], "mapping_notes": pair["notes"],
            "ctt1_total_responses": a["total_responses"], "ctt2_total_responses": b["total_responses"],
            "ctt1_difficulty_index": p1, "ctt2_difficulty_index": p2,
            "difficulty_delta_ctt2_minus_ctt1": round(p2-p1, 4) if p1 is not None and p2 is not None else None,
            "ctt1_discrimination_index": d1, "ctt2_discrimination_index": d2,
            "discrimination_delta_ctt2_minus_ctt1": round(d2-d1, 4) if d1 is not None and d2 is not None else None,
            "ctt1_correct_option": a["correct_option"], "ctt2_correct_option": b["correct_option"],
            "interpretation_note": " ".join(notes)
        }
        for opt in OPTIONS:
            p_old = proportion(a["option_counts"][opt], a["total_responses"])
            p_new = proportion(b["option_counts"][opt], b["total_responses"])
            row[f"ctt1_option_{opt}_count"] = a["option_counts"][opt]
            row[f"ctt2_option_{opt}_count"] = b["option_counts"][opt]
            row[f"ctt1_option_{opt}_proportion"] = p_old
            row[f"ctt2_option_{opt}_proportion"] = p_new
            row[f"option_{opt}_proportion_delta"] = round(p_new-p_old, 4) if p_old is not None and p_new is not None else None
        rows.append(row)
    return rows


def write_csv(path: Path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)


def run(ctt1_path, output_dir, ctt2_path=None, mapping_path=None):
    ctt1 = load_ctt(ctt1_path)
    out = Path(output_dir); out.mkdir(parents=True, exist_ok=True)
    write_csv(out / "evaluasi_awal_ctt1.csv", initial_review(ctt1))
    summary = {"ctt1_item_count": len(ctt1), "ctt2_item_count": 0,
               "paired_item_count": 0, "unmatched_item_count": 0,
               "comparison_created": False,
               "note": "Catatan bersifat awal; keputusan evaluasi akhir dilakukan manusia/ahli."}
    if ctt2_path:
        ctt2 = load_ctt(ctt2_path)
        pairs, unmatched = load_pairs(ctt1, ctt2, mapping_path)
        write_csv(out / "perbandingan_ctt1_ctt2.csv", compare(ctt1, ctt2, pairs))
        write_csv(out / "soal_tidak_berpasangan.csv", unmatched)
        summary.update({"ctt2_item_count": len(ctt2), "paired_item_count": len(pairs),
                        "unmatched_item_count": len(unmatched), "comparison_created": True,
                        "mapping_used": bool(mapping_path)})
    (out / "ringkasan.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary


def main():
    parser = argparse.ArgumentParser(description="Evaluasi awal CTT1 dan perbandingan CTT1-CTT2.")
    parser.add_argument("--ctt1", required=True, help="CSV hasil CTT pertama dari Rizki.")
    parser.add_argument("--ctt2", help="CSV hasil CTT kedua dari Rizki (opsional).")
    parser.add_argument("--mapping", help="CSV pemetaan ID soal jika ID berubah (opsional).")
    parser.add_argument("--out", default="hasil_evaluasi", help="Folder hasil keluaran.")
    args = parser.parse_args()
    try:
        summary = run(args.ctt1, args.out, args.ctt2, args.mapping)
    except (EvaluationError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr); return 1
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nHasil tersimpan di: {args.out}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
