#!/bin/bash
# ============================================================
# Memo - 個人智慧生活記錄庫 (Mac 專用一鍵啟動腳本)
# ============================================================

cd "$(dirname "$0")"

clear
echo "============================================================"
echo "✨ 歡迎使用 Memo — 個人智慧生活記錄庫"
echo "============================================================"
echo "🎯 模式：本機零成本開源版 (BYOK)"
echo "📂 目錄：$(pwd)"
echo "------------------------------------------------------------"

# 1. 檢查 Node.js 環境
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 偵測到您的 Mac 尚未安裝 Node.js！"
  echo ""
  echo "👉 請至 Node.js 官方網站下載安裝 LTS 穩定版："
  echo "   https://nodejs.org/"
  echo "（安裝完成後，再次雙擊此腳本即可自動啟動！）"
  echo "------------------------------------------------------------"
  read -n 1 -s -r -p "按任意鍵離開視窗..."
  exit 1
fi

echo "✓ 偵測到 Node.js 版本：$(node -v)"

# 2. 首次執行：自動安裝套件依賴
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 正在為您進行首次依賴套件安裝 (npm install)..."
  echo "   這只需要執行一次，請稍候約 10~30 秒鐘..."
  echo ""
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 套件安裝失敗，請檢查網路連線後重試。"
    read -n 1 -s -r -p "按任意鍵離開視窗..."
    exit 1
  fi
  echo "✓ 套件安裝完成！"
fi

# 3. 確保 .data 目錄存在以記錄進程
mkdir -p .data

# 檢查 3000 埠是否被佔用，若有舊的 Memo 進程則先清理
OLD_PID=$(lsof -ti :3000 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "⚡ 偵測到 Port 3000 佔用中，正在自動重置服務..."
  kill -9 $OLD_PID 2>/dev/null
  sleep 1
fi

echo ""
echo "🚀 正在啟動 Memo 服務..."
echo "🌐 服務網址：http://localhost:3000"
echo "💡 提示：網頁將於 3 秒內自動在瀏覽器中開啟！"
echo "🛑 若欲停止服務，可關閉此視窗，或雙擊執行「🗑️ 停止並準備刪除 Memo (Mac).command」"
echo "============================================================"
echo ""

# 背景排程：等待 3 秒後自動喚起預設瀏覽器打開網頁
(sleep 3 && open "http://localhost:3000") &

# 啟動 Next.js 服務 (保存 PID 供刪除腳本讀取)
npm run dev &
MEMO_PID=$!
echo $MEMO_PID > .data/memo.pid

# 監聽關閉訊號
trap 'kill -9 $MEMO_PID 2>/dev/null; rm -f .data/memo.pid; exit 0' INT TERM EXIT

wait $MEMO_PID
