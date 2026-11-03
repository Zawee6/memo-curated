@echo off
chcp 65001 >nul
title Memo - 停止服務與準備刪除 (Windows 腳本)

cd /d "%~dp0"

echo ============================================================
echo 🛑 正在停止 Memo 本機背景服務...
echo ============================================================

:: 尋找並終止佔用 Port 3000 的進程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /f /pid %%a >nul 2>nul
)

:: 刪除 PID 暫存檔（若存在）
if exist ".data\memo.pid" del /f /q ".data\memo.pid" >nul 2>nul

timeout /t 1 /nobreak >nul

echo.
echo ============================================================
echo ✅ 背景服務已完全關閉，沒有任何系統殘留！
echo 現在您可以直接將此資料夾拖進垃圾桶刪除。
echo ============================================================
echo.
pause
