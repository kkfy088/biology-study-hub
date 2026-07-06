"""趋势分类：Rev 趋势 5 类 + 舆情趋势 3 类 + 面板回归 β"""
import numpy as np
import pandas as pd


def sum_ap16(sales_arr, months, year_prefix):
    """计算指定年份 AP1-6 期间的总销量"""
    total = 0
    for i, m in enumerate(months):
        if m.startswith(year_prefix):
            ap = int(m[2:].replace('AP', ''))
            if 1 <= ap <= 6:
                v = sales_arr[i]
                if v is not None and not np.isnan(v) and v > 0:
                    total += v
    return total


def classify_sales_trend(hospital, months):
    """Rev 趋势 5 类口径：26年AP1-6 vs 25年AP1-6同期对比
    - 上升：26>25 超5%，或 25无26有（新进院）
    - 下降：26<25 超5%
    - 平稳：±5% 内
    - 业务丢失：25有销量，26年同期归零
    - 数据缺失：25和26都无销量
    """
    s25 = sum_ap16(hospital['sales'], months, '25')
    s26 = sum_ap16(hospital['sales'], months, '26')

    hospital['sales_25'] = round(s25, 2)
    hospital['sales_26'] = round(s26, 2)

    if s25 <= 0 and s26 <= 0:
        return '数据缺失'
    if s25 > 0 and s26 <= 0:
        return '业务丢失'
    if s25 <= 0 and s26 > 0:
        return '上升'
    rate = (s26 - s25) / s25
    if rate > 0.05:
        return '上升'
    if rate < -0.05:
        return '下降'
    return '平稳'


def classify_sentiment_trend(hospital, months):
    """舆情趋势 3 类：25/26 年同期均值差 > 0.1
    只统计有销量的月份（销量为空=未来月份，不参与趋势判断）"""
    s25, c25 = 0, 0
    s26, c26 = 0, 0
    for i, m in enumerate(months):
        v = hospital['sentiment'][i]
        if v is None or (isinstance(v, float) and np.isnan(v)):
            continue
        # 只统计有销量的月份（销量为空=未来月份，不参与趋势判断）
        sv = hospital['sales'][i]
        if sv is None or (isinstance(sv, float) and np.isnan(sv)):
            continue
        if m.startswith('25'):
            s25 += v; c25 += 1
        elif m.startswith('26'):
            s26 += v; c26 += 1
    if c25 == 0 or c26 == 0:
        return '数据不足'
    diff = (s26 / c26) - (s25 / c25)
    # 舆情值：1=最严重, 2=部分限制, 3=正常 → 数值变大=转好
    if diff > 0.1:
        return '改善'
    if diff < -0.1:
        return '恶化'
    return '稳定'


def classify_all(hospitals, months):
    """对所有 HP 执行趋势分类，并剔除数据缺失的"""
    for h in hospitals:
        h['sales_trend'] = classify_sales_trend(h, months)
        h['sentiment_trend'] = classify_sentiment_trend(h, months)

    # 剔除数据缺失
    valid = [h for h in hospitals if h['sales_trend'] != '数据缺失']
    dropped = len(hospitals) - len(valid)
    return valid, dropped


def compute_regression(hospitals, months):
    """面板固定效应回归：ln(sales) ~ sentiment_dummy_1 + sentiment_dummy_2 + hospital_FE
    返回 β 系数（type1/type2 相对 type3 的影响百分比）
    """
    reg_data = []
    for h in hospitals:
        for i, m in enumerate(months):
            v = h['sales'][i]
            s = h['sentiment'][i]
            if v is None or np.isnan(v) or v <= 0:
                continue
            if s is None or np.isnan(s):
                continue
            reg_data.append({'code': h['code'], 'ln_sales': np.log(float(v)),
                             's1': 1 if s == 1 else 0, 's2': 1 if s == 2 else 0})

    if len(reg_data) < 100:
        return {'beta_type1': None, 'beta_type2': None, 'n_obs': len(reg_data)}

    # 用 pandas 做组内 demean
    df = pd.DataFrame(reg_data)
    group_means = df.groupby('code')[['ln_sales', 's1', 's2']].transform('mean')
    df_dm = df[['ln_sales', 's1', 's2']] - group_means

    # OLS: demeaned ln_sales ~ demeaned s1 + demeaned s2
    X = df_dm[['s1', 's2']].values.astype(float)
    y = df_dm['ln_sales'].values.astype(float)

    try:
        beta = np.linalg.lstsq(X, y, rcond=None)[0]
        pct1 = 100 * (np.exp(float(beta[0])) - 1)
        pct2 = 100 * (np.exp(float(beta[1])) - 1)
        return {
            'beta_type1': round(pct1, 1),
            'beta_type2': round(pct2, 1),
            'beta_type3': 'baseline',
            'n_obs': len(reg_data),
        }
    except np.linalg.LinAlgError:
        return {'beta_type1': None, 'beta_type2': None, 'n_obs': len(reg_data)}
