import { InlineRule } from './types';
import { backtickRule } from './backtick';
import { bracketRule } from './bracket';
import { disabledRule } from './disabled';
import { escapeRule } from './escape';
import { markerHighlightRule } from './marker-highlight';
import { styleRule } from './style';

const INLINE_RULES_BY_FIRST_CHAR: Readonly<Record<string, InlineRule>> = {
  '\\': escapeRule,
  '{': disabledRule,
  '`': backtickRule,
  '=': markerHighlightRule,
  '*': styleRule,
  '/': styleRule,
  _: styleRule,
  '-': styleRule,
  '~': styleRule,
  '^': styleRule,
  '[': bracketRule,
};

export function getInlineRuleForChar(ch: string): InlineRule | undefined {
  return INLINE_RULES_BY_FIRST_CHAR[ch];
}
