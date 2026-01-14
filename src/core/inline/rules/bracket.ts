import { ColorAttribute, InlineAttributes, InlineNode, LinkNode } from '../../ast';
import { ParseError } from '../../errors';
import { reportParseWarning } from '../../diagnostics';
import { setNodeLocation } from '../../location';
import { InlineFontStyleKey } from '../types';
import { readBacktickSegment } from './backtick';
import { readMarkerHighlight } from './marker-highlight';
import { readStyledSegment } from './style';
import { InlineRule, InlineRuleContext, InlineScanner } from './types';

const INLINE_FONT_STYLE_KEYS = new Set<InlineFontStyleKey>([
  'italic',
  'bold',
  'heavy',
  'slim',
  'serif',
  'mono',
]);
const INLINE_FONT_STYLE_ALIASES: Readonly<Record<string, InlineFontStyleKey>> = {
  i: 'italic',
  b: 'bold',
  bb: 'heavy',
};

function splitInlineAttributeParts(inside: string): string[] {
  return inside
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function normalizeFontStyleKey(part: string): InlineFontStyleKey | undefined {
  const alias = INLINE_FONT_STYLE_ALIASES[part];
  if (alias) {
    return alias;
  }
  if (INLINE_FONT_STYLE_KEYS.has(part as InlineFontStyleKey)) {
    return part as InlineFontStyleKey;
  }
  return undefined;
}

function parseColorAttributeFromToken(token: string): ColorAttribute | undefined {
  const value = token.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (value.startsWith('#')) {
    return { kind: 'hex', value };
  }
  return { kind: 'preset', value };
}

function isInlineAttributeExpression(inside: string): boolean {
  const parts = splitInlineAttributeParts(inside);
  if (parts.length === 0) {
    return false;
  }

  for (const part of parts) {
    if (part === '->' || part === '<-' || part === '<->') {
      return false;
    }
  }

  let hasRecognized = false;
  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }
    hasRecognized = true;

    const asNumber = Number(part);
    if (!Number.isNaN(asNumber)) {
      if (
        asNumber >= 0.5 &&
        asNumber <= 5 &&
        Math.abs(asNumber * 2 - Math.round(asNumber * 2)) < 1e-6
      ) {
        continue;
      }
      return false;
    }

    const styleKey = normalizeFontStyleKey(part);
    if (styleKey) {
      continue;
    }

    if (part.startsWith('!')) {
      if (parseColorAttributeFromToken(part.slice(1))) {
        continue;
      }
      return false;
    }

    if (parseColorAttributeFromToken(part)) {
      continue;
    }

    return false;
  }

  return hasRecognized;
}

function parseInlineAttributes(
  inside: string,
  errors: ParseError[],
  line: number,
  column: number,
): InlineAttributes | undefined {
  const parts = splitInlineAttributeParts(inside);
  if (parts.length === 0) {
    return undefined;
  }

  const attrs: InlineAttributes = {};
  const fontStyles: InlineFontStyleKey[] = [];

  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }

    if (part === '->' || part === '<-' || part === '<->') {
      continue;
    }

    const asNumber = Number(part);
    if (!Number.isNaN(asNumber)) {
      const size = asNumber;
      if (size >= 0.5 && size <= 5 && Math.abs(size * 2 - Math.round(size * 2)) < 1e-6) {
        attrs.fontSize = size;
      } else {
        reportParseWarning(errors, {
          message: `Invalid fontSize ${part} in inline attributes`,
          line,
          column,
        });
      }
      continue;
    }

    const styleKey = normalizeFontStyleKey(part);
    if (styleKey) {
      fontStyles.push(styleKey);
      continue;
    }

    if (part.startsWith('!')) {
      const color = parseColorAttributeFromToken(part.slice(1));
      if (color) {
        attrs.secondaryColor = color;
      }
      continue;
    }

    const color = parseColorAttributeFromToken(part);
    if (color) {
      attrs.color = color;
      continue;
    }
  }

  if (fontStyles.length > 0) {
    attrs.fontStyle = fontStyles;
  }

  if (!attrs.color && !attrs.secondaryColor && !attrs.fontSize && !attrs.fontStyle) {
    return undefined;
  }
  return attrs;
}

function mergeInlineAttributes(base: InlineAttributes, next: InlineAttributes): InlineAttributes {
  const merged: InlineAttributes = { ...base };

  if (next.color) {
    merged.color = next.color;
  }
  if (next.secondaryColor) {
    merged.secondaryColor = next.secondaryColor;
  }
  if (next.fontSize) {
    merged.fontSize = next.fontSize;
  }
  if (next.fontStyle) {
    const styles = [...(merged.fontStyle ?? [])];
    for (const style of next.fontStyle) {
      if (!styles.includes(style)) {
        styles.push(style);
      }
    }
    merged.fontStyle = styles;
  }

  return merged;
}

function isInlineSymbol(ch: string): boolean {
  return (
    ch === '`' ||
    ch === '=' ||
    ch === '*' ||
    ch === '/' ||
    ch === '_' ||
    ch === '-' ||
    ch === '~' ||
    ch === '^' ||
    ch === '['
  );
}

function applyHighlightColorsFromAttrs(
  node: InlineNode,
  attrs: InlineAttributes | undefined,
): void {
  if (node.type !== 'highlight' || !attrs) {
    return;
  }

  if (attrs.color) {
    node.colorAttr = attrs.color;
  }
  if (attrs.secondaryColor) {
    node.fillColorAttr = attrs.secondaryColor;
  }
}

function parseInlineAttrsNode(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
  attrs: InlineAttributes,
  baseLine: number,
  startColumn: number,
  rawInside: string,
): InlineNode | string | undefined {
  let segment = '';
  let closedBySlash = false;
  let closedByLineBreak = false;
  let closedByNextAttr = false;

  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === '\n') {
      closedByLineBreak = true;
      break;
    }
    if (ch === '[') {
      const saveIndex = scanner.index;
      const saveLine = scanner.line;
      const saveColumn = scanner.column;
      scanner.next();
      const next1 = scanner.peek();
      if (next1 === '/') {
        scanner.next();
        const next2 = scanner.peek();
        if (next2 === ']') {
          scanner.next();
          closedBySlash = true;
          break;
        }
      } else {
        const rest = scanner.text.slice(scanner.index);
        const closingOffset = rest.indexOf(']');
        if (closingOffset !== -1) {
          const insideCandidate = rest.slice(0, closingOffset);
          if (isInlineAttributeExpression(insideCandidate)) {
            closedByNextAttr = true;
            scanner.index = saveIndex;
            scanner.line = saveLine;
            scanner.column = saveColumn;
            break;
          }
        }
      }
      scanner.index = saveIndex;
      scanner.line = saveLine;
      scanner.column = saveColumn;
    }

    scanner.next();
    segment += ch;
  }

  const endedByEof = scanner.eof();

  if (!closedBySlash && !closedByLineBreak && !closedByNextAttr && !endedByEof) {
    reportParseWarning(ctx.errors, {
      message: 'Missing closing [/] for inline attributes',
      line: baseLine,
      column: startColumn,
    });
    return `[${rawInside}]${segment}`;
  }

  const children = ctx.parseNested(segment, baseLine);
  const node: InlineNode = {
    type: 'inlineAttrs',
    attrs,
    children,
  } as InlineNode;
  return node;
}

function parseLinkAfterLinkKeyword(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
  startLine: number,
): InlineNode | string | undefined {
  let raw = '[link]';

  let linkColor: ColorAttribute | undefined;
  let underlineColor: ColorAttribute | undefined;

  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch !== '[') {
      break;
    }

    const saveIndex = scanner.index;
    const saveLine = scanner.line;
    const saveColumn = scanner.column;
    scanner.next();

    let attrInside = '';
    let attrClosed = false;
    while (!scanner.eof()) {
      const c = scanner.peek();
      if (c === undefined) {
        break;
      }
      if (c === ']') {
        scanner.next();
        attrClosed = true;
        break;
      }
      scanner.next();
      attrInside += c;
    }

    if (!attrClosed) {
      reportParseWarning(ctx.errors, {
        message: 'Missing closing ] for link attribute',
        line: saveLine,
        column: saveColumn,
      });
      return `[link][${attrInside}`;
    }

    if (attrInside.length === 0) {
      scanner.index = saveIndex;
      scanner.line = saveLine;
      scanner.column = saveColumn;
      break;
    }

    const parts = attrInside
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    let recognizedColor = false;
    for (const part of parts) {
      if (part.startsWith('!')) {
        const color = parseColorAttributeFromToken(part.slice(1));
        if (color) {
          underlineColor = color;
          recognizedColor = true;
        }
      } else {
        const color = parseColorAttributeFromToken(part);
        if (color) {
          linkColor = color;
          recognizedColor = true;
        }
      }
    }

    if (!recognizedColor) {
      scanner.index = saveIndex;
      scanner.line = saveLine;
      scanner.column = saveColumn;
      break;
    }

    raw += `[${attrInside}]`;
  }

  let text = '';
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === '(') {
      break;
    }
    scanner.next();
    text += ch;
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return raw + text;
  }

  raw += text;

  const next = scanner.peek();
  if (next !== '(') {
    reportParseWarning(ctx.errors, {
      message: 'Missing (url) after [link]text for inline link',
      line: scanner.line,
      column: scanner.column,
    });
    return raw;
  }

  scanner.next();
  let url = '';
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === ')') {
      scanner.next();
      break;
    }
    scanner.next();
    url += ch;
  }

  const href = url.trim();
  if (href.length === 0) {
    reportParseWarning(ctx.errors, {
      message: 'Empty url in inline link',
      line: scanner.line,
      column: scanner.column,
    });
    return `${raw}()`;
  }

  raw += `(${url})`;

  const children = ctx.parseNested(trimmedText, startLine);

  const node: InlineNode = {
    type: 'link',
    href,
    children,
  } as InlineNode;

  const linkNode = node as LinkNode;
  if (linkColor) {
    linkNode.colorAttr = linkColor;
  }
  if (underlineColor) {
    linkNode.underlineColorAttr = underlineColor;
  }

  return node;
}

export function parseBracketExpression(
  scanner: InlineScanner,
  ctx: InlineRuleContext,
): InlineNode | string | undefined {
  const startLine = scanner.line;
  const startColumn = scanner.column;

  const open = scanner.next();
  if (open !== '[') {
    return undefined;
  }

  let inside = '';
  let closed = false;
  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }
    if (ch === ']') {
      scanner.next();
      closed = true;
      break;
    }
    scanner.next();
    inside += ch;
  }

  if (!closed) {
    reportParseWarning(ctx.errors, {
      message: 'Missing closing ] for bracket expression',
      line: startLine,
      column: startColumn,
    });
    return `[${inside}`;
  }

  if (inside.length === 0) {
    return '[]';
  }

  if (inside.startsWith('fn:')) {
    const id = inside.slice(3).trim();
    if (id.length === 0) {
      return `[${inside}]`;
    }
    const node: InlineNode = {
      type: 'footnoteRef',
      id,
    } as InlineNode;
    setNodeLocation(node, { line: startLine, column: startColumn });
    return node;
  }

  if (inside === 'comment') {
    let content = '';
    while (!scanner.eof()) {
      const ch = scanner.peek();
      if (ch === undefined) {
        break;
      }
      if (ch === '[') {
        const saveIndex = scanner.index;
        const saveLine = scanner.line;
        const saveColumn = scanner.column;
        scanner.next();
        const next1 = scanner.peek();
        if (next1 === '/') {
          scanner.next();
          const next2 = scanner.peek();
          if (next2 === ']') {
            scanner.next();
            const children = ctx.parseNested(content, startLine);
            const node: InlineNode = {
              type: 'commentInline',
              children,
            } as InlineNode;
            return node;
          }
        }
        scanner.index = saveIndex;
        scanner.line = saveLine;
        scanner.column = saveColumn;
      }
      scanner.next();
      content += ch;
    }

    reportParseWarning(ctx.errors, {
      message: 'Missing closing [/] for inline comment',
      line: startLine,
      column: startColumn,
    });
    return `[comment]${content}`;
  }

  if (inside === 'link') {
    const linkNodeOrText = parseLinkAfterLinkKeyword(scanner, ctx, startLine);
    if (linkNodeOrText) {
      return linkNodeOrText;
    }
    return '[link]';
  }

  const attrs = parseInlineAttributes(inside, ctx.errors, startLine, startColumn);
  if (attrs) {
    let mergedAttrs = attrs;
    let mergedRawInside = inside;

    while (true) {
      const nextCh = scanner.peek();
      if (nextCh !== '[') {
        break;
      }

      const saveIndex = scanner.index;
      const saveLine = scanner.line;
      const saveColumn = scanner.column;
      scanner.next();

      let attrInside = '';
      let attrClosed = false;
      while (!scanner.eof()) {
        const ch = scanner.peek();
        if (ch === undefined) {
          break;
        }
        if (ch === ']') {
          scanner.next();
          attrClosed = true;
          break;
        }
        scanner.next();
        attrInside += ch;
      }

      if (!attrClosed) {
        reportParseWarning(ctx.errors, {
          message: 'Missing closing ] for inline attributes',
          line: saveLine,
          column: saveColumn,
        });
        return `[${mergedRawInside}][${attrInside}`;
      }

      if (!isInlineAttributeExpression(attrInside)) {
        scanner.index = saveIndex;
        scanner.line = saveLine;
        scanner.column = saveColumn;
        break;
      }

      const nextAttrs = parseInlineAttributes(attrInside, ctx.errors, saveLine, saveColumn);
      if (!nextAttrs) {
        scanner.index = saveIndex;
        scanner.line = saveLine;
        scanner.column = saveColumn;
        break;
      }

      mergedAttrs = mergeInlineAttributes(mergedAttrs, nextAttrs);
      mergedRawInside += `][${attrInside}`;
    }

    const nextCh = scanner.peek();
    if (nextCh !== undefined && isInlineSymbol(nextCh)) {
      const symbol = nextCh;
      let inner: InlineNode | string | undefined;
      if (symbol === '`') {
        inner = readBacktickSegment(scanner, ctx);
      } else if (symbol === '=') {
        inner = readMarkerHighlight(scanner, ctx);
      } else if (
        symbol === '*' ||
        symbol === '/' ||
        symbol === '_' ||
        symbol === '-' ||
        symbol === '~' ||
        symbol === '^'
      ) {
        inner = readStyledSegment(scanner, ctx);
      } else if (symbol === '[') {
        inner = parseBracketExpression(scanner, ctx);
      }

      if (!inner) {
        return `[${inside}]`;
      }
      if (typeof inner === 'string') {
        return `[${inside}]${inner}`;
      }

      if (inner.type === 'highlight') {
        applyHighlightColorsFromAttrs(inner, mergedAttrs);
        delete mergedAttrs.color;
        delete mergedAttrs.secondaryColor;
      }

      const node: InlineNode = {
        type: 'inlineAttrs',
        attrs: mergedAttrs,
        children: [inner],
      } as InlineNode;
      return node;
    }

    const saveIndex = scanner.index;
    const saveLine = scanner.line;
    const saveColumn = scanner.column;

    let linkText = '';
    let foundParen = false;
    while (!scanner.eof()) {
      const ch = scanner.peek();
      if (ch === undefined) {
        break;
      }
      if (ch === '(') {
        foundParen = true;
        break;
      }
      if (ch === '\n') {
        break;
      }
      scanner.next();
      linkText += ch;
    }

    if (foundParen && linkText.length > 0) {
      scanner.next();
      let url = '';
      let foundCloseParen = false;
      while (!scanner.eof()) {
        const ch = scanner.peek();
        if (ch === ')') {
          scanner.next();
          foundCloseParen = true;
          break;
        }
        scanner.next();
        url += ch;
      }

      if (foundCloseParen && url.length > 0) {
        const children = ctx.parseNested(linkText.trim(), startLine);
        const linkNode: LinkNode = {
          type: 'link',
          href: url,
          children,
        };

        if (mergedAttrs.color) {
          linkNode.colorAttr = mergedAttrs.color;
        }
        if (mergedAttrs.secondaryColor) {
          linkNode.underlineColorAttr = mergedAttrs.secondaryColor;
        }

        return linkNode;
      }
    }

    scanner.index = saveIndex;
    scanner.line = saveLine;
    scanner.column = saveColumn;

    const node = parseInlineAttrsNode(
      scanner,
      ctx,
      mergedAttrs,
      startLine,
      startColumn,
      mergedRawInside,
    );
    if (node) {
      return node;
    }
  }

  return `[${inside}]`;
}

export const bracketRule: InlineRule = {
  flushTextBefore: true,
  parse(scanner, ctx) {
    const result = parseBracketExpression(scanner, ctx);
    if (!result) {
      return { kind: 'append', text: '' };
    }
    if (typeof result === 'string') {
      return { kind: 'emitText', text: result };
    }
    return { kind: 'emit', node: result };
  },
};
