import {
  BlockNode,
  CodeBlock,
  DisabledBlock,
  ListBlock,
  ListItemBlock,
  ListKind,
  ParagraphBlock,
  TaskStatus,
} from '../../ast';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { isAttributeOnlyLine } from './attribute-line';
import { isCodeFenceEnd, matchAttributedCodeFence, matchCodeFenceStart } from './code-fence';
import { BlockRuleContext } from './types';

interface ListItemMatchResult {
  kind: ListKind;
  indent: number;
  ordinal?: string;
  taskStatus?: TaskStatus;
  text: string;
  line?: number;
  column?: number;
  childBlocks?: BlockNode[];
}

export function tryParseListBlock(ctx: BlockRuleContext): number | null {
  const listFirstMatch = matchListItem(
    ctx.lineInfo.content,
    ctx.index + 1,
    ctx.lineInfo.tabCount + 1,
  );
  if (!listFirstMatch) {
    return null;
  }

  const listMatches: ListItemMatchResult[] = [listFirstMatch];
  const rawLines: string[] = [ctx.lineInfo.raw];

  let jList = ctx.index + 1;
  while (jList < ctx.lines.length) {
    const nextRaw = ctx.lines[jList];
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
      const codeFence = matchCodeFenceStart(nextTrimmed);
      const attrCodeFence = codeFence ? null : matchAttributedCodeFence(nextTrimmed);
      const effectiveFence = codeFence || attrCodeFence;
      if (effectiveFence && listMatches.length > 0) {
        const codeLines: string[] = [];
        const fenceIndent = nextInfo.tabCount;
        let kCode = jList + 1;
        let codeClosed = false;
        while (kCode < ctx.lines.length) {
          const codeRaw = ctx.lines[kCode];
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
          setNodeLocation(codeBlock, { line: jList + 1, column: nextInfo.tabCount + 1 });
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

  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);

  let block: BlockNode;
  if (ctx.pending.isDisabled) {
    const disabled: DisabledBlock = {
      type: 'disabledBlock',
      raw: rawLines.join('\n'),
      blockAttrs,
    };
    setNodeLocation(disabled, ctx.lineLocation);
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
    setNodeLocation(listBlock, ctx.lineLocation);
    block = listBlock;
  }

  ctx.commitBlock(block, blockAttrs);
  return jList;
}

export function isListItemStart(content: string): boolean {
  return matchListItem(content) !== undefined;
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
    const textColumn = getListTextColumn(column, taskMatch[0], textGroup);
    return { kind: 'task', indent, taskStatus, text, line, column: textColumn };
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
    const textColumn = getListTextColumn(column, orderedMatch[0], textGroup);
    return { kind: 'ordered', indent, ordinal, taskStatus, text, line, column: textColumn };
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
    const textColumn = getListTextColumn(column, foldableMatch[0], textGroup);
    return {
      kind: 'foldable',
      indent,
      ordinal: ordinalFromIndent(indent),
      taskStatus,
      text,
      line,
      column: textColumn,
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
    const textColumn = getListTextColumn(column, bulletMatch[0], textGroup);
    return { kind: 'bullet', indent, text, line, column: textColumn };
  }

  return undefined;
}

function getListTextColumn(
  baseColumn: number | undefined,
  matchText: string,
  rawText: string,
): number | undefined {
  if (baseColumn === undefined) {
    return undefined;
  }
  const prefixLength = matchText.length - rawText.length;
  return baseColumn + Math.max(0, prefixLength);
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
