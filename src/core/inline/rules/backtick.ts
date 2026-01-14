import { InlineNode } from '../../ast';
import { InlineRule, InlineRuleContext, InlineScanner } from './types';

export function readBacktickSegment(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
): InlineNode | undefined {
  const startLine = scanner.line;
  const startColumn = scanner.column;

  let tickCount = 0;
  while (!scanner.eof() && scanner.peek() === '`') {
    scanner.next();
    tickCount += 1;
  }

  if (tickCount === 0) {
    return undefined;
  }

  if (tickCount === 1) {
    let value = '';
    while (!scanner.eof()) {
      const ch = scanner.peek();
      if (ch === undefined) {
        break;
      }
      if (ch === '`') {
        scanner.next();
        return { type: 'codeSpan', value };
      }
      scanner.next();
      value += ch;
    }

    ctx.errors.push({
      message: 'Missing closing backtick for inline code span',
      line: startLine,
      column: startColumn,
      severity: 'warning',
    });
    return { type: 'text', value: `\`${value}` };
  }

  let content = '';
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === '`') {
      const saveIndex = scanner.index;
      const saveLine = scanner.line;
      const saveColumn = scanner.column;
      let matched = true;
      for (let i = 0; i < tickCount; i += 1) {
        const c = scanner.peek();
        if (c !== '`') {
          matched = false;
          break;
        }
        scanner.next();
      }
      if (matched) {
        const children = ctx.parseNested(content, startLine);
        const node: InlineNode = {
          type: 'highlight',
          mode: 'frame',
          children,
        } as InlineNode;
        return node;
      }
      scanner.index = saveIndex;
      scanner.line = saveLine;
      scanner.column = saveColumn;
    }
    scanner.next();
    content += ch;
  }

  ctx.errors.push({
    message: 'Missing closing double backticks for frame highlight',
    line: startLine,
    column: startColumn,
    severity: 'warning',
  });
  return { type: 'text', value: `${'`'.repeat(tickCount)}${content}` };
}

export const backtickRule: InlineRule = {
  flushTextBefore: true,
  parse(scanner, ctx) {
    const node = readBacktickSegment(scanner, ctx);
    if (node) {
      return { kind: 'emit', node };
    }
    const consumed = scanner.next();
    return { kind: 'append', text: consumed ?? '' };
  },
};
