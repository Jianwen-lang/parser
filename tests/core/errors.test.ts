import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen errors - bracket and attribute issues', () => {
  it('reports missing closing ] for bracket expression', () => {
    const source = 'Text [bold some text';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Missing closing ] for bracket expression'))).toBe(
      true,
    );
  });

  it('reports invalid inline font size out of allowed range', () => {
    const source = 'Text [10] text';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Invalid fontSize'))).toBe(true);
  });
});

describe('JianWen errors - meta and template', () => {
  it('ignores malformed meta lines without crashing', () => {
    const source = ['________', '[invalid', 'no-brackets=here', '________', '', 'Paragraph.'].join(
      '\n',
    );

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(ast.children[0]?.type).toBe('paragraph');
    expect(errors).toHaveLength(0);
  });
});
