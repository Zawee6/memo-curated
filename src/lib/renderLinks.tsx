'use client';

import React from 'react';

/**
 * 解析文字中的 Markdown 超連結 [文字](網址) 與裸露網址 (https://...)
 * 將其渲染為真實的 <a> 超連結，點擊開新分頁連往目標網站
 */
export function renderTextWithLinks(text?: string | null): React.ReactNode {
  if (!text) return null;

  // Pattern matches [label](url) OR raw URLs (https?://[^\s]+)
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;

    // Plain text preceding the match
    if (matchStart > lastIndex) {
      elements.push(text.substring(lastIndex, matchStart));
    }

    if (match[1] && match[2]) {
      // Markdown link: [label](url)
      const label = match[1];
      const url = match[2];
      elements.push(
        <a
          key={`md-link-${matchStart}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2563eb] hover:underline font-bold inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{label}</span>
          <span className="text-[10px]">↗</span>
        </a>
      );
    } else if (match[3]) {
      // Raw URL
      const url = match[3];
      elements.push(
        <a
          key={`raw-link-${matchStart}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2563eb] hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    }

    lastIndex = matchEnd;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length === 1 && typeof elements[0] === 'string'
    ? elements[0]
    : elements;
}
