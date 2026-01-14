import { BlockAttributes, BlockNode } from '../../ast';
import { ParseError } from '../../errors';
import { SourceLocation } from '../../location';
import { PendingBlockContext } from '../types';
import { LineInfo } from '../../../lexer/lexer';

export interface CommitBlockOptions {
  allowTag?: boolean;
  postResetPending?: (pending: PendingBlockContext) => void;
}

export interface BlockRuleContext {
  lines: string[];
  index: number;
  lineInfo: LineInfo;
  trimmedContent: string;
  lineLocation: SourceLocation;
  pending: PendingBlockContext;
  errors: ParseError[];
  buildBlockAttrs: (tabCount: number) => BlockAttributes | undefined;
  commitBlock: (
    block: BlockNode,
    blockAttrs: BlockAttributes | undefined,
    options?: CommitBlockOptions,
  ) => void;
}

export type BlockRule = (ctx: BlockRuleContext) => number | null;
