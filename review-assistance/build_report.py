#!/usr/bin/env python3
"""DashboardCat — 本地数据分析看板生成器
双击运行 → 选择 Excel → 一键生成交互看板 + CSV 数据表
严格本地运行，零网络依赖
"""
import sys
import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# 确保能找到 src 模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.loader import (
    load_main_data, pivot_to_long, load_vf_data, gen_template_excel, MONTH_COLS
)
from src.cleaner import detect_bad_hospitals, interpolate_sentiment, build_hospital_data
from src.classifier import classify_all, compute_regression
from src.renderer import render_dashboard, render_anonymized, export_csv, open_in_browser


class ReviewAssistanceApp:
    def __init__(self, root):
        self.root = root
        self.root.title("DashboardCat")
        self.root.geometry("560x480")
        self.root.resizable(False, False)
        self.data_path = tk.StringVar()
        self.vf_path = tk.StringVar()
        self.anonymize = tk.BooleanVar(value=False)
        self.open_browser = tk.BooleanVar(value=True)
        self.status = tk.StringVar(value="请选择数据文件")
        self._setup_ui()
        self.root.after(100, self._center_window)

    def _center_window(self):
        self.root.update_idletasks()
        w, h = self.root.winfo_width(), self.root.winfo_height()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f'+{(sw-w)//2}+{(sh-h)//2}')

    def _setup_ui(self):
        # 主框架
        main = ttk.Frame(self.root, padding=24)
        main.pack(fill='both', expand=True)

        # 标题
        ttk.Label(main, text="DashboardCat", font=("Helvetica", 24, "bold")).pack(anchor='w')
        ttk.Label(main, text="舆情×Rev 交互看板生成器",
                  font=("Helvetica", 12), foreground="#666").pack(anchor='w', pady=(0, 20))

        # 数据文件选择
        ttk.Label(main, text="主数据文件（.xlsx）", font=("Helvetica", 11, "bold")).pack(anchor='w')
        f1 = ttk.Frame(main)
        f1.pack(fill='x', pady=(4, 0))
        ttk.Entry(f1, textvariable=self.data_path, width=48).pack(side='left', padx=(0, 6))
        ttk.Button(f1, text="选择", command=self._pick_data).pack(side='left')

        # VF 占比文件（可选 — 如主数据已含 VF占比 sheet 则无需选择）
        ttk.Label(main, text="VF 占比文件（可选 — 主数据含 VF占比 sheet 时可跳过）",
                  font=("Helvetica", 10)).pack(anchor='w', pady=(8, 0))
        f2 = ttk.Frame(main)
        f2.pack(fill='x', pady=(4, 0))
        ttk.Entry(f2, textvariable=self.vf_path, width=48).pack(side='left', padx=(0, 6))
        ttk.Button(f2, text="选择", command=self._pick_vf).pack(side='left')

        # 选项区
        opt = ttk.Frame(main)
        opt.pack(fill='x', pady=(16, 8))
        ttk.Checkbutton(opt, text="脱敏导出（隐藏 HP 名称，仅保留编号）",
                        variable=self.anonymize).pack(anchor='w')
        ttk.Checkbutton(opt, text="生成后自动在浏览器中打开看板",
                        variable=self.open_browser).pack(anchor='w', pady=(2, 0))

        # 按钮区
        btn_frame = ttk.Frame(main)
        btn_frame.pack(fill='x', pady=(8, 0))

        self.btn_gen = ttk.Button(btn_frame, text="▶ 生成分析报告",
                                  command=self._generate, style="Accent.TButton")
        self.btn_gen.pack(side='left', ipadx=12, ipady=4)

        ttk.Button(btn_frame, text="下载模板 Excel",
                   command=self._download_template).pack(side='left', padx=(10, 0))

        # 进度条
        self.progress = ttk.Progressbar(main, mode='indeterminate')
        self.progress.pack(fill='x', pady=(16, 6))

        # 状态栏
        status_frame = ttk.Frame(main)
        status_frame.pack(fill='x')
        ttk.Label(status_frame, textvariable=self.status, foreground="#555").pack(side='left')

        self._update_status("就绪 — 选择 Excel 文件后点击「生成分析报告」")

    def _pick_data(self):
        p = filedialog.askopenfilename(
            title="选择主数据文件",
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")]
        )
        if p:
            self.data_path.set(p)

    def _pick_vf(self):
        p = filedialog.askopenfilename(
            title="选择 VF 占比文件（可选）",
            filetypes=[("Excel 文件", "*.xlsx"), ("所有文件", "*.*")]
        )
        if p:
            self.vf_path.set(p)

    def _download_template(self):
        p = filedialog.asksaveasfilename(
            title="保存模板到",
            defaultextension=".xlsx",
            filetypes=[("Excel 文件", "*.xlsx")],
            initialfile="DashboardCat_数据模板.xlsx"
        )
        if not p:
            return
        try:
            gen_template_excel(p)
            messagebox.showinfo("完成", f"模板已保存到：\n{p}\n\n包含两个分表：\n• IV-限控tracking — 舆情追踪\n• IV-THHtracking — Rev 追踪\n\n填写数据后即可导入生成看板。")
        except Exception as e:
            messagebox.showerror("错误", f"生成模板失败：{e}")

    def _update_status(self, msg):
        self.status.set(msg)
        self.root.update_idletasks()

    def _generate(self):
        dp = self.data_path.get().strip()
        if not dp or not os.path.exists(dp):
            messagebox.showwarning("提示", "请先选择主数据文件（.xlsx）")
            return

        try:
            self.btn_gen.config(state='disabled')
            self.progress.start()

            self._update_status("Step 1/6: 读取 Excel...")
            self.root.update_idletasks()

            sent_df, sales_df, hospital_info, months = load_main_data(dp)
            n_raw = len(hospital_info)

            self._update_status(f"Step 2/6: 数据清洗（{n_raw} 条记录）...")
            long_data = pivot_to_long(sent_df, sales_df, months, hospital_info)
            bad = detect_bad_hospitals(long_data)
            clean_data = long_data[~long_data['code'].isin(bad)].copy()

            self._update_status(f"Step 3/6: 舆情插值（已剔除 {len(bad)} 家）...")
            clean_data, interp_info = interpolate_sentiment(clean_data)
            hospitals_raw = build_hospital_data(clean_data, months)

            self._update_status(f"Step 4/6: 趋势分类...")
            hospitals, dropped = classify_all(hospitals_raw, months)

            self._update_status(f"Step 5/6: VF 匹配 + 回归分析...")
            vfmap = load_vf_data(self.vf_path.get() if self.vf_path.get() else None, main_path=dp)
            for h in hospitals:
                h['vf'] = vfmap.get(h['name'].strip(), None)
            reg = compute_regression(hospitals, months)

            self._update_status(f"Step 6/6: 渲染看板（{len(hospitals)} 家 HP）...")
            desktop = os.path.expanduser("~/Desktop")
            html_name = "DashboardCat_看板.html" if not self.anonymize.get() else "DashboardCat_看板_脱敏.html"
            csv_name = "DashboardCat_data.csv" if not self.anonymize.get() else "DashboardCat_data_脱敏.csv"
            html_path = os.path.join(desktop, html_name)
            csv_path = os.path.join(desktop, csv_name)

            if self.anonymize.get():
                render_anonymized(hospitals, months, interp_info, len(hospitals), html_path)
                export_csv(hospitals, months, csv_path, anonymize=True)
            else:
                render_dashboard(hospitals, months, interp_info, len(hospitals), html_path)
                export_csv(hospitals, months, csv_path, anonymize=False)

            self.progress.stop()
            self._update_status("完成！")

            summary = (
                f"✅ 分析完成！\n\n"
                f"• 原始记录：{n_raw} 家\n"
                f"• 清洗剔除：{len(bad)} 家\n"
                f"• 数据缺失剔除：{dropped} 家\n"
                f"• 最终 HP：{len(hospitals)} 家\n"
                f"• 月份数：{len(months)}\n"
                f"• 数据行数：{len(hospitals) * len(months):,}\n"
            )
            if reg.get('beta_type1'):
                summary += (
                    f"\n舆情影响系数（面板固定效应）：\n"
                    f"• 类型1 vs 类型3: {reg['beta_type1']:+.1f}%\n"
                    f"• 类型2 vs 类型3: {reg['beta_type2']:+.1f}%\n"
                )

            summary += f"\n\n📄 看板：{html_name}\n📊 数据：{csv_name}\n\n文件已保存到桌面。"

            messagebox.showinfo("生成完成", summary)

            if self.open_browser.get():
                open_in_browser(html_path)

        except Exception as e:
            self.progress.stop()
            self._update_status("出错")
            messagebox.showerror("错误", f"分析过程中出错：\n\n{e}")
            import traceback
            traceback.print_exc()
        finally:
            self.btn_gen.config(state='normal')


def main():
    root = tk.Tk()
    app = ReviewAssistanceApp(root)
    root.mainloop()


if __name__ == '__main__':
    main()
