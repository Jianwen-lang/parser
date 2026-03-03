import { BlockAttributes } from '../../ast';
import { reportParseWarning } from '../../diagnostics';
import { ParseError } from '../../errors';
import { matchInclude } from './include';
import { PendingBlockContext } from '../types';

const MULTI_ARROW_WARNING_CODE = 'layout-multi-arrow';
const UNKNOWN_ATTRIBUTE_WARNING_CODE = 'unknown-attribute-token';

interface AttributeLineResult {
  attrs?: BlockAttributes;
  foldNext: boolean;
  tagName?: string;
  isComment: boolean;
  isDisabled: boolean;
  isSheet: boolean;
  isHtml: boolean;
  recognizedAny: boolean;
}

export interface ConsumeAttributeLineOptions {
  text: string;
  lineNumber: number;
  errors: ParseError[];
  pending: PendingBlockContext;
  fallbackPosition?: BlockAttributes['position'];
  tabCount?: number;
}

export function isAttributeOnlyLine(text: string): boolean {
  if (text.length === 0) {
    return false;
  }
  const trimmed = text.trim();
  if (matchInclude(trimmed)) {
    return false;
  }

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '[') {
      const end = text.indexOf(']', i + 1);
      if (end === -1) {
        return false;
      }
      i = end + 1;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      i += 1;
      continue;
    }
    return false;
  }
  return true;
}

export function tryConsumeAttributeOnlyLine(options: ConsumeAttributeLineOptions): boolean {
  const result = parseAttributeLine(
    options.text,
    options.lineNumber,
    options.errors,
    options.pending.attrs,
    options.fallbackPosition,
    options.tabCount,
  );
  if (!result.recognizedAny) {
    return false;
  }

  if (result.attrs) {
    options.pending.attrs = mergeBlockAttributes(options.pending.attrs, result.attrs);
  }
  if (result.foldNext) {
    options.pending.foldNext = true;
  }
  if (result.tagName) {
    options.pending.tagName = result.tagName;
  }
  if (result.isComment) {
    options.pending.isComment = true;
  }
  if (result.isDisabled) {
    options.pending.isDisabled = true;
  }
  if (result.isSheet) {
    options.pending.isSheet = true;
  }
  if (result.isHtml) {
    options.pending.isHtml = true;
  }
  return true;
}

function parseAttributeLine(
  text: string,
  lineNumber: number,
  errors: ParseError[],
  baseAttrs?: BlockAttributes,
  fallbackPosition?: BlockAttributes['position'],
  tabCount?: number,
): AttributeLineResult {
  const result: AttributeLineResult = {
    attrs: undefined,
    foldNext: false,
    tagName: undefined,
    isComment: false,
    isDisabled: false,
    isSheet: false,
    isHtml: false,
    recognizedAny: false,
  };
  let attrs: BlockAttributes | undefined = baseAttrs ? { ...baseAttrs } : undefined;
  const unknownTokens: string[] = [];

  let arrowCount = 0;

  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('[', i);
    if (start === -1) {
      break;
    }
    const end = text.indexOf(']', start + 1);
    if (end === -1) {
      break;
    }
    const inside = text.slice(start + 1, end).trim();
    if (inside.length === 0) {
      i = end + 1;
      continue;
    }
    const parts = inside.split(',');
    for (const rawPart of parts) {
      const part = rawPart.trim();
      if (part.length === 0) {
        continue;
      }
      if (part === 'c') {
        attrs = ensureBlockAttributes(attrs);
        attrs.align = 'center';
        result.recognizedAny = true;
        continue;
      }
      if (part === 'r') {
        attrs = ensureBlockAttributes(attrs);
        attrs.align = 'right';
        result.recognizedAny = true;
        continue;
      }
      if (part === '->' || part === '<-' || part === '<->') {
        arrowCount += 1;
        result.recognizedAny = true;
        if (part === '->' && arrowCount > 2) {
          reportParseWarning(errors, {
            message:
              'More than two [->] attributes in a row; extra [->] will be treated as plain text.',
            line: lineNumber,
            code: MULTI_ARROW_WARNING_CODE,
          });
          continue;
        }
        attrs = ensureBlockAttributes(attrs);
        if (part === '->' || part === '<->') {
          const basePosition =
            attrs.position ??
            fallbackPosition ??
            (tabCount !== undefined ? mapTabsToPosition(tabCount) : undefined);
          attrs.position = shiftPositionRight(basePosition);
          attrs.sameLine = true;
        }
        if (part === '<-' || part === '<->') {
          attrs.truncateRight = true;
        }
        continue;
      }
      if (part === 'fold') {
        result.foldNext = true;
        result.recognizedAny = true;
        continue;
      }
      if (part === 'sheet') {
        result.isSheet = true;
        result.recognizedAny = true;
        continue;
      }
      if (part === 'html') {
        result.isHtml = true;
        result.recognizedAny = true;
        continue;
      }
      if (part === 'comment') {
        result.isComment = true;
        result.recognizedAny = true;
        continue;
      }
      if (part === 'disable' || part === 'd') {
        result.isDisabled = true;
        result.recognizedAny = true;
        continue;
      }
      if (part.startsWith('tag=')) {
        result.tagName = part.slice('tag='.length);
        result.recognizedAny = true;
        continue;
      }
      if (part.startsWith('t=')) {
        result.tagName = part.slice(2);
        result.recognizedAny = true;
        continue;
      }
      if (part.startsWith('f=')) {
        result.tagName = part.slice(2);
        result.recognizedAny = true;
        continue;
      }

      unknownTokens.push(part);
      continue;
    }
    i = end + 1;
  }

  if (!result.recognizedAny && unknownTokens.length > 0) {
    for (const token of unknownTokens) {
      reportParseWarning(errors, {
        message: `Unknown block attribute token "${token}"`,
        line: lineNumber,
        code: UNKNOWN_ATTRIBUTE_WARNING_CODE,
      });
    }
  }

  result.attrs = attrs;
  return result;
}

function ensureBlockAttributes(attrs?: BlockAttributes): BlockAttributes {
  if (attrs) {
    return attrs;
  }
  return {};
}

function mergeBlockAttributes(
  base: BlockAttributes | undefined,
  extra: BlockAttributes,
): BlockAttributes {
  if (!base) {
    return { ...extra };
  }
  return { ...base, ...extra };
}

function mapTabsToPosition(tabCount: number): BlockAttributes['position'] {
  if (tabCount === 0) {
    return 'L';
  }
  if (tabCount === 1) {
    return 'C';
  }
  if (tabCount >= 2) {
    return 'R';
  }
  return undefined;
}

function shiftPositionRight(position: BlockAttributes['position']): BlockAttributes['position'] {
  if (position === 'L') {
    return 'C';
  }
  if (position === 'C') {
    return 'R';
  }
  if (position === 'R') {
    return 'R';
  }
  return 'C';
}
