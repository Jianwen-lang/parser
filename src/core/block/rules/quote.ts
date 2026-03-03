import { BlockNode, DisabledBlock, QuoteBlock } from '../../ast';
import { ParseError } from '../../errors';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { BlockRuleContext } from './types';

interface QuoteRuleContext extends BlockRuleContext {
  parseBlocks: (source: string, errors: ParseError[]) => BlockNode[];
}

interface QuoteMatchResult {
  level: number;
  text: string;
}

export function tryParseQuoteBlock(ctx: QuoteRuleContext): number | null {
  const quoteMatch = matchQuote(ctx.lineInfo.content);
  if (!quoteMatch) {
    return null;
  }

  const { level } = quoteMatch;
  const innerLines: string[] = [];
  const rawLines: string[] = [];

  const normalizedFirstLine = normalizeQuoteLine(quoteMatch, level);
  if (normalizedFirstLine !== undefined) {
    innerLines.push(normalizedFirstLine);
  }
  rawLines.push(ctx.lineInfo.raw);

  let jQuote = ctx.index + 1;
  while (jQuote < ctx.lines.length) {
    const nextRaw = ctx.lines[jQuote];
    if (nextRaw === undefined) {
      jQuote += 1;
      continue;
    }
    const nextInfo = getLineInfo(nextRaw);
    const nextTrimmed = nextInfo.content.trim();
    if (nextTrimmed.length === 0) {
      break;
    }
    const match = matchQuote(nextInfo.content);
    if (!match) {
      break;
    }
    const normalized = normalizeQuoteLine(match, level);
    if (normalized === undefined) {
      break;
    }
    innerLines.push(normalized);
    rawLines.push(nextInfo.raw);
    jQuote += 1;
  }

  const innerSource = innerLines.join('\n');
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
    const children = ctx.parseBlocks(innerSource, ctx.errors);
    adjustNestedQuoteLevels(children, level);
    const quote: QuoteBlock = {
      type: 'quote',
      level,
      children,
      blockAttrs,
    };
    setNodeLocation(quote, ctx.lineLocation);
    block = quote;
  }

  ctx.commitBlock(block, blockAttrs);
  return jQuote;
}

export function matchQuote(content: string): QuoteMatchResult | undefined {
  const m = content.match(/^(@+)\s+(.+)$/);
  if (!m) {
    return undefined;
  }
  const atGroup = m[1];
  const textGroup = m[2];
  if (atGroup === undefined || textGroup === undefined) {
    return undefined;
  }
  const level = atGroup.length;
  const text = textGroup.trimEnd();
  return { level, text };
}

function normalizeQuoteLine(match: QuoteMatchResult, baseLevel: number): string | undefined {
  if (match.level < baseLevel) {
    return undefined;
  }
  const relativeLevel = match.level - baseLevel;
  if (relativeLevel === 0) {
    return match.text;
  }
  const nestedMarkers = '@'.repeat(relativeLevel);
  return `${nestedMarkers} ${match.text}`;
}

function adjustNestedQuoteLevels(nodes: BlockNode[], parentLevel: number): void {
  for (const node of nodes) {
    if (node.type !== 'quote') {
      continue;
    }
    node.level += parentLevel;
    adjustNestedQuoteLevels(node.children, node.level);
  }
}
