import { InlineNode } from '../../ast';
import { InlineRule, InlineRuleContext, InlineScanner } from './types';

export function readMarkerHighlight(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
): InlineNode | undefined {
  const startLine = scanner.line;
  const startColumn = scanner.column;

  const first = scanner.next();
  if (first !== '=') {
    return undefined;
  }

  const remaining = scanner.text.slice(scanner.index);
  if (!remaining.includes('=')) {
    return { type: 'text', value: '=' };
  }

  let content = '';
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === '=') {
      scanner.next();
      if (content.length === 0) {
        return { type: 'text', value: '==' };
      }
      const children = ctx.parseNested(content, startLine);
      const node: InlineNode = {
        type: 'highlight',
        mode: 'marker',
        children,
      } as InlineNode;
      return node;
    }
    scanner.next();
    content += ch;
  }

  ctx.errors.push({
    message: 'Missing closing = for marker highlight',
    line: startLine,
    column: startColumn,
    severity: 'warning',
  });
  return { type: 'text', value: `=${content}` };
}

export const markerHighlightRule: InlineRule = {
  flushTextBefore: true,
  parse(scanner, ctx) {
    const node = readMarkerHighlight(scanner, ctx);
    if (node) {
      return { kind: 'emit', node };
    }
    const consumed = scanner.next();
    return { kind: 'append', text: consumed ?? '' };
  },
};
