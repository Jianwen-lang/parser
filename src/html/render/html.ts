import * as path from 'path';
import { JianwenDocument } from '../../core/ast';
import { formatHtml } from '../format';
import { RenderHtmlOptions, escapeAttr } from './utils';
import { renderMetaToHtml, buildDocumentWrapperAttributes } from './meta';
import { renderBlocksToHtml } from './blocks';

export { RenderHtmlOptions } from './utils';
export { DocumentTheme } from '../theme/theme';
export { renderBlocksToHtml } from './blocks';
export { renderInlinesToHtml } from './inlines';

export function createDefaultAssetPathResolver(
  sourceFilePath: string,
  outputFilePath: string,
): (assetPath: string) => string | undefined {
  const sourceDir = path.dirname(sourceFilePath);
  const outputDir = path.dirname(outputFilePath);

  return (assetPath: string) => {
    if (path.isAbsolute(assetPath) || /^https?:\/\//i.test(assetPath)) {
      return assetPath;
    }
    const absoluteAssetPath = path.resolve(sourceDir, assetPath);
    const relativeToOutput = path.relative(outputDir, absoluteAssetPath);
    return relativeToOutput.replace(/\\/g, '/');
  };
}

export function renderDocumentToHtml(
  doc: JianwenDocument,
  options: RenderHtmlOptions = {},
): string {
  const wrapperTag =
    options.documentWrapperTag === undefined ? 'article' : options.documentWrapperTag;
  const finalOptions = { ...options };
  if (options.sourceFilePath && options.outputFilePath && !options.resolveAssetPath) {
    finalOptions.resolveAssetPath = createDefaultAssetPathResolver(
      options.sourceFilePath,
      options.outputFilePath,
    );
  }

  const innerParts: string[] = [];
  if (finalOptions.includeMeta) {
    innerParts.push(renderMetaToHtml(doc.meta));
  }

  if (!wrapperTag) {
    innerParts.push(
      renderBlocksToHtml(doc.children, {
        ...finalOptions,
        suppressBlockWrapper: true,
      }),
    );
  } else {
    innerParts.push(renderBlocksToHtml(doc.children, finalOptions));
  }
  const innerHtml = innerParts.join('');

  if (!wrapperTag) {
    return innerHtml;
  }

  const wrapperAttrs = buildDocumentWrapperAttributes(doc.meta);
  const themeAttr = finalOptions.documentTheme
    ? ` data-jw-theme="${escapeAttr(finalOptions.documentTheme)}"`
    : '';
  const html = `<${wrapperTag} class="jw-root"${wrapperAttrs}${themeAttr}>${innerHtml}</${wrapperTag}>`;
  return finalOptions.format ? formatHtml(html) : html;
}
