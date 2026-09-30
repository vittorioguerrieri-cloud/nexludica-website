import json, os, sys

with open(os.path.join(os.environ['TEMP'], 'tumi_v7_check.json'), encoding='utf-8-sig') as f:
    data = json.load(f)
schema = json.loads(data[0]['results'][0]['schema_json'])
pp = next(p for p in schema['pages'] if p['name'] == 'player_profile')
bgp = next(e for e in pp['elements'] if e['name'] == 'bg_proxy')
print("bg_proxy.isAllRowRequired:", bgp.get('isAllRowRequired', 'REMOVED'))
print("bg_proxy rows:")
for r in bgp['rows']:
    print(f"  - {r['value']} required={r.get('required', False)}")
t1 = next(e for e in next(p for p in schema['pages'] if p['name'] == 'tumi_1')['elements'] if e['name'] == 'tumi_matrix_1')
print(f"\ntumi_matrix_1.isAllRowRequired: {t1.get('isAllRowRequired', 'REMOVED')}")
flags = [r.get('required', False) for r in t1['rows'][:5]]
print(f"tumi_matrix_1 first 5 rows required flags: {flags}")
