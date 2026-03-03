import { BlockRule, BlockRuleContext } from './types';
import { tryParseInclude } from './include';
import { tryParseHeading } from './heading';
import { tryParseHorizontalRule } from './horizontal-rule';

const BLOCK_RULES: BlockRule[] = [tryParseInclude, tryParseHeading, tryParseHorizontalRule];

export function tryParseBlockRules(ctx: BlockRuleContext): number | null {
  for (const rule of BLOCK_RULES) {
    const nextIndex = rule(ctx);
    if (nextIndex !== null) {
      return nextIndex;
    }
  }
  return null;
}
