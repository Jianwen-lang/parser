import * as path from 'path';
import { JianwenDocument } from '../../core/ast';
import { formatHtml } from '../format';
import { RenderHtmlOptions, escapeAttr } from './utils';
import { renderMetaToHtml, buildDocumentWrapperAttributes } from './meta';
import { RenderBlockGroupDraft, renderBlocksToHtmlWithGroups } from './blocks';

export { RenderHtmlOptions } from './utils';
export { DocumentTheme } from '../theme/theme';
export { renderBlocksToHtml } from './blocks';
export { renderBlocksToHtmlWithGroups } from './blocks';
export { renderInlinesToHtml } from './inlines';

export interface RenderedBlockGroup {
  id: string;
  kind: 'single' | 'sameLine' | 'foldable';
  startBlockIndex: number;
  endBlockIndex: number;
  startLine?: number;
  endLine?: number;
  origin?: string;
  readOnly: boolean;
}

export interface RenderDocumentWithBlockMapResult {
  html: string;
  groups: RenderedBlockGroup[];
}

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
  return renderDocumentToHtmlWithBlockMap(doc, {
    ...options,
    emitBlockMeta: options.emitBlockMeta ?? false,
  }).html;
}

function finalizeGroups(
  groups: RenderBlockGroupDraft[],
  sourceLineCount: number | undefined,
): RenderedBlockGroup[] {
  return groups.map((group, index) => {
    const next = groups[index + 1];
    let endLine: number | undefined;
    if (group.startLine !== undefined) {
      if (next?.startLine !== undefined) {
        endLine = Math.max(group.startLine, 1, next.startLine - 1);
      } else if (sourceLineCount !== undefined) {
        endLine = Math.max(group.startLine, 1, sourceLineCount);
      }
    }
    return {
      ...group,
      endLine,
    };
  });
}

export function renderDocumentToHtmlWithBlockMap(
  doc: JianwenDocument,
  options: RenderHtmlOptions = {},
): RenderDocumentWithBlockMapResult {
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
    const rendered = renderBlocksToHtmlWithGroups(doc.children, {
      ...finalOptions,
      suppressBlockWrapper: true,
      emitBlockMeta: finalOptions.emitBlockMeta ?? true,
    });
    const lineCount = doc.source ? doc.source.split('\n').length : undefined;
    innerParts.push(rendered.html);
    return {
      html: innerParts.join(''),
      groups: finalizeGroups(rendered.groups, lineCount),
    };
  } else {
    const rendered = renderBlocksToHtmlWithGroups(doc.children, {
      ...finalOptions,
      emitBlockMeta: finalOptions.emitBlockMeta ?? true,
    });
    innerParts.push(rendered.html);
    const innerHtml = innerParts.join('');

    const wrapperAttrs = buildDocumentWrapperAttributes(doc.meta);
    const themeAttr = finalOptions.documentTheme
      ? ` data-jw-theme="${escapeAttr(finalOptions.documentTheme)}"`
      : '';
    const html = `<${wrapperTag} class="jw-root"${wrapperAttrs}${themeAttr}>${innerHtml}</${wrapperTag}>`;
    const lineCount = doc.source ? doc.source.split('\n').length : undefined;
    return {
      html: finalOptions.format ? formatHtml(html) : html,
      groups: finalizeGroups(rendered.groups, lineCount),
    };
  }
}
