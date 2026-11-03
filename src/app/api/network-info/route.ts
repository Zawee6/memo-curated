import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        if (name === 'en0') {
          candidates.unshift(net.address);
        } else if (name.startsWith('en') || name.startsWith('wl') || name.startsWith('eth')) {
          candidates.push(net.address);
        } else {
          candidates.push(net.address);
        }
      }
    }
  }

  return candidates[0] || '127.0.0.1';
}

function getActiveTunnelUrl(): string {
  const defaultDomain = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  try {
    const tunnelPath = path.join(process.cwd(), '.data', 'tunnel.json');
    if (fs.existsSync(tunnelPath)) {
      const data = JSON.parse(fs.readFileSync(tunnelPath, 'utf8'));
      if (data.publicUrl) {
        const raw = String(data.publicUrl).replace(/\/+$/, '');
        return raw.endsWith('/memo') ? raw : `${raw}/memo`;
      }
    }
  } catch {}
  if (!defaultDomain) return '';
  return defaultDomain.endsWith('/memo') ? defaultDomain : `${defaultDomain}/memo`;
}

export async function GET() {
  try {
    const localIp = getLocalIp();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const networkUrl = `http://${localIp}:${port}/memo`;
    const publicUrl = getActiveTunnelUrl();
    const activeUrl = publicUrl || networkUrl;
    const shortcutDownloadUrl = `/memo/Memo-Save.shortcut`;

    const publicPath = path.join(process.cwd(), 'public', 'Memo-Save.shortcut');
    const hasShortcutFile = fs.existsSync(publicPath);
    let fileSize = 0;
    if (hasShortcutFile) {
      const stats = fs.statSync(publicPath);
      fileSize = stats.size;
    }

    return NextResponse.json({
      success: true,
      localIp,
      port,
      networkUrl,
      publicUrl,
      activeUrl,
      isTunnelActive: Boolean(publicUrl),
      shortcutDownloadUrl,
      hasShortcutFile,
      fileSize,
      targetAddUrl: `${activeUrl}/?add=`,
    });
  } catch (error) {
    console.error('[API /api/network-info] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '無法取得網路資訊',
      },
      { status: 500 }
    );
  }
}
