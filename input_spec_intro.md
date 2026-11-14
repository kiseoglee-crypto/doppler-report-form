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
