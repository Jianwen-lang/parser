import { BlockNode, DisabledBlock, ParagraphBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { isAttributeOnlyLine } from './attribute-line';
import { BlockRuleContext } from './types';

interface ParagraphRuleContext extends BlockRuleContext {
  shouldStopParagraph: (content: string, trimmed: string) => boolean;
}

export function tryParseParagraphBlock(ctx: ParagraphRuleContext): number {
  const blockRawLines: string[] = [ctx.lineInfo.raw];
  const blockTextLines: string[] = [ctx.lineInfo.content];

  let j = ctx.index + 1;
  while (j < ctx.lines.length) {
    const nextRaw = ctx.lines[j];
    if (nextRaw === undefined) {
      j += 1;
      continue;
    }
    const nextInfo = getLineInfo(nextRaw);
    const nextTrimmed = nextInfo.content.trim();
    if (nextTrimmed.length === 0) {
      break;
    }
    if (isAttributeOnlyLine(nextTrimmed)) {
      break;
    }
    if (ctx.shouldStopParagraph(nextInfo.content, nextTrimmed)) {
      break;
    }

    blockRawLines.push(nextInfo.raw);
    blockTextLines.push(nextInfo.content);
    j += 1;
  }

  const blockText = blockTextLines.join('\n');
  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);

  let block: BlockNode;
  if (ctx.pending.isDisabled) {
    const disabled: DisabledBlock = {
      type: 'disabledBlock',
      raw: blockRawLines.join('\n'),
      blockAttrs,
    };
    setNodeLocation(disabled, ctx.lineLocation);
    block = disabled;
  } else {
    const paragraph: ParagraphBlock = {
      type: 'paragraph',
      children: [{ type: 'text', value: blockText }],
      blockAttrs,
    };
    setNodeLocation(paragraph, ctx.lineLocation);
    block = paragraph;
  }

  ctx.commitBlock(block, blockAttrs, { allowTag: !ctx.pending.isDisabled });
  return j;
}
