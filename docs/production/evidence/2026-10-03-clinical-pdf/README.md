# Synthetic clinical document verification

This evidence uses the installed **real jsPDF + jspdf-autotable engine**, synthetic fixtures only, and no Supabase connection or patient records.

`before/` retains the original three PDF artifacts and its generator-source hash. The original accepted-limit prescription contained 20 medicines and 1,999 instruction characters: PDF parsing found **1,825 characters outside its pages**, and the rendered second page overlapped the issuer with a medicine row. The original HCU omitted part of the patient name, recorded sessions, representative and final notes; its legend covered lower teeth and its lower arches differed from the screen diagram.

`candidate/manifest.json` binds the current generator source hash to each generated PDF hash. `candidate/pdf-byte-verification.json` records reopened-byte parsing with pypdf/pdfplumber: all clinical markers present; no characters outside the page bounds; original prescription issue date in America/Guayaquil; HCU lower-arch positions match the screen; recorded CPO=6 and ceo=4 remain unchanged; unknown diagnosis status is not printed as definitive. The PNGs are renders of those exact files and were inspected for overlap, clipping and legibility.

Reproduce from the repository root:

```text
node scripts/verify-clinia-clinical-pdfs.cjs docs/production/evidence/2026-10-03-clinical-pdf/candidate
python scripts/verify-clinia-clinical-pdfs.py docs/production/evidence/2026-10-03-clinical-pdf/candidate
node --test test/production/clinical-pdf-bytes.test.cjs test/production/hcu-publication.test.cjs test/production/pdf-publication.test.cjs test/production/prescription-receipt.test.cjs
node --test test/production/hcu-context-loading.test.cjs
```

The Python check requires pypdf and pdfplumber; the Codex bundled workspace runtime provided both for this run. PNG rendering used bundled Poppler, which reported `No display font for 'Symbol'`; reviewed pages used Helvetica and rendered legibly.

Evidence limits: this verifies document engineering and synthetic regression behavior. It does not verify clinical diagnosis/dosing, prescriber licensing, legal effectiveness of consent/signatures, a minor's representative, retention periods, live JWT/RLS, or browser UAT. The HCU graph is explicitly a summary with complete recorded tooth-state detail in the complement; CPO/ceo values are recorded values, not a clinically certified recalculation. An image signature is not a cryptographic identity assertion. Attachments are outside these PDF artifacts and require separate controlled custody/delivery.

Editor regression checks execute the actual HCU handlers with delayed synthetic responses: patient A cannot populate or save patient B; clinic/user changes, revalidation and unmount discard the old response; failed loads cannot be saved as a new blank HCU; smoking does not set asthma. The shared callback and save handler are also bound to the captured publication generation. These tests do not simulate a real browser or database enforcement.
