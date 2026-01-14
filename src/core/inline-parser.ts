import { InlineNode } from './ast';
import { ParseError } from './errors';
import { CharScanner, createCharScanner } from '../lexer/lexer';
import { getInlineRuleForChar } from './inline/rules';
import { InlineRuleContext } from './inline/rules/types';

export function parseInlines(
  text: string,
  errors: ParseError[],
  baseLine: number,
  baseColumn = 1,
): InlineNode[] {
  const scanner = createScanner(text, baseLine, baseColumn);
  const nodes: InlineNode[] = [];
  let buffer = '';

  const ctx: InlineRuleContext = {
    errors,
    parseNested: (nestedText, nestedBaseLine) => parseInlines(nestedText, errors, nestedBaseLine),
  };

  function flushText(): void {
    if (buffer.length === 0) {
      return;
    }
    const node: InlineNode = { type: 'text', value: buffer };
    nodes.push(node);
    buffer = '';
  }

  while (!scanner.eof()) {
    const ch = scanner.peek();
    if (ch === undefined) {
      break;
    }

    const rule = getInlineRuleForChar(ch);
    if (rule) {
      if (rule.flushTextBefore) {
        flushText();
      }

      const result = rule.parse(scanner, ctx);
      if (result.kind === 'append') {
        buffer += result.text;
      } else if (result.kind === 'emit') {
        nodes.push(result.node);
      } else {
        nodes.push({ type: 'text', value: result.text });
      }
      continue;
    }

    scanner.next();
    buffer += ch;
  }

  flushText();
  return nodes;
}

type InlineScanner = CharScanner;

function createScanner(text: string, baseLine: number, baseColumn: number): InlineScanner {
  return createCharScanner(text, baseLine, baseColumn);
}
