import { reportParseWarning } from '../../diagnostics';
import { InlineRule } from './types';

export const disabledRule: InlineRule = {
  flushTextBefore: false,
  parse(scanner, ctx) {
    const startLine = scanner.line;
    const startColumn = scanner.column;

    const open = scanner.next();
    if (open !== '{') {
      return { kind: 'append', text: '' };
    }

    let content = '';
    while (!scanner.eof()) {
      const ch = scanner.peek();
      if (ch === undefined) {
        break;
      }
      if (ch === '}') {
        scanner.next();
        return { kind: 'append', text: content };
      }
      scanner.next();
      content += ch;
    }

    reportParseWarning(ctx.errors, {
      message: 'Missing closing } for disabled inline segment',
      line: startLine,
      column: startColumn,
    });
    return { kind: 'append', text: `{${content}` };
  },
};
