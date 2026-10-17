"""Inspect actual synthetic PDF bytes; never connect to patient data."""
from pathlib import Path
import json
import sys
import re
import pdfplumber
from pypdf import PdfReader

root = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/production/evidence/2026-10-03-clinical-pdf/candidate")
required = {
    "receta-sintetica.pdf": ["MARIA JOSE DE LA CRUZ SINTETICA", "Fecha: 1/10/2026", "AUTOR SINTETICO", "Registro no informado"],
    "receta-limite-sintetica.pdf": ["MEDICAMENTO_QA_20", "FIN_INDICACIONES_QA", "AUTOR SINTETICO", "Fecha: 1/10/2026"],
    "hcu-sintetica.pdf": ["MARIA JOSE DE LA CRUZ SINTETICA", "SESION_QA_REALIZADA", "MEDICACION_SESION_QA", "OBS_SESION_QA", "OBS_FINAL_QA", "REPRESENTANTE_SINTETICO", "FIN_MOTIVO_QA", "NOTA_PIEZA_QA", "sealant:blue", "Recesión: 2; movilidad: 1", "No registrado", "Pre.", "880e8400-e29b-41d4-a716-446655440003"],
}
results = []
for name, markers in required.items():
    with pdfplumber.open(root / name) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        outside = [
            {"page": i, "text": char["text"]}
            for i, page in enumerate(pdf.pages, 1) for char in page.chars
            if char["x0"] < -0.5 or char["x1"] > page.width + 0.5
            or char["top"] < -0.5 or char["bottom"] > page.height + 0.5
        ]
        # A long table cell can wrap a word across PDF text operators. Read the
        # semantic operator order as well as layout order before calling it lost.
        semantic = re.sub(r"\s+", "", "\n".join(page.extract_text() or "" for page in PdfReader(root / name).pages))
        missing = [marker for marker in markers if re.sub(r"\s+", "", marker) not in semantic]
        result = {"name": name, "pages": len(pdf.pages), "missing_markers": missing, "characters_outside_page": len(outside)}
        result["persisted_document_id_on_every_page"] = all("880e8400-e29b-41d4-a716-446655440000" in (page.extract_text() or "") for page in pdf.pages)
        if name == "hcu-sintetica.pdf":
            words = pdf.pages[0].extract_words()
            centers = {tooth: next((w["x0"] + w["x1"]) / 2 for w in words if w["text"] == tooth) for tooth in ["48", "31", "85", "71"]}
            result["lower_arch_order_matches_screen"] = centers["48"] < centers["31"] and centers["85"] < centers["71"]
            result["invented_definitive_diagnosis"] = "Def." in text
            result["cpo_6_ceo_4_recorded"] = "CPO 2 1 3 6" in text and "ceo 1 2 1 4" in text
            marks = [c for c in pdf.pages[0].chars if c["text"] == "X"]
            result["completed_extraction_blue"] = any(isinstance(c.get("non_stroking_color"), (tuple, list)) and len(c["non_stroking_color"]) == 3 and c["non_stroking_color"][2] > c["non_stroking_color"][0] for c in marks)
        result["pass"] = not missing and not outside and result["persisted_document_id_on_every_page"] and result.get("lower_arch_order_matches_screen", True) and not result.get("invented_definitive_diagnosis", False) and result.get("cpo_6_ceo_4_recorded", True) and result.get("completed_extraction_blue", True)
        results.append(result)

report = {"scope": "actual synthetic PDF byte extraction and page bounds; separate rendered-page QA required", "results": results, "pass": all(item["pass"] for item in results)}
(root / "pdf-byte-verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
sys.exit(0 if report["pass"] else 1)
