'use client';

import React from 'react';
import { useNetworkInfo } from '@/hooks/useNetworkInfo';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export function ConnectionSettings() {
  const { data: netInfo, isLoading, refetch } = useNetworkInfo();

  return (
    <SettingsGroup
      title="連線與外網穿透狀態"
      description="檢查這台電腦目前的區網 IP 與 Cloudflare 免費穿透連線狀態。"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-control bg-surface-2 border border-line space-y-1">
            <span className="text-[11px] text-ink-3 block">電腦區網位址 (LAN)</span>
            <span className="font-mono font-semibold text-ink">
              {netInfo?.networkUrl || '偵測中...'}
            </span>
          </div>

          <div className="p-3 rounded-control bg-surface-2 border border-line space-y-1">
            <span className="text-[11px] text-ink-3 block">外網穿透網址 (Tunnel)</span>
            <span className="font-mono font-semibold text-ink truncate block">
              {netInfo?.publicUrl || '未啟動穿透 (使用區網模式)'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            {netInfo?.hasShortcutFile ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>捷徑安裝檔已生成並就緒 ({netInfo.fileSize} bytes)</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-accent" />
                <span>尚未偵測到捷徑安裝檔</span>
              </>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            重新整理
          </Button>
        </div>
      </div>
    </SettingsGroup>
  );
}
