import { BlockNode, DisabledBlock, HeadingBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRule } from './types';

interface HeadingMatchResult {
  level: 1 | 2 | 3 | 4 | 5;
  foldable?: boolean;
  text: string;
}

export function matchHeading(content: string): HeadingMatchResult | undefined {
  const foldableMatch = content.match(/^(#{1,5})\+\s+(.+)$/);
  if (foldableMatch) {
    const hashes = foldableMatch[1];
    const textGroup = foldableMatch[2];
    if (hashes === undefined || textGroup === undefined) {
      return undefined;
    }
    const text = textGroup.trimEnd();
    const level = hashes.length as 1 | 2 | 3 | 4 | 5;
    return { level, foldable: true, text };
  }
  const normalMatch = content.match(/^(#{1,5})\s+(.+)$/);
  if (!normalMatch) {
    return undefined;
  }
  const hashes = normalMatch[1];
  const textGroup = normalMatch[2];
  if (hashes === undefined || textGroup === undefined) {
    return undefined;
  }
  const text = textGroup.trimEnd();
  const level = hashes.length as 1 | 2 | 3 | 4 | 5;
  return { level, text };
}

export const tryParseHeading: BlockRule = (ctx) => {
  const headingMatch = matchHeading(ctx.lineInfo.content);
  if (!headingMatch) {
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
    ctx.commitBlock(block, blockAttrs, {
      allowTag: false,
      postResetPending: (pending) => {
        if (headingMatch.foldable) {
          pending.foldNext = true;
        }
      },
    });
  } else {
    const heading: HeadingBlock = {
      type: 'heading',
      level: headingMatch.level,
      foldable: headingMatch.foldable,
      children: [{ type: 'text', value: headingMatch.text }],
      blockAttrs,
    };
    setNodeLocation(heading, ctx.lineLocation);
    block = heading;
    ctx.commitBlock(block, blockAttrs, {
      postResetPending: (pending) => {
        if (headingMatch.foldable) {
          pending.foldNext = true;
        }
      },
    });
  }

  return ctx.index + 1;
};
