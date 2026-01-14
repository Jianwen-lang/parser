import { parseJianwenWithErrors, ParseOptions } from '../core/parser';
import { JianwenDocument } from '../core/ast';
import { ParseError } from '../core/errors';
import { formatHtml } from './format';
import { renderDocumentToHtml } from './render/html';
import { RenderHtmlOptions, escapeAttr, escapeHtml } from './render/utils';
import { DEFAULT_CSS } from './theme/theme';

export const DEFAULT_RUNTIME_SRC = 'dist/src/html/theme/runtime.js';

export interface HtmlDocumentOptions {
  title?: string;
  lang?: string;
  charset?: string;
  headHtml?: string;

  includeCss?: boolean;
  cssText?: string;
  cssHref?: string;

  includeRuntime?: boolean;
  runtimeSrc?: string;

  format?: boolean;
}

export interface RenderJianwenToHtmlDocumentOptions {
  parse?: ParseOptions;
  render?: RenderHtmlOptions;
  document?: HtmlDocumentOptions;
}

export interface RenderJianwenToHtmlDocumentResult {
  html: string;
  ast: JianwenDocument;
  errors: ParseError[];
}

export function buildHtmlDocument(bodyHtml: string, options: HtmlDocumentOptions = {}): string {
  const lang = options.lang ?? 'zh-CN';
  const charset = options.charset ?? 'utf-8';
  const title = options.title ?? 'Jianwen';

  const headParts: string[] = [];
  headParts.push(`<meta charset="${escapeAttr(charset)}">`);
  headParts.push(`<title>${escapeHtml(title)}</title>`);

  const includeCss = options.includeCss ?? true;
  if (includeCss) {
    if (options.cssHref) {
      headParts.push(`<link rel="stylesheet" href="${escapeAttr(options.cssHref)}">`);
    } else {
      const cssText = options.cssText ?? DEFAULT_CSS;
      headParts.push(`<style>${cssText}</style>`);
    }
  }

  if (options.headHtml) {
    headParts.push(options.headHtml);
  }

  const runtimeHtml =
    options.includeRuntime && (options.runtimeSrc ?? DEFAULT_RUNTIME_SRC)
      ? `<script src="${escapeAttr(options.runtimeSrc ?? DEFAULT_RUNTIME_SRC)}"></script>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
${headParts.join('\n')}
</head>
<body>
${bodyHtml}
${runtimeHtml}
</body>
</html>`;

  return options.format ? formatHtml(html) : html;
}

export function renderJianwenToHtmlDocument(
  source: string,
  options: RenderJianwenToHtmlDocumentOptions = {},
): RenderJianwenToHtmlDocumentResult {
  const parseResult = parseJianwenWithErrors(source, options.parse);

  const renderOptions: RenderHtmlOptions = {
    includeMeta: true,
    includeComments: false,
    ...options.render,
  };
  const bodyHtml = renderDocumentToHtml(parseResult.ast, renderOptions);

  const title = options.document?.title ?? parseResult.ast.meta?.title;
  const html = buildHtmlDocument(bodyHtml, {
    ...options.document,
    title,
  });

  return { html, ast: parseResult.ast, errors: parseResult.errors };
}
