import { BlockNode, DisabledBlock, FootnoteDefBlock, FootnotesBlock } from '../../ast';
import { ParseError } from '../../errors';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { BlockRuleContext } from './types';

interface FootnotesRuleContext extends BlockRuleContext {
  parseBlocks: (source: string, errors: ParseError[]) => BlockNode[];
}

export function tryParseFootnotesBlock(ctx: FootnotesRuleContext): number | null {
  if (!isFootnotesLine(ctx.trimmedContent)) {
    return null;
  }

  const rawLines: string[] = [ctx.lineInfo.raw];
  const regionLines: string[] = [];

  let jFoot = ctx.index + 1;
  while (jFoot < ctx.lines.length) {
    const nextRaw = ctx.lines[jFoot];
    if (nextRaw === undefined) {
      jFoot += 1;
      continue;
    }
    const nextInfo = getLineInfo(nextRaw);
    const nextTrimmed = nextInfo.content.trim();
    if (nextTrimmed.length === 0) {
      break;
    }
    rawLines.push(nextInfo.raw);
    regionLines.push(nextInfo.content);
    jFoot += 1;
  }

  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);

  let block: BlockNode;
  if (ctx.pending.isDisabled) {
    const disabled: DisabledBlock = {
      type: 'disabledBlock',
      raw: rawLines.join('\n'),
      blockAttrs,
    };
    setNodeLocation(disabled, ctx.lineLocation);
    block = disabled;
  } else {
    const children = parseFootnoteDefs(regionLines, ctx.errors, ctx.parseBlocks);
    const footnotesBlock: FootnotesBlock = {
      type: 'footnotes',
      children,
      blockAttrs,
    };
    setNodeLocation(footnotesBlock, ctx.lineLocation);
    block = footnotesBlock;
  }

  ctx.commitBlock(block, blockAttrs);
  return jFoot;
}

export function isFootnotesLine(trimmed: string): boolean {
  return trimmed === '[footnotes]';
}

function parseFootnoteDefs(
  lines: string[],
  errors: ParseError[],
  parseBlocks: (source: string, errors: ParseError[]) => BlockNode[],
): FootnoteDefBlock[] {
  const defs: FootnoteDefBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw === undefined) {
      i += 1;
      continue;
    }
    const trimmed = raw.trim();
    const match = trimmed.match(/^\[fn=([^\]]+)\]\s*$/);
    if (!match) {
      i += 1;
      continue;
    }
    const idGroup = match[1];
    if (!idGroup) {
      i += 1;
      continue;
    }
    const id = idGroup.trim();
    i += 1;
    const contentLines: string[] = [];
    while (i < lines.length) {
      const innerRaw = lines[i];
      if (innerRaw === undefined) {
        i += 1;
        continue;
      }
      const innerTrimmed = innerRaw.trim();
      if (innerTrimmed.length === 0) {
        break;
      }
      if (/^\[fn=[^\]]+\]\s*$/.test(innerTrimmed)) {
        break;
      }
      contentLines.push(innerRaw);
      i += 1;
    }

    const contentSource = contentLines.join('\n');
    const children: BlockNode[] =
      contentSource.length > 0 ? parseBlocks(contentSource, errors) : [];
    const def: FootnoteDefBlock = {
      type: 'footnoteDef',
      id,
      children,
    };
    defs.push(def);
  }
  return defs;
}
