import json
S=json.load(open('input_spec.json'))
def ft(fields):
    r=["| id | Label | Type | Unit / Options | Source |","|---|---|---|---|---|"]
    for f in fields:
        o=f.get('unit','') if f['type']=='number' else (', '.join(x if isinstance(x,str) else f"{x[0]} ({x[1]})" for x in f['options']) if isinstance(f.get('options'),list) else f.get('options',''))
        extra=[]
        for k in ['show_if','show_for','only_segments','computed','optional','required']:
            if k in f: extra.append(f"{k}={f[k]}")
        src=f.get('source','')
        if 'OUTSIDE' in src: src='⚠ '+src
        r.append(f"| `{f['id']}` | {f['label']} | {f['type']} | {o}{' ('+'; '.join(map(str,extra))+')' if extra else ''} | {src} |")
    return '\n'.join(r)
def rules(rs):
    r=["| Rule | IF | THEN | Source |","|---|---|---|---|"]
    for x in rs: r.append(f"| {x['id']} | {x['if']} | {x['then']} | {'⚠ ' if 'OUTSIDE' in x['source'] else ''}{x['source']} |")
    return '\n'.join(r)
def tpl(t):
    return '\n'.join(f"- `{k}`: {v if isinstance(v,str) else json.dumps(v)}" for k,v in t.items())
def segs(ex):
    return '\n'.join(f"| `{s['id']}` | {s['name']} | {s.get('reflux_class',s.get('level',''))} | {'optional' if s['optional'] else 'core'} |" for s in S['exams'][ex]['segments'])
ex=open('example_reports.txt').read()
md=open('input_spec_intro.md').read()
md+="\n## 2. Common header (모든 검사 공통)\n출처: "+S['common_header']['source']+"\n\n"+ft(S['common_header']['fields'])
md+="\n\n## 3. Report layout (EMR 출력 순서)\n"+' → '.join(S['report_layout']['order'])+"\n\n"+tpl(S['report_layout']['header_templates'])
names={'arterial':'4. Lower extremity ARTERIAL duplex','venous_insufficiency':'5. Lower extremity VENOUS INSUFFICIENCY (reflux / varicose) duplex','dvt':'6. Lower extremity DVT duplex'}
for k,t in names.items():
    E=S['exams'][k]
    md+=f"\n\n## {t}\n\n### Indications (multiselect)\n"+', '.join(E['indications'])
    md+="\n\n### Segments (각 segment는 Rt/Lt 두 열로 입력)\n| id | Segment | class/level | |\n|---|---|---|---|\n"+segs(k)
    md+="\n\n### Per-segment fields (Rt/Lt)\n"+ft(E['segment_fields'])
    if E.get('exam_fields'): md+="\n\n### Exam-level fields\n"+ft(E['exam_fields'])
    for lk in ['lesion_list','perforator_list','varicosity_list']:
        if lk in E: md+=f"\n\n### {E[lk]['label']} (repeatable rows)\n"+ft(E[lk]['fields'])
    md+="\n\n### Auto-interpretation rules\n"+rules(E['rules'])
    md+="\n\n### Report sentence templates (English, EMR output)\n"+tpl(E['templates'])
md+="\n\n## 7. Configurable thresholds (`config`)\n```json\n"+json.dumps(S['config'],indent=1)+"\n```\n"
md+="\n## 8. Example generated reports (render_example.py 출력, 가상 입력)\n```text\n"+ex+"```\n"
import re
tj=open('test/test_outputs.txt').read()
blk=[b for b in tj.split('=== ') if b.startswith('VENOUS: CEAP full') or b.startswith('DVT: Rt GSV SVT')]
md+="\n## 9. CEAP 2020 / SVT examples (웹페이지 index.html 실제 출력, 가상 입력)\n```text\n"+''.join('=== '+b for b in blk)+"```\n"
open('input_spec.md','w').write(md)
