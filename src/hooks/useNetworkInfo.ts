'use client';

import { useState, useEffect } from 'react';

export interface NetworkInfoData {
  localIp: string;
  port: number;
  networkUrl: string;
  publicUrl: string | null;
  activeUrl: string;
  shortcutDownloadUrl: string;
  hasShortcutFile: boolean;
  fileSize: number;
}

export function useNetworkInfo() {
  const [data, setData] = useState<NetworkInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchInfo() {
    try {
      setIsLoading(true);
      const res = await fetch('/memo/api/network-info');
      if (!res.ok) throw new Error('無法取得網路資訊');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '連線失敗');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchInfo();
  }, []);

  return { data, isLoading, error, refetch: fetchInfo };
}
