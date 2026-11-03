'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShoppingItem } from '@/types/item';
import {
  getCustomInventory,
  saveCustomInventory,
  importInventoryFromCSV,
} from '@/lib/warehouseCatalog';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';
import { Upload, Download, Package, Trash2 } from 'lucide-react';

export function InventoryManager() {
  const { addToast } = useAppState();
  const [inventory, setInventory] = useState<ShoppingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInventory(getCustomInventory());
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const imported = importInventoryFromCSV(text);
        if (imported.length > 0) {
          saveCustomInventory(imported);
          setInventory(imported);
          addToast({
            type: 'success',
            message: `成功匯入 ${imported.length} 筆家中庫存/倉儲常備品！`,
          });
        } else {
          addToast({
            type: 'warning',
            message: '未能自 CSV 識別出有效資料，請確認格式：品名,分類,賣場,規格,預估單價,現貨',
          });
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleExportCSV() {
    if (inventory.length === 0) return;
    let csv = '品名,分類,賣場,規格,預估單價,現貨\n';
    inventory.forEach((item) => {
      csv += `${item.name},${item.category},${item.store},${item.spec || ''},${item.estimatedPrice},${item.inStock ? '是' : '否'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Memo-常備倉儲庫存-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      message: '庫存清單 CSV 已開始下載！',
    });
  }

  function handleClear() {
    saveCustomInventory([]);
    setInventory([]);
    addToast({
      type: 'info',
      message: '已清空自訂倉儲清單',
    });
  }

  return (
    <SettingsGroup
      title="常備物資與家中庫存管理"
      description="匯入家中常備調味料、生鮮與耗材，採買中心將自動標註「家中現貨」免重複購買。"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-control bg-surface-2 border border-line text-xs">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-ink-3" />
            <span className="font-medium text-ink">
              目前登錄庫存品項：<strong>{inventory.length}</strong> 件
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              suppressHydrationWarning
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              匯入 CSV
            </Button>

            {inventory.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={handleExportCSV}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  匯出
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  className="text-danger hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="text-[11px] text-ink-3">
          支援 CSV 格式標頭：<code>品名,分類,賣場,規格,預估單價,現貨</code>
        </p>
      </div>
    </SettingsGroup>
  );
}
