import { BlockNode, ColorAttribute, DisabledBlock, HorizontalRuleBlock } from '../../ast';
import { setNodeLocation } from '../../location';
import { BlockRule } from './types';

interface HorizontalRuleMatchResult {
  style: HorizontalRuleBlock['style'];
  colorAttr?: ColorAttribute;
}

function parseColorAttribute(token: string): ColorAttribute | undefined {
  const text = token.trim();
  if (text.length === 0) {
    return undefined;
  }
  if (text.startsWith('#')) {
    return { kind: 'hex', value: text };
  }
  return { kind: 'preset', value: text };
}

export function matchHorizontalRule(trimmed: string): HorizontalRuleMatchResult | undefined {
  let rest = trimmed;
  let colorAttr: ColorAttribute | undefined;

  if (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end !== -1) {
      const inside = rest.slice(1, end).trim();
      const parsedColor = parseColorAttribute(inside);
      if (parsedColor) {
        colorAttr = parsedColor;
        rest = rest.slice(end + 1).trim();
      }
    }
  }

  if (rest.length < 3) {
    return undefined;
  }
  const ch = rest[0];
  if (ch !== '-' && ch !== '*' && ch !== '=' && ch !== '~') {
    return undefined;
  }
  for (let i = 1; i < rest.length; i += 1) {
    if (rest[i] !== ch) {
      return undefined;
    }
  }

  let style: HorizontalRuleBlock['style'];
  if (ch === '-') {
    style = 'solid';
  } else if (ch === '*') {
    style = 'dashed';
  } else if (ch === '=') {
    style = 'bold';
  } else {
    style = 'wavy';
  }

  return { style, colorAttr };
}

export const tryParseHorizontalRule: BlockRule = (ctx) => {
  const hrMatch = matchHorizontalRule(ctx.trimmedContent);
  if (!hrMatch) {
    return null;
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
    ctx.commitBlock(block, blockAttrs, { allowTag: false });
  } else {
    const hr: HorizontalRuleBlock = {
      type: 'hr',
      style: hrMatch.style,
      colorAttr: hrMatch.colorAttr,
      blockAttrs,
    };
    setNodeLocation(hr, ctx.lineLocation);
    block = hr;
    ctx.commitBlock(block, blockAttrs);
  }

  return ctx.index + 1;
};
