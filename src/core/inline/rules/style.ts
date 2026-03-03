import { InlineNode } from '../../ast';
import { reportParseWarning } from '../../diagnostics';
import { InlineRule, InlineRuleContext, InlineScanner } from './types';

function isAsciiWordChar(ch: string | undefined): boolean {
  if (!ch) {
    return false;
  }
  return /[A-Za-z0-9]/.test(ch);
}

function shouldTreatMarkerAsLiteralWordSeparator(
  scanner: InlineScanner,
  marker: string,
  markerStartIndex: number,
): boolean {
  if (marker !== '-' && marker !== '/' && marker !== '_' && marker !== '^') {
    return false;
  }
  const prev = markerStartIndex > 0 ? scanner.text[markerStartIndex - 1] : undefined;
  const next =
    markerStartIndex + 1 < scanner.length ? scanner.text[markerStartIndex + 1] : undefined;
  return isAsciiWordChar(prev) && isAsciiWordChar(next);
}

function hasClosingDelimiterAhead(
  scanner: InlineScanner,
  marker: string,
  expectDoubleCaret: boolean,
): boolean {
  const remaining = scanner.text.slice(scanner.index);
  if (marker === '^' && expectDoubleCaret) {
    return remaining.includes('^^');
  }
  return remaining.includes(marker);
}

export function readStyledSegment(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
): InlineNode | undefined {
  const startLine = scanner.line;
  const startColumn = scanner.column;
  const markerStartIndex = scanner.index;
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

  const openingToken = marker === '^' && expectDoubleCaret ? '^^' : marker;
  if (shouldTreatMarkerAsLiteralWordSeparator(scanner, marker, markerStartIndex)) {
    return { type: 'text', value: openingToken } as InlineNode;
  }

  if (!hasClosingDelimiterAhead(scanner, marker, expectDoubleCaret)) {
    if (marker === '-' || marker === '/' || marker === '_' || marker === '^') {
      return { type: 'text', value: openingToken } as InlineNode;
    }
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

  reportParseWarning(ctx.errors, {
    message: 'Missing closing style delimiter',
    line: startLine,
    column: startColumn,
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
