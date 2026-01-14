import { BlockAttributes, ColorAttribute, InlineAttributes } from '../../core/ast';
import { DocumentTheme, PRESET_COLORS } from '../theme/theme';

export interface RenderHtmlOptions {
  includeMeta?: boolean;
  includeComments?: boolean;
  resolveHtmlSource?: (source: string) => string | undefined;
  resolveInclude?: (mode: 'file' | 'tag', target: string) => string | undefined;
  resolveAssetPath?: (assetPath: string) => string | undefined;
  sourceFilePath?: string;
  outputFilePath?: string;
  documentWrapperTag?: string | null;
  documentTheme?: DocumentTheme;
  format?: boolean;
  suppressBlockWrapper?: boolean;
}

export function slugifyToId(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'section';
  }
  const lowered = trimmed.toLowerCase();
  const replacedSpaces = lowered.replace(/\s+/g, '-');
  const cleaned = replacedSpaces.replace(/[^a-z0-9_\-\u4e00-\u9fa5]+/g, '-');
  const collapsed = cleaned.replace(/-+/g, '-');
  const trimmedDashes = collapsed.replace(/^-|-$/g, '');
  return trimmedDashes || 'section';
}

export function buildHeadingIdFromText(text: string): string {
  return `jw-heading-${slugifyToId(text)}`;
}

export function buildTagIdFromName(name: string): string {
  return `jw-tag-${slugifyToId(name)}`;
}

export function tryBuildHeadingAnchorFromHref(href: string): string | undefined {
  const trimmed = href.trim();
  const match = trimmed.match(/^#{1,6}\s+(.+)/);
  if (!match || !match[1]) {
    return undefined;
  }
  const titleText = match[1];
  if (!titleText.trim()) {
    return undefined;
  }
  return `#${buildHeadingIdFromText(titleText)}`;
}

export function tryBuildTagAnchorFromHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return undefined;
  }
  if (/\.[^\s.]+$/.test(trimmed)) {
    return undefined;
  }
  return `#${buildTagIdFromName(trimmed)}`;
}

export function resolveLinkHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) {
    return '#';
  }

  const headingAnchor = tryBuildHeadingAnchorFromHref(trimmed);
  if (headingAnchor) {
    return headingAnchor;
  }

  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }

  const tagAnchor = tryBuildTagAnchorFromHref(trimmed);
  if (tagAnchor) {
    return tagAnchor;
  }

  return trimmed;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#96;');
}

export function colorAttributeToCssColor(attr: ColorAttribute | undefined): string | undefined {
  if (!attr) {
    return undefined;
  }
  if (attr.kind === 'hex') {
    return attr.value;
  }
  const cleanValue = attr.value.replace(/[^a-zA-Z0-9_-]/g, '-');
  const preset = PRESET_COLORS[attr.value];
  if (preset) {
    return `var(--jw-color-${cleanValue}, ${preset})`;
  }
  return `var(--jw-color-${cleanValue})`;
}

function mapFontSizeToEm(fontSize: number): number {
  if (fontSize <= 1) return 1;
  if (fontSize >= 5) return 2.5;
  return 1 + (fontSize - 1) * 0.375;
}

export function buildInlineStyleFromInlineAttributes(
  attrs: InlineAttributes | undefined,
): string | undefined {
  if (!attrs) {
    return undefined;
  }

  const styleParts: string[] = [];

  if (attrs.color) {
    const cssColor = colorAttributeToCssColor(attrs.color);
    if (cssColor) {
      styleParts.push(`color:${cssColor}`);
    }
  }

  if (typeof attrs.fontSize === 'number') {
    const emValue = mapFontSizeToEm(attrs.fontSize);
    styleParts.push(`font-size:${emValue}em`);
  }

  if (attrs.fontStyle && attrs.fontStyle.length > 0) {
    let fontWeight: string | undefined;
    let fontStyle: string | undefined;
    let fontFamily: string | undefined;

    for (const style of attrs.fontStyle) {
      if (style === 'italic') {
        fontStyle = 'italic';
      } else if (style === 'bold') {
        fontWeight = 'bold';
      } else if (style === 'heavy') {
        fontWeight = '900';
      } else if (style === 'slim') {
        fontWeight = '300';
      } else if (style === 'serif') {
        fontFamily = 'serif';
      } else if (style === 'mono') {
        fontFamily = 'monospace';
      }
    }

    if (fontWeight) {
      styleParts.push(`font-weight:${fontWeight}`);
    }
    if (fontStyle) {
      styleParts.push(`font-style:${fontStyle}`);
    }
    if (fontFamily) {
      styleParts.push(`font-family:${fontFamily}`);
    }
  }

  if (styleParts.length === 0) {
    return undefined;
  }
  return styleParts.join(';');
}

export interface BlockAttrBuildOptions {
  rawAttrs?: string[];
  extraData?: Record<string, string>;
  extraStyle?: string[] | string;
}

export function buildBlockAttributes(
  attrs: BlockAttributes | undefined,
  options: BlockAttrBuildOptions = {},
): string {
  const attrParts: string[] = [];

  if (options.rawAttrs) {
    attrParts.push(...options.rawAttrs);
  }

  if (options.extraData) {
    for (const [key, value] of Object.entries(options.extraData)) {
      attrParts.push(`${key}="${escapeAttr(value)}"`);
    }
  }

  const styleParts: string[] = [];

  if (options.extraStyle) {
    if (Array.isArray(options.extraStyle)) {
      styleParts.push(...options.extraStyle);
    } else {
      styleParts.push(options.extraStyle);
    }
  }

  if (attrs) {
    if (attrs.align) {
      attrParts.push(`data-jw-align="${escapeAttr(attrs.align)}"`);
      styleParts.push(`text-align:${attrs.align}`);
    }
    if (attrs.position) {
      attrParts.push(`data-jw-position="${escapeAttr(attrs.position)}"`);
    }
    if (attrs.truncateLeft) {
      attrParts.push('data-jw-truncate-left="true"');
    }
    if (attrs.truncateRight) {
      attrParts.push('data-jw-truncate-right="true"');
    }

    const inlineStyle = buildInlineStyleFromInlineAttributes(attrs);
    if (inlineStyle) {
      styleParts.push(inlineStyle);
    }
  }

  if (styleParts.length > 0) {
    attrParts.push(`style="${escapeAttr(styleParts.join(';'))}"`);
  }

  if (attrParts.length === 0) {
    return '';
  }
  return ` ${attrParts.join(' ')}`;
}
