@echo off
chcp 65001 >nul
title Memo - 個人智慧生活記錄庫 (Windows 啟動腳本)

cd /d "%~dp0"

echo ============================================================
echo ✨ 歡迎使用 Memo — 個人智慧生活記錄庫
echo ============================================================
echo 🎯 模式：本機零成本開源版 (BYOK)
echo 📂 目錄：%cd%
echo ------------------------------------------------------------

:: 1. 檢查 Node.js 環境
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ 偵測到您的電腦尚未安裝 Node.js！
  echo.
  echo 👉 請至 Node.js 官方網站下載安裝 LTS 穩定版：
  echo    https://nodejs.org/
  echo （安裝完成後，再次雙擊此腳本即可自動啟動！）
  echo ------------------------------------------------------------
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✓ 偵測到 Node.js 版本：%NODE_VER%

:: 2. 首次執行：自動安裝套件依賴
if not exist "node_modules\" (
  echo.
  echo 📦 正在為您進行首次依賴套件安裝 (npm install)...
  echo    這只需要執行一次，請稍候約 10~30 秒鐘...
  echo.
  call npm install
  if %errorlevel% neq 0 (
    echo ❌ 套件安裝失敗，請檢查網路連線後重試。
    pause
    exit /b 1
  )
  echo ✓ 套件安裝完成！
)

echo.
echo 🚀 正在啟動 Memo 服務...
echo 🌐 服務網址：http://localhost:3000
echo 💡 提示：網頁將於 3 秒內自動在瀏覽器中開啟！
echo 🛑 若欲停止服務，可關閉此視窗，或雙擊執行「🗑️ 停止服務 (Windows).bat」
echo ============================================================
echo.

:: 3 秒後自動以預設瀏覽器開啟網頁
start "" timeout /t 3 /nobreak >nul & start http://localhost:3000

:: 啟動 Next.js 開發服務
call npm run dev

pause
