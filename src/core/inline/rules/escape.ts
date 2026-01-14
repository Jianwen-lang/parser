import { InlineRule } from './types';

export const escapeRule: InlineRule = {
  flushTextBefore: false,
  parse(scanner) {
    scanner.next();
    const escaped = scanner.next();
    return { kind: 'append', text: escaped ?? '' };
  },
};
