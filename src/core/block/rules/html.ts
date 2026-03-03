import { BlockNode, DisabledBlock, HtmlBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRuleContext } from './types';

interface HtmlBlockMatchResult {
  source: string;
}

export function tryParseHtmlBlock(ctx: BlockRuleContext): number | null {
  const htmlMatch = matchHtmlBlock(ctx.trimmedContent);
  if (!htmlMatch) {
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
    const htmlBlock: HtmlBlock = {
      type: 'html',
      source: htmlMatch.source,
      blockAttrs,
    };
    setNodeLocation(htmlBlock, ctx.lineLocation);
    block = htmlBlock;
  }

  ctx.commitBlock(block, blockAttrs);
  return ctx.index + 1;
}

export function matchHtmlBlock(trimmed: string): HtmlBlockMatchResult | undefined {
  const m = trimmed.match(/^\[html\]\(([^)]+)\)\s*$/);
  if (!m) {
    return undefined;
  }
  const urlGroup = m[1];
  if (urlGroup === undefined) {
    return undefined;
  }
  const source = urlGroup.trim();
  if (source.length === 0) {
    return undefined;
  }
  return { source };
}
