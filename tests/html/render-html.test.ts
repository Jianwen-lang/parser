import {
  BlockNode,
  FootnoteDefBlock,
  FootnotesBlock,
  InlineNode,
  JianwenDocument,
  ListBlock,
  TableBlock,
} from '../../src/core/ast';
import {
  renderBlocksToHtml,
  renderDocumentToHtml,
  renderInlinesToHtml,
} from '../../src/html/render/html';

describe('render-html - document and meta', () => {
  it('renders document wrapper and meta when includeMeta is true', () => {
    const doc: JianwenDocument = {
      type: 'document',
      source: 'source',
      meta: {
        title: 'Hello',
        author: 'Alice',
        time: '2025-11-19',
        tags: ['t1', 't2'],
      },
      children: [
        {
          type: 'heading',
          level: 1,
          foldable: false,
          children: [{ type: 'text', value: 'Heading' }],
          blockAttrs: { align: 'center' },
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Paragraph text' }],
          blockAttrs: undefined,
        },
      ],
    };

    const html = renderDocumentToHtml(doc, { includeMeta: true });

    expect(html).toContain('<article');
    expect(html).toContain('class="jw-meta-title">Hello</h1>');
    expect(html).toContain('class="jw-heading level-1"');
    expect(html).toContain('class="jw-paragraph"');
    expect(html).toContain('data-jw-tags="t1,t2"');
    expect(html).not.toContain('jw-meta-tags');
  });

  it('keeps formatted paragraph closing tags inline to avoid extra whitespace', () => {
    const doc: JianwenDocument = {
      type: 'document',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '列表项内容' }],
          blockAttrs: undefined,
        },
      ],
    };

    const html = renderDocumentToHtml(doc, {
      includeMeta: false,
      format: true,
    });
    expect(html).toMatch(/<p class="jw-paragraph">列表项内容<\/p>/);
  });

  it('omits wrapper when documentWrapperTag is null', () => {
    const doc: JianwenDocument = {
      type: 'document',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Plain' }],
          blockAttrs: undefined,
        },
      ],
    };

    const html = renderDocumentToHtml(doc, { documentWrapperTag: null });
    expect(html.startsWith('<p class="jw-paragraph"')).toBe(true);
  });

  it('renders document wrapper attributes for globalFont', () => {
    const doc: JianwenDocument = {
      type: 'document',
      meta: {
        globalFont: ['mono', 'slim'],
      },
      children: [],
    };

    const html = renderDocumentToHtml(doc, { includeMeta: false });

    expect(html).toContain('data-jw-global-font="mono slim"');
  });
});

describe('render-html - blocks', () => {
  it('renders lists and list items with attributes', () => {
    const list: ListBlock = {
      type: 'list',
      kind: 'bullet',
      children: [
        {
          type: 'listItem',
          kind: 'bullet',
          indent: 0,
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'Item 1' }],
              blockAttrs: undefined,
            },
          ],
          blockAttrs: undefined,
        },
        {
          type: 'listItem',
          kind: 'task',
          indent: 1,
          taskStatus: 'done',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'Task done' }],
              blockAttrs: undefined,
            },
          ],
          blockAttrs: undefined,
        },
      ],
      blockAttrs: undefined,
    };

    const html = renderBlocksToHtml([list]);

    expect(html).toContain('<ul class="jw-list"');
    expect(html).toContain('data-jw-list-kind="bullet"');
    expect(html).toContain('class="jw-list-item"');
    expect(html).toContain('data-jw-indent="1"');
    expect(html).toContain('data-jw-task-status="done"');
  });

  it('renders content titles with an explicit spacer', () => {
    const blocks: BlockNode[] = [
      {
        type: 'contentTitle',
        children: [{ type: 'text', value: 'Section' }],
      },
    ];

    const html = renderBlocksToHtml(blocks);

    expect(html).toContain('<div class="jw-content-title">Section</div>');
    expect(html).toContain('class="jw-content-title-gap"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders heading and quote with block attributes and foldable', () => {
    const blocks: BlockNode[] = [
      {
        type: 'heading',
        level: 2,
        foldable: true,
        children: [{ type: 'text', value: 'Foldable' }],
        blockAttrs: {
          align: 'right',
          position: 'C',
          fold: true,
        },
      },
      {
        type: 'quote',
        level: 2,
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'Quoted' }],
            blockAttrs: undefined,
          },
        ],
        blockAttrs: { align: 'center' },
      },
    ];

    const html = renderBlocksToHtml(blocks);

    expect(html).toContain('class="jw-heading level-2"');
    expect(html).toContain('<details class="jw-foldable-section">');
    expect(html).toContain('<summary class="jw-heading-summary">');
    expect(html).toContain('data-jw-align="right"');
    expect(html).toContain('data-jw-position="C"');

    expect(html).toContain('<blockquote class="jw-quote"');
    expect(html).toContain('data-jw-level="2"');
    expect(html).toContain('data-jw-align="center"');
  });

  it('renders table with column alignment', () => {
    const table: TableBlock = {
      type: 'table',
      rows: [
        {
          type: 'tableRow',
          cells: [
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Name' }],
              align: 'left',
            },
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Score' }],
              align: 'right',
            },
          ],
        },
        {
          type: 'tableRow',
          cells: [
            {
              type: 'tableCell',
              children: [{ type: 'text', value: 'Ada' }],
              align: undefined,
            },
            {
              type: 'tableCell',
              children: [{ type: 'text', value: '95' }],
              align: undefined,
            },
          ],
        },
      ],
      align: ['left', 'right'],
      blockAttrs: undefined,
    };

    const html = renderBlocksToHtml([table]);

    expect(html).toContain('<table class="jw-table"');
    expect(html).toContain('<th class="jw-table-cell"');
    expect(html).toContain('style="text-align:right"');
    expect(html).toContain('<td class="jw-table-cell"');
  });

  it('renders html-like code block and html block', () => {
    const blocks: BlockNode[] = [
      {
        type: 'code',
        language: 'html',
        value: '<div>inline</div>',
        htmlLike: true,
        blockAttrs: undefined,
      },
      {
        type: 'html',
        value: '<span>block</span>',
        blockAttrs: undefined,
      },
      {
        type: 'html',
        source: 'snippet.html',
        blockAttrs: undefined,
      },
    ];

    const html = renderBlocksToHtml(blocks, {
      resolveHtmlSource: (source) => (source === 'snippet.html' ? '<p>from source</p>' : undefined),
    });

    expect(html).toContain('class="jw-html-like"');
    expect(html).toContain('<div class="jw-html-block"');
    expect(html).toContain('<p>from source</p>');
  });

  it('renders footnotes and footnote definitions', () => {
    const def1: FootnoteDefBlock = {
      type: 'footnoteDef',
      id: '1',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Note 1' }],
          blockAttrs: undefined,
        },
      ],
      blockAttrs: undefined,
    };

    const footnotes: FootnotesBlock = {
      type: 'footnotes',
      children: [def1],
      blockAttrs: undefined,
    };

    const html = renderBlocksToHtml([footnotes]);

    expect(html).toContain('class="jw-footnotes"');
    expect(html).toContain('class="jw-footnote-def"');
    expect(html).toContain('data-jw-footnote-id="1"');
  });

  it('respects includeComments option for comment blocks and inline comments', () => {
    const commentBlock: BlockNode = {
      type: 'commentBlock',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Hidden' }],
          blockAttrs: undefined,
        },
      ],
      blockAttrs: undefined,
    };

    const inlineComment: InlineNode = {
      type: 'commentInline',
      children: [{ type: 'text', value: 'inline hidden' }],
    };

    const without =
      renderBlocksToHtml([commentBlock], { includeComments: false }) +
      renderInlinesToHtml([inlineComment], { includeComments: false });
    expect(without).toBe('');

    const withComments =
      renderBlocksToHtml([commentBlock], { includeComments: true }) +
      renderInlinesToHtml([inlineComment], { includeComments: true });
    expect(withComments).toContain('jw-comment-block');
    expect(withComments).toContain('jw-comment-inline');
  });

  it('renders hr, image, include, tagged, disabled and raw blocks', () => {
    const blocks: BlockNode[] = [
      {
        type: 'hr',
        style: 'solid',
        colorAttr: { kind: 'preset', value: 'red' },
        blockAttrs: { truncateRight: true },
      },
      {
        type: 'image',
        url: 'img.png',
        title: 'Caption',
        shape: 'rounded',
        blockAttrs: undefined,
      },
      {
        type: 'include',
        mode: 'file',
        target: 'child.jw',
        blockAttrs: { fold: true },
      },
      {
        type: 'taggedBlock',
        name: 'hero',
        child: {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Tagged content' }],
          blockAttrs: undefined,
        },
        blockAttrs: undefined,
      },
      {
        type: 'disabledBlock',
        raw: '[x] not parsed',
        blockAttrs: { position: 'C' },
      },
      {
        type: 'raw',
        value: 'raw text',
        blockAttrs: undefined,
      },
    ];

    const html = renderBlocksToHtml(blocks);

    expect(html).toContain('<hr class="jw-hr"');
    expect(html).toContain('data-jw-hr-style="solid"');
    expect(html).toContain('color:var(--jw-color-red, #B10000)');
    expect(html).toContain('border-color:var(--jw-color-red, #B10000)');
    expect(html).toContain('data-jw-truncate-right="true"');

    expect(html).toContain('class="jw-image-figure"');
    expect(html).toContain('class="jw-image"');
    expect(html).toContain('class="jw-image-caption"');
    expect(html).toContain('data-jw-shape="rounded"');

    expect(html).toContain('class="jw-include"');
    expect(html).toContain('data-jw-include-mode="file"');
    expect(html).toContain('data-jw-include-target="child.jw"');

    expect(html).toContain('class="jw-tagged-block"');
    expect(html).toContain('data-jw-tag="hero"');
    expect(html).toContain('Tagged content');

    expect(html).toContain('class="jw-disabled-block"');
    expect(html).toContain('data-jw-position="C"');

    expect(html).toContain('class="jw-raw-block"');
    expect(html).toContain('raw text');
  });
});

describe('render-html - inlines and attributes', () => {
  it('renders inline attributes into style', () => {
    const nodes: InlineNode[] = [
      {
        type: 'inlineAttrs',
        attrs: {
          fontSize: 2,
          fontStyle: ['bold', 'italic'],
          color: { kind: 'preset', value: 'red' },
        },
        children: [{ type: 'text', value: 'Styled' }],
      },
    ];

    const html = renderInlinesToHtml(nodes);

    expect(html).toContain('class="jw-inline-attrs"');
    expect(html).toContain('font-size:1.375em');
    expect(html).toContain('color:var(--jw-color-red, #B10000)');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-style:italic');
  });

  it('renders highlight and link nodes with styles', () => {
    const nodes: InlineNode[] = [
      {
        type: 'highlight',
        mode: 'marker',
        children: [{ type: 'text', value: 'HL' }],
        colorAttr: { kind: 'preset', value: 'yellow' },
        fillColorAttr: { kind: 'preset', value: 'green' },
      },
      {
        type: 'link',
        href: 'https://example.com',
        children: [{ type: 'text', value: 'Link' }],
        colorAttr: { kind: 'preset', value: 'blue' },
        underlineColorAttr: { kind: 'preset', value: 'red' },
      },
    ];

    const html = renderInlinesToHtml(nodes);

    expect(html).toContain('class="jw-highlight jw-highlight-marker"');
    expect(html).toContain('background-color:var(--jw-color-yellow, #7B5A00)'); // yellow
    expect(html).toContain('border-color:var(--jw-color-green, #006200)'); // green
    expect(html).toContain('class="jw-link"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('text-decoration-color:var(--jw-color-red, #B10000)');
  });

  it('renders footnote references and unknown preset colors', () => {
    const nodes: InlineNode[] = [
      {
        type: 'footnoteRef',
        id: 'n1',
      } as InlineNode,
      {
        type: 'inlineAttrs',
        attrs: {
          color: { kind: 'preset', value: 'customColor' },
        },
        children: [{ type: 'text', value: 'X' }],
      },
    ];

    const html = renderInlinesToHtml(nodes);

    expect(html).toContain('class="jw-footnote-ref"');
    expect(html).toContain('data-jw-footnote-id="n1"');
    expect(html).toContain('[n1]');
    expect(html).toContain('var(--jw-color-customColor)');
  });
});
