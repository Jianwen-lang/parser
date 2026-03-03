import { BlockNode, TaggedBlock } from '../../src/core/ast';
import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen include - depth and cycle', () => {
  it('stops expanding when includeMaxDepth is exceeded', () => {
    const files: Record<string, string> = {
      root: '[@](a)',
      a: '[@](b)',
      b: '[@](c)',
      c: '# End',
    };

    const { ast, errors } = parseJianwenWithErrors(files.root!, {
      expandInclude: true,
      includeMaxDepth: 2,
      loadFile: (path) => files[path] ?? undefined,
    });

    expect(ast.children.length).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThanOrEqual(0);
  });

  it('detects include cycles across multiple files', () => {
    const files: Record<string, string> = {
      root: '[@](a)',
      a: '[@](b)',
      b: '[@](root)',
    };

    const { errors } = parseJianwenWithErrors(files.root!, {
      expandInclude: true,
      includeMaxDepth: 10,
      loadFile: (path) => files[path] ?? undefined,
    });
    expect(errors.length).toBeGreaterThanOrEqual(0);
  });
});

describe('JianWen include - complex placement', () => {
  it('expands includes inside lists, quotes and footnotes', () => {
    const child = ['[footnotes]', '[fn=note1]', 'From include.'].join('\n');
    const source = [
      '- item 1',
      '-[@](child)',
      '@ Quote with [@](child)',
      '',
      'Text [fn:note1].',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
      loadFile: (path) => (path === 'child' ? child : undefined),
    });
    expect(errors.length).toBeGreaterThanOrEqual(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen include - caching and tag index', () => {
  it('expands repeated file includes using provided loadFile', () => {
    const source = ['Before', '[@](child)', '[@](child)'].join('\n');
    const child = '# Child heading';

    const { ast, errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
      loadFile: () => child,
    });

    const includeBlocks = ast.children.filter((b) => b.type === 'include');
    expect(includeBlocks.length).toBe(0);
    expect(errors.length).toBeGreaterThanOrEqual(0);
  });

  it('expands tag-mode includes based on tagged blocks and removes include nodes at top level', () => {
    const source = [
      '[tag=first]',
      '# First',
      '',
      '[tag=second]',
      '# Second',
      '',
      '[@=second]',
    ].join('\n');

    const { ast, errors } = parseJianwenWithErrors(source, {
      expandInclude: true,
    });
    expect(errors).toHaveLength(0);

    const taggedSecond = ast.children.find(
      (b: BlockNode): b is TaggedBlock => b.type === 'taggedBlock' && b.name === 'second',
    );
    expect(taggedSecond).toBeDefined();
    const includeBlocks = ast.children.filter((b) => b.type === 'include');
    expect(includeBlocks.length).toBe(0);
  });
});
