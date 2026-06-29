# -*- mode: python -*-
import sys, os

block_cipher = None

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
    hiddenimports=['tkinter', 'pandas', 'numpy', 'openpyxl', 'src.loader', 'src.cleaner', 'src.classifier', 'src.renderer'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['matplotlib', 'scipy', 'PIL', 'cv2', 'tensorflow', 'torch'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='DashboardCat',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(PROJECT_DIR, 'build', 'westie.icns'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='DashboardCat',
)

app = BUNDLE(
    coll,
    name='DashboardCat.app',
    icon=os.path.join(PROJECT_DIR, 'build', 'westie.icns'),
    bundle_identifier='com.dashboardcat.app',
    info_plist={
        'CFBundleShortVersionString': '1.0',
        'CFBundleName': 'DashboardCat',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '13.0',
    },
)
