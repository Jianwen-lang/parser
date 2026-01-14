import { HighlightNode, InlineAttributes, InlineNode, LinkNode } from '../../core/ast';
import {
  RenderHtmlOptions,
  escapeHtml,
  escapeAttr,
  colorAttributeToCssColor,
  buildInlineStyleFromInlineAttributes,
  resolveLinkHref,
} from './utils';

export function renderInlinesToHtml(nodes: InlineNode[], options: RenderHtmlOptions = {}): string {
  return nodes.map((node) => renderInlineToHtml(node, options)).join('');
}

export function renderInlineToHtml(node: InlineNode, options: RenderHtmlOptions): string {
  switch (node.type) {
    case 'text': {
      const escaped = escapeHtml(node.value);
      return escaped.replace(/\n/g, '<br/>');
    }
    case 'codeSpan':
      return `<code class="jw-code-span">${escapeHtml(node.value)}</code>`;
    case 'em':
      return `<em>${renderInlinesToHtml(node.children, options)}</em>`;
    case 'strong':
      return `<strong>${renderInlinesToHtml(node.children, options)}</strong>`;
    case 'underline':
      return `<span class="jw-underline">${renderInlinesToHtml(node.children, options)}</span>`;
    case 'strike':
      return `<span class="jw-strike">${renderInlinesToHtml(node.children, options)}</span>`;
    case 'wave':
      return `<span class="jw-wave">${renderInlinesToHtml(node.children, options)}</span>`;
    case 'sup':
      return `<sup>${renderInlinesToHtml(node.children, options)}</sup>`;
    case 'sub':
      return `<sub>${renderInlinesToHtml(node.children, options)}</sub>`;
    case 'highlight':
      return renderHighlightInline(node, options);
    case 'link':
      return renderLinkInline(node, options);
    case 'footnoteRef':
      return renderFootnoteRefInline(node);
    case 'commentInline':
      return options.includeComments
        ? `<span class="jw-comment-inline" data-jw-comment="true">${renderInlinesToHtml(node.children, options)}</span>`
        : '';
    case 'inlineAttrs':
      return renderInlineAttrsInline(node, options);
    default:
      return '';
  }
}

function renderHighlightInline(node: HighlightNode, options: RenderHtmlOptions): string {
  const cssColor = colorAttributeToCssColor(node.colorAttr);
  const cssFillColor = colorAttributeToCssColor(node.fillColorAttr);
  const classes = ['jw-highlight', `jw-highlight-${node.mode}`];
  const styleParts: string[] = [];

  if (node.mode === 'marker') {
    if (cssColor) {
      styleParts.push(`background-color:${cssColor}`);
    }
    if (cssFillColor) {
      styleParts.push(`border-color:${cssFillColor}`);
    }
  } else {
    if (cssColor) {
      styleParts.push(`border-color:${cssColor}`);
    }
    if (cssFillColor) {
      styleParts.push(`background-color:${cssFillColor}`);
    }
  }

  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttr(styleParts.join(';'))}"` : '';
  const inner = renderInlinesToHtml(node.children, options);

  const hasLineBreaks = inner.includes('<br/>');
  if (hasLineBreaks) {
    classes.push('jw-highlight-block');
    const trimmedInner = inner.replace(/^(<br\/>)+|(<br\/>)+$/g, '');
    return `<div class="${classes.join(' ')}"${styleAttr}>${trimmedInner}</div>`;
  }

  return `<span class="${classes.join(' ')}"${styleAttr}>${inner}</span>`;
}

function renderLinkInline(node: LinkNode, options: RenderHtmlOptions): string {
  const resolvedHref = resolveLinkHref(node.href);
  const href = escapeAttr(resolvedHref);
  const styleParts: string[] = [];
  const color = colorAttributeToCssColor(node.colorAttr);
  const underlineColor = colorAttributeToCssColor(node.underlineColorAttr);
  if (color) {
    styleParts.push(`color:${color}`);
  }
  if (underlineColor) {
    styleParts.push(`text-decoration-color:${underlineColor}`);
  }
  const styleAttr = styleParts.length > 0 ? ` style="${escapeAttr(styleParts.join(';'))}"` : '';
  const inner = renderInlinesToHtml(node.children, options);
  return `<a href="${href}" class="jw-link"${styleAttr}>${inner}</a>`;
}

function renderFootnoteRefInline(node: { type: 'footnoteRef'; id: string }): string {
  const id = escapeAttr(node.id);
  return `<sup class="jw-footnote-ref" data-jw-footnote-id="${id}">[${id}]</sup>`;
}

function renderInlineAttrsInline(
  node: {
    type: 'inlineAttrs';
    attrs: InlineAttributes;
    children: InlineNode[];
  },
  options: RenderHtmlOptions,
): string {
  const style = buildInlineStyleFromInlineAttributes(node.attrs);
  const styleAttr = style ? ` style="${escapeAttr(style)}"` : '';
  const inner = renderInlinesToHtml(node.children, options);
  return `<span class="jw-inline-attrs"${styleAttr}>${inner}</span>`;
}
