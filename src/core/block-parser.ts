import { BlockAttributes, BlockNode } from './ast';
import { ParseError } from './errors';
import { tryParseBlockRules } from './block/rules';
import { isAttributeOnlyLine, tryConsumeAttributeOnlyLine } from './block/rules/attribute-line';
import { tryParseCodeBlock } from './block/rules/code-block';
import { matchCodeFenceStart } from './block/rules/code-fence';
import { matchContentTitle, tryParseContentTitleBlock } from './block/rules/content-title';
import { isFootnotesLine, tryParseFootnotesBlock } from './block/rules/footnotes';
import { matchHeading } from './block/rules/heading';
import { matchHorizontalRule } from './block/rules/horizontal-rule';
import { matchHtmlBlock, tryParseHtmlBlock } from './block/rules/html';
import { matchImageBlock, tryParseImageBlock } from './block/rules/image';
import { matchInclude } from './block/rules/include';
import { isListItemStart, tryParseListBlock } from './block/rules/list';
import { tryParseParagraphBlock } from './block/rules/paragraph';
import { matchQuote, tryParseQuoteBlock } from './block/rules/quote';
import { tryParseTableBlock } from './block/rules/table';
import {
  buildBlockAttrs,
  commitParsedBlock,
  createBlockParseRuntime,
  resetPending,
} from './block/runtime';
import { getLineInfo as getLineInfoFromLexer, LineInfo as LexerLineInfo } from '../lexer/lexer';

type LineInfo = LexerLineInfo;
type NextIndex = number | null;
type ConfiguredRuleName =
  | 'coreRuleSet'
  | 'contentTitle'
  | 'quote'
  | 'table'
  | 'image'
  | 'html'
  | 'list';

const CONFIGURED_RULE_ORDER: ConfiguredRuleName[] = [
  'coreRuleSet',
  'contentTitle',
  'quote',
  'table',
  'image',
  'html',
  'list',
];

const PARAGRAPH_STOP_CHECKS: Array<(nextContent: string, nextTrimmed: string) => boolean> = [
  (_nextContent, nextTrimmed) => isFootnotesLine(nextTrimmed),
  (nextContent) => matchInclude(nextContent) !== undefined,
  (nextContent) => matchHeading(nextContent) !== undefined,
  (nextContent) => matchContentTitle(nextContent) !== undefined,
  (nextContent) => matchQuote(nextContent) !== undefined,
  (_nextContent, nextTrimmed) => matchCodeFenceStart(nextTrimmed) !== undefined,
  (_nextContent, nextTrimmed) => matchHorizontalRule(nextTrimmed) !== undefined,
  (_nextContent, nextTrimmed) => matchImageBlock(nextTrimmed) !== undefined,
  (_nextContent, nextTrimmed) => matchHtmlBlock(nextTrimmed) !== undefined,
  (nextContent) => isListItemStart(nextContent),
];

function buildLineLocation(
  lineIndex: number,
  lineInfo: LineInfo,
): { line: number; column: number } {
  return { line: lineIndex + 1, column: lineInfo.tabCount + 1 };
}

export function parseBlocks(source: string, errors: ParseError[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  const lines = source.split(/\r?\n/);
  const runtime = createBlockParseRuntime();

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

    const commitBlock = (
      block: BlockNode,
      blockAttrs: BlockAttributes | undefined,
      options?: {
        allowTag?: boolean;
        postResetPending?: (pending: typeof runtime.pending) => void;
      },
    ): void => {
      commitParsedBlock({
        runtime,
        blocks,
        block,
        blockAttrs,
        lineInfo,
        lineLocation,
        options,
      });
    };

    const nextIndexFromFootnotes = tryParseFootnotesBlock({
      lines,
      index: i,
      lineInfo,
      trimmedContent,
      lineLocation,
      pending: runtime.pending,
      errors,
      parseBlocks,
      buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
      commitBlock,
    });
    if (nextIndexFromFootnotes !== null) {
      i = nextIndexFromFootnotes;
      continue;
    }

    const nextIndexFromCodeBlock = tryParseCodeBlock({
      lines,
      index: i,
      lineInfo,
      trimmedContent,
      lineLocation,
      pending: runtime.pending,
      errors,
      buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
      commitBlock,
    });
    if (nextIndexFromCodeBlock !== null) {
      i = nextIndexFromCodeBlock;
      continue;
    }

    if (isAttributeOnlyLine(trimmedContent)) {
      const consumed = tryConsumeAttributeOnlyLine({
        text: trimmedContent,
        lineNumber: i + 1,
        errors,
        pending: runtime.pending,
        fallbackPosition: runtime.lastBlockPosition,
        tabCount: lineInfo.tabCount,
      });
      if (consumed) {
        i += 1;
        continue;
      }
    }
    let handledByConfiguredRule = false;
    for (const ruleName of CONFIGURED_RULE_ORDER) {
      let nextIndex: NextIndex = null;
      switch (ruleName) {
        case 'coreRuleSet':
          nextIndex = tryParseBlockRules({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'contentTitle':
          nextIndex = tryParseContentTitleBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            blocks,
            resetPending: () => resetPending(runtime.pending),
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'quote':
          nextIndex = tryParseQuoteBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            parseBlocks,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'table':
          nextIndex = tryParseTableBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'image':
          nextIndex = tryParseImageBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'html':
          nextIndex = tryParseHtmlBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        case 'list':
          nextIndex = tryParseListBlock({
            lines,
            index: i,
            lineInfo,
            trimmedContent,
            lineLocation,
            pending: runtime.pending,
            errors,
            buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
            commitBlock,
          });
          break;
        default:
          break;
      }
      if (nextIndex !== null) {
        i = nextIndex;
        handledByConfiguredRule = true;
        break;
      }
    }
    if (handledByConfiguredRule) {
      continue;
    }

    i = tryParseParagraphBlock({
      lines,
      index: i,
      lineInfo,
      trimmedContent,
      lineLocation,
      pending: runtime.pending,
      errors,
      buildBlockAttrs: (tabCount) => buildBlockAttrs(runtime, tabCount),
      commitBlock,
      shouldStopParagraph: (nextContent, nextTrimmed) =>
        PARAGRAPH_STOP_CHECKS.some((rule) => rule(nextContent, nextTrimmed)),
    });
  }

  return blocks;
}

function getLineInfo(raw: string): LineInfo {
  return getLineInfoFromLexer(raw);
}
