import { BlockNode, DisabledBlock, IncludeBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRule } from './types';

interface IncludeMatchResult {
  mode: IncludeBlock['mode'];
  target: string;
}

export function matchInclude(content: string): IncludeMatchResult | undefined {
  const trimmed = content.trim();

  const fileMatch = trimmed.match(/^\[@\]\(([^)]+)\)\s*$/);
  if (fileMatch) {
    const pathGroup = fileMatch[1];
    if (!pathGroup) {
      return undefined;
    }
    const target = pathGroup.trim();
    if (target.length === 0) {
      return undefined;
    }
    return { mode: 'file', target };
  }

  const tagMatch = trimmed.match(/^\[@=([^\]]+)\]\s*$/);
  if (tagMatch) {
    const nameGroup = tagMatch[1];
    if (!nameGroup) {
      return undefined;
    }
    const target = nameGroup.trim();
    if (target.length === 0) {
      return undefined;
    }
    return { mode: 'tag', target };
  }

  return undefined;
}

export const tryParseInclude: BlockRule = (ctx) => {
  const includeMatch = matchInclude(ctx.lineInfo.content);
  if (!includeMatch) {
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
    ctx.commitBlock(block, blockAttrs, { allowTag: false });
  } else {
    const includeBlock: IncludeBlock = {
      type: 'include',
      mode: includeMatch.mode,
      target: includeMatch.target,
      blockAttrs,
    };
    setNodeLocation(includeBlock, ctx.lineLocation);
    block = includeBlock;
    ctx.commitBlock(block, blockAttrs);
  }

  return ctx.index + 1;
};
