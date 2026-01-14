import { HighlightNode, InlineAttrsNode, LinkNode, ParagraphBlock } from '../../src/core/ast';
import { ParseError } from '../../src/core/errors';
import { parseInlines } from '../../src/core/inline-parser';
import { parseJianwenWithErrors } from '../../src/core/parser';

describe('JianWen inline - escapes and basic styles', () => {
  it('handles backslash escapes before inline symbols', () => {
    const source = 'Literal \\*star\\* and \\[brackets]';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('parses nested inline styles and highlights', () => {
    const source = '*strong /em _u ``frame``_/ text*';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen inline - attributes and scope', () => {
  it('applies [attrs] only to following symbol when directly followed by inline marker', () => {
    const source = '[red]`printf()` normal [bold] *strong* text';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('applies [attrs]...[/] range to enclosed segment', () => {
    const source = '[bold,2]strong and /em/[/] normal';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('limits [attrs] scope to current line when no explicit closing', () => {
    const source = ['[red]first line', '[green]second line'].join('\n');
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);

    const paragraph = ast.children[0] as ParagraphBlock | undefined;
    if (!paragraph || paragraph.type !== 'paragraph') {
      throw new Error('Expected first block to be a paragraph');
    }

    expect(paragraph.children).toHaveLength(3);

    const firstInline = paragraph.children[0] as InlineAttrsNode;
    expect(firstInline.type).toBe('inlineAttrs');
    expect(firstInline.children).toHaveLength(1);
    expect(firstInline.children[0]).toMatchObject({
      type: 'text',
      value: 'first line',
    });

    const newlineNode = paragraph.children[1];
    expect(newlineNode).toMatchObject({ type: 'text', value: '\n' });

    const secondInline = paragraph.children[2] as InlineAttrsNode;
    expect(secondInline.type).toBe('inlineAttrs');
    expect(secondInline.children[0]).toMatchObject({
      type: 'text',
      value: 'second line',
    });
    expect(secondInline.attrs.color).toMatchObject({
      kind: 'preset',
      value: 'green',
    });
  });

  it('ends inline attrs before next attribute token when omitted [/] between words', () => {
    const source = '[heavy]特粗体 [serif]衬线体 [mono]等宽体 [slim]细体。';
    const errors: ParseError[] = [];
    const nodes = parseInlines(source, errors, 1);

    expect(errors).toHaveLength(0);

    const inlineAttrNodes = nodes.filter((n): n is InlineAttrsNode => n.type === 'inlineAttrs');
    expect(inlineAttrNodes).toHaveLength(4);

    const texts = inlineAttrNodes.map((node) =>
      node.children
        .map((child) => (child.type === 'text' ? child.value : `[${child.type}]`))
        .join(''),
    );
    expect(texts).toEqual(['特粗体 ', '衬线体 ', '等宽体 ', '细体。']);

    const monoNode = inlineAttrNodes.find((node) => node.attrs.fontStyle?.includes('mono'));
    const slimNode = inlineAttrNodes.find((node) => node.attrs.fontStyle?.includes('slim'));

    if (!monoNode) {
      throw new Error('Expected to find [mono] inline attrs node');
    }
    if (!slimNode) {
      throw new Error('Expected to find [slim] inline attrs node');
    }

    expect(monoNode.children.some((child) => child.type === 'inlineAttrs')).toBe(false);
    expect(monoNode.children).toHaveLength(1);
    expect(monoNode.children[0]).toMatchObject({
      type: 'text',
      value: '等宽体 ',
    });

    expect(slimNode.children).toHaveLength(1);
    expect(slimNode.children[0]).toMatchObject({
      type: 'text',
      value: '细体。',
    });
  });
});

describe('JianWen inline - short font style markers', () => {
  it('maps [i], [b], [bb] to italic, bold, heavy fontStyle', () => {
    const source = ['x [i]italic[/]', '', 'x [b]bold[/]', '', 'x [bb]heavy[/]'].join('\n');
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);

    const first = ast.children[0] as ParagraphBlock | undefined;
    const second = ast.children[1] as ParagraphBlock | undefined;
    const third = ast.children[2] as ParagraphBlock | undefined;

    if (!first || first.type !== 'paragraph') {
      throw new Error('Expected first block to be a paragraph');
    }
    if (!second || second.type !== 'paragraph') {
      throw new Error('Expected second block to be a paragraph');
    }
    if (!third || third.type !== 'paragraph') {
      throw new Error('Expected third block to be a paragraph');
    }

    const isInlineAttrsNode = (n: unknown): n is InlineAttrsNode =>
      Boolean(n && typeof n === 'object' && (n as InlineAttrsNode).type === 'inlineAttrs');

    const attrNode1 = first.children.find(isInlineAttrsNode);
    const attrNode2 = second.children.find(isInlineAttrsNode);
    const attrNode3 = third.children.find(isInlineAttrsNode);

    if (!attrNode1) {
      throw new Error('Expected first paragraph to contain an inlineAttrs node');
    }
    if (!attrNode2) {
      throw new Error('Expected second paragraph to contain an inlineAttrs node');
    }
    if (!attrNode3) {
      throw new Error('Expected third paragraph to contain an inlineAttrs node');
    }

    expect(attrNode1.attrs.fontStyle).toEqual(['italic']);
    expect(attrNode2.attrs.fontStyle).toEqual(['bold']);
    expect(attrNode3.attrs.fontStyle).toEqual(['heavy']);

    expect(attrNode1.attrs.color).toBeUndefined();
    expect(attrNode2.attrs.color).toBeUndefined();
    expect(attrNode3.attrs.color).toBeUndefined();
  });
});

describe('JianWen inline - marker highlight', () => {
  it('parses marker highlight delimited by =', () => {
    const source = 'Text with =marker highlight= content';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('applies inline attribute colors and font styles to block highlight', () => {
    const source = '[#FFEB3B,!blue,b]``块级框选``';
    const errors: ParseError[] = [];
    const nodes = parseInlines(source, errors, 1);

    expect(errors).toHaveLength(0);

    const attrNode = nodes.find((n): n is InlineAttrsNode => n.type === 'inlineAttrs');
    if (!attrNode) {
      throw new Error('Expected inline attributes node wrapping highlight');
    }

    expect(attrNode.attrs.fontStyle).toEqual(['bold']);

    const highlightNode = attrNode.children[0] as HighlightNode | undefined;
    if (!highlightNode || highlightNode.type !== 'highlight') {
      throw new Error('Expected highlight child node');
    }

    expect(highlightNode.colorAttr).toEqual({ kind: 'hex', value: '#FFEB3B' });
    expect(highlightNode.fillColorAttr).toEqual({
      kind: 'preset',
      value: 'blue',
    });
  });
});

describe('JianWen inline - inline code', () => {
  it('parses inline code spans inside sentences', () => {
    const source = 'Call `function()` to execute.';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('allows inline attributes to style inline code', () => {
    const source = 'Use [red]`printf()` for output';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('supports multiple inline code segments in one line', () => {
    const source = 'Set `var x` and `let y` before use.';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});

describe('JianWen inline - links and comments', () => {
  it('parses links with color and underline attributes', () => {
    const source = '[link][red,!blue]Click here(https://example.com)';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });

  it('applies link colors when attributes are split across brackets', () => {
    const errors: ParseError[] = [];
    const nodes1 = parseInlines('点击[green,!red]此处(https://example.com)', errors, 1);
    const nodes2 = parseInlines('点击[green][!red]此处(https://example.com)', errors, 1);

    expect(errors).toHaveLength(0);

    const link1 = nodes1.find((node): node is LinkNode => node.type === 'link');
    const link2 = nodes2.find((node): node is LinkNode => node.type === 'link');

    expect(link1?.colorAttr).toEqual({ kind: 'preset', value: 'green' });
    expect(link1?.underlineColorAttr).toEqual({ kind: 'preset', value: 'red' });
    expect(link2?.colorAttr).toEqual({ kind: 'preset', value: 'green' });
    expect(link2?.underlineColorAttr).toEqual({ kind: 'preset', value: 'red' });
  });

  it('parses inline comments embedded in styled text', () => {
    const source = '*strong [comment]hidden[/] text*';
    const { ast, errors } = parseJianwenWithErrors(source);
    expect(errors).toHaveLength(0);
    expect(ast.children).toMatchSnapshot();
  });
});
