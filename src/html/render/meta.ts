import { JianwenMeta } from '../../core/ast';
import { escapeHtml, escapeAttr } from './utils';

export function renderMetaToHtml(meta: JianwenMeta | undefined): string {
  if (!meta) {
    return '';
  }

  const parts: string[] = [];

  if (meta.title) {
    parts.push(`<h1 class="jw-meta-title">${escapeHtml(meta.title)}</h1>`);
  }

  const bylineParts: string[] = [];
  if (meta.author) {
    const authorText = escapeHtml(meta.author);
    if (meta.authorUrl) {
      const href = escapeAttr(meta.authorUrl);
      bylineParts.push(
        `<span class="jw-meta-author"><a href="${href}" class="jw-meta-author-link">${authorText}</a></span>`,
      );
    } else {
      bylineParts.push(`<span class="jw-meta-author">${authorText}</span>`);
    }
  }
  if (meta.time) {
    bylineParts.push(`<time class="jw-meta-time">${escapeHtml(meta.time)}</time>`);
  }

  if (meta.addInfo) {
    bylineParts.push(`<span class="jw-meta-add-info">${escapeHtml(meta.addInfo)}</span>`);
  }

  if (bylineParts.length > 0) {
    parts.push(`<div class="jw-meta-byline">${bylineParts.join(' · ')}</div>`);
  }

  return `<header class="jw-meta">${parts.join('')}</header>`;
}

export function buildDocumentWrapperAttributes(meta: JianwenMeta | undefined): string {
  if (!meta) {
    return '';
  }

  const attrs: string[] = [];
  if (meta.tags && meta.tags.length > 0) {
    attrs.push(`data-jw-tags="${escapeAttr(meta.tags.join(','))}"`);
  }
  if (meta.globalFont && meta.globalFont.length > 0) {
    attrs.push(`data-jw-global-font="${escapeAttr(meta.globalFont.join(' '))}"`);
  }
  if (attrs.length === 0) {
    return '';
  }
  return ` ${attrs.join(' ')}`;
}
