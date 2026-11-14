# Lower Extremity Vascular Doppler Report Form

Offline, single-file web app (`index.html`) for structured lower-extremity duplex reports:

- LE Arterial
- LE Venous Reflux / Varicose (CEAP 2020)
- LE DVT

Enter findings, and a standardized English report (FINDINGS + IMPRESSION) is generated for copying into the EMR.

**Privacy:** all processing happens in the browser. No data is stored or transmitted; refreshing clears the form.

Evidence sources and decisions: see `evidence_summary.md` and `input_spec.md`. Criteria not in the uploaded literature are flagged as outside sources in the UI.
