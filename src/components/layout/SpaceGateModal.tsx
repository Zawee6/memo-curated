'use client';

import React, { useState } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { ShieldCheck, User, KeyRound, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function SpaceGateModal() {
  const {
    needsSpaceInput,
    setNeedsSpaceInput,
    setSpaceId,
    unlockAdmin,
    addToast,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'friend' | 'admin'>('friend');
  const [friendCode, setFriendCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!needsSpaceInput) {
    return null;
  }

  const handleFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const clean = friendCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!clean) {
      setErrorMessage('請輸入有效的空間代號（例如 amy、john、travel）');
      return;
    }
    if (clean === 'default') {
      setErrorMessage('default 為主機受保護主空間，請使用下方管理員通行碼解鎖');
      return;
    }

    setSpaceId(clean);
    setNeedsSpaceInput(false);
    addToast({
      type: 'success',
      message: `🎉 歡迎進入【${clean}】的專屬空間！`,
    });
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanPin = pinCode.trim();
    if (!cleanPin) {
      setErrorMessage('請輸入管理員 4 位數通行碼 (PIN)');
      return;
    }

    setLoading(true);
    try {
      const res = await unlockAdmin(cleanPin);
      if (res.success) {
        setNeedsSpaceInput(false);
        addToast({
          type: 'success',
          message: '👑 管理員解鎖成功，已載入主機主資料庫！',
        });
      } else {
        setErrorMessage(res.error || '通行碼不正確，請重新輸入');
      }
    } catch {
      setErrorMessage('驗證連線失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface border border-line-strong rounded-2xl shadow-float overflow-hidden flex flex-col p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 text-accent flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-ink">
              私人手帳空間保護
            </h3>
            <p className="text-xs text-ink-3">
              此為私密資料庫。請選擇您的身分進入：
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-surface-2 rounded-xl border border-line text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('friend');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'friend'
                ? 'bg-surface text-ink shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>我是朋友（進入專屬空間）</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-surface text-ink shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>我是主機（輸入 PIN 碼）</span>
          </button>
        </div>

        {/* Tab 1: Friend Code */}
        {activeTab === 'friend' ? (
          <form onSubmit={handleFriendSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-2 block">
                朋友空間代碼 (Space ID)
              </label>
              <input
                type="text"
                autoFocus
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="例如：amy、john、family"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm font-mono placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
              <p className="text-[11px] text-ink-3">
                若主人有傳送專屬邀請連結給您，代碼通常在網址結尾的 <code className="font-mono text-ink-2">?space=代碼</code> 中。
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 font-bold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              進入我的專屬空間
            </Button>
          </form>
        ) : (
          /* Tab 2: Host Admin PIN */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-2 block">
                主機管理員通行碼 (PIN)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                maxLength={8}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="預設通行碼：8888"
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm font-mono tracking-widest text-center placeholder:tracking-normal placeholder:text-ink-3 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
              <p className="text-[11px] text-ink-3">
                輸入正確 PIN 碼即可解除主資料庫鎖定，並將此瀏覽器認證為永久管理員。
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full justify-center py-2.5 font-bold"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
            >
              {loading ? '驗證中...' : '驗證並解鎖主資料庫'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
