"""数据清洗：舆情缺失剔除 + 插值"""
import pandas as pd
import numpy as np


def find_active_window(grp):
    """找出该 HP 的舆情活跃窗口：第一个非 NaN 月 到 最后一个非 NaN 月"""
    non_null = grp['sentiment'].notna()
    if not non_null.any():
        return None, None
    idx = grp.index[non_null]
    return idx[0], idx[-1]


def detect_bad_hospitals(data, max_gap=3):
    """剔除活跃窗口内舆情连续缺失 > max_gap 个月的 HP
    返回需要剔除的 code 集合
    """
    bad = set()
    for code, grp in data.groupby('code'):
        grp_sorted = grp.sort_values('month')
        first, last = find_active_window(grp_sorted)
        if first is None:
            bad.add(code)
            continue
        window = grp_sorted.loc[first:last]
        gap = 0
        for _, row in window.iterrows():
            if pd.isna(row['sentiment']):
                gap += 1
                if gap > max_gap:
                    bad.add(code)
                    break
            else:
                gap = 0
    return bad


def interpolate_sentiment(data):
    """舆情插值规则：
    1. 活跃窗口外：全局 ffill + bfill
    2. 活跃窗口内：前半段 ffill，后半段 bfill，奇数中间月归后值

    注：使用 iloc 基于组的相对位置操作，避免全局索引越组问题
    """
    data = data.sort_values(['code', 'month']).reset_index(drop=True)
    missing_before = data['sentiment'].isna().sum()

    for code, grp in data.groupby('code'):
        start = grp.index[0]   # 该组在 data 中的起始行号
        end   = grp.index[-1]  # 该组在 data 中的结束行号
        n     = len(grp)

        # 找到组内活跃窗口（相对位置）
        vals = grp['sentiment'].values
        non_null_pos = [i for i, v in enumerate(vals) if not pd.isna(v)]
        if not non_null_pos:
            # 全空 → 填 3
            data.iloc[start:end+1, data.columns.get_loc('sentiment')] = 3
            continue

        first_rel = non_null_pos[0]
        last_rel  = non_null_pos[-1]
        win_len = last_rel - first_rel + 1
        half = win_len // 2  # 前半段长度

        col_idx = data.columns.get_loc('sentiment')

        # 1) 窗口前半段：ffill
        if half > 0:
            seg = data.iloc[start + first_rel : start + first_rel + half, col_idx]
            data.iloc[start + first_rel : start + first_rel + half, col_idx] = seg.ffill()

        # 2) 窗口后半段：bfill
        second_start = first_rel + half
        if second_start <= last_rel:
            seg = data.iloc[start + second_start : start + last_rel + 1, col_idx]
            data.iloc[start + second_start : start + last_rel + 1, col_idx] = seg.bfill()

        # 3) 窗口之前：全部填为首个有效值
        anchor_first = vals[first_rel]
        if first_rel > 0:
            data.iloc[start : start + first_rel, col_idx] = anchor_first

        # 4) 窗口之后：全部填为末个有效值
        anchor_last = vals[last_rel]
        if last_rel < n - 1:
            data.iloc[start + last_rel + 1 : start + n, col_idx] = anchor_last

    filled = missing_before - data['sentiment'].isna().sum()
    return data, {'before_missing': int(missing_before), 'filled': int(filled),
                  'after_missing': int(data['sentiment'].isna().sum()),
                  'method': '活跃窗口前半ffill+后半bfill/奇数中间归后值+窗口外全局填充'}


def build_hospital_data(data, months):
    """将长表转为看板所需的结构：每个 HP 的 sales/sentiment 数组 + 元信息"""
    records = []
    for code, grp in data.groupby('code'):
        # 取第一条记录获取元信息
        first_row = grp.iloc[0]
        name = first_row.get('name', code)
        prov = first_row.get('province', '')
        region = first_row.get('region', '')

        grp_idx = grp.set_index('month')
        # 按月份顺序取出数组
        sales_arr = []
        sent_arr = []
        for m in months:
            if m in grp_idx.index:
                sv = grp_idx.loc[m, 'sales'] if 'sales' in grp_idx.columns else None
                se = grp_idx.loc[m, 'sentiment'] if 'sentiment' in grp_idx.columns else None
            else:
                sv, se = None, None
            sales_arr.append(None if (isinstance(sv, float) and np.isnan(sv)) else sv)
            sent_arr.append(None if (isinstance(se, float) and np.isnan(se)) else
                           (int(se) if se is not None and not (isinstance(se, float) and np.isnan(se)) else None))

        total = sum(v for v in sales_arr if v is not None and not (isinstance(v, float) and np.isnan(v)) and v > 0)

        records.append({
            'code': code,
            'name': name,
            'province': prov,
            'region': region,
            'total_sales': float(total),
            'sales': sales_arr,
            'sentiment': sent_arr,
        })
    return records
