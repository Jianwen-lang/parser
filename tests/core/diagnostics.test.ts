import { ParseError } from '../../src/core/errors';
import {
  prefixIncludeError,
  reportParseError,
  reportParseWarning,
} from '../../src/core/diagnostics';
import { parseJianwenWithErrors } from '../../src/core/parser';

describe('diagnostics helpers', () => {
  it('records warnings and errors with consistent fields', () => {
    const errors: ParseError[] = [];

    reportParseWarning(errors, {
      message: 'warning message',
      line: 1,
      column: 2,
      code: 'warn-code',
    });
    reportParseError(errors, {
      message: 'error message',
      line: 3,
    });

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      message: 'warning message',
      line: 1,
      column: 2,
      severity: 'warning',
      code: 'warn-code',
    });
    expect(errors[1]).toEqual({
      message: 'error message',
      line: 3,
      column: undefined,
      severity: 'error',
      code: undefined,
    });
  });

  it('prefixes include errors without mutating the original', () => {
    const original: ParseError = {
      message: 'original error',
      line: 1,
      severity: 'warning',
    };
    const prefixed = prefixIncludeError(original, 'child.jw');

    expect(prefixed.message).toBe('[include:child.jw] original error');
    expect(original.message).toBe('original error');
  });
});

describe('diagnostics integration', () => {
  it('reports table row missing closing border as error', () => {
    const source = ['[sheet]', '| A | B ', '| 1 | 2 |'].join('\n');
    const { errors } = parseJianwenWithErrors(source);
    const tableError = errors.find((e) =>
      e.message.includes('Table row is missing closing "|" border'),
    );

    expect(tableError).toBeDefined();
    expect(tableError?.severity).toBe('error');
  });

  it('prefixes include file errors with include marker', () => {
    const source = '[@](child)';
    const child = 'Text *unclosed';
    const { errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
      loadFile: (path) => (path === 'child' ? child : undefined),
    });
    const includeError = errors.find((e) =>
      e.message.includes('[include:child] Missing closing style delimiter'),
    );

    expect(includeError).toBeDefined();
    expect(includeError?.severity).toBe('warning');
  });
});
