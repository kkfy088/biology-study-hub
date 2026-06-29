#!/bin/bash
# Review Assistance 打包脚本 — 生成 macOS .app + DMG
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
DIST_DIR="$PROJECT_DIR/dist"
APP_NAME="Review Assistance"
DMG_NAME="Review_Assistance"

echo "=== Review Assistance 打包 ==="

# 1) 环境准备
echo "[1/6] 准备 Python 环境..."
VENV="$BUILD_DIR/venv"
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet pyinstaller
pip install --quiet -r "$PROJECT_DIR/requirements.txt"

# 2) 生成模板 Excel（打包进去）
echo "[2/6] 生成模板 Excel..."
python3 -c "
import sys; sys.path.insert(0, '$PROJECT_DIR')
from src.loader import gen_template_excel
gen_template_excel('$BUILD_DIR/Review_Assistance_数据模板.xlsx')
print('模板已生成')
"

# 3) 创建 PyInstaller spec
echo "[3/6] 创建 PyInstaller spec..."
cat > "$BUILD_DIR/review_assistance.spec" << 'SPECEOF'
# -*- mode: python -*-
import sys, os

block_cipher = None

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(SPECPATH)))

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
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Review Assistance',
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
    icon=None,
)

app = BUNDLE(
    exe,
    name='Review Assistance.app',
    icon=None,
    bundle_identifier='com.review.assistance',
    info_plist={
        'CFBundleShortVersionString': '1.0',
        'CFBundleName': 'Review Assistance',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '13.0',
    },
)
SPECEOF

# 4) 运行 PyInstaller
echo "[4/6] 打包为 .app（约 3-5 分钟）..."
cd "$BUILD_DIR"
rm -rf "$DIST_DIR/Review Assistance.app" "$DIST_DIR/Review Assistance" 2>/dev/null || true
pyinstaller --clean --noconfirm "$BUILD_DIR/review_assistance.spec"

echo "[5/6] 创建 DMG..."
APP_PATH="$DIST_DIR/Review Assistance.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ .app 未生成，检查 PyInstaller 输出"
    exit 1
fi

DMG_TMP="$BUILD_DIR/dmg_tmp"
rm -rf "$DMG_TMP"
mkdir -p "$DMG_TMP"
cp -R "$APP_PATH" "$DMG_TMP/"
cp "$BUILD_DIR/Review_Assistance_数据模板.xlsx" "$DMG_TMP/"

# 创建使用说明
cat > "$DMG_TMP/使用说明.txt" << 'README'
Review Assistance — 使用说明
=============================

📋 功能
  上传标准格式的 Excel 数据 → 一键生成交互式舆情×Rev 分析看板

🚀 使用步骤
  1. 双击「Review Assistance.app」启动
  2. 如系统提示"无法验证开发者"：
     → 打开「系统设置」→「隐私与安全性」→ 点击「仍要打开」
     （或右键点击 app → 按住 Option → 打开）
  3. 选择主数据文件（.xlsx，需包含 IV-限控tracking 和 IV-THHtracking 两张分表）
  4. 可选：选择 VF 占比文件
  5. 点击「生成分析报告」
  6. 桌面自动生成 Review_Assistance_看板.html + Review_Assistance_data.csv

📊 数据模板
  Review_Assistance_数据模板.xlsx — 标准数据格式，请按模板填写后导入

🔒 数据安全
  本软件严格本地运行，不上传任何数据到网络。
  即使设备联网，也不会发起任何网络请求。
  脱敏模式可隐藏 HP 名称，仅保留编号。

📧 支持
  如有问题请联系开发团队
README

# 生成 DMG
DMG_PATH="$DIST_DIR/$DMG_NAME.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "$DMG_NAME" -srcfolder "$DMG_TMP" -ov -format UDZO "$DMG_PATH"

# 6) 完成
echo ""
echo "============================================"
echo "✅ 打包完成！"
echo "📦 DMG: $DMG_PATH"
echo "📱 App: $APP_PATH"
ls -lh "$DMG_PATH"
ls -lh "$APP_PATH"
echo "============================================"
