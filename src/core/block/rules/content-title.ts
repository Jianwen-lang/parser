import { BlockNode, ContentTitleBlock, DisabledBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRuleContext } from './types';

interface ContentTitleRuleContext extends BlockRuleContext {
  blocks: BlockNode[];
  resetPending: () => void;
}

interface ContentTitleMatchResult {
  text: string;
}

export function tryParseContentTitleBlock(ctx: ContentTitleRuleContext): number | null {
  const contentTitleMatch = matchContentTitle(ctx.lineInfo.content);
  if (!contentTitleMatch) {
    return null;
  }

  const text = contentTitleMatch.text;

  let consumedByImageTitle = false;
  if (canAttachToPreviousImage(ctx.pending)) {
    const lastBlock = ctx.blocks[ctx.blocks.length - 1];
    if (lastBlock && lastBlock.type === 'image') {
      lastBlock.title = text;
      consumedByImageTitle = true;
    } else if (lastBlock && lastBlock.type === 'taggedBlock' && lastBlock.child.type === 'image') {
      lastBlock.child.title = text;
      consumedByImageTitle = true;
    }
  }

  if (consumedByImageTitle) {
    ctx.resetPending();
    return ctx.index + 1;
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
    const contentTitle: ContentTitleBlock = {
      type: 'contentTitle',
      children: [{ type: 'text', value: text }],
    };
    setNodeLocation(contentTitle, ctx.lineLocation);
    block = contentTitle;
  }

  ctx.commitBlock(block, blockAttrs);
  return ctx.index + 1;
}

export function matchContentTitle(content: string): ContentTitleMatchResult | undefined {
  const m = content.match(/^>\s+(.+)$/);
  if (!m) {
    return undefined;
  }
  const group = m[1];
  if (group === undefined) {
    return undefined;
  }
  const text = group.trimEnd();
  return { text };
}

function canAttachToPreviousImage(pending: ContentTitleRuleContext['pending']): boolean {
  return (
    !pending.attrs &&
    !pending.foldNext &&
    !pending.tagName &&
    !pending.isComment &&
    !pending.isDisabled &&
    !pending.isSheet &&
    !pending.isHtml
  );
}
