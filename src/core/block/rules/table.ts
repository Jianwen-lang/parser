import { BlockNode, DisabledBlock, TableBlock, TableCell, TableRow } from '../../ast';
import { reportParseError } from '../../diagnostics';
import { ParseError } from '../../errors';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { isAttributeOnlyLine } from './attribute-line';
import { BlockRuleContext } from './types';

type ColumnAlign = 'left' | 'right' | 'center';

interface ParsedTableRows {
  rows: TableRow[];
  align?: ColumnAlign[];
}

export function tryParseTableBlock(ctx: BlockRuleContext): number | null {
  if (!ctx.pending.isSheet || !isTableRow(ctx.lineInfo.content)) {
    return null;
  }

  const rawLines: string[] = [ctx.lineInfo.raw];
  const rowContents: { text: string; raw: string; line: number }[] = [
    { text: ctx.lineInfo.content, raw: ctx.lineInfo.raw, line: ctx.index + 1 },
  ];

  let jTable = ctx.index + 1;
  while (jTable < ctx.lines.length) {
    const nextRaw = ctx.lines[jTable];
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
    rowContents.push({ text: nextInfo.content, raw: nextInfo.raw, line: jTable + 1 });
    jTable += 1;
  }

  const { rows, align } = parseTableRows(rowContents, ctx.errors);
  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);
  let tableAlign = align;
  if (!tableAlign && blockAttrs?.align && blockAttrs.align !== 'left') {
    const columnCount = getMaxTableColumnCount(rows);
    if (columnCount > 0) {
      tableAlign = Array.from({ length: columnCount }, () => blockAttrs.align as ColumnAlign);
    }
  }

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
    const tableBlock: TableBlock = {
      type: 'table',
      rows,
      align: tableAlign,
      blockAttrs,
    };
    setNodeLocation(tableBlock, ctx.lineLocation);
    block = tableBlock;
  }

  ctx.commitBlock(block, blockAttrs);
  return jTable;
}

function isTableRow(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('|')) {
    return false;
  }
  return trimmed.indexOf('|', 1) !== -1;
}

function parseTableRows(
  lines: { text: string; raw: string; line: number }[],
  errors: ParseError[],
): ParsedTableRows {
  if (lines.length === 0) {
    return { rows: [], align: undefined };
  }

  for (const line of lines) {
    const trimmed = line.text.trim();
    if (isTableRow(trimmed) && !trimmed.endsWith('|')) {
      const contentStart = line.raw.length - line.text.length;
      const trimmedContent = line.text.replace(/\s+$/, '');
      const column = contentStart + trimmedContent.length + 1;
      reportParseError(errors, {
        message: 'Table row is missing closing "|" border',
        line: line.line,
        column,
      });
    }
  }

  const remaining = [...lines];
  let align: ColumnAlign[] | undefined;

  const firstLine = remaining[0];
  if (firstLine !== undefined) {
    const firstTrimmed = firstLine.text.trim();
    if (isAlignmentRow(firstTrimmed)) {
      align = parseAlignmentLine(firstTrimmed);
      remaining.shift();
    }
  }

  if (align === undefined && remaining.length >= 2) {
    const secondLine = remaining[1];
    if (secondLine !== undefined) {
      const secondTrimmed = secondLine.text.trim();
      if (isAlignmentRow(secondTrimmed)) {
        align = parseAlignmentLine(secondTrimmed);
        remaining.splice(1, 1);
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

function getMaxTableColumnCount(rows: TableRow[]): number {
  let max = 0;
  for (const row of rows) {
    if (row.cells.length > max) {
      max = row.cells.length;
    }
  }
  return max;
}
