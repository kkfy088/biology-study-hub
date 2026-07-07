#!/usr/bin/env python3
"""构建单文件 HTML 看板：模板 + Chart.js + SheetJS + 应用逻辑"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
NODE = os.path.join(os.path.expanduser('~'), 'node_modules')

with open(os.path.join(BASE, 'part1_head_body.html'), encoding='utf-8') as f:
    html = f.read()
with open(os.path.join(BASE, 'part2_logic.js'), encoding='utf-8') as f:
    logic = f.read()
with open(os.path.join(NODE, 'chart.js', 'dist', 'chart.umd.min.js'), encoding='utf-8') as f:
    chartjs = f.read()
with open(os.path.join(NODE, 'xlsx', 'dist', 'xlsx.full.min.js'), encoding='utf-8') as f:
    xlsx = f.read()

html = html.replace('/* === CHARTJS_LIB === */', chartjs)
html = html.replace('/* === XLSX_LIB === */', xlsx)
html = html.replace('/* === APP_LOGIC === */', logic)

out = os.path.join(BASE, 'DashboardCat_看板.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print('OK', out, round(len(html)/1024, 1), 'KB')
