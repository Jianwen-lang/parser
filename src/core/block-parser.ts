import {
  BlockAttributes,
  BlockNode,
  CodeBlock,
  CommentBlock,
  ContentTitleBlock,
  DisabledBlock,
  FootnoteDefBlock,
  FootnotesBlock,
  HtmlBlock,
  ImageBlock,
  ListBlock,
  ListItemBlock,
  ListKind,
  ParagraphBlock,
  QuoteBlock,
  RawBlock,
  TableBlock,
  TableCell,
  TableRow,
  TaggedBlock,
  TaskStatus,
} from './ast';
import { ParseError } from './errors';
import { setNodeLocation } from './location';
import { tryParseBlockRules } from './block/rules';
import { matchHeading } from './block/rules/heading';
import { matchHorizontalRule } from './block/rules/horizontal-rule';
import { matchInclude } from './block/rules/include';
import { PendingBlockContext } from './block/types';
import { getLineInfo as getLineInfoFromLexer, LineInfo as LexerLineInfo } from '../lexer/lexer';

type LineInfo = LexerLineInfo;

function buildLineLocation(
  lineIndex: number,
  lineInfo: LineInfo,
): { line: number; column: number } {
  return { line: lineIndex + 1, column: lineInfo.tabCount + 1 };
}

interface AttributeLineResult {
  attrs?: BlockAttributes;
  foldNext: boolean;
  tagName?: string;
  isComment: boolean;
  isDisabled: boolean;
  isSheet: boolean;
  isHtml: boolean;
}

const MULTI_ARROW_WARNING_CODE = 'layout-multi-arrow';

function buildBlockAttrs(
  pending: PendingBlockContext,
  tabCount: number,
): BlockAttributes | undefined {
  const baseAttrs = pending.attrs ? { ...pending.attrs } : undefined;
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

  if (pending.foldNext) {
    if (!blockAttrs) {
      blockAttrs = {};
    }
    blockAttrs.fold = true;
  }

  return blockAttrs;
}

function resetPending(pending: PendingBlockContext): void {
  pending.attrs = undefined;
  pending.foldNext = false;
  pending.tagName = undefined;
  pending.isComment = false;
  pending.isDisabled = false;
  pending.isSheet = false;
  pending.isHtml = false;
}

function wrapTaggedIfNeeded(
  block: BlockNode,
  pending: PendingBlockContext,
  blockAttrs: BlockAttributes | undefined,
  lineLocation: { line: number; column: number },
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
  lineLocation: { line: number; column: number },
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

function pushBlockAndResetPending(
  blocks: BlockNode[],
  block: BlockNode,
  lineInfo: LineInfo,
  pending: PendingBlockContext,
  lastBlockPosition: BlockAttributes['position'],
): BlockAttributes['position'] {
  blocks.push(block);
  const nextPosition = resolveNextPosition(
    getBlockAttributes(block),
    lineInfo.tabCount,
    lastBlockPosition,
  );
  resetPending(pending);
  return nextPosition;
}

export function parseBlocks(source: string, errors: ParseError[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  const lines = source.split(/\r?\n/);
  const pending: PendingBlockContext = {
    attrs: undefined,
    foldNext: false,
    tagName: undefined,
    isComment: false,
    isDisabled: false,
    isSheet: false,
    isHtml: false,
  };
  let lastBlockPosition: BlockAttributes['position'] = 'L';

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw === undefined) {
      i += 1;
      continue;
    }

    const lineInfo = getLineInfo(raw);
    const lineLocation = buildLineLocation(i, lineInfo);
    const trimmedContent = lineInfo.content.trim();

    if (trimmedContent.length === 0) {
      i += 1;
      continue;
    }

    if (isFootnotesLine(trimmedContent)) {
      const rawLines: string[] = [lineInfo.raw];
      const regionLines: string[] = [];

      let jFoot = i + 1;
      while (jFoot < lines.length) {
        const nextRaw = lines[jFoot];
        if (nextRaw === undefined) {
          jFoot += 1;
          continue;
        }
        const nextInfo = getLineInfo(nextRaw);
        const nextTrimmed = nextInfo.content.trim();
        if (nextTrimmed.length === 0) {
          break;
        }
        rawLines.push(nextInfo.raw);
        regionLines.push(nextInfo.content);
        jFoot += 1;
      }

      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: rawLines.join('\n'),
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const children = parseFootnoteDefs(regionLines, errors);
        const footnotesBlock: FootnotesBlock = {
          type: 'footnotes',
          children,
          blockAttrs,
        };
        setNodeLocation(footnotesBlock, lineLocation);
        block = wrapTaggedIfNeeded(footnotesBlock, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i = jFoot;
      continue;
    }

    // Check for code blocks - both plain ``` and attributed [html]``` forms
    const codeFenceStart = matchCodeFenceStart(trimmedContent);
    const attrCodeFenceStart = codeFenceStart ? null : matchAttributedCodeFence(trimmedContent);
    const effectiveCodeFence = codeFenceStart || attrCodeFenceStart;
    if (effectiveCodeFence) {
      const rawLines: string[] = [lineInfo.raw];
      const codeLines: string[] = [];
      // Record the indentation level of the opening ``` to strip from content lines
      const fenceIndent = lineInfo.tabCount;

      let jCode = i + 1;
      let closed = false;
      while (jCode < lines.length) {
        const nextRaw = lines[jCode];
        if (nextRaw === undefined) {
          jCode += 1;
          continue;
        }
        const nextInfo = getLineInfo(nextRaw);
        const nextTrimmed = nextInfo.content.trim();
        if (isCodeFenceEnd(nextTrimmed)) {
          rawLines.push(nextInfo.raw);
          closed = true;
          jCode += 1;
          break;
        }
        rawLines.push(nextInfo.raw);
        // Strip leading tabs matching the fence indentation level
        let codeLine = nextRaw;
        for (let t = 0; t < fenceIndent && codeLine.startsWith('\t'); t++) {
          codeLine = codeLine.slice(1);
        }
        codeLines.push(codeLine);
        jCode += 1;
      }

      if (!closed) {
        const error: ParseError = {
          message: 'Code block is not closed with ```',
          line: i + 1,
          severity: 'error',
        };
        errors.push(error);
      }

      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      // Determine if this is an HTML block from either pending state or inline attribute
      const isHtmlBlock = pending.isHtml || (attrCodeFenceStart?.isHtml ?? false);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: rawLines.join('\n'),
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const codeBlock: CodeBlock = {
          type: 'code',
          language: effectiveCodeFence.language,
          value: codeLines.join('\n'),
          htmlLike: isHtmlBlock ? true : undefined,
          blockAttrs,
        };
        setNodeLocation(codeBlock, lineLocation);
        block = wrapTaggedIfNeeded(codeBlock, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i = jCode;
      continue;
    }

    if (isAttributeOnlyLine(trimmedContent)) {
      const result = parseAttributeLine(
        trimmedContent,
        i + 1,
        errors,
        pending.attrs,
        lastBlockPosition,
        lineInfo.tabCount,
      );
      if (result.attrs) {
        pending.attrs = mergeBlockAttributes(pending.attrs, result.attrs);
      }
      if (result.foldNext) {
        pending.foldNext = true;
      }
      if (result.tagName) {
        pending.tagName = result.tagName;
      }
      if (result.isComment) {
        pending.isComment = true;
      }
      if (result.isDisabled) {
        pending.isDisabled = true;
      }
      if (result.isSheet) {
        pending.isSheet = true;
      }
      if (result.isHtml) {
        pending.isHtml = true;
      }
      i += 1;
      continue;
    }

    const commitBlock = (
      block: BlockNode,
      blockAttrs: BlockAttributes | undefined,
      options?: {
        allowTag?: boolean;
        postResetPending?: (pending: PendingBlockContext) => void;
      },
    ): void => {
      const allowTag = options?.allowTag !== false;
      const taggedOrOriginal = allowTag
        ? wrapTaggedIfNeeded(block, pending, blockAttrs, lineLocation)
        : block;
      const finalBlock = wrapCommentIfNeeded(taggedOrOriginal, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        finalBlock,
        lineInfo,
        pending,
        lastBlockPosition,
      );
      options?.postResetPending?.(pending);
    };

    const nextIndexFromRule = tryParseBlockRules({
      lines,
      index: i,
      lineInfo,
      trimmedContent,
      lineLocation,
      pending,
      errors,
      buildBlockAttrs: (tabCount) => buildBlockAttrs(pending, tabCount),
      commitBlock,
    });
    if (nextIndexFromRule !== null) {
      i = nextIndexFromRule;
      continue;
    }

    const contentTitleMatch = matchContentTitle(lineInfo.content);
    if (contentTitleMatch) {
      const text = contentTitleMatch.text;

      let consumedByImageTitle = false;
      if (
        !pending.attrs &&
        !pending.foldNext &&
        !pending.tagName &&
        !pending.isComment &&
        !pending.isDisabled &&
        !pending.isSheet &&
        !pending.isHtml
      ) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.type === 'image') {
          lastBlock.title = text;
          consumedByImageTitle = true;
        } else if (
          lastBlock &&
          lastBlock.type === 'taggedBlock' &&
          lastBlock.child.type === 'image'
        ) {
          lastBlock.child.title = text;
          consumedByImageTitle = true;
        }
      }

      if (consumedByImageTitle) {
        resetPending(pending);

        i += 1;
        continue;
      }

      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: lineInfo.raw,
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const contentTitle: ContentTitleBlock = {
          type: 'contentTitle',
          children: [{ type: 'text', value: text }],
        };
        setNodeLocation(contentTitle, lineLocation);
        block = wrapTaggedIfNeeded(contentTitle, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i += 1;
      continue;
    }

    const quoteMatch = matchQuote(lineInfo.content);
    if (quoteMatch) {
      const { level } = quoteMatch;
      const innerLines: string[] = [];
      const rawLines: string[] = [];

      const first = matchQuote(lineInfo.content);
      if (first) {
        const normalized = normalizeQuoteLine(first, level);
        if (normalized !== undefined) {
          innerLines.push(normalized);
        }
      }
      rawLines.push(lineInfo.raw);

      let jQuote = i + 1;
      while (jQuote < lines.length) {
        const nextRaw = lines[jQuote];
        if (nextRaw === undefined) {
          jQuote += 1;
          continue;
        }
        const nextInfo = getLineInfo(nextRaw);
        const nextTrimmed = nextInfo.content.trim();
        if (nextTrimmed.length === 0) {
          break;
        }
        const m = matchQuote(nextInfo.content);
        if (!m) {
          break;
        }
        const normalized = normalizeQuoteLine(m, level);
        if (normalized === undefined) {
          break;
        }
        innerLines.push(normalized);
        rawLines.push(nextInfo.raw);
        jQuote += 1;
      }

      const innerSource = innerLines.join('\n');
      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: rawLines.join('\n'),
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const children = parseBlocks(innerSource, errors);
        adjustNestedQuoteLevels(children, level);
        const quote: QuoteBlock = {
          type: 'quote',
          level,
          children,
          blockAttrs,
        };
        setNodeLocation(quote, lineLocation);
        block = wrapTaggedIfNeeded(quote, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i = jQuote;
      continue;
    }
    if (pending.isSheet && isTableRow(lineInfo.content)) {
      const rawLines: string[] = [lineInfo.raw];
      const rowContents: { text: string; line: number }[] = [
        { text: lineInfo.content, line: i + 1 },
      ];

      let jTable = i + 1;
      while (jTable < lines.length) {
        const nextRaw = lines[jTable];
        if (nextRaw === undefined) {
          jTable += 1;
          continue;
        }
        const nextInfo = getLineInfo(nextRaw);
        const nextTrimmed = nextInfo.content.trim();
        if (nextTrimmed.length === 0) {
          break;
        }
        if (isAttributeOnlyLine(nextTrimmed)) {
          break;
        }
        if (!isTableRow(nextInfo.content)) {
          break;
        }
        rawLines.push(nextInfo.raw);
        rowContents.push({ text: nextInfo.content, line: jTable + 1 });
        jTable += 1;
      }

      const { rows, align } = parseTableRows(rowContents);
      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: rawLines.join('\n'),
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const tableBlock: TableBlock = {
          type: 'table',
          rows,
          align,
          blockAttrs,
        };
        setNodeLocation(tableBlock, lineLocation);
        block = wrapTaggedIfNeeded(tableBlock, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i = jTable;
      continue;
    }

    const imageMatch = matchImageBlock(trimmedContent);
    if (imageMatch) {
      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: lineInfo.raw,
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const image: ImageBlock = {
          type: 'image',
          url: imageMatch.url,
          shape: imageMatch.shape,
          roundedRadius: imageMatch.roundedRadius,
          blockAttrs,
        };
        setNodeLocation(image, lineLocation);
        block = wrapTaggedIfNeeded(image, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i += 1;
      continue;
    }

    const htmlMatch = matchHtmlBlock(trimmedContent);
    if (htmlMatch) {
      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: lineInfo.raw,
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const htmlBlock: HtmlBlock = {
          type: 'html',
          source: htmlMatch.source,
          blockAttrs,
        };
        setNodeLocation(htmlBlock, lineLocation);
        block = wrapTaggedIfNeeded(htmlBlock, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i += 1;
      continue;
    }

    const listFirstMatch = matchListItem(lineInfo.content, i + 1, lineInfo.tabCount + 1);
    if (listFirstMatch) {
      const listMatches: ListItemMatchResult[] = [listFirstMatch];
      const rawLines: string[] = [lineInfo.raw];

      let jList = i + 1;
      while (jList < lines.length) {
        const nextRaw = lines[jList];
        if (nextRaw === undefined) {
          jList += 1;
          continue;
        }
        const nextInfo = getLineInfo(nextRaw);
        const nextTrimmed = nextInfo.content.trim();
        if (nextTrimmed.length === 0) {
          break;
        }
        if (isAttributeOnlyLine(nextTrimmed)) {
          break;
        }
        const nextMatch = matchListItem(nextInfo.content, jList + 1, nextInfo.tabCount + 1);
        if (!nextMatch) {
          // Check if this is a code block that should be attached to the previous list item
          // Support both plain ``` and attributed [html]``` forms
          const codeFence = matchCodeFenceStart(nextTrimmed);
          const attrCodeFence = codeFence ? null : matchAttributedCodeFence(nextTrimmed);
          const effectiveFence = codeFence || attrCodeFence;
          if (effectiveFence && listMatches.length > 0) {
            // Parse the code block
            const codeLines: string[] = [];
            const fenceIndent = nextInfo.tabCount;
            let kCode = jList + 1;
            let codeClosed = false;
            while (kCode < lines.length) {
              const codeRaw = lines[kCode];
              if (codeRaw === undefined) {
                kCode += 1;
                continue;
              }
              const codeInfo = getLineInfo(codeRaw);
              const codeTrimmed = codeInfo.content.trim();
              if (isCodeFenceEnd(codeTrimmed)) {
                codeClosed = true;
                kCode += 1;
                break;
              }
              // Strip leading tabs matching the fence indentation level
              let codeLine = codeRaw;
              for (let t = 0; t < fenceIndent && codeLine.startsWith('\t'); t++) {
                codeLine = codeLine.slice(1);
              }
              codeLines.push(codeLine);
              kCode += 1;
            }
            if (codeClosed) {
              const isHtmlBlock = attrCodeFence?.isHtml ?? false;
              const codeBlock: CodeBlock = {
                type: 'code',
                language: effectiveFence.language,
                value: codeLines.join('\n'),
                htmlLike: isHtmlBlock ? true : undefined,
              };
              setNodeLocation(codeBlock, buildLineLocation(jList, nextInfo));
              // Attach to the last list item
              const lastItem = listMatches[listMatches.length - 1];
              if (lastItem) {
                if (!lastItem.childBlocks) {
                  lastItem.childBlocks = [];
                }
                lastItem.childBlocks.push(codeBlock);
              }
              jList = kCode;
              continue;
            }
          }
          break;
        }
        if (nextMatch.kind !== listFirstMatch.kind) {
          break;
        }
        if (nextMatch.indent < listFirstMatch.indent) {
          break;
        }
        listMatches.push(nextMatch);
        rawLines.push(nextInfo.raw);
        jList += 1;
      }

      const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

      let block: BlockNode;
      if (pending.isDisabled) {
        const disabled: DisabledBlock = {
          type: 'disabledBlock',
          raw: rawLines.join('\n'),
          blockAttrs,
        };
        setNodeLocation(disabled, lineLocation);
        block = disabled;
      } else {
        const { items } = buildListItems(listMatches, 0, listFirstMatch.indent);
        let listKind: ListKind = listFirstMatch.kind;
        const firstItem = items[0];
        if (firstItem) {
          listKind = firstItem.kind;
        }
        const listBlock: ListBlock = {
          type: 'list',
          kind: listKind,
          orderedStyle: listKind === 'ordered' ? 'decimal' : undefined,
          children: items,
          blockAttrs,
        };
        setNodeLocation(listBlock, lineLocation);
        block = wrapTaggedIfNeeded(listBlock, pending, blockAttrs, lineLocation);
      }

      block = wrapCommentIfNeeded(block, pending, lineLocation);
      lastBlockPosition = pushBlockAndResetPending(
        blocks,
        block,
        lineInfo,
        pending,
        lastBlockPosition,
      );

      i = jList;
      continue;
    }

    const blockRawLines: string[] = [lineInfo.raw];
    const blockTextLines: string[] = [lineInfo.content];

    let j = i + 1;
    while (j < lines.length) {
      const nextRaw = lines[j];
      if (nextRaw === undefined) {
        j += 1;
        continue;
      }
      const nextInfo = getLineInfo(nextRaw);
      const nextTrimmed = nextInfo.content.trim();
      if (nextTrimmed.length === 0) {
        break;
      }
      if (isAttributeOnlyLine(nextTrimmed)) {
        break;
      }

      if (isFootnotesLine(nextTrimmed)) {
        break;
      }
      if (matchInclude(nextInfo.content)) {
        break;
      }
      if (matchHeading(nextInfo.content)) {
        break;
      }
      if (matchContentTitle(nextInfo.content)) {
        break;
      }
      if (matchQuote(nextInfo.content)) {
        break;
      }
      if (matchCodeFenceStart(nextTrimmed)) {
        break;
      }
      if (matchHorizontalRule(nextTrimmed)) {
        break;
      }
      if (matchImageBlock(nextTrimmed)) {
        break;
      }
      if (matchHtmlBlock(nextTrimmed)) {
        break;
      }
      if (matchListItem(nextInfo.content)) {
        break;
      }

      blockRawLines.push(nextInfo.raw);
      blockTextLines.push(nextInfo.content);
      j += 1;
    }

    const blockText = blockTextLines.join('\n');
    const blockAttrs = buildBlockAttrs(pending, lineInfo.tabCount);

    let block: BlockNode;
    if (pending.isDisabled) {
      const disabled: DisabledBlock = {
        type: 'disabledBlock',
        raw: blockRawLines.join('\n'),
        blockAttrs,
      };
      setNodeLocation(disabled, lineLocation);
      block = disabled;
    } else {
      let paragraphLike = true;
      if (blockTextLines.length === 1) {
        const firstLine = blockTextLines[0] ?? '';
        const firstTrimmed = firstLine.trim();
        if (firstTrimmed.startsWith('[')) {
          paragraphLike = false;
        }
      }

      if (paragraphLike) {
        const paragraph: ParagraphBlock = {
          type: 'paragraph',
          children: [{ type: 'text', value: blockText }],
          blockAttrs,
        };
        setNodeLocation(paragraph, lineLocation);
        block = paragraph;
      } else {
        const rawBlock: RawBlock = {
          type: 'raw',
          value: blockText,
          blockAttrs,
        };
        setNodeLocation(rawBlock, lineLocation);
        block = rawBlock;
      }

      if (pending.tagName) {
        block = wrapTaggedIfNeeded(block, pending, blockAttrs, lineLocation);
      }
    }

    block = wrapCommentIfNeeded(block, pending, lineLocation);
    lastBlockPosition = pushBlockAndResetPending(
      blocks,
      block,
      lineInfo,
      pending,
      lastBlockPosition,
    );

    i = j;
  }

  return blocks;
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

function getLineInfo(raw: string): LineInfo {
  return getLineInfoFromLexer(raw);
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

function isAttributeOnlyLine(text: string): boolean {
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

function isFootnotesLine(trimmed: string): boolean {
  return trimmed === '[footnotes]';
}

function parseFootnoteDefs(lines: string[], errors: ParseError[]): FootnoteDefBlock[] {
  const defs: FootnoteDefBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw === undefined) {
      i += 1;
      continue;
    }
    const trimmed = raw.trim();
    const match = trimmed.match(/^\[fn=([^\]]+)\]\s*$/);
    if (!match) {
      i += 1;
      continue;
    }
    const idGroup = match[1];
    if (!idGroup) {
      i += 1;
      continue;
    }
    const id = idGroup.trim();
    i += 1;
    const contentLines: string[] = [];
    while (i < lines.length) {
      const innerRaw = lines[i];
      if (innerRaw === undefined) {
        i += 1;
        continue;
      }
      const innerTrimmed = innerRaw.trim();
      if (innerTrimmed.length === 0) {
        break;
      }
      if (/^\[fn=[^\]]+\]\s*$/.test(innerTrimmed)) {
        break;
      }
      contentLines.push(innerRaw);
      i += 1;
    }

    const contentSource = contentLines.join('\n');
    const children: BlockNode[] =
      contentSource.length > 0 ? parseBlocks(contentSource, errors) : [];
    const def: FootnoteDefBlock = {
      type: 'footnoteDef',
      id,
      children,
    };
    defs.push(def);
  }
  return defs;
}

function isTableRow(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('|')) {
    return false;
  }
  return trimmed.indexOf('|', 1) !== -1;
}

type ColumnAlign = 'left' | 'right' | 'center';

interface ParsedTableRows {
  rows: TableRow[];
  align?: ColumnAlign[];
}

function parseTableRows(lines: { text: string; line: number }[]): ParsedTableRows {
  if (lines.length === 0) {
    return { rows: [], align: undefined };
  }

  const remaining = [...lines];
  let align: ColumnAlign[] | undefined;

  // Check if the first line is an alignment row (JianWen native syntax: alignment row comes first)
  const firstLine = remaining[0];
  if (firstLine !== undefined) {
    const firstTrimmed = firstLine.text.trim();
    if (isAlignmentRow(firstTrimmed)) {
      align = parseAlignmentLine(firstTrimmed);
      remaining.shift();
    }
  }

  // Check if the second line is an alignment row (Markdown compatible syntax: alignment row after header row)
  if (align === undefined && remaining.length >= 2) {
    const secondLine = remaining[1];
    if (secondLine !== undefined) {
      const secondTrimmed = secondLine.text.trim();
      if (isAlignmentRow(secondTrimmed)) {
        align = parseAlignmentLine(secondTrimmed);
        remaining.splice(1, 1); // Remove the second line (alignment row)
      }
    }
  }

  const rows: TableRow[] = [];
  for (const line of remaining) {
    const trimmed = line.text.trim();
    if (!isTableRow(trimmed)) {
      continue;
    }
    const rawCells = trimmed.split('|').slice(1, -1);
    const cells: TableCell[] = [];
    for (let ci = 0; ci < rawCells.length; ci += 1) {
      const rawCell = rawCells[ci];
      if (rawCell === undefined) {
        continue;
      }
      let cellText = rawCell.trim();
      let cellAlign: ColumnAlign | undefined;

      if (cellText.startsWith('[r]')) {
        cellAlign = 'right';
        cellText = cellText.slice(3).trim();
      } else if (cellText.startsWith('[c]')) {
        cellAlign = 'center';
        cellText = cellText.slice(3).trim();
      } else if (align && ci < align.length) {
        cellAlign = align[ci];
      }

      const cell: TableCell = {
        type: 'tableCell',
        children: cellText.length > 0 ? [{ type: 'text', value: cellText }] : [],
        align: cellAlign,
      };
      setNodeLocation(cell, { line: line.line, column: 1 });
      cells.push(cell);
    }
    const row: TableRow = {
      type: 'tableRow',
      cells,
    };
    rows.push(row);
  }

  return { rows, align };
}

function isAlignmentRow(trimmed: string): boolean {
  if (!isTableRow(trimmed)) {
    return false;
  }
  const segments = trimmed.split('|').slice(1, -1);
  if (segments.length === 0) {
    return false;
  }
  for (const seg of segments) {
    const t = seg.trim();
    if (!/^:?-+:?$/.test(t)) {
      return false;
    }
  }
  return true;
}

function parseAlignmentLine(trimmed: string): ColumnAlign[] {
  const segments = trimmed.split('|').slice(1, -1);
  const result: ColumnAlign[] = [];
  for (const seg of segments) {
    const t = seg.trim();
    const left = t.startsWith(':');
    const right = t.endsWith(':');
    if (left && right) {
      result.push('center');
    } else if (right) {
      result.push('right');
    } else {
      result.push('left');
    }
  }
  return result;
}

interface ImageBlockMatchResult {
  url: string;
  shape?: 'square' | 'rounded';
  roundedRadius?: number;
}

function matchImageBlock(trimmed: string): ImageBlockMatchResult | undefined {
  const m = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
  if (!m) {
    return undefined;
  }
  const inside = m[1];
  const urlGroup = m[2];
  if (inside === undefined || urlGroup === undefined) {
    return undefined;
  }
  const url = urlGroup.trim();
  if (url.length === 0) {
    return undefined;
  }
  const parts = inside
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.includes('img')) {
    return undefined;
  }

  let shape: 'square' | 'rounded' | undefined;
  let roundedRadius: number | undefined;
  for (const part of parts) {
    if (part === 'rounded') {
      shape = 'rounded';
      continue;
    }
    if (part === 'square') {
      shape = 'square';
      continue;
    }
    const roundedMatch = part.match(/^rounded=([0-9.]+)$/);
    if (roundedMatch && roundedMatch[1]) {
      const num = parseFloat(roundedMatch[1]);
      if (!isNaN(num) && num > 0) {
        shape = 'rounded';
        roundedRadius = num;
      }
    }
  }

  return { url, shape, roundedRadius };
}

interface HtmlBlockMatchResult {
  source: string;
}

function matchHtmlBlock(trimmed: string): HtmlBlockMatchResult | undefined {
  const m = trimmed.match(/^\[html\]\(([^)]+)\)\s*$/);
  if (!m) {
    return undefined;
  }
  const urlGroup = m[1];
  if (urlGroup === undefined) {
    return undefined;
  }
  const source = urlGroup.trim();
  if (source.length === 0) {
    return undefined;
  }
  return { source };
}

interface ContentTitleMatchResult {
  text: string;
}

function matchContentTitle(content: string): ContentTitleMatchResult | undefined {
  const m = content.match(/^>\s+(.+)$/);
  if (!m) {
    return undefined;
  }
  const group = m[1];
  if (group === undefined) {
    return undefined;
  }
  const text = group.trimEnd();
  return { text };
}

interface QuoteMatchResult {
  level: number;
  text: string;
}

function matchQuote(content: string): QuoteMatchResult | undefined {
  const m = content.match(/^(@+)\s+(.+)$/);
  if (!m) {
    return undefined;
  }
  const atGroup = m[1];
  const textGroup = m[2];
  if (atGroup === undefined || textGroup === undefined) {
    return undefined;
  }
  const level = atGroup.length;
  const text = textGroup.trimEnd();
  return { level, text };
}

function normalizeQuoteLine(match: QuoteMatchResult, baseLevel: number): string | undefined {
  if (match.level < baseLevel) {
    return undefined;
  }
  const relativeLevel = match.level - baseLevel;
  if (relativeLevel === 0) {
    return match.text;
  }
  const nestedMarkers = '@'.repeat(relativeLevel);
  return `${nestedMarkers} ${match.text}`;
}

function adjustNestedQuoteLevels(nodes: BlockNode[], parentLevel: number): void {
  for (const node of nodes) {
    if (node.type !== 'quote') {
      continue;
    }
    node.level += parentLevel;
    adjustNestedQuoteLevels(node.children, node.level);
  }
}

interface CodeFenceStartMatchResult {
  language?: string;
}

function matchCodeFenceStart(trimmed: string): CodeFenceStartMatchResult | undefined {
  if (!trimmed.startsWith('```')) {
    return undefined;
  }
  const m = trimmed.match(/^```([^\s`]*)\s*$/);
  if (!m) {
    return undefined;
  }
  const group = m[1];
  if (group === undefined || group.length === 0) {
    return { language: undefined };
  }
  return { language: group };
}

function isCodeFenceEnd(trimmed: string): boolean {
  return /^```\s*$/.test(trimmed);
}

interface AttributedCodeFenceResult {
  language?: string;
  isHtml: boolean;
}

/**
 * Match code fence with optional leading attributes like [html]```
 * Returns the language and whether it's an HTML block
 */
function matchAttributedCodeFence(trimmed: string): AttributedCodeFenceResult | undefined {
  // Match pattern: optional [attr]... followed by ```language?
  const match = trimmed.match(/^(\[.+\])*\s*```([^\s`]*)\s*$/);
  if (!match) {
    return undefined;
  }
  const attrPart = match[1] || '';
  const language = match[2] || undefined;
  const isHtml = /\[html\]/i.test(attrPart);
  return { language, isHtml };
}

interface ListItemMatchResult {
  kind: ListKind;
  indent: number;
  ordinal?: string;
  taskStatus?: TaskStatus;
  text: string;
  line?: number;
  column?: number;
  /** Child blocks that follow this list item (e.g., code blocks) */
  childBlocks?: BlockNode[];
}

function matchListItem(
  content: string,
  line?: number,
  column?: number,
): ListItemMatchResult | undefined {
  const taskMatch = content.match(/^(-+)(\[(.|..)?\])(?:\s+(.*))?$/);
  if (taskMatch) {
    const dashes = taskMatch[1];
    const markerGroup = taskMatch[2];
    const markerInner = taskMatch[3];
    const textGroup = taskMatch[4] || '';
    if (!dashes || !markerGroup) {
      return undefined;
    }
    const indent = dashes.length;
    const taskStatus = mapTaskStatus(markerInner);
    const text = textGroup.trimEnd();
    return { kind: 'task', indent, taskStatus, text, line, column };
  }

  const orderedMatch = content.match(/^(\d+(?:\.\d+)*)\.?\s*(\[(.|..)?\])?(?:\s+(.*))?$/);
  if (orderedMatch) {
    const ordinalGroup = orderedMatch[1];
    const markerGroup = orderedMatch[2];
    const markerInner = orderedMatch[3];
    const textGroup = orderedMatch[4] || '';
    if (!ordinalGroup) {
      return undefined;
    }
    const ordinal = ordinalGroup;
    const indent = ordinal.split('.').length;
    const taskStatus = markerGroup ? mapTaskStatus(markerInner) : undefined;
    const text = textGroup.trimEnd();
    return { kind: 'ordered', indent, ordinal, taskStatus, text, line, column };
  }

  const foldableMatch = content.match(/^(\++)(\[(.|..)?\])?(?:\s+(.*))?$/);
  if (foldableMatch) {
    const pluses = foldableMatch[1];
    const markerGroup = foldableMatch[2];
    const markerInner = foldableMatch[3];
    const textGroup = foldableMatch[4] || '';
    if (!pluses) {
      return undefined;
    }
    const indent = pluses.length;
    const taskStatus = markerGroup ? mapTaskStatus(markerInner) : undefined;
    const text = textGroup.trimEnd();
    return {
      kind: 'foldable',
      indent,
      ordinal: ordinalFromIndent(indent),
      taskStatus,
      text,
      line,
      column,
    };
  }

  const bulletMatch = content.match(/^(-+)(?:\s+(.*))?$/);
  if (bulletMatch) {
    const dashes = bulletMatch[1];
    const textGroup = bulletMatch[2] || '';
    if (!dashes) {
      return undefined;
    }
    const indent = dashes.length;
    const text = textGroup.trimEnd();
    return { kind: 'bullet', indent, text, line, column };
  }

  return undefined;
}

function mapTaskStatus(markerInner: string | undefined): TaskStatus {
  if (!markerInner || markerInner === '') {
    return 'unknown';
  }
  if (markerInner === 'o') {
    return 'in_progress';
  }
  if (markerInner === 'x') {
    return 'not_done';
  }
  if (markerInner === 'v') {
    return 'done';
  }
  return 'unknown';
}

function ordinalFromIndent(indent: number): string {
  if (indent <= 0) {
    return '1';
  }
  return Array(indent).fill('1').join('.');
}

function buildListItems(
  matches: ListItemMatchResult[],
  startIndex: number,
  baseIndent: number,
): { items: ListItemBlock[]; nextIndex: number } {
  const items: ListItemBlock[] = [];
  let index = startIndex;
  while (index < matches.length) {
    const current = matches[index];
    if (!current) {
      break;
    }
    if (current.indent < baseIndent) {
      break;
    }
    if (current.indent > baseIndent) {
      break;
    }

    const paragraph: ParagraphBlock = {
      type: 'paragraph',
      children: [{ type: 'text', value: current.text }],
    };
    if (current.line !== undefined && current.column !== undefined) {
      setNodeLocation(paragraph, {
        line: current.line,
        column: current.column,
      });
    }

    const childrenBlocks: BlockNode[] = [paragraph];

    // Add any child blocks (code blocks, etc.) that follow this list item
    if (current.childBlocks && current.childBlocks.length > 0) {
      childrenBlocks.push(...current.childBlocks);
    }

    index += 1;
    const next = matches[index];
    if (next && next.indent > current.indent) {
      const childResult = buildListItems(matches, index, next.indent);
      childrenBlocks.push({
        type: 'list',
        kind: next.kind,
        orderedStyle: next.kind === 'ordered' ? 'decimal' : undefined,
        children: childResult.items,
      } as ListBlock);
      index = childResult.nextIndex;
    }

    const item: ListItemBlock = {
      type: 'listItem',
      kind: current.kind,
      ordinal: current.ordinal,
      taskStatus: current.taskStatus,
      indent: current.indent,
      children: childrenBlocks,
    };
    items.push(item);
  }
  return { items, nextIndex: index };
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
  };
  let attrs: BlockAttributes | undefined = baseAttrs ? { ...baseAttrs } : undefined;

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
        continue;
      }
      if (part === 'r') {
        attrs = ensureBlockAttributes(attrs);
        attrs.align = 'right';
        continue;
      }
      if (part === '->' || part === '<-' || part === '<->') {
        arrowCount += 1;
        if (part === '->' && arrowCount > 2) {
          const error: ParseError = {
            message:
              'More than two [->] attributes in a row; extra [->] will be treated as plain text.',
            line: lineNumber,
            severity: 'warning',
            code: MULTI_ARROW_WARNING_CODE,
          };
          errors.push(error);
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
        continue;
      }
      if (part === 'sheet') {
        result.isSheet = true;
        continue;
      }
      if (part === 'html') {
        result.isHtml = true;
        continue;
      }
      if (part === 'comment') {
        result.isComment = true;
        continue;
      }
      if (part === 'disable' || part === 'd') {
        result.isDisabled = true;
        continue;
      }
      if (part.startsWith('tag=')) {
        result.tagName = part.slice('tag='.length);
        continue;
      }
      if (part.startsWith('t=')) {
        result.tagName = part.slice(2);
        continue;
      }
      if (part.startsWith('f=')) {
        result.tagName = part.slice(2);
        continue;
      }
    }
    i = end + 1;
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
