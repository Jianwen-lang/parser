import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen parser - basic syntax', () => {
  it('parses headings, paragraphs, lists, code blocks, tables and hr as expected', () => {
    const source = [
      '# Heading 1',
      '',
      'Plain paragraph line.',
      '',
      '- bullet item',
      '-[v] task done',
      '1. ordered one',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '[sheet]',
      '| a | b |',
      '| 1 | 2 |',
      '',
      '---',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('reports error for unclosed code fence', () => {
    const source = ['```', 'code line without closing fence'].join('\n');
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Code block is not closed with ```'))).toBe(true);
  });
});

describe('JianWen parser - advanced features', () => {
  it('parses inline styles, attributes, links, highlights and footnotes', () => {
    const source = [
      '[bold,2] *strong* /em/ _u_ -del- ~wave~ ^sup^ ^^sub^^',
      '',
      '[red]``frame`` [!yellow]=marker=',
      '',
      '[link][red]Click me(https://example.com)',
      '',
      'Text with footnote [fn:note1].',
      '',
      '[footnotes]',
      '[fn=note1]',
      'Footnote content.',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('applies block attributes and tagged blocks, horizontal rules and images', () => {
    const source = [
      '[c,->]',
      '# Centered heading',
      '',
      '[tag=hero]',
      '[#FF0000]=====',
      '',
      '[img](path/to/img.png)',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen parser - Include and snapshots', () => {
  it('expands tag includes and keeps AST stable', () => {
    const source = ['[tag=intro]', '# Intro heading', '', '[@=intro]'].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
    });
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen parser - error diagnostics', () => {
  it('reports unmatched inline styles', () => {
    const source = '*unclosed strong';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Missing closing style delimiter'))).toBe(true);
  });

  it('reports missing ] or [/] for inline attributes', () => {
    const source = 'Text [red bold some text';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some(
        (e) =>
          e.message.includes('Missing closing ] for bracket expression') ||
          e.message.includes('Missing closing [/] for inline attributes'),
      ),
    ).toBe(true);
  });

  it('reports invalid inline font size and link errors', () => {
    const source = 'Text [10.3] big text [link]Text()';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Invalid fontSize'))).toBe(true);
  });

  it('reports multi-arrow attribute misuse', () => {
    const source = '[->][->][->]';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some(
        (e) =>
          e.message.includes('More than two [->] attributes in a row') ||
          e.code === 'layout-multi-arrow',
      ),
    ).toBe(true);
  });
});

describe('JianWen parser - meta and template', () => {
  it('parses initialization template meta and body', () => {
    const source = [
      '________',
      '[title]=Hello',
      '[author]=Alice',
      '[tag(s)]=foo, bar',
      '________',
      '',
      '# Heading after template',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.meta).toEqual({
      title: 'Hello',
      author: 'Alice',
      tags: ['foo', 'bar'],
    });
    expect(ast.children[0]?.type).toBe('heading');
  });
});

describe('JianWen parser - html and comment blocks', () => {
  it('parses comment and html-like code blocks', () => {
    const source = [
      '[comment]',
      '# Hidden heading',
      '',
      '[html]',
      '```',
      '<div>html</div>',
      '```',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen parser - file include mode', () => {
  it('warns when loadFile is missing', () => {
    const source = '[@](child.jw)';
    const { errors } = parseJianwenWithErrors(source, { expandInclude: true });
    expect(
      errors.some((e) =>
        e.message.includes('IncludeBlock with mode "file" requires loadFile option to expand'),
      ),
    ).toBe(true);
  });

  it('warns when loadFile cannot load target', () => {
    const source = '[@](child.jw)';
    const { errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
      loadFile: () => undefined,
    });
    expect(errors.some((e) => e.message.includes('could not be loaded'))).toBe(true);
  });

  it('expands file include with provided loadFile and does not re-expand nested includes', () => {
    const source = '[@](child)';
    const childSource = ['[tag=inner]', '# Child heading', '', '[@=inner]'].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
      loadFile: (path) => (path === 'child' ? childSource : undefined),
    });

    expect(errors).toHaveLength(0);
    expect(ast.children[0]?.type).toBe('taggedBlock');
    const includeBlocks = ast.children.filter((b) => b.type === 'include');
    expect(includeBlocks.length).toBe(0);
  });
});

describe('JianWen parser - inline disabled and comments', () => {
  it('reports missing closing } for disabled inline segment', () => {
    const source = '{unclosed';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some((e) => e.message.includes('Missing closing } for disabled inline segment')),
    ).toBe(true);
  });

  it('reports missing closing [/] for inline comment', () => {
    const source = 'Text [comment]no end';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Missing closing [/] for inline comment'))).toBe(
      true,
    );
  });
});

describe('JianWen parser - footnote diagnostics', () => {
  it('reports missing footnote definition for used id', () => {
    const source = 'Text with missing [fn:missing].';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some((e) =>
        e.message.includes('Footnote reference "missing" has no corresponding FootnoteDefBlock'),
      ),
    ).toBe(true);
  });
});

describe('JianWen parser - error positions', () => {
  it('provides reasonable line information for errors', () => {
    const source = ['```', 'still inside'].join('\n');
    const { errors } = parseJianwenWithErrors(source);
    const fenceError = errors.find((e) => e.message.includes('Code block is not closed with ```'));
    expect(fenceError).toBeDefined();
    expect(fenceError?.line).toBe(1);
  });
});

describe('JianWen parser - complex integration scenario', () => {
  it('parses a complex document combining meta, blocks, lists, tables, hr, quotes, images, links and footnotes', () => {
    const baseSource = [
      '____________________',
      '[title]=Integration test',
      '[author]=Tester',
      '[tag(s)]=integration, demo',
      '____________________',
      '',
      '[c,2]',
      '#+ Foldable heading /Title/',
      '',
      'Paragraph with *strong* /em/ _u_ -del- ~wave~ ^sup^ ^^sub^^ and [red]``frame`` plus [!yellow]=marker= and a [link][green,!blue][Link text](https://example.com) and [fn:note1].',
      '',
      '- bullet item',
      '-- nested bullet',
      '1. ordered root',
      '1.1. ordered child',
      '+[o] foldable task root',
      '++[v] foldable task done',
      '-[x] task not done',
      '-[v] task done',
      '',
      '[sheet][r]',
      '| Name | Value |',
      '| a | 1 |',
      '| b | 2 |',
      '',
      '[tag=hero]',
      '[rounded,img](hero.png)',
      '> Hero image',
      '',
      '@ Quote start',
      '@@ Nested quote with *styles*',
      '',
      '[#FF0000]-----',
      '*****',
      '=====',
      '~~~~~',
      '',
      '[footnotes]',
      '[fn=note1]',
      'This is the first footnote.',
    ].join('\n');

    const { ast: baseAst, errors: baseErrors } = parseJianwenWithErrors(baseSource);
    expect(baseErrors).toHaveLength(0);
    expect(baseAst).toMatchSnapshot();
  });
});

describe('JianWen parser - inline disabled and comments', () => {
  it('reports missing closing } for disabled inline segment', () => {
    const source = '{unclosed';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some((e) => e.message.includes('Missing closing } for disabled inline segment')),
    ).toBe(true);
  });

  it('reports missing closing [/] for inline comment', () => {
    const source = 'Text [comment]no end';
    const { errors } = parseJianwenWithErrors(source);
    expect(errors.some((e) => e.message.includes('Missing closing [/] for inline comment'))).toBe(
      true,
    );
  });
});

describe('JianWen parser - footnote diagnostics', () => {
  it('reports missing footnote definition for used id', () => {
    const source = 'Text with missing [fn:missing].';
    const { errors } = parseJianwenWithErrors(source);
    expect(
      errors.some((e) =>
        e.message.includes('Footnote reference "missing" has no corresponding FootnoteDefBlock'),
      ),
    ).toBe(true);
  });
});

describe('JianWen parser - error positions', () => {
  it('provides reasonable line information for errors', () => {
    const source = ['```', 'still inside'].join('\n');
    const { errors } = parseJianwenWithErrors(source);
    const fenceError = errors.find((e) => e.message.includes('Code block is not closed with ```'));
    expect(fenceError).toBeDefined();
    expect(fenceError?.line).toBe(1);
  });
});
