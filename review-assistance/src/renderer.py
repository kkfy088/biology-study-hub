"""看板渲染：将处理后的数据注入 HTML 模板"""
import json
import os
import webbrowser
import csv

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
BEFORE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'template_before.html')
AFTER_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'template_after.html')


def build_raw_json(hospitals, months, interp_info, n_hospitals):
    """构建看板内嵌的 RAW JSON"""
    return {
        'months': months,
        'n_hospitals': n_hospitals,
        'hospitals': hospitals,
        'interpolation_info': interp_info,
    }


def render_dashboard(hospitals, months, interp_info, n_hospitals, output_path):
    """将数据注入模板，生成独立 HTML 看板"""
    data = build_raw_json(hospitals, months, interp_info, n_hospitals)
    raw_json = json.dumps(data, ensure_ascii=False, allow_nan=False,
                          default=lambda x: None)

    with open(BEFORE_PATH, 'r', encoding='utf-8') as f:
        before = f.read()
    with open(AFTER_PATH, 'r', encoding='utf-8') as f:
        after = f.read()

    html = before + raw_json + after

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    return output_path


def render_anonymized(hospitals, months, interp_info, n_hospitals, output_path):
    """脱敏版：HP 名替换为 —"""
    anon = []
    for h in hospitals:
        hc = dict(h)
        hc['name'] = '—'
        anon.append(hc)
    return render_dashboard(anon, months, interp_info, n_hospitals, output_path)


def export_csv(hospitals, months, output_path, anonymize=False):
    """导出长表 CSV"""
    rows = []
    for h in hospitals:
        code = h['code']
        name = '—' if anonymize else h['name']
        prov = h.get('province', '')
        region = h.get('region', '')
        vf = h.get('vf')
        st = h.get('sales_trend', '')
        sent = h.get('sentiment_trend', '')
        for i, m in enumerate(months):
            yr = '20' + m[:2]
            ap = m[2:]
            sv = h['sales'][i]
            sv2 = h['sentiment'][i]
            rows.append({
                'HP_Code': code,
                'HP_Name': name,
                'Province': prov,
                'Region': region,
                'VF_Pct': f"{round(vf*100,1)}%" if vf is not None else '',
                'month': m,
                'period': f'{yr} {ap}',
                'sales': '' if sv is None else sv,
                'sentiment_type': '' if sv2 is None else sv2,
                'sales_trend': st,
                'sentiment_trend': sent,
            })

    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=[
            'HP_Code', 'HP_Name', 'Province', 'Region', 'VF_Pct',
            'month', 'period', 'sales', 'sentiment_type', 'sales_trend', 'sentiment_trend'
        ])
        w.writeheader()
        w.writerows(rows)
    return output_path


def open_in_browser(path):
    """在默认浏览器中打开文件"""
    webbrowser.open('file://' + os.path.abspath(path))
