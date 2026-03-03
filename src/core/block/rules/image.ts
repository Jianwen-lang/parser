import { BlockNode, DisabledBlock, ImageBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRuleContext } from './types';

interface ImageBlockMatchResult {
  url: string;
  shape?: 'square' | 'rounded';
  roundedRadius?: number;
}

export function tryParseImageBlock(ctx: BlockRuleContext): number | null {
  const imageMatch = matchImageBlock(ctx.trimmedContent);
  if (!imageMatch) {
    return null;
  }

  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);

  let block: BlockNode;
  if (ctx.pending.isDisabled) {
    const disabled: DisabledBlock = {
      type: 'disabledBlock',
      raw: ctx.lineInfo.raw,
      blockAttrs,
    };
    setNodeLocation(disabled, ctx.lineLocation);
    block = disabled;
  } else {
    const image: ImageBlock = {
      type: 'image',
      url: imageMatch.url,
      shape: imageMatch.shape,
      roundedRadius: imageMatch.roundedRadius,
      blockAttrs,
    };
    setNodeLocation(image, ctx.lineLocation);
    block = image;
  }

  ctx.commitBlock(block, blockAttrs);
  return ctx.index + 1;
}

export function matchImageBlock(trimmed: string): ImageBlockMatchResult | undefined {
  const m = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
  if (!m) {
    return undefined;
  }
  const inside = m[1];
  const urlGroup = m[2];
  if (inside === undefined || urlGroup === undefined) {
    return undefined;
  }
  const url = urlGroup.trim();
  if (url.length === 0) {
    return undefined;
  }
  const parts = inside
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.includes('img')) {
    return undefined;
  }

  let shape: 'square' | 'rounded' | undefined;
  let roundedRadius: number | undefined;
  for (const part of parts) {
    if (part === 'rounded') {
      shape = 'rounded';
      continue;
    }
    if (part === 'square') {
      shape = 'square';
      continue;
    }
    const roundedMatch = part.match(/^rounded=([0-9.]+)$/);
    if (roundedMatch && roundedMatch[1]) {
      const num = parseFloat(roundedMatch[1]);
      if (!isNaN(num) && num > 0) {
        shape = 'rounded';
        roundedRadius = num;
      }
    }
  }

  return { url, shape, roundedRadius };
}
