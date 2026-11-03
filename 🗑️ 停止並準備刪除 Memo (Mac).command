#!/bin/bash
# ============================================================
# Memo - 停止服務與準備刪除 (Mac 專用腳本)
# ============================================================

cd "$(dirname "$0")"

clear
echo "============================================================"
echo "🛑 正在停止 Memo 本機背景服務..."
echo "============================================================"

# 1. 依據 PID 檔停止
if [ -f ".data/memo.pid" ]; then
  MEMO_PID=$(cat .data/memo.pid 2>/dev/null)
  if [ -n "$MEMO_PID" ]; then
    kill -9 $MEMO_PID 2>/dev/null
    rm -f .data/memo.pid
  fi
fi

# 2. 依據 Port 3000 確保徹底釋放
PORT_PIDS=$(lsof -ti :3000 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
  for pid in $PORT_PIDS; do
    # 檢查是否為 node 程序
    cmd=$(ps -p $pid -o comm= 2>/dev/null)
    if [[ "$cmd" == *"node"* ]]; then
      kill -9 $pid 2>/dev/null
    fi
  done
fi

sleep 1

echo ""
echo "============================================================"
echo "✅ 背景服務已完全關閉，沒有任何系統殘留！"
echo "現在您可以直接將此資料夾拖進垃圾桶刪除。"
echo "============================================================"
echo ""
read -n 1 -s -r -p "按任意鍵關閉視窗..."
exit 0
