# -*- mode: python -*-
# Windows 打包配置 —— 在 Windows 系统上运行：pyinstaller DashboardCat_win.spec
import os

block_cipher = None

# 项目根目录（spec 在 build_windows/ 子目录下）
PROJECT_DIR = os.path.dirname(os.path.abspath(SPECPATH))

added_files = [
    (os.path.join(PROJECT_DIR, 'template_before.html'), '.'),
    (os.path.join(PROJECT_DIR, 'template_after.html'), '.'),
]

a = Analysis(
    [os.path.join(PROJECT_DIR, 'build_report.py')],
    pathex=[PROJECT_DIR],
    binaries=[],
    datas=added_files,
    hiddenimports=['tkinter', 'pandas', 'numpy', 'openpyxl',
                   'src.loader', 'src.cleaner', 'src.classifier', 'src.renderer'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['matplotlib', 'scipy', 'PIL', 'cv2', 'tensorflow', 'torch'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# 单文件 exe —— 双击即用，无需安装
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='DashboardCat',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,                       # 不弹黑色命令行窗口
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(PROJECT_DIR, 'build_windows', 'westie.ico'),
)
