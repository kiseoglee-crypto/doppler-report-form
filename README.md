# Lower Extremity Vascular Doppler Report Form

Offline, single-file web app (`index.html`) for structured lower-extremity duplex reports:

- LE Arterial
- LE Venous Reflux / Varicose (CEAP 2020)
- LE DVT

Enter findings, and a standardized English report (FINDINGS + IMPRESSION) is generated for copying into the EMR.

**Privacy:** all processing happens in the browser. Nothing is stored in the browser except the optional Google Drive settings (Apps Script URL + shared secret); refreshing clears the form.

**Optional Save to Drive (pseudonymized research log):** the *Save to Drive* button sends the current exam to the user's own Google Sheet through a Google Apps Script web app (`apps_script/Code.gs`, setup guide `apps_script/SETUP_ko.md`). Stored: registration no., exam date, age, sex, all inputs, auto-interpretation, CEAP, report text, full input JSON. Not stored: name or date of birth (no such fields), sonographer/physician names. No URL or secret is contained in this repository; each browser is configured once in *Google Drive settings*.

Evidence sources and decisions: see `evidence_summary.md` and `input_spec.md`. Criteria not in the uploaded literature are flagged as outside sources in the UI.
