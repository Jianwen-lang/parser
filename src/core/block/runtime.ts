import { BlockAttributes, BlockNode, CommentBlock, TaggedBlock } from '../ast';
import { getNodeLocation, SourceLocation, setNodeLocation } from '../location';
import { CommitBlockOptions } from './rules/types';
import { PendingBlockContext } from './types';

interface LineInfoLike {
  tabCount: number;
}

export interface BlockParseRuntime {
  pending: PendingBlockContext;
  lastBlockPosition: BlockAttributes['position'];
}

interface CommitParsedBlockParams {
  runtime: BlockParseRuntime;
  blocks: BlockNode[];
  block: BlockNode;
  blockAttrs: BlockAttributes | undefined;
  lineInfo: LineInfoLike;
  lineLocation: SourceLocation;
  options?: CommitBlockOptions;
}

export function createBlockParseRuntime(): BlockParseRuntime {
  return {
    pending: {
      attrs: undefined,
      anchorLocation: undefined,
      foldNext: false,
      tagName: undefined,
      isComment: false,
      isDisabled: false,
      isSheet: false,
      isHtml: false,
    },
    lastBlockPosition: 'L',
  };
}

export function buildBlockAttrs(
  runtime: BlockParseRuntime,
  tabCount: number,
): BlockAttributes | undefined {
  const baseAttrs = runtime.pending.attrs ? { ...runtime.pending.attrs } : undefined;
  const positionFromTabs = mapTabsToPosition(tabCount);
  let blockAttrs: BlockAttributes | undefined = baseAttrs;

  if (positionFromTabs) {
    if (!blockAttrs) {
      blockAttrs = {};
    }
    if (!blockAttrs.position) {
      blockAttrs.position = positionFromTabs;
    }
  }

  if (runtime.pending.foldNext) {
    if (!blockAttrs) {
      blockAttrs = {};
    }
    blockAttrs.fold = true;
  }

  return blockAttrs;
}

export function resetPending(pending: PendingBlockContext): void {
  pending.attrs = undefined;
  pending.anchorLocation = undefined;
  pending.foldNext = false;
  pending.tagName = undefined;
  pending.isComment = false;
  pending.isDisabled = false;
  pending.isSheet = false;
  pending.isHtml = false;
}

export function commitParsedBlock(params: CommitParsedBlockParams): void {
  const { runtime, blocks, block, blockAttrs, lineInfo, lineLocation, options } = params;
  const existingLocation = getNodeLocation(block);
  const shouldReanchor =
    existingLocation?.line !== lineLocation.line ||
    existingLocation?.column !== lineLocation.column;
  const blockToCommit = shouldReanchor ? ({ ...block } as BlockNode) : block;
  if (!existingLocation || shouldReanchor) {
    setNodeLocation(blockToCommit, lineLocation);
  }
  const allowTag = options?.allowTag !== false;
  const taggedOrOriginal = allowTag
    ? wrapTaggedIfNeeded(blockToCommit, runtime.pending, blockAttrs, lineLocation)
    : blockToCommit;
  const finalBlock = wrapCommentIfNeeded(taggedOrOriginal, runtime.pending, lineLocation);
  blocks.push(finalBlock);
  runtime.lastBlockPosition = resolveNextPosition(
    getBlockAttributes(finalBlock),
    lineInfo.tabCount,
    runtime.lastBlockPosition,
  );
  resetPending(runtime.pending);
  options?.postResetPending?.(runtime.pending);
}

function wrapTaggedIfNeeded(
  block: BlockNode,
  pending: PendingBlockContext,
  blockAttrs: BlockAttributes | undefined,
  lineLocation: SourceLocation,
): BlockNode {
  if (!pending.tagName) {
    return block;
  }
  const tagged: TaggedBlock = {
    type: 'taggedBlock',
    name: pending.tagName,
    child: block,
    blockAttrs,
  };
  setNodeLocation(tagged, lineLocation);
  return tagged;
}

function wrapCommentIfNeeded(
  block: BlockNode,
  pending: PendingBlockContext,
  lineLocation: SourceLocation,
): BlockNode {
  if (!pending.isComment) {
    return block;
  }
  const comment: CommentBlock = {
    type: 'commentBlock',
    children: [block],
    blockAttrs: undefined,
  };
  setNodeLocation(comment, lineLocation);
  return comment;
}

function getBlockAttributes(block: BlockNode): BlockAttributes | undefined {
  if ('blockAttrs' in block) {
    const candidate = (block as { blockAttrs?: BlockAttributes }).blockAttrs;
    return candidate;
  }
  return undefined;
}

function resolveNextPosition(
  attrs: BlockAttributes | undefined,
  tabCount: number,
  fallback: BlockAttributes['position'],
): BlockAttributes['position'] {
  if (attrs?.position) {
    return attrs.position;
  }
  const tabPosition = mapTabsToPosition(tabCount);
  if (tabPosition) {
    return tabPosition;
  }
  return fallback;
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
