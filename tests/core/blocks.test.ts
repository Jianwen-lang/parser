import { QuoteBlock } from '../../src/core/ast';
import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen blocks - headings, titles and quotes', () => {
  it('parses all heading levels and foldable headings', () => {
    const source = [
      '# H1',
      '## H2',
      '### H3',
      '#### H4',
      '##### H5',
      '#+ Foldable H1',
      '##+ Foldable H2',
      '###+ Foldable H3',
      '####+ Foldable H4',
      '#####+ Foldable H5',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('parses contentTitle and image title lines', () => {
    const source = ['[img](hero.png)', '> Hero image title', '', '> Standalone content title'].join(
      '\n',
    );

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('parses nested quotes with paragraphs and lists inside', () => {
    const source = [
      '@ Top quote',
      '@@ Nested quote level 2',
      '@@ Nested inner paragraph',
      '@ Still in top quote',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    const topQuote = ast.children[0];
    expect(topQuote?.type).toBe('quote');
    if (topQuote?.type === 'quote') {
      const nestedQuote = topQuote.children.find(
        (child): child is QuoteBlock => child.type === 'quote',
      );
      expect(nestedQuote).toBeDefined();
      expect(nestedQuote?.level).toBe(2);
    }
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen blocks - lists and tasks', () => {
  it('parses nested bullet, ordered, foldable and task lists', () => {
    const source = [
      '- bullet 1',
      '-- bullet 1.1',
      '1. ordered 1',
      '1.1. ordered 1.1',
      '+[ ] foldable root',
      '++[o] foldable child in progress',
      '-[x] task not done',
      '-[v] task done',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen blocks - tables and alignment', () => {
  it('parses table with alignment row and multiple data rows', () => {
    const source = ['[sheet]', '| name | value |', '| :- | -: |', '| a | 1 |', '| b | 2 |'].join(
      '\n',
    );

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(
      errors.every(
        (e) => e.severity === 'warning' && e.message === 'Missing closing style delimiter',
      ),
    ).toBe(true);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen blocks - hr, tags and comments', () => {
  it('parses various horizontal rules with colors and tagged blocks', () => {
    const source = ['[tag=section]', '[#FF0000]---', '***', '===', '~~~'].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('wraps blocks inside commentBlock using [comment] attribute line', () => {
    const source = ['[comment]', '## Hidden heading', '- hidden list item'].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});
