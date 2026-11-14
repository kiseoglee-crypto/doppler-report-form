# 하지 혈관 Duplex 입력 워크플로 스펙 (Structured Input Spec) v0.2 draft

- 용도: 별도의 웹 입력 페이지에서 소견을 입력하면 EMR에 붙여넣을 **영문 리포트**를 자동으로 생성합니다.
- 언어: 필드 라벨과 출력 문장은 영어, 이 문서의 설명은 한국어입니다.
- 짝 파일: `input_spec.json`(기계 판독용 원본. 웹페이지는 이 파일을 그대로 읽으면 됩니다), `render_example.py`(rule과 template이 동작하는 방식을 보여주는 참고 구현), `example_reports.txt`, `evidence_summary.md`(근거와 쪽수)
- 출처 표기: S1-S4는 `evidence_summary.md` 0장을 참고하세요. **⚠ OUTSIDE SOURCE** = 업로드된 4개 문헌에 없는 기준입니다. 기본값만 제안해 두었으니 채택 여부를 결정해 주세요. 모든 cutoff는 `config`에 모아 두어서 코드를 고치지 않고 값만 바꿀 수 있어요.

## 0. 확정된 결정사항 (2026-11-14, 자기 결정 A)
- Reflux cutoff: superficial·perforator >0.5 s, femoral/popliteal >1.0 s, pathologic perforator ≥3.5 mm & ≥0.5 s (⚠ outside source)
- 협착 등급: SVM/SVU 3단계 (<50% / 50-74% / ≥75% / occlusion), S2 Table 7
- ABI: ON, normal 0.9-1.4, <0.9 PAD, <0.5 severe, >1.4 non-compressible (S1 p.12, p.15)
- CEAP: ON, **CEAP 2020 개정판** 기준 (⚠ outside source: Lurie F et al. J Vasc Surg Venous Lymphat Disord 2020;8:342-352)
  - C: 있는 class를 전부 체크 (C0, C1, C2, C2r, C3, C4a, C4b, C4c, C5, C6, C6r) + s/a modifier 필수
  - 출력: basic(최고 C 하나)을 먼저, advanced(전체 C + 해부 segment)를 괄호에 → `Right CEAP 2020: C4a,s Ep As,p Pr (advanced: C2,3,4a,s Ep As,p Pr GSVa, GSVb, SSV, CPV).`
  - E는 선택(기본 Ep), A·P는 입력된 reflux/폐쇄 소견에서 자동 산출(2020 약어 GSVa/GSVb/SSV/AASV/NSV/CFV/FV/POPV/PTV/GAV/TPV/CPV), 수동 override 가능
  - basic의 '최고 C' 순위: C4b > C4c > C4a (**자체 임상 결정** 2026-11-14, 논문은 C4 하위분류 순위를 정하지 않음). advanced 목록은 2020 Table III 순서 유지 → C4b+C4c는 `C4b,s (advanced: C4b,4c,s ...)`
  - `config.ceap.output_format`으로 both / basic / advanced 전환
- SVT: SFJ/SPJ까지 thrombus apex 거리만 기록. DVT 준용 여부 문구는 자동 생성하지 않음(임상 판단, 2026-11-14 결정). 거리 미입력 시 경고
- DVT: calf vein을 포함한 whole-leg 검사, compressibility·acute/chronic 기준은 외부 가이드라인(SRU 2018) 채택 (⚠ outside source)

## 1. 설계 원칙
1. **Findings와 Interpretation 분리**(S2 p.15 CONSENSUS POINT): 입력값과 파형 descriptor는 findings 문장으로, rule이 판정한 결과는 IMPRESSION 문장으로 나갑니다. 의사가 자동 판정을 덮어쓸 수 있습니다(`overridable`).
2. **파형 용어는 SVM/SVU 2020(S2)만 사용**: arterial은 flow direction, phasicity(multiphasic/monophasic), resistance(high/intermediate/low), upstroke(rapid/prolonged), modifier를 씁니다. venous는 direction, flow pattern, spontaneity, augmentation, reflux를 씁니다. triphasic/biphasic은 입력 옵션에서 빼고 도움말에만 "former term"으로 표시합니다.
3. **IAC 필수 요소 강제**(S4 pp.182-183): position, equipment/probe, limitation 사유, comparison, interpretation date는 required입니다. unilateral 정맥 검사에서 contralateral CFV가 없으면 경고합니다. 정맥류가 있는데 reflux source가 없으면 "incomplete"로 표시합니다.
4. **Segment × Side 그리드**: 화면은 segment마다 Rt와 Lt 두 열로 둡니다. `not_visualized`를 체크하면 그 행의 입력이 잠기고 limitation 문장이 자동으로 들어갑니다.
5. **정상 기본값**: 클릭 수를 줄이기 위해 "All normal" 버튼으로 정상값을 일괄 입력합니다. arterial은 antegrade/multiphasic/high/rapid, DVT는 fully compressible/complete filling/spontaneous/respirophasic/normal augmentation이 들어가고, 이상 소견만 고치면 됩니다. 정상 segment는 한 문장으로 묶어 출력합니다.

## 2. Common header (모든 검사 공통)
출처: S4 pp.182-184; S2 p.15

| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `patient_id` | Patient ID | text |  (required=True) |  |
| `patient_name` | Name | text |  |  |
| `age` | Age | number | y |  |
| `sex` | Sex | select | M, F |  |
| `exam_date` | Exam date | date |  (required=True) |  |
| `exam_type` | Exam | select | Lower extremity arterial duplex, Lower extremity venous insufficiency (reflux) duplex, Lower extremity venous duplex for DVT (required=True) |  |
| `laterality` | Side examined | select | Bilateral, Right, Left (required=True) |  |
| `indication` | Indication | multiselect | exam-specific list (see each exam) (required=True) | S4 Venous Ultrasound 2e Ch.10 p.182 |
| `indication_free` | Indication (free text) | text |  |  |
| `history` | Pertinent history (prior intervention, anticoagulation, prior DVT, etc.) | text |  |  |
| `position` | Patient position | select | Supine, Standing, Reverse Trendelenburg, Sitting, Prone (popliteal/calf) | S4 Venous Ultrasound 2e Ch.10 p.182 (standing vs supine must be stated) |
| `equipment` | Ultrasound system | text |  (required=True) | S4 Venous Ultrasound 2e Ch.10 p.183 |
| `probe` | Transducer (type/MHz) | text |  (required=True) | S4 Venous Ultrasound 2e Ch.10 p.183 |
| `sonographer` | Sonographer | text |  |  |
| `physician` | Interpreting physician | text |  (required=True) |  |
| `limited` | Technically limited / incomplete study | checkbox |  | S4 Venous Ultrasound 2e Ch.10 p.183 |
| `limitation_reason` | Limitation reason | multiselect | Body habitus, Edema, Dressing/cast, Open wound/ulcer, Patient intolerance/pain, Calcified vessels (acoustic shadowing), Bowel gas (iliac), Limited mobility (unable to stand), Other | S4 Venous Ultrasound 2e Ch.10 p.183 |
| `limitation_free` | Limitation details | text |  |  |
| `prior_exam_date` | Comparison: prior exam date | date |  | S4 Venous Ultrasound 2e Ch.10 p.183; S2 SVM/SVU Consensus 2020 p.15 |
| `prior_change` | Comparison result | select | No prior available, No significant change, New finding, Progression, Improvement/regression | S2 SVM/SVU Consensus 2020 p.15 |
| `interp_date` | Date of interpretation | date |  (required=True) | S4 Venous Ultrasound 2e Ch.10 p.183 |

## 3. Report layout (EMR 출력 순서)
EXAM → DATE → INDICATION → HISTORY → TECHNIQUE → COMPARISON → FINDINGS (Right, then Left) → IMPRESSION (numbered) → LIMITATIONS → Sonographer / Interpreting physician / Date of interpretation

- `exam`: EXAM: {exam_type} ({laterality}).
- `date`: DATE: {exam_date}
- `indication`: INDICATION: {indication}{indication_free_clause}.
- `history`: HISTORY: {history}
- `equipment`: EQUIPMENT: {equipment}, {probe} transducer.
- `comparison_none`: COMPARISON: None.
- `comparison`: COMPARISON: {prior_exam_date}.
- `limited`: LIMITATIONS: {limitation_reason}{limitation_free_clause}.
- `signature`: Sonographer: {sonographer}. Interpreting physician: {physician}. Interpreted: {interp_date}.

## 4. Lower extremity ARTERIAL duplex

### Indications (multiselect)
Claudication, Rest pain, Non-healing wound/ulcer, Gangrene/tissue loss, Absent/diminished pulses, Abnormal ABI, Cold extremity, Post-intervention surveillance (stent/bypass), Pulsatile mass/pseudoaneurysm, Other

### Segments (각 segment는 Rt/Lt 두 열로 입력)
| id | Segment | class/level | |
|---|---|---|---|
| `CIA` | common iliac artery |  | optional |
| `EIA` | external iliac artery |  | optional |
| `CFA` | common femoral artery |  | core |
| `DFA` | profunda femoris (deep femoral) artery, proximal |  | core |
| `SFA_P` | proximal superficial femoral artery |  | core |
| `SFA_M` | mid superficial femoral artery |  | core |
| `SFA_D` | distal superficial femoral artery |  | core |
| `POPA` | popliteal artery |  | core |
| `TPT` | tibioperoneal trunk |  | optional |
| `ATA` | anterior tibial artery |  | core |
| `PTA` | posterior tibial artery |  | core |
| `PERA` | peroneal artery |  | core |
| `DPA` | dorsalis pedis artery |  | optional |

### Per-segment fields (Rt/Lt)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `not_visualized` | Not visualized | checkbox |  |  |
| `psv` | PSV | number | cm/s | S1 Arterial Doppler Waveform Analysis p.8 (PSV most reliable indicator) |
| `edv` | EDV | number | cm/s (optional=True) | S1 Arterial Doppler Waveform Analysis p.9 |
| `flow_direction` | Flow direction | select | antegrade, retrograde, bi-directional, absent | S2 SVM/SVU Consensus 2020 Table 2 p.22 |
| `phasicity` | Phasicity | select | multiphasic, monophasic | S2 SVM/SVU Consensus 2020 Table 2 p.23 |
| `resistance` | Resistance | select | high, intermediate, low | S2 SVM/SVU Consensus 2020 Table 2 p.24 |
| `upstroke` | Upstroke | select | rapid, prolonged | S2 SVM/SVU Consensus 2020 Table 3 p.25 |
| `modifiers` | Modifiers | multiselect | sharp peak, spectral broadening, staccato, dampened, flow reversal | S2 SVM/SVU Consensus 2020 Table 3 p.25-26 |
| `at` | Acceleration time | number | ms (only_segments=['CFA']) | S2 SVM/SVU Consensus 2020 Table 3 p.25 |
| `plaque` | Plaque | select | none, present | S1 Arterial Doppler Waveform Analysis p.1 (detection only) |
| `plaque_char` | Plaque character | multiselect | calcified, non-calcified, mixed, acoustic shadowing (show_if=plaque==present) | ⚠ OUTSIDE SOURCE |
| `occluded` | Occlusion (no flow in imaged segment) | checkbox |  | S1 Arterial Doppler Waveform Analysis p.13; S2 SVM/SVU Consensus 2020 Table 2 |
| `occl_length` | Occlusion length | number | cm (show_if=occluded; optional=True) | ⚠ OUTSIDE SOURCE |
| `reconstitution` | Reconstitution at | select | CIA, EIA, CFA, DFA, SFA_P, SFA_M, SFA_D, POPA, TPT, ATA, PTA, PERA, DPA (show_if=occluded; optional=True) |  |
| `stent_graft` | Stent/bypass in segment | select | none, stent, bypass graft (optional=True) |  |

### Exam-level fields
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `abi_rt` | ABI Rt | number |  (show_if=config.abi.enabled) | S1 Arterial Doppler Waveform Analysis p.12/15 |
| `abi_lt` | ABI Lt | number |  (show_if=config.abi.enabled) | S1 Arterial Doppler Waveform Analysis p.12/15 |

### Focal stenosis (add one row per lesion) (repeatable rows)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `side` | Side | select | Rt, Lt |  |
| `segment` | Segment | select | CIA, EIA, CFA, DFA, SFA_P, SFA_M, SFA_D, POPA, TPT, ATA, PTA, PERA, DPA |  |
| `psv_lesion` | PSV at stenosis | number | cm/s |  |
| `psv_ref` | PSV in normal adjacent proximal segment | number | cm/s |  |
| `vr` | Velocity ratio (auto) | number |  (computed=psv_lesion/psv_ref, 1 decimal) |  |
| `grade` | Stenosis grade (auto, overridable) | select | <50%, 50-74%, >=75%, occlusion (computed=rule A2) |  |
| `length` | Lesion length | number | cm (optional=True) | ⚠ OUTSIDE SOURCE |

### Auto-interpretation rules
| Rule | IF | THEN | Source |
|---|---|---|---|
| A1 | segment.occluded OR segment.flow_direction=='absent' | segment.status='occluded' | S1 Arterial Doppler Waveform Analysis p.13; S2 SVM/SVU Consensus 2020 Table 2 p.22 |
| A2 | lesion.vr available | grade = bin(vr, config.arterial_grading_scheme) | S2 SVM/SVU Consensus 2020 Table 7 p.32 (default) / S1 Arterial Doppler Waveform Analysis p.13 |
| A3 | CFA.at > config.cfa_at_prolonged_ms OR CFA.upstroke=='prolonged' OR 'dampened' in CFA.modifiers | flag 'suggests proximal (aortoiliac) inflow disease' | S2 SVM/SVU Consensus 2020 Table 3 p.25; S1 Arterial Doppler Waveform Analysis p.13 |
| A4 | segment monophasic AND (upstroke=='prolonged' OR 'dampened') AND no lesion/occlusion recorded at that segment | flag 'consistent with more proximal flow-limiting disease' | S2 SVM/SVU Consensus 2020 Table 7 p.32-33; S2 SVM/SVU Consensus 2020 p.9 |
| A5 | segment.resistance=='intermediate' at rest | note 'may reflect vasodilation (exercise, warming, vasodilators) or severe distal obstruction' | S2 SVM/SVU Consensus 2020 Table 2 p.24 |
| A6 | bi-directional flow at neck of perivascular sac | suggest pseudoaneurysm | S2 SVM/SVU Consensus 2020 Table 7 p.33; S1 Arterial Doppler Waveform Analysis p.16 |
| A7 | config.abi.enabled | ABI class: >1.4 non-compressible; 0.9-1.4 normal; 0.5-0.89 PAD; <0.5 severe PAD | S1 Arterial Doppler Waveform Analysis p.12, p.15 |
| A8 | no occlusion, no lesion >= 50%, all visualized segments multiphasic with rapid upstroke | normal impression for that side | S2 SVM/SVU Consensus 2020 Table 6 p.30 |

### Report sentence templates (English, EMR output)
- `findings_segment`: {Side} {segment_name}: {flow_direction}, {phasicity}, {resistance} resistive waveform with {upstroke} upstroke{modifiers_clause}; PSV {psv} cm/s{plaque_clause}.
- `modifiers_clause`: , with {modifiers_phrase}
- `modifiers_phrase_map`: {"sharp peak": "a sharp peak", "spectral broadening": "spectral broadening", "staccato": "a staccato pattern", "dampened": "dampened morphology", "flow reversal": "flow reversal"}
- `plaque_clause`: ; {plaque_char} plaque present
- `cfa_at`: {Side} CFA acceleration time {at} ms.
- `lesion`: {Side} {segment_name}: focal stenosis with PSV {psv_lesion} cm/s (proximal reference {psv_ref} cm/s, velocity ratio {vr}), consistent with {grade} diameter stenosis.
- `occlusion`: {Side} {segment_name}: no flow detected, consistent with occlusion{length_clause}{reconst_clause}.
- `length_clause`:  (length approximately {occl_length} cm)
- `reconst_clause`: , with reconstitution at the {reconstitution}
- `not_visualized`: {Side} {segment_name} was not adequately visualized.
- `abi`: ABI: Rt {abi_rt}, Lt {abi_lt}.
- `imp_normal`: {Side} lower extremity: no hemodynamically significant arterial stenosis or occlusion. Multiphasic waveforms throughout the visualized arterial segments.
- `imp_lesion`: {Side} {segment_name}: {grade} diameter stenosis (velocity ratio {vr}).
- `imp_occlusion`: {Side} {segment_name} occlusion{reconst_clause}.
- `imp_inflow`: {Side} CFA waveform with prolonged upstroke suggests proximal (aortoiliac) inflow disease.
- `imp_distal_dampened`: {Side} dampened monophasic waveforms in the {segments} suggest more proximal flow-limiting disease.
- `imp_abi`: {Side} ABI {abi}: {abi_class}.
- `imp_comparison`: Compared with the prior study of {prior_exam_date}: {prior_change}.
- `abi_class_text`: {"noncompressible": "non-compressible vessels, ABI unreliable", "normal": "within normal range", "pad": "consistent with peripheral arterial disease", "severe": "consistent with severe peripheral arterial disease"}

## 5. Lower extremity VENOUS INSUFFICIENCY (reflux / varicose) duplex

### Indications (multiselect)
Visible varicose veins, Leg pain/heaviness/aching, Edema, Skin changes (pigmentation, lipodermatosclerosis), Venous ulcer (active/healed), Pre-procedural evaluation (ablation/surgery), Recurrent varicose veins after treatment, Post-ablation follow-up, Other

### Segments (각 segment는 Rt/Lt 두 열로 입력)
| id | Segment | class/level | |
|---|---|---|---|
| `CFV` | common femoral vein | deep_femoropopliteal | core |
| `SFJ` | saphenofemoral junction (terminal valve) | superficial | core |
| `GSV_PT` | great saphenous vein, proximal thigh | superficial | core |
| `GSV_MT` | great saphenous vein, mid thigh | superficial | core |
| `GSV_DT` | great saphenous vein, distal thigh | superficial | core |
| `GSV_K` | great saphenous vein, knee | superficial | core |
| `GSV_PC` | great saphenous vein, proximal calf | superficial | core |
| `GSV_MC` | great saphenous vein, mid calf | superficial | optional |
| `GSV_DC` | great saphenous vein, distal calf/ankle | superficial | optional |
| `AAGSV` | anterior accessory great saphenous vein | superficial | optional |
| `PAGSV` | posterior accessory great saphenous vein | superficial | optional |
| `FV_P` | proximal femoral vein | deep_femoropopliteal | core |
| `FV_D` | distal femoral vein | deep_femoropopliteal | optional |
| `DFV` | deep femoral vein, proximal | deep_other | optional |
| `POPV` | popliteal vein | deep_femoropopliteal | core |
| `SPJ` | saphenopopliteal junction | superficial | core |
| `SSV_P` | small saphenous vein, proximal | superficial | core |
| `SSV_M` | small saphenous vein, mid calf | superficial | core |
| `SSV_D` | small saphenous vein, distal calf | superficial | optional |
| `TE` | thigh extension / Giacomini vein | superficial | optional |
| `GCV` | gastrocnemius veins | deep_other | optional |
| `PTV` | posterior tibial veins | deep_other | optional |

### Per-segment fields (Rt/Lt)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `not_visualized` | Not visualized / absent | checkbox |  |  |
| `prior_treated` | Treated/ablated segment | checkbox |  |  |
| `patency` | Patency/compressibility | select | compressible, patent, non-compressible / thrombus, occluded post-ablation, not assessed | S4 Venous Ultrasound 2e Ch.10 p.183 |
| `diameter` | Diameter | number | mm (show_for=superficial) | S4 Venous Ultrasound 2e Ch.10 p.183 (GSV/SSV diameter required); S3 Radiology Key Venous Insufficiency p.3 Fig 21.1 |
| `depth` | Depth from skin | number | mm (show_for=superficial; optional=True) | S3 Radiology Key Venous Insufficiency p.3 Fig 21.1 |
| `extrafascial` | Exits saphenous fascia (epifascial) | checkbox |  (show_for=superficial; optional=True) | S3 Radiology Key Venous Insufficiency p.3 |
| `reflux_time` | Retrograde flow duration | number | s | S2 SVM/SVU Consensus 2020 Table 5 p.29 / Table 9 p.35 |
| `spontaneity` | Spontaneity | select | spontaneous, non-spontaneous (show_for=deep) | S2 SVM/SVU Consensus 2020 Table 4 p.28 |
| `flow_pattern` | Flow pattern | select | respirophasic, decreased, continuous, pulsatile, regurgitant (show_for=deep) | S2 SVM/SVU Consensus 2020 Table 4 p.27-28 |
| `augmentation` | Augmentation | select | normal, reduced, absent (show_for=deep) | S2 SVM/SVU Consensus 2020 Table 5 p.29 |

### Exam-level fields
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `maneuver_method` | Reflux provocation | select | Valsalva, Manual distal compression-release, Pneumatic cuff (rapid inflation-deflation), Active dorsiflexion | S2 SVM/SVU Consensus 2020 Table 5 p.29; S3 Radiology Key Venous Insufficiency p.12 (cuff recommended) |
| `reflux_position` | Position for reflux testing | select | Standing, Reverse Trendelenburg, Sitting, Supine | S4 Venous Ultrasound 2e Ch.10 p.182; S3 Radiology Key Venous Insufficiency p.12 |
| `gsv_pattern` | GSV tributary pattern | select | type i, type h, type s | S3 Radiology Key Venous Insufficiency p.4 |
| `spj_pattern` | SPJ termination pattern | select | A1: SPJ, GCV separate, A2: GCV joins SSV, B: small SPJ, main outflow TE/GV, C: no SPJ, continues as TE/GV, SSV absent/not identified | S3 Radiology Key Venous Insufficiency pp.9-10 |
| `spj_height` | SPJ level above popliteal crease | number | cm | S3 Radiology Key Venous Insufficiency p.9 (usually within 5 cm) |
| `junction_tributary_reflux` | Reflux in SFJ tributaries (SIEV/SCIV/pudendal) with competent terminal valve | checkbox |  | S3 Radiology Key Venous Insufficiency p.5 |
| `ceap_c` | CEAP 2020 clinical classes present (check all) | multiselect | C0, C1, C2, C2r, C3, C4a, C4b, C4c, C5, C6, C6r (show_if=config.ceap_enabled) | ⚠ OUTSIDE SOURCE (CEAP 2020 Table III) |
| `ceap_sa` | CEAP symptoms modifier | select | s (symptomatic), a (asymptomatic) (show_if=config.ceap_enabled; required=True) | ⚠ OUTSIDE SOURCE (CEAP 2020) |
| `ceap_e` | CEAP etiology | select | Ep, Es, Esi, Ese, Ec, En (show_if=config.ceap_enabled) | ⚠ OUTSIDE SOURCE (CEAP 2020 Table IV) |
| `ceap_a_override` | CEAP A override (blank = auto) | text |  (show_if=config.ceap_enabled) |  |
| `ceap_p_override` | CEAP P override (blank = auto) | text |  (show_if=config.ceap_enabled) |  |
| `ceap_pseg_override` | CEAP advanced P segments override (blank = auto) | text |  (show_if=config.ceap_enabled) |  |

### Perforators (one row each) (repeatable rows)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `side` | Side | select | Rt, Lt |  |
| `group` | Group | select | thigh - medial, thigh - anterior, thigh - lateral, thigh - posterior, knee, calf - medial (paratibial), calf - medial (posterior tibial), calf - anterior, calf - lateral, calf - posterior (gastrocnemius/soleal/para-Achillean) | S3 Radiology Key Venous Insufficiency p.10 |
| `distance` | Distance from heel/medial malleolus or knee crease | number | cm | ⚠ OUTSIDE SOURCE |
| `diameter` | Diameter at fascia | number | mm | ⚠ OUTSIDE SOURCE |
| `outflow_time` | Outward flow duration | number | s | ⚠ OUTSIDE SOURCE |
| `connects` | Connects to | select | GSV, GSV tributary, posterior arch vein, SSV, SSV tributary, varicosity | S3 Radiology Key Venous Insufficiency p.8, p.10 |
| `near_ulcer` | Beneath active/healed ulcer | checkbox |  | ⚠ OUTSIDE SOURCE |

### Varicosities / refluxing tributaries (repeatable rows)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `side` | Side | select | Rt, Lt |  |
| `location` | Location | select | medial thigh, anterior thigh, lateral thigh, posterior thigh, medial calf, anterior calf, lateral calf, posterior calf, ankle/foot, suprapubic/vulvar |  |
| `diameter` | Max diameter | number | mm (optional=True) | S3 Radiology Key Venous Insufficiency p.12 (most >4 mm) |
| `source` | Source/feeder | select | GSV, AAGSV, PAGSV, SSV, TE/Giacomini, perforator, pelvic/vulvar, unknown | S4 Venous Ultrasound 2e Ch.10 p.183 (source of reflux must be documented) |

### Auto-interpretation rules
| Rule | IF | THEN | Source |
|---|---|---|---|
| V1 | segment.reflux_time > config.reflux_threshold_s[segment.reflux_class] | segment.reflux=true | ⚠ thresholds: see config (superficial 0.5 s partly S3 p.12; deep/perforator OUTSIDE SOURCE) |
| V2 | SFJ.reflux AND any GSV reflux | 'SFJ incompetence with GSV reflux extending from the SFJ to the {most distal contiguous refluxing GSV level}' | S3 Radiology Key Venous Insufficiency p.12-13 |
| V3 | GSV reflux present AND SFJ competent | 'segmental GSV reflux ({levels}) with competent SFJ'; prompt user to identify source (perforator/tributary) | S3 Radiology Key Venous Insufficiency p.12-13 (segmental reflux; perforator at upper end); S4 Venous Ultrasound 2e Ch.10 p.183 |
| V4 | SFJ competent AND junction_tributary_reflux | 'reflux arising from SFJ tributaries with competent terminal valve' | S3 Radiology Key Venous Insufficiency p.5 |
| V5 | SPJ.reflux AND SSV reflux | 'SPJ incompetence with SSV reflux to {level}'; segmental SSV reflux analogous to V3 | S3 Radiology Key Venous Insufficiency p.9, p.12-13 |
| V6 | perforator.outflow_time >= config.reflux_threshold_s.perforator AND perforator.diameter >= config.pathologic_perforator_diameter_mm | perforator='incompetent (pathologic)'; if only one criterion -> 'incompetent' without 'pathologic' | ⚠ OUTSIDE SOURCE |
| V7 | any deep segment reflux | 'deep venous reflux in the {segments}' | ⚠ threshold OUTSIDE SOURCE; definition S2 SVM/SVU Consensus 2020 Table 5 |
| V8 | CFV.flow_pattern=='continuous' (or non-spontaneous / reduced augmentation) | 'continuous CFV flow suggests more central (iliocaval) venous obstruction or extrinsic compression; further evaluation recommended' | S2 SVM/SVU Consensus 2020 Table 9 p.35; S2 SVM/SVU Consensus 2020 p.11 |
| V9 | CFV.flow_pattern=='pulsatile' (esp. bilateral) | 'pulsatile CFV flow, may reflect elevated central venous pressure (e.g., heart failure, tricuspid regurgitation, pulmonary hypertension)' | S2 SVM/SVU Consensus 2020 Table 9 p.35 |
| V10 | any DEEP segment patency=='non-compressible / thrombus' | 'non-compressible {segments}, suspicious for deep vein thrombus; dedicated DVT evaluation recommended' | S4 Venous Ultrasound 2e Ch.10 p.183 |
| V10b | any SUPERFICIAL segment non-compressible | 'non-compressible {segments}, suspicious for superficial vein thrombosis' - no DVT wording (user decision 2026-11-14: DVT-equivalence left to clinical judgment) | user decision |
| V11 | varicosities present AND no source identified | block 'complete study' status; prompt 'source of reflux not identified' | S4 Venous Ultrasound 2e Ch.10 p.183 |
| V12 | laterality unilateral AND contralateral CFV not entered | validation warning | S4 Venous Ultrasound 2e Ch.10 p.183 |
| V13 | config.ceap_enabled AND ceap_c selected (per limb) | basic = highest C by config.ceap.c_rank (local decision: C4b > C4c > C4a) + ',{s|a}'; advanced = 'C' + all selected classes in config.ceap.c_display_order (Table III order) joined by ',', leading C dropped after the first, + ',{s|a}' | ⚠ OUTSIDE SOURCE (CEAP 2020: basic = single highest C; advanced = all C present) |
| V14 | auto A | As if any superficial reflux/thrombus (SFJ, GSV, AAGSV, PAGSV, TE, SPJ, SSV, SFJ tributaries); Ad if deep reflux or deep non-compressible; Ap if incompetent perforator; none -> An. Ordered s,d,p | ⚠ OUTSIDE SOURCE (CEAP 2020) |
| V15 | auto P | Pr if any reflux; Po if any non-compressible (thrombus/post-thrombotic) segment; both -> Pr,o; none -> Pn. Advanced: 'Pr {segment abbreviations}; Po {segment abbreviations}' via config.ceap.segment_map. Treated/ablated segments excluded. Continuous CFV flow does NOT auto-add Po (warning only). | ⚠ OUTSIDE SOURCE (CEAP 2020) |
| V16 | ceap_a/p/pseg override non-blank | override replaces the auto value (prefix A/P added if missing) | user requirement |
| V17 | warnings | C not selected; s/a not selected; C0 with other classes; C2+C2r or C6+C6r both selected; deep thrombus with Ep (consider Esi); central CFV pattern without Po | ⚠ OUTSIDE SOURCE (CEAP 2020 definitions) |

### Report sentence templates (English, EMR output)
- `technique`: Duplex ultrasound of the {laterality_lc} lower extremity venous system was performed in the {reflux_position_lc} position. Reflux was assessed using {maneuver_method_lc}. Reflux criteria: superficial and perforator veins > {thr_sup} s, femoral/popliteal veins > {thr_deep} s.
- `deep_normal`: {Side}: The deep veins (CFV, FV, POPV) are compressible and patent with spontaneous respirophasic flow and no deep venous reflux.
- `deep_seg`: {Side} {segment_name}: {patency}; {spontaneity}, {flow_pattern} flow; augmentation {augmentation}; {reflux_text}.
- `reflux_text_pos`: reflux present ({reflux_time} s)
- `reflux_text_neg`: no reflux
- `sup_seg`: {Side} {segment_name}: diameter {diameter} mm; {reflux_text}.
- `perforator`: {Side} {group} perforator at {distance} cm, diameter {diameter} mm, outward flow {outflow_time} s, connecting to the {connects}: {perf_status}.
- `varicosity`: {Side} varicosities in the {location} (up to {diameter} mm), fed by the {source}.
- `imp_sfj_gsv`: {Side}: SFJ incompetence with GSV reflux from the SFJ to the {distal_level} (GSV diameter {dmin}-{dmax} mm).
- `imp_segmental_gsv`: {Side}: Segmental GSV reflux at the {levels} with a competent SFJ{source_clause}.
- `imp_tributary`: {Side}: Reflux in SFJ tributaries with a competent terminal valve.
- `imp_spj_ssv`: {Side}: SPJ incompetence with SSV reflux to the {distal_level} (SSV diameter {dmax} mm).
- `imp_aagsv`: {Side}: AAGSV reflux.
- `imp_perf`: {Side}: Incompetent {group} perforator ({diameter} mm, {outflow_time} s).
- `imp_deep`: {Side}: Deep venous reflux in the {segments}.
- `imp_no_deep`: {Side}: No deep venous reflux. No evidence of deep vein thrombosis.
- `imp_normal`: {Side}: No significant superficial or deep venous reflux.
- `imp_central`: {Side}: Continuous CFV flow suggests more central (iliocaval) venous obstruction or extrinsic compression; further evaluation of the iliac veins/IVC is recommended.
- `imp_pulsatile`: Pulsatile CFV waveforms may reflect elevated central venous pressure; correlate with cardiac status.
- `imp_source_unknown`: Source of reflux for the {location} varicosities was not identified.
- `imp_ceap`: {Side} CEAP 2020: {C_highest},{sa} {E} {A} {P} (advanced: C{C_all},{sa} {E} {A} {P_segments}).
- `imp_ceap_example`: Right CEAP 2020: C4a,s Ep As,p Pr (advanced: C2,3,4a,s Ep As,p Pr GSVa, GSVb, SSV, CPV).
- `imp_sup_thrombus`: {Side} non-compressible {segments}, suspicious for superficial vein thrombosis.

## 6. Lower extremity DVT duplex

### Indications (multiselect)
Leg swelling, Leg pain/tenderness, Suspected DVT, Suspected pulmonary embolism, Elevated D-dimer, Follow-up of known DVT, End of anticoagulation: residual thrombosis, Pre-operative/high-risk screening, Other

### Segments (각 segment는 Rt/Lt 두 열로 입력)
| id | Segment | class/level | |
|---|---|---|---|
| `EIV` | external iliac vein | proximal | optional |
| `CFV` | common femoral vein | proximal | core |
| `SFJ_GSV` | saphenofemoral junction / proximal GSV | superficial | core |
| `DFV` | deep femoral vein, proximal | proximal | core |
| `FV_P` | proximal femoral vein | proximal | core |
| `FV_M` | mid femoral vein | proximal | core |
| `FV_D` | distal femoral vein | proximal | core |
| `POPV` | popliteal vein | proximal | core |
| `PTV` | posterior tibial veins | distal | core |
| `PERV` | peroneal veins | distal | core |
| `GCV` | gastrocnemius veins | distal | optional |
| `SOV` | soleal veins | distal | optional |
| `GSV` | great saphenous vein | superficial | optional |
| `SSV` | small saphenous vein | superficial | optional |

### Per-segment fields (Rt/Lt)
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `not_visualized` | Not visualized | checkbox |  |  |
| `compressibility` | Compressibility | select | fully compressible, partially compressible, non-compressible, not assessed | ⚠ OUTSIDE SOURCE (documentation of 'compressible' required: S4 Venous Ultrasound 2e Ch.10 p.183) |
| `thrombus` | Intraluminal thrombus | select | none, non-occlusive, occlusive | ⚠ S4 Venous Ultrasound 2e Ch.10 p.183 (presence); occlusive/non-occlusive: OUTSIDE SOURCE |
| `echogenicity` | Thrombus echogenicity | select | anechoic/hypoechoic, mixed, hyperechoic (show_if=thrombus!=none) | ⚠ OUTSIDE SOURCE |
| `vein_size` | Vein size (vs adjacent artery) | select | distended, normal, contracted/small (show_if=thrombus!=none) | ⚠ OUTSIDE SOURCE |
| `thrombus_features` | Thrombus features | multiselect | free-floating tail, smooth margins, wall thickening, synechiae/webs, recanalization channels, collateral veins, irregular/calcified (show_if=thrombus!=none) | ⚠ OUTSIDE SOURCE |
| `color_flow` | Color flow | select | complete filling, partial filling/defect, absent | S3 Radiology Key Venous Insufficiency p.1 |
| `spontaneity` | Spontaneity | select | spontaneous, non-spontaneous (show_for=['EIV', 'CFV', 'FV_P', 'POPV']) | S2 SVM/SVU Consensus 2020 Table 4 p.28 |
| `flow_pattern` | Flow pattern | select | respirophasic, decreased, continuous, pulsatile, regurgitant (show_for=['EIV', 'CFV', 'POPV']) | S2 SVM/SVU Consensus 2020 Table 4 p.27-28 |
| `augmentation` | Augmentation | select | normal, reduced, absent (show_for=['CFV', 'FV_P', 'POPV']) | S2 SVM/SVU Consensus 2020 Table 5 p.29 |
| `thrombus_ext` | Distance of thrombus apex from SFJ/SPJ | number | cm (show_for=['GSV', 'SSV']) | ⚠ OUTSIDE SOURCE |

### Exam-level fields
| id | Label | Type | Unit / Options | Source |
|---|---|---|---|---|
| `other_findings` | Other findings | multiselect | Baker's cyst, Hematoma, Lymphadenopathy, Soft tissue edema, Superficial thrombophlebitis, Muscle tear, None | ⚠ OUTSIDE SOURCE |
| `other_free` | Other findings (free text) | text |  |  |

### Auto-interpretation rules
| Rule | IF | THEN | Source |
|---|---|---|---|
| D1 | compressibility in [partially, non-compressible] OR thrombus != none | segment.dvt=true | ⚠ OUTSIDE SOURCE (compressibility criterion; e.g., SRU 2018) |
| D2 | dvt segment level | classify: proximal DVT (POPV and above) / distal (calf) DVT / superficial vein thrombosis | ⚠ OUTSIDE SOURCE |
| D3 | thrombus features | acute if majority of [hypoechoic, distended, free-floating tail, smooth] and none of [wall thickening, synechiae, recanalization, collaterals, contracted]; chronic/post-thrombotic if majority of the latter; else 'indeterminate age' | ⚠ OUTSIDE SOURCE |
| D4 | 'free-floating tail' in features | add 'free-floating thrombus tail' to impression | ⚠ OUTSIDE SOURCE |
| D5 | CFV/EIV flow_pattern=='continuous' OR spontaneity=='non-spontaneous' with no thrombus at/below sample site to explain | 'suggests more central (iliocaval) obstruction or extrinsic compression; consider iliac vein/IVC imaging' | S2 SVM/SVU Consensus 2020 Table 9 p.35; S2 SVM/SVU Consensus 2020 p.11 |
| D6 | augmentation reduced/absent compared with contralateral | 'reduced augmentation suggests obstruction between the sampling site and the compression site' | ⚠ definition S2 SVM/SVU Consensus 2020 Table 5 p.29; interpretation OUTSIDE SOURCE |
| D7 | CFV pulsatile (esp. bilateral) | 'pulsatile venous flow may reflect elevated central venous pressure' | S2 SVM/SVU Consensus 2020 Table 9 p.35 |
| D8 | laterality unilateral AND contralateral CFV not entered | validation warning | S4 Venous Ultrasound 2e Ch.10 p.183 |
| D9 | GSV/SSV thrombus | superficial vein thrombosis; report distance to SFJ/SPJ | ⚠ OUTSIDE SOURCE |
| D10 | prior exam AND dvt | compare: new / extension / unchanged / partial recanalization / resolved | S4 Venous Ultrasound 2e Ch.10 p.183; S2 SVM/SVU Consensus 2020 p.15 |

### Report sentence templates (English, EMR output)
- `technique`: Duplex ultrasound with compression and color/spectral Doppler of the {laterality_lc} lower extremity deep veins{calf_clause}.
- `calf_clause`: , including the calf veins
- `seg_normal_group`: {Side}: The {segment_list} are fully compressible with normal color filling.
- `cfv_flow`: {Side} CFV: {spontaneity}, {flow_pattern} flow with {augmentation} augmentation.
- `seg_dvt`: {Side} {segment_name}: {compressibility}, with {thrombus} {echogenicity} thrombus{features_clause}; {color_flow} color flow.
- `features_clause`:  ({thrombus_features})
- `imp_negative`: {Side}: No evidence of deep vein thrombosis.
- `imp_dvt`: {Side}: {age} {occlusion} deep vein thrombosis involving the {segment_list} ({level} DVT){tail_clause}.
- `tail_clause`: , with a free-floating thrombus tail
- `imp_svt`: {Side} superficial vein thrombosis of the {segment_name}, thrombus apex {thrombus_ext} cm from the {saphenofemoral|saphenopopliteal} junction.
- `imp_svt_policy`: No DVT-equivalence statement is generated for superficial vein thrombosis; distance to SFJ/SPJ is recorded only and management is left to clinical judgment (user decision 2026-11-14). Warning if distance not entered.
- `imp_central`: {Side}: Continuous/non-spontaneous CFV flow suggests more central (iliocaval) venous obstruction or extrinsic compression; consider iliac vein/IVC imaging.
- `imp_pulsatile`: Pulsatile CFV waveforms may reflect elevated central venous pressure.
- `imp_contralateral`: Contralateral ({Side}) CFV: compressible with {flow_pattern} flow.
- `imp_comparison`: Compared with the prior study of {prior_exam_date}: {prior_change}.
- `imp_other`: Incidental: {other_findings}.
- `imp_limited`: Limited study: {limitation_reason}{limitation_free_clause}. {not_visualized_segments} not adequately visualized.

## 7. Configurable thresholds (`config`)
```json
{
 "arterial_grading_scheme": {
  "value": "S2",
  "decision": "User decision 2026-11-14: SVM/SVU 3-tier",
  "options": {
   "S2": {
    "source": "S2 Table 7 p.32",
    "bins": [
     {
      "max_lt": 2.0,
      "grade": "<50%"
     },
     {
      "max_lt": 4.0,
      "grade": "50-74%"
     },
     {
      "max_lt": null,
      "grade": ">=75%"
     }
    ]
   },
   "S1": {
    "source": "S1 p.13",
    "bins": [
     {
      "max_lt": 1.5,
      "grade": "no significant stenosis"
     },
     {
      "max_lt": 2.0,
      "grade": "25-49%"
     },
     {
      "max_lt": 4.0,
      "grade": "50-75%"
     },
     {
      "max_lt": null,
      "grade": ">75%"
     }
    ]
   }
  },
  "note": "Boundary: S2 writes '>2' and '>4'; spec treats VR=2.0 as 50-74% and VR=4.0 as >=75% (user to confirm)."
 },
 "cfa_at_prolonged_ms": {
  "value": 140,
  "source": "S2 Table 3 p.25; S1 p.13"
 },
 "abi": {
  "enabled": true,
  "decision": "User decision 2026-11-14: ON, normal 0.9-1.4",
  "normal_low": {
   "value": 0.9,
   "alt": 1.0,
   "source": "S1 p.12 (0.9) adopted; S1 p.15 states 1.0"
  },
  "noncompressible_gt": 1.4,
  "severe_lt": 0.5,
  "source": "S1 p.12, p.15"
 },
 "reflux_threshold_s": {
  "decision": "User decision 2026-11-14: superficial & perforator >0.5 s, femoral/popliteal >1.0 s; pathologic perforator >=3.5 mm & >=0.5 s",
  "superficial": {
   "value": 0.5,
   "source": "S3 p.12 (normal saphenous valve closure <0.5 s standing); cutoff as reflux criterion: OUTSIDE SOURCE (Labropoulos 2003; SVS/AVF 2011)"
  },
  "deep_femoropopliteal": {
   "value": 1.0,
   "source": "OUTSIDE SOURCE (Labropoulos 2003; SVS/AVF 2011; ESVS 2022)"
  },
  "deep_other": {
   "value": 0.5,
   "source": "OUTSIDE SOURCE"
  },
  "perforator": {
   "value": 0.5,
   "source": "OUTSIDE SOURCE (SVS/AVF 2011)"
  }
 },
 "pathologic_perforator_diameter_mm": {
  "value": 3.5,
  "source": "OUTSIDE SOURCE (SVS/AVF 2011)"
 },
 "dvt_include_calf_veins": {
  "value": true,
  "decision": "User decision 2026-11-14: whole-leg incl. calf veins",
  "source": "OUTSIDE SOURCE"
 },
 "dvt_criteria": {
  "value": "external",
  "decision": "User decision 2026-11-14: compressibility and acute/chronic criteria adopted from external guidelines",
  "source": "OUTSIDE SOURCE (Needleman L et al. SRU consensus, J Ultrasound Med 2018;37:1597-1608)"
 },
 "ceap_enabled": {
  "value": true,
  "decision": "User decision 2026-11-14: ON, CEAP 2020 revision",
  "source": "OUTSIDE SOURCE (CEAP 2020: Lurie F, et al. The 2020 update of the CEAP classification system and reporting standards. J Vasc Surg Venous Lymphat Disord 2020;8:342-352. doi:10.1016/j.jvsv.2019.12.075)"
 },
 "ceap": {
  "source": "OUTSIDE SOURCE (Lurie F, et al. The 2020 update of the CEAP classification system and reporting standards. J Vasc Surg Venous Lymphat Disord 2020;8:342-352. doi:10.1016/j.jvsv.2019.12.075)",
  "decision": "User decision 2026-11-14: record per CEAP 2020; all C classes present are checked (advanced CEAP) and the single highest C is also reported (basic CEAP).",
  "output_format": {
   "value": "both",
   "options": [
    "both",
    "basic",
    "advanced"
   ],
   "note": "both = '{basic} (advanced: {advanced})'; advanced omitted when identical to basic"
  },
  "c_display_order": {
   "value": [
    "C0",
    "C1",
    "C2",
    "C2r",
    "C3",
    "C4a",
    "C4b",
    "C4c",
    "C5",
    "C6",
    "C6r"
   ],
   "source": "OUTSIDE SOURCE (CEAP 2020 Table III order)",
   "note": "order of classes in the advanced C list"
  },
  "c_rank": {
   "value": [
    "C0",
    "C1",
    "C2",
    "C2r",
    "C3",
    "C4a",
    "C4c",
    "C4b",
    "C5",
    "C6",
    "C6r"
   ],
   "decision": "LOCAL CLINICAL DECISION (user, 2026-11-14): C4b > C4c > C4a for the basic 'highest C'",
   "note": "Not defined by the paper (Table III listing order is stated not to be a severity scale; C4 subclasses unranked)."
  },
  "c_classes": {
   "C0": "No visible or palpable signs of venous disease",
   "C1": "Telangiectasias or reticular veins",
   "C2": "Varicose veins",
   "C2r": "Recurrent varicose veins",
   "C3": "Edema",
   "C4a": "Pigmentation or eczema",
   "C4b": "Lipodermatosclerosis or atrophie blanche",
   "C4c": "Corona phlebectatica",
   "C5": "Healed venous ulcer",
   "C6": "Active venous ulcer",
   "C6r": "Recurrent active venous ulcer"
  },
  "c_modifier": {
   "s": "symptomatic",
   "a": "asymptomatic",
   "note": "subscript to the clinical class (Table III footnote); written as ',s' / ',a' after the C list, e.g. C2,4a,s"
  },
  "e_classes": {
   "Ep": "Primary",
   "Es": "Secondary",
   "Esi": "Secondary - intravenous",
   "Ese": "Secondary - extravenous",
   "Ec": "Congenital",
   "En": "No cause identified"
  },
  "a_classes": {
   "As": "Superficial",
   "Ad": "Deep",
   "Ap": "Perforator",
   "An": "No venous anatomic location identified",
   "order": "s,d,p (combined e.g. As,p)"
  },
  "p_classes": {
   "Pr": "Reflux",
   "Po": "Obstruction",
   "Pr,o": "Reflux and obstruction",
   "Pn": "No pathophysiology identified",
   "advanced": "Table V anatomic abbreviations listed under each P class, e.g. 'Pr GSVa, GSVb, CPV'; when both: 'Pr ...; Po ...' (separator not specified in paper - local convention)"
  },
  "segment_map": {
   "value": {
    "SFJ": "GSVa",
    "GSV_prox_thigh": "GSVa",
    "GSV_mid_thigh": "GSVa",
    "GSV_distal_thigh": "GSVa",
    "GSV_knee": "GSVa",
    "GSV_prox_calf": "GSVb",
    "GSV_mid_calf": "GSVb",
    "GSV_distal_calf": "GSVb",
    "AAGSV": "AASV",
    "PAGSV": "NSV",
    "TE_Giacomini": "NSV",
    "SFJ_tributaries": "NSV",
    "SPJ": "SSV",
    "SSV_*": "SSV",
    "CFV": "CFV",
    "FV_*": "FV",
    "DFV": "DFV",
    "POPV": "POPV",
    "gastrocnemius": "GAV",
    "PTV": "PTV",
    "perforator thigh*": "TPV",
    "perforator knee": "TPV",
    "perforator calf*": "CPV"
   },
   "note": "Table V abbreviations. GSV at knee level and knee perforators are not defined by the paper - mapped to GSVa/TPV by default (configurable). PAGSV and Giacomini are not listed - mapped to NSV."
  }
 }
}
```

## 8. Example generated reports (render_example.py 출력, 가상 입력)
```text
=== ARTERIAL ===
EXAM: Lower extremity arterial duplex (Bilateral).
DATE: 2026-11-14
INDICATION: Claudication.
EQUIPMENT: [system], L12-3 linear transducer.
COMPARISON: None.
FINDINGS:
Right common femoral artery: antegrade, multiphasic, high resistive waveform with rapid upstroke, with a sharp peak; PSV 110 cm/s.
Right mid superficial femoral artery: antegrade, multiphasic, high resistive waveform with rapid upstroke; PSV 95 cm/s; calcified plaque present.
Right popliteal artery: antegrade, monophasic, low resistive waveform with prolonged upstroke, with dampened morphology; PSV 40 cm/s.
Right distal superficial femoral artery: focal stenosis with PSV 380 cm/s (proximal reference 90 cm/s, velocity ratio 4.2), consistent with >=75% diameter stenosis.
Left common femoral artery: antegrade, multiphasic, high resistive waveform with rapid upstroke; PSV 105 cm/s.
Left popliteal artery: antegrade, multiphasic, high resistive waveform with rapid upstroke; PSV 70 cm/s.
IMPRESSION:
1. Right distal superficial femoral artery: >=75% diameter stenosis (velocity ratio 4.2).
2. Right dampened monophasic waveforms in the popliteal artery are consistent with the above flow-limiting disease.
3. Left lower extremity: no hemodynamically significant arterial stenosis or occlusion. Multiphasic waveforms throughout the visualized arterial segments.
Sonographer: [RVT]. Interpreting physician: [MD]. Interpreted: 2026-11-14.

=== VENOUS INSUFFICIENCY ===
EXAM: Lower extremity venous insufficiency (reflux) duplex (Right).
DATE: 2026-11-14
INDICATION: Visible varicose veins, Leg pain/heaviness/aching.
EQUIPMENT: [system], L12-3 linear transducer.
COMPARISON: None.
TECHNIQUE: Duplex ultrasound of the right lower extremity venous system was performed in the standing position. Reflux was assessed using manual distal compression-release and Valsalva. Reflux criteria: superficial and perforator veins > 0.5 s, femoral/popliteal veins > 1.0 s.
FINDINGS:
Right common femoral vein: compressible, patent; spontaneous, respirophasic flow; augmentation normal; no reflux.
Right saphenofemoral junction (terminal valve): reflux present (2.1 s).
Right great saphenous vein, proximal thigh: diameter 7.2 mm; reflux present (2.5 s).
Right great saphenous vein, mid thigh: diameter 6.1 mm; reflux present (2.2 s).
Right great saphenous vein, distal thigh: diameter 5.4 mm; reflux present (1.8 s).
Right great saphenous vein, knee: diameter 4.2 mm; no reflux.
Right proximal femoral vein: compressible, patent; spontaneous, respirophasic flow; augmentation normal; no reflux.
Right popliteal vein: compressible, patent; spontaneous, respirophasic flow; augmentation normal; no reflux.
Right saphenopopliteal junction: no reflux.
Right small saphenous vein, proximal: diameter 3.2 mm; no reflux.
Right calf - medial (posterior tibial) perforator at 12 cm, diameter 4.0 mm, outward flow 0.9 s, connecting to the posterior arch vein: incompetent (pathologic).
Right varicosities in the medial calf (up to 6 mm), fed by the GSV.
IMPRESSION:
1. Right: SFJ incompetence with GSV reflux from the SFJ to the distal thigh (GSV diameter 5.4-7.2 mm).
2. Right: Incompetent (pathologic) calf - medial (posterior tibial) perforator (4.0 mm, 0.9 s).
3. Right: No deep venous reflux. No evidence of deep vein thrombosis.
Sonographer: [RVT]. Interpreting physician: [MD]. Interpreted: 2026-11-14.

=== DVT ===
EXAM: Lower extremity venous duplex for DVT (Left).
DATE: 2026-11-14
INDICATION: Leg swelling, Elevated D-dimer.
EQUIPMENT: [system], L12-3 linear transducer.
COMPARISON: None.
TECHNIQUE: Duplex ultrasound with compression and color/spectral Doppler of the left lower extremity deep veins, including the calf veins.
FINDINGS:
Right CFV: spontaneous, respirophasic flow with normal augmentation.
Right: The common femoral vein is fully compressible with normal color filling.
Left CFV: spontaneous, respirophasic flow with reduced augmentation.
Left distal femoral vein: non-compressible, with occlusive anechoic/hypoechoic thrombus (smooth margins); absent color flow.
Left popliteal vein: non-compressible, with occlusive anechoic/hypoechoic thrombus; absent color flow.
Left: The common femoral vein, posterior tibial veins are fully compressible with normal color filling.
IMPRESSION:
1. Left: Acute occlusive deep vein thrombosis involving the distal femoral vein, popliteal vein (proximal DVT).
2. Contralateral (Right) CFV: compressible with respirophasic flow.
Sonographer: [RVT]. Interpreting physician: [MD]. Interpreted: 2026-11-14.
```

## 9. CEAP 2020 / SVT examples (웹페이지 index.html 실제 출력, 가상 입력)
```text
=== DVT: Rt GSV SVT ===
EXAM: Lower extremity venous duplex ultrasound for deep vein thrombosis, bilateral.
DATE OF EXAM: 2026-11-14
INDICATION: [indication].
TECHNIQUE: Compression B-mode, color and spectral Doppler evaluation of the bilateral lower extremity deep veins from the common femoral vein through the calf veins, in the supine position. Equipment: TestSys, L12-3 transducer.
COMPARISON: None.

FINDINGS:
Right common femoral vein: spontaneous, respirophasic flow with normal augmentation.
Right great saphenous vein: non-compressible, with occlusive intraluminal thrombus; color filling preserved; thrombus apex 4 cm from the saphenofemoral junction.
Right common femoral vein, saphenofemoral junction/proximal great saphenous vein, deep femoral vein, proximal femoral vein, mid femoral vein, distal femoral vein, popliteal vein, posterior tibial veins, peroneal veins, gastrocnemius veins, and soleal veins: fully compressible with normal color filling; no intraluminal thrombus.
Left common femoral vein: spontaneous, respirophasic flow with normal augmentation.
Left common femoral vein, saphenofemoral junction/proximal great saphenous vein, deep femoral vein, proximal femoral vein, mid femoral vein, distal femoral vein, popliteal vein, posterior tibial veins, peroneal veins, gastrocnemius veins, and soleal veins: fully compressible with normal color filling; no intraluminal thrombus.

IMPRESSION:
1. Right superficial vein thrombosis of the great saphenous vein, thrombus apex 4 cm from the saphenofemoral junction.
2. Right no evidence of deep vein thrombosis from the common femoral vein through the calf veins.
3. Left no evidence of deep vein thrombosis from the common femoral vein through the calf veins.

Sonographer: [ ]   Interpreting physician: Dr. X   Date of interpretation: 2026-11-14

=== VENOUS: CEAP full ===
EXAM: Lower extremity venous insufficiency (reflux) duplex ultrasound, right.
DATE OF EXAM: 2026-11-14
INDICATION: [indication].
TECHNIQUE: Duplex ultrasound of the right lower extremity deep and superficial veins in the standing position. Reflux provoked with manual distal compression-release and Valsalva. Reflux criteria: superficial and perforator veins >0.5 s; common femoral, femoral and popliteal veins >1 s. Equipment: TestSys, L12-3 transducer.
COMPARISON: None.

FINDINGS:
Right saphenofemoral junction: reflux present (2 s).
Right GSV, proximal thigh: diameter 6 mm; reflux present (2 s).
Right GSV, mid thigh: diameter 6 mm; reflux present (2 s).
Right GSV, distal thigh: diameter 6 mm; reflux present (2 s).
Right GSV, knee: diameter 6 mm; reflux present (2 s).
Right GSV, proximal calf: diameter 6 mm; reflux present (2 s).
Right saphenopopliteal junction: reflux present (1 s).
Right SSV, proximal: diameter 4 mm; reflux present (1.5 s).
Right common femoral vein, proximal femoral vein, and popliteal vein: compressible with spontaneous, respirophasic flow and normal augmentation; no reflux.
Right SSV, mid calf: compressible; no reflux.
Right calf medial posterior tibial perforator at 10 cm from the heel: diameter 4 mm, outward flow 1 s; incompetent (pathologic).
Contralateral left common femoral vein: compressible; spontaneous, respirophasic flow.

IMPRESSION:
1. Right saphenofemoral junction incompetence with great saphenous vein reflux from the SFJ to the proximal calf (GSV diameter 6-6 mm).
2. Right saphenopopliteal junction incompetence with small saphenous vein reflux to the proximal calf (SSV diameter up to 4 mm).
3. Right incompetent (pathologic) calf medial posterior tibial perforator (4 mm, 1 s).
4. Right no deep venous reflux; deep veins compressible.
5. Right CEAP 2020: C4a,s Ep As,p Pr (advanced: C2,3,4a,s Ep As,p Pr GSVa, GSVb, SSV, CPV).

Sonographer: [ ]   Interpreting physician: Dr. X   Date of interpretation: 2026-11-14
```
