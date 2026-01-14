import { InlineNode } from '../../ast';
import { InlineRule, InlineRuleContext, InlineScanner } from './types';

export function readStyledSegment(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
): InlineNode | undefined {
  const startLine = scanner.line;
  const startColumn = scanner.column;
  const marker = scanner.next();
  if (!marker) {
    return undefined;
  }

  let styleType: InlineNode['type'] | undefined;
  let expectDoubleCaret = false;

  if (marker === '*') {
    styleType = 'strong';
  } else if (marker === '/') {
    styleType = 'em';
  } else if (marker === '_') {
    styleType = 'underline';
  } else if (marker === '-') {
    styleType = 'strike';
  } else if (marker === '~') {
    styleType = 'wave';
  } else if (marker === '^') {
    if (!scanner.eof() && scanner.peek() === '^') {
      scanner.next();
      styleType = 'sub';
      expectDoubleCaret = true;
    } else {
      styleType = 'sup';
    }
  }

  if (!styleType) {
    return undefined;
  }

  let content = '';
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === marker || (marker === '^' && ch === '^')) {
      if (marker === '^' && expectDoubleCaret) {
        const saveIndex = scanner.index;
        const firstCaret = scanner.next();
        const secondCaret = scanner.peek();
        if (firstCaret === '^' && secondCaret === '^') {
          scanner.next();
          const children = ctx.parseNested(content, startLine);
          const node: InlineNode = { type: styleType, children } as InlineNode;
          return node;
        }
        scanner.index = saveIndex;
      } else {
        scanner.next();
        const children = ctx.parseNested(content, startLine);
        const node: InlineNode = { type: styleType, children } as InlineNode;
        return node;
      }
    }
    scanner.next();
    content += ch;
  }

  ctx.errors.push({
    message: 'Missing closing style delimiter',
    line: startLine,
    column: startColumn,
    severity: 'warning',
  });
  return { type: 'text', value: `${marker}${content}` } as InlineNode;
}

export const styleRule: InlineRule = {
  flushTextBefore: true,
  parse(scanner, ctx) {
    const node = readStyledSegment(scanner, ctx);
    if (node) {
      return { kind: 'emit', node };
    }
    const consumed = scanner.next();
    return { kind: 'append', text: consumed ?? '' };
  },
};
