import { InlineNode } from '../../ast';
import { ParseError } from '../../errors';
import { CharScanner } from '../../../lexer/lexer';

export type InlineScanner = CharScanner;

export interface InlineRuleContext {
  errors: ParseError[];
  parseNested: (text: string, baseLine: number) => InlineNode[];
}

export type InlineRuleResult =
  | { kind: 'append'; text: string }
  | { kind: 'emit'; node: InlineNode }
  | { kind: 'emitText'; text: string };

export interface InlineRule {
  flushTextBefore: boolean;
  parse: (scanner: InlineScanner, ctx: InlineRuleContext) => InlineRuleResult;
}
