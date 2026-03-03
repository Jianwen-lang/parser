import {
  BlockNode,
  FootnoteDefBlock,
  FootnotesBlock,
  InlineNode,
  ListBlock,
  ListItemBlock,
  TableBlock,
  TableCell,
  TableRow,
} from '../../core/ast';
import {
  RenderHtmlOptions,
  buildBlockAttributes,
  buildHeadingIdFromText,
  buildTagIdFromName,
  colorAttributeToCssColor,
  escapeAttr,
  escapeHtml,
} from './utils';
import { renderInlinesToHtml } from './inlines';

export function renderBlocksToHtml(blocks: BlockNode[], options: RenderHtmlOptions = {}): string {
  const result: string[] = [];
  let i = 0;

  function wrapBlock(html: string): string {
    if (!html || !html.trim()) return '';
    if (options.suppressBlockWrapper) return html;
    return `<div class="jw-block">${html}</div>`;
  }

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block) {
      i++;
      continue;
    }

    if (block.type === 'heading' && block.foldable) {
      const headingHtml = renderHeadingBlock(block, options);
      const foldedBlocks: string[] = [];

      let j = i + 1;
      while (j < blocks.length) {
        const nextBlock = blocks[j];
        if (!nextBlock) {
          j++;
          continue;
        }
        const nextAttrs = 'blockAttrs' in nextBlock ? nextBlock.blockAttrs : undefined;
        if (nextAttrs?.fold) {
          foldedBlocks.push(wrapBlock(renderBlockToHtml(nextBlock, options)));
          j++;
        } else {
          break;
        }
      }

      const detailsContent = foldedBlocks.join('');
      const detailsHtml = `<details class="jw-foldable-section">${headingHtml}${detailsContent}</details>`;
      result.push(wrapBlock(detailsHtml));
      i = j;
      continue;
    }

    const blockAttrs = 'blockAttrs' in block ? block.blockAttrs : undefined;

    if (!blockAttrs?.sameLine) {
      result.push(wrapBlock(renderBlockToHtml(block, options)));
      i++;
      continue;
    }

    const rowBlocks: BlockNode[] = [];
    let rowStartIndex = i;

    if (i > 0) {
      const prevBlock = blocks[i - 1];
      if (prevBlock) {
        const prevAttrs = 'blockAttrs' in prevBlock ? prevBlock.blockAttrs : undefined;

        if (!prevAttrs?.sameLine) {
          rowStartIndex = i - 1;
          result.pop();
        }
      }
    }

    for (let j = rowStartIndex; j < blocks.length; j++) {
      const currentBlock = blocks[j];
      if (!currentBlock) {
        continue;
      }

      rowBlocks.push(currentBlock);

      if (j + 1 >= blocks.length) {
        break;
      }
      const nextBlock = blocks[j + 1];
      if (nextBlock) {
        const nextAttrs = 'blockAttrs' in nextBlock ? nextBlock.blockAttrs : undefined;
        if (!nextAttrs?.sameLine) {
          break;
        }
      }
    }

    const rowHtml = rowBlocks.map((b) => renderBlockToHtml(b, options)).join('');
    result.push(wrapBlock(`<div class="jw-same-line-row">${rowHtml}</div>`));

    i = rowStartIndex + rowBlocks.length;
  }

  return result.join('');
}

export function renderBlockToHtml(block: BlockNode, options: RenderHtmlOptions): string {
  switch (block.type) {
    case 'paragraph':
      return renderParagraphBlock(block, options);
    case 'heading':
      return renderHeadingBlock(block, options);
    case 'contentTitle':
      return renderContentTitleBlock(block, options);
    case 'quote':
      return renderQuoteBlock(block, options);
    case 'list':
      return renderListBlock(block, options);
    case 'listItem':
      return renderListItemBlock(block, options);
    case 'code':
      return renderCodeBlock(block, options);
    case 'table':
      return renderTableBlock(block, options);
    case 'hr':
      return renderHorizontalRuleBlock(block, options);
    case 'image':
      return renderImageBlock(block, options);
    case 'html':
      return renderHtmlBlock(block, options);
    case 'footnotes':
      return renderFootnotesBlock(block, options);
    case 'footnoteDef':
      return renderFootnoteDefBlock(block, options);
    case 'commentBlock':
      return options.includeComments ? renderCommentBlock(block, options) : '';
    case 'disabledBlock':
      return renderDisabledBlock(block, options);
    case 'include':
      return renderIncludeBlock(block, options);
    case 'taggedBlock':
      return renderTaggedBlock(block, options);
    case 'raw':
      return renderRawBlock(block, options);
    default:
      return '';
  }
}

function renderParagraphBlock(
  block: BlockNode & { type: 'paragraph' },
  options: RenderHtmlOptions,
): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  const inner = renderInlinesToHtml(block.children, options);

  const hasBlockElements = inner.includes('<div');
  if (hasBlockElements) {
    const trimmedInner = inner.trim();
    return `<div class="jw-paragraph jw-paragraph-block"${attrs}>${trimmedInner}</div>`;
  }

  return `<p class="jw-paragraph"${attrs}>${inner}</p>`;
}

function renderHeadingBlock(
  block: BlockNode & { type: 'heading' },
  options: RenderHtmlOptions,
): string {
  const level = block.level;
  const tag = level >= 1 && level <= 5 ? (`h${level}` as const) : 'h1';

  const headingText = block.children.map((node) => extractTextFromInlineNode(node)).join('');
  const headingId = buildHeadingIdFromText(headingText);

  const inner = renderInlinesToHtml(block.children, options);

  if (block.foldable) {
    const attrs = buildBlockAttributes(block.blockAttrs);
    const heading = `<${tag} id="${escapeAttr(headingId)}" class="jw-heading level-${level}"${attrs}>${inner}</${tag}>`;
    return `<summary class="jw-heading-summary">${heading}</summary>`;
  }

  const attrs = buildBlockAttributes(block.blockAttrs);
  return `<${tag} id="${escapeAttr(headingId)}" class="jw-heading level-${level}"${attrs}>${inner}</${tag}>`;
}

type InlineNodeWithChildren = Extract<InlineNode, { children: InlineNode[] }>;

function hasInlineChildren(node: InlineNode): node is InlineNodeWithChildren {
  return 'children' in node && Array.isArray(node.children);
}

function extractTextFromInlineNode(node: InlineNode): string {
  if (node.type === 'text') {
    return node.value;
  }
  if (hasInlineChildren(node)) {
    return node.children.map((child) => extractTextFromInlineNode(child)).join('');
  }
  return '';
}

function renderContentTitleBlock(
  block: BlockNode & { type: 'contentTitle' },
  options: RenderHtmlOptions,
): string {
  const inner = renderInlinesToHtml(block.children, options);
  const spacer = '<div class="jw-content-title-gap" aria-hidden="true"></div>';
  return `<div class="jw-content-title">${inner}</div>${spacer}`;
}

function renderQuoteBlock(
  block: BlockNode & { type: 'quote' },
  options: RenderHtmlOptions,
): string {
  const inner = renderBlocksToHtml(block.children, options);
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: { 'data-jw-level': String(block.level) },
  });
  return `<blockquote class="jw-quote"${attrs}>${inner}</blockquote>`;
}

function renderListBlock(block: ListBlock, options: RenderHtmlOptions): string {
  const isOrdered = block.kind === 'ordered';
  const tag = isOrdered ? 'ol' : 'ul';
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: {
      'data-jw-list-kind': block.kind,
      ...(block.orderedStyle ? { 'data-jw-ordered-style': block.orderedStyle } : {}),
    },
  });
  const inner = block.children.map((child) => renderListItemBlock(child, options)).join('');
  return `<${tag} class="jw-list"${attrs}>${inner}</${tag}>`;
}

function renderListItemBlock(block: ListItemBlock, options: RenderHtmlOptions): string {
  const attrsParts: string[] = [];
  attrsParts.push(`data-jw-list-kind="${escapeAttr(block.kind)}"`);
  attrsParts.push(`data-jw-indent="${block.indent}"`);
  if (block.ordinal) {
    attrsParts.push(`data-jw-ordinal="${escapeAttr(block.ordinal)}"`);
  }
  if (block.taskStatus) {
    attrsParts.push(`data-jw-task-status="${escapeAttr(block.taskStatus)}"`);
  }
  const blockAttrStr = buildBlockAttributes(block.blockAttrs, {
    rawAttrs: attrsParts,
  });

  let prefix = '';
  if (block.kind === 'ordered' && block.ordinal) {
    prefix += `<span class="jw-list-ordinal">${escapeHtml(block.ordinal)}.</span>`;
  }
  if (block.taskStatus) {
    prefix += `<span class="jw-list-task-marker" data-jw-task-status="${escapeAttr(block.taskStatus)}"></span>`;
  }

  const inner = renderBlocksToHtml(block.children, {
    ...options,
    suppressBlockWrapper: true,
  });

  if (block.kind === 'foldable') {
    const firstChild = block.children[0];
    if (firstChild && firstChild.type === 'paragraph') {
      const summaryContent = renderBlockToHtml(firstChild, {
        ...options,
        suppressBlockWrapper: true,
      });
      const remainingChildren = block.children.slice(1);
      const detailsContent =
        remainingChildren.length > 0
          ? renderBlocksToHtml(remainingChildren, {
              ...options,
              suppressBlockWrapper: true,
            })
          : '';
      return `<li class="jw-list-item"${blockAttrStr}><details class="jw-foldable-list-item"><summary class="jw-list-summary">${prefix}${summaryContent}</summary>${detailsContent}</details></li>`;
    }
  }

  return `<li class="jw-list-item"${blockAttrStr}>${prefix}${inner}</li>`;
}

function renderCodeBlock(block: BlockNode & { type: 'code' }, _options: RenderHtmlOptions): string {
  if (block.htmlLike) {
    const attrs = buildBlockAttributes(block.blockAttrs, {
      extraData: { 'data-jw-html-like': 'true' },
    });
    const value = block.value ?? '';
    return `<div class="jw-html-like"${attrs}><template shadowrootmode="open">${value}</template></div>`;
  }

  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: block.language ? { 'data-jw-language': block.language } : undefined,
  });
  const langClass = block.language ? ` language-${escapeAttr(block.language)}` : '';
  const normalized = (block.value ?? '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length === 0) {
    lines.push('');
  }
  // Generate line numbers HTML
  const lineNumbersHtml = lines
    .map((_, index) => `<span class="jw-line-number">${index + 1}</span>`)
    .join('');
  // Generate code lines HTML
  const linesHtml = lines
    .map((line) => {
      const escapedLine = escapeHtml(line);
      const contentWithSpaces = escapedLine
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
        .replace(/ /g, '&nbsp;');
      const content = line.length === 0 ? '&nbsp;' : contentWithSpaces;
      return `<span class="jw-code-line">${content}</span>`;
    })
    .join('');

  // Build header with language label and copy button
  const languageLabel = block.language
    ? `<span class="jw-code-lang">${escapeHtml(block.language)}</span>`
    : '<span></span>';
  const copyButton = `<button class="jw-code-copy" onclick="navigator.clipboard.writeText([...this.closest('.jw-code-block').querySelectorAll('.jw-code-line')].map(l=>l.textContent).join('\\n')).then(()=>{this.textContent='已复制';setTimeout(()=>this.textContent='复制',1500)})">复制</button>`;
  const header = `<div class="jw-code-header">${languageLabel}${copyButton}</div>`;

  const content = `<div class="jw-code-content"><span class="jw-line-numbers">${lineNumbersHtml}</span><code class="jw-code${langClass}">${linesHtml}</code></div>`;

  return `<pre class="jw-code-block"${attrs}>${header}${content}</pre>`;
}

function renderTableBlock(block: TableBlock, options: RenderHtmlOptions): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  if (!block.rows || block.rows.length === 0) {
    return `<table class="jw-table"${attrs}></table>`;
  }

  const headerRow = block.rows[0];
  if (!headerRow) {
    return `<table class="jw-table"${attrs}></table>`;
  }
  const bodyRows = block.rows.slice(1);
  const thead = `<thead>${renderTableRow(headerRow, block, options, true)}</thead>`;
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows.map((row) => renderTableRow(row, block, options, false)).join('')}</tbody>`
    : '';
  return `<table class="jw-table"${attrs}>${thead}${tbody}</table>`;
}

function renderTableRow(
  row: TableRow,
  table: TableBlock,
  options: RenderHtmlOptions,
  isHeader: boolean,
): string {
  const cellTag = isHeader ? 'th' : 'td';
  const cellsHtml = row.cells
    .map((cell, index) => renderTableCell(cell, table, options, index, cellTag))
    .join('');
  return `<tr class="jw-table-row">${cellsHtml}</tr>`;
}

function renderTableCell(
  cell: TableCell,
  table: TableBlock,
  options: RenderHtmlOptions,
  columnIndex: number,
  tag: 'th' | 'td',
): string {
  const align = cell.align ?? table.align?.[columnIndex];
  const styleParts: string[] = [];
  if (align) {
    styleParts.push(`text-align:${align}`);
  }
  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttr(styleParts.join(';'))}"` : '';
  const inner = renderInlinesToHtml(cell.children, options);
  return `<${tag} class="jw-table-cell"${styleAttr}>${inner}</${tag}>`;
}

function renderHorizontalRuleBlock(
  block: BlockNode & { type: 'hr' },
  _options: RenderHtmlOptions,
): string {
  const attrsParts: string[] = [`data-jw-hr-style="${escapeAttr(block.style)}"`];
  const color = colorAttributeToCssColor(block.colorAttr);
  const extraStyle: string[] = [];
  if (color) {
    extraStyle.push(`color:${color}`);
    extraStyle.push(`border-color:${color}`);
  }
  const attrStr = buildBlockAttributes(block.blockAttrs, {
    rawAttrs: attrsParts,
    extraStyle: extraStyle.length > 0 ? extraStyle : undefined,
  });
  return `<hr class="jw-hr"${attrStr} />`;
}

function renderImageBlock(
  block: BlockNode & { type: 'image' },
  options: RenderHtmlOptions,
): string {
  const extraData: Record<string, string> = {};
  if (block.shape) {
    extraData['data-jw-shape'] = block.shape;
  }
  if (block.roundedRadius !== undefined) {
    extraData['data-jw-rounded-radius'] = String(block.roundedRadius);
  }
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
  });
  let url = block.url;
  if (options.resolveAssetPath) {
    const resolved = options.resolveAssetPath(block.url);
    if (resolved !== undefined) {
      url = resolved;
    }
  }
  const src = escapeAttr(url);
  const alt = block.title ? escapeAttr(block.title) : '';

  let imgStyle = '';
  if (block.shape === 'rounded' && block.roundedRadius !== undefined) {
    const radius = block.roundedRadius * 8;
    imgStyle = ` style="border-radius:${radius}px"`;
  }

  const img = `<img class="jw-image" src="${src}" alt="${alt}"${imgStyle} />`;
  if (!block.title) {
    return `<figure class="jw-image-figure"${attrs}>${img}</figure>`;
  }
  const caption = `<figcaption class="jw-image-caption">${escapeHtml(block.title)}</figcaption>`;
  return `<figure class="jw-image-figure"${attrs}>${img}${caption}</figure>`;
}

function renderHtmlBlock(block: BlockNode & { type: 'html' }, options: RenderHtmlOptions): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  if (block.value) {
    return `<div class="jw-html-block"${attrs}>${block.value}</div>`;
  }

  if (block.source) {
    const resolved = options.resolveHtmlSource
      ? options.resolveHtmlSource(block.source)
      : undefined;
    if (resolved !== undefined) {
      return `<div class="jw-html-block"${attrs}>${resolved}</div>`;
    }
    let source = block.source;
    if (options.resolveAssetPath) {
      const resolvedPath = options.resolveAssetPath(block.source);
      if (resolvedPath !== undefined) {
        source = resolvedPath;
      }
    }
    const dataAttrs =
      attrs.length > 0
        ? `${attrs} data-jw-html-source="${escapeAttr(source)}"`
        : ` data-jw-html-source="${escapeAttr(source)}"`;
    return `<div class="jw-html-block"${dataAttrs}></div>`;
  }

  return `<div class="jw-html-block"${attrs}></div>`;
}

function renderFootnotesBlock(block: FootnotesBlock, options: RenderHtmlOptions): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  const items = block.children.map((def) => renderFootnoteDefBlock(def, options)).join('');
  return `<section class="jw-footnotes"${attrs}><ol class="jw-footnote-list">${items}</ol></section>`;
}

function renderFootnoteDefBlock(block: FootnoteDefBlock, options: RenderHtmlOptions): string {
  const inner = renderBlocksToHtml(block.children, options);
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: { 'data-jw-footnote-id': block.id },
  });
  return `<li class="jw-footnote-def"${attrs}>${inner}</li>`;
}

function renderCommentBlock(
  block: BlockNode & { type: 'commentBlock' },
  options: RenderHtmlOptions,
): string {
  const inner = renderBlocksToHtml(block.children, options);
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: { 'data-jw-comment': 'true' },
  });
  return `<aside class="jw-comment-block"${attrs}>${inner}</aside>`;
}

function renderDisabledBlock(
  block: BlockNode & { type: 'disabledBlock' },
  _options: RenderHtmlOptions,
): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  const text = escapeHtml(block.raw ?? '');
  return `<pre class="jw-disabled-block"${attrs}>${text}</pre>`;
}

function renderIncludeBlock(
  block: BlockNode & { type: 'include' },
  options: RenderHtmlOptions,
): string {
  const attrsParts: string[] = [
    `data-jw-include-mode="${escapeAttr(block.mode)}"`,
    `data-jw-include-target="${escapeAttr(block.target)}"`,
  ];
  const attrs = buildBlockAttributes(block.blockAttrs, {
    rawAttrs: attrsParts,
  });

  if (options.resolveInclude) {
    const resolved = options.resolveInclude(block.mode, block.target);
    if (resolved !== undefined) {
      return `<div class="jw-include"${attrs}>${resolved}</div>`;
    }
  }

  return `<div class="jw-include"${attrs}></div>`;
}

function renderTaggedBlock(
  block: BlockNode & { type: 'taggedBlock' },
  options: RenderHtmlOptions,
): string {
  const id = buildTagIdFromName(block.name);
  const attrs = buildBlockAttributes(block.blockAttrs, {
    extraData: { 'data-jw-tag': block.name },
    rawAttrs: [`id="${escapeAttr(id)}"`],
  });
  const inner = renderBlockToHtml(block.child, options);
  return `<div class="jw-tagged-block"${attrs}>${inner}</div>`;
}

function renderRawBlock(block: BlockNode & { type: 'raw' }, _options: RenderHtmlOptions): string {
  const attrs = buildBlockAttributes(block.blockAttrs);
  const text = escapeHtml(block.value ?? '');
  return `<pre class="jw-raw-block"${attrs}>${text}</pre>`;
}
