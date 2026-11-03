import { getSourceAspectRatio } from '@/lib/video';

export interface BentoTrio<T> {
  type: 'bento-trio';
  id: string;
  hero: T; // 16:9 card
  left: T; // 9:16 card
  right: T; // 9:16 card
}

export interface BentoSingle<T> {
  type: 'single';
  id: string;
  item: T;
}

export type BentoBlock<T> = BentoTrio<T> | BentoSingle<T>;

/**
 * packBentoBlocks packs a newest-first sorted list into Bento blocks.
 * Whenever a 16:9 horizontal card is encountered, it looks ahead up to `lookaheadLimit`
 * items to find two 9:16 vertical cards and packs them into a 2-column Bento module:
 * 1 horizontal (16:9) on top + 2 vertical (9:16) below.
 * Items not formed into trios naturally stay as singles.
 * This eliminates the CSS Grid row-lock vertical gap below 16:9 cards while strictly
 * preserving newest-first order.
 */
export function packBentoBlocks<T>(
  items: T[],
  getItemMeta: (item: T) => { id: string; url: string; aspectRatio?: string },
  lookaheadLimit = 4
): BentoBlock<T>[] {
  const n = items.length;
  const consumed = new Set<number>();
  const blocks: BentoBlock<T>[] = [];

  for (let i = 0; i < n; i++) {
    if (consumed.has(i)) continue;

    const current = items[i];
    const currentMeta = getItemMeta(current);
    const is169 =
      getSourceAspectRatio(currentMeta.url, currentMeta.aspectRatio) === '16:9';

    if (is169) {
      // Look ahead for two vertical (9:16) cards
      const verticalIndices: number[] = [];
      const endLimit = Math.min(n, i + 1 + lookaheadLimit);

      for (let j = i + 1; j < endLimit; j++) {
        if (consumed.has(j)) continue;
        const meta = getItemMeta(items[j]);
        const isVert =
          getSourceAspectRatio(meta.url, meta.aspectRatio) !== '16:9';
        if (isVert) {
          verticalIndices.push(j);
          if (verticalIndices.length === 2) break;
        }
      }

      if (verticalIndices.length === 2) {
        // Form a 3-Block Bento Trio!
        consumed.add(i);
        consumed.add(verticalIndices[0]);
        consumed.add(verticalIndices[1]);

        blocks.push({
          type: 'bento-trio',
          id: `bento_${currentMeta.id}_${verticalIndices[0]}_${verticalIndices[1]}`,
          hero: current,
          left: items[verticalIndices[0]],
          right: items[verticalIndices[1]],
        });
        continue;
      }
    }

    // Otherwise, emit as a single block
    consumed.add(i);
    blocks.push({
      type: 'single',
      id: currentMeta.id,
      item: current,
    });
  }

  return blocks;
}
