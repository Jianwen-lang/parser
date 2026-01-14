import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen parser - comprehensive test', () => {
  it('handles a real-world style article with nested layout attributes, disabled blocks, deep footnotes and combined errors', () => {
    const nestedSource = [
      '____________________',
      '[title]=JianWen 综合测试',
      '[author]=Tester',
      '[tag(s)]=综合测试,布局,脚注',
      '____________________',
      '',
      '# 引言',
      '',
      '这是开篇段落，包含 *加粗*、/斜体/、_下划线_、~波浪线~ 和 [link][green,!blue]外部链接(https://example.com)。',
      '',
      '-[] 任务 1',
      '--[v] 已完成的子任务 1.1',
      '-[o] 进行中的任务 2',
      '',
      '[sheet]',
      '| 章节 | 描述 |',
      '| 引言 | 简要说明 |',
      '| 布局 | 测试列布局 |',
      '',
      '-----',
      '',
      '## 布局与折叠章节',
      '',
      '[fold]',
      '这一段被折叠，并在末尾引用脚注 [fn:note2]。',
      '> 折叠内容摘要',
      '',
      '[c,->]',
      '# Parent heading',
      '',
      '[fold]',
      'Paragraph inside fold with [green,bold]inline attrs[/] and {literal _*_ text} plus [fn:note2].',
      '> Fold summary',
      '',
      '[->][c]',
      'Second paragraph chained with [!yellow]=marker= and inline [comment]note[/].',
      '',
      '-----',
      '',
      '## 列表与引用',
      '',
      '- Root bullet',
      '-- Nested bullet with @@ quote inside',
      '@@ Inline quote with [fn:note3] inside list',
      '',
      '+[v] Foldable task root',
      '++[x] Foldable task child',
      '',
      '[sheet][r]',
      '| Name | [r]Score |',
      '| Ada | 95 |',
      '| Bob | 88 |',
      '',
      '## 图片与标签',
      '',
      '[tag=callout]',
      '[rounded,img](hero.png)',
      '> Shared hero reference',
      '',
      '[@=callout]',
      '',
      '[@](child.jw)',
      '',
      '## 布局箭头与禁用区块',
      '',
      '[->][<-][<->]',
      '[<->,disable]',
      '*Should stay literal*',
      '',
      '## HTML 片段和批注',
      '',
      '[html]',
      '```',
      '<section>inline html</section>',
      '```',
      '',
      '[comment]',
      '@ Hidden quote block',
      '',
      '[footnotes]',
      '[fn=note2]',
      '- List item in note2 [fn:note3].',
      '[fn=note3]',
      '@ Inner quote in note3 [fn:note2].',
    ].join('\n');

    const { ast: nestedAst, errors: nestedErrors } = parseJianwenWithErrors(nestedSource);
    expect(nestedErrors).toHaveLength(0);
    expect(nestedAst.children.some((node) => node.type === 'taggedBlock')).toBe(true);
    expect(nestedAst.children.some((node) => node.type === 'disabledBlock')).toBe(true);
    expect(nestedAst.children.some((node) => node.type === 'code' && node.htmlLike === true)).toBe(
      true,
    );
    expect(nestedAst.children.some((node) => node.type === 'footnotes')).toBe(true);
    expect(
      nestedAst.children.some(
        (node) => node.type === 'include' && node.mode === 'file' && node.target === 'child.jw',
      ),
    ).toBe(true);

    const disabledBlock = nestedAst.children.find((node) => node.type === 'disabledBlock');
    if (disabledBlock && disabledBlock.type === 'disabledBlock') {
      expect(disabledBlock.blockAttrs?.position).toBe('R');
      expect(disabledBlock.blockAttrs?.truncateRight).toBe(true);
    }

    const commentBlock = nestedAst.children.find((node) => node.type === 'commentBlock');
    if (commentBlock && commentBlock.type === 'commentBlock') {
      expect(commentBlock.children.some((child) => child.type === 'quote')).toBe(true);
    }

    const footnotesBlock = nestedAst.children.find((node) => node.type === 'footnotes');
    if (footnotesBlock && footnotesBlock.type === 'footnotes') {
      expect(
        footnotesBlock.children.some((def) => def.type === 'footnoteDef' && def.id === 'note2'),
      ).toBe(true);
      expect(
        footnotesBlock.children.some((def) => def.type === 'footnoteDef' && def.id === 'note3'),
      ).toBe(true);

      const note3Def = footnotesBlock.children.find(
        (def) => def.type === 'footnoteDef' && def.id === 'note3',
      );
      if (note3Def && note3Def.type === 'footnoteDef') {
        expect(note3Def.children.some((child) => child.type === 'quote')).toBe(true);
      }
    }

    const errorSource = [
      '[->][->][->]',
      '',
      '# Heading with *unterminated emphasis',
      '',
      'Paragraph referencing [fn:missing].',
      '',
      '```js',
      'const broken = true;',
    ].join('\n');

    const { errors: integrationErrors } = parseJianwenWithErrors(errorSource);
    expect(
      integrationErrors.some((e) => e.message.includes('More than two [->] attributes in a row')),
    ).toBe(true);
    expect(
      integrationErrors.some((e) => e.message.includes('Missing closing style delimiter')),
    ).toBe(true);
    expect(
      integrationErrors.some((e) =>
        e.message.includes('Footnote reference "missing" has no corresponding FootnoteDefBlock'),
      ),
    ).toBe(true);
    expect(
      integrationErrors.some((e) => e.message.includes('Code block is not closed with ```')),
    ).toBe(true);
  });
});
