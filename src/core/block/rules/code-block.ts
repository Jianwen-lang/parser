import { BlockNode, CodeBlock, DisabledBlock } from '../../ast';
import { reportParseError } from '../../diagnostics';
import { setNodeLocation } from '../../location';
import { getLineInfo } from '../../../lexer/lexer';
import { BlockRuleContext } from './types';
import { isCodeFenceEnd, matchAttributedCodeFence, matchCodeFenceStart } from './code-fence';

export function tryParseCodeBlock(ctx: BlockRuleContext): number | null {
  const codeFenceStart = matchCodeFenceStart(ctx.trimmedContent);
  const attrCodeFenceStart = codeFenceStart ? null : matchAttributedCodeFence(ctx.trimmedContent);
  const effectiveCodeFence = codeFenceStart || attrCodeFenceStart;
  if (!effectiveCodeFence) {
    return null;
  }

  const rawLines: string[] = [ctx.lineInfo.raw];
  const codeLines: string[] = [];
  const fenceIndent = ctx.lineInfo.tabCount;

  let jCode = ctx.index + 1;
  let closed = false;
  while (jCode < ctx.lines.length) {
    const nextRaw = ctx.lines[jCode];
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
    let codeLine = nextRaw;
    for (let t = 0; t < fenceIndent && codeLine.startsWith('\t'); t++) {
      codeLine = codeLine.slice(1);
    }
    codeLines.push(codeLine);
    jCode += 1;
  }

  if (!closed) {
    reportParseError(ctx.errors, {
      message: 'Code block is not closed with ```',
      line: ctx.index + 1,
    });
  }

  const blockAttrs = ctx.buildBlockAttrs(ctx.lineInfo.tabCount);
  const isHtmlBlock = ctx.pending.isHtml || (attrCodeFenceStart?.isHtml ?? false);

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
    const codeBlock: CodeBlock = {
      type: 'code',
      language: effectiveCodeFence.language,
      value: codeLines.join('\n'),
      htmlLike: isHtmlBlock ? true : undefined,
      blockAttrs,
    };
    setNodeLocation(codeBlock, ctx.lineLocation);
    block = codeBlock;
  }

  ctx.commitBlock(block, blockAttrs, { allowTag: !ctx.pending.isDisabled });
  return jCode;
}
