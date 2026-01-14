import {
  BlockNode,
  FootnoteDefBlock,
  InlineNode,
  JianwenDocument,
  JianwenMeta,
  TaggedBlock,
} from './ast';
import { ParseError, ParseResult } from './errors';
import { parseBlocks } from './block-parser';
import { parseInlines } from './inline-parser';
import { getNodeLocation, getNodeOrigin } from './location';
import { cloneBlock } from './clone';
import { forEachBlock, forEachInlineContainerInBlocks, walkInlines } from './traverse';

export interface ParseOptions {
  expandInclude?: boolean;
  includeMaxDepth?: number;
  loadFile?: (path: string, fromStack: string[]) => string | undefined;
}

interface TemplateParseResult {
  meta?: JianwenMeta;
  body: string;
}

export function parseJianwen(source: string, options: ParseOptions = {}): JianwenDocument {
  return parseJianwenWithErrors(source, options).ast;
}

export function parseJianwenWithErrors(source: string, options: ParseOptions = {}): ParseResult {
  const errors: ParseError[] = [];
  const { meta, body } = parseInitializationTemplate(source);
  const blocks: BlockNode[] = parseBlocks(body, errors);
  applyInlineParsing(blocks, errors);
  const ast: JianwenDocument = {
    type: 'document',
    source,
    meta,
    children: blocks,
  };
  postProcessDocument(ast, options, errors);
  return { ast, errors };
}

function parseInitializationTemplate(source: string): TemplateParseResult {
  const lines = source.split('\n');
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== undefined && isTemplateBoundaryLine(line)) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    return { body: source };
  }
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== undefined && isTemplateBoundaryLine(line)) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { body: source };
  }

  const meta: JianwenMeta = {};
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const bracketIndex = line.indexOf('[');
    if (bracketIndex === -1) {
      continue;
    }
    const segment = line.slice(bracketIndex);
    const pattern = /\[([^\]]+?)\]=([^[]*)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(segment)) !== null) {
      const rawKey = match[1];
      const rawValue = match[2];
      if (rawKey === undefined || rawValue === undefined) {
        continue;
      }
      const key = rawKey.trim();
      const value = rawValue.trim();
      applyMetaKey(meta, key, value);
    }
  }

  const bodyLines = lines.slice(0, start).concat(lines.slice(end + 1));
  const body = bodyLines.join('\n');
  if (isMetaEmpty(meta)) {
    return { body };
  }
  return { meta, body };
}

function isTemplateBoundaryLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== '_') {
      return false;
    }
  }
  return true;
}

function applyMetaKey(meta: JianwenMeta, key: string, rawValue: string): void {
  const value = rawValue.trim();
  if (key === 'title') {
    if (value.length > 0) {
      meta.title = value;
    }
    return;
  }
  if (key === 'author') {
    if (value.length > 0) {
      const match = /^(.*)\(([^)]+)\)$/.exec(value);
      if (match && match[1] !== undefined && match[2] !== undefined) {
        meta.author = match[1].trim();
        meta.authorUrl = match[2].trim();
      } else {
        meta.author = value;
      }
    }
    return;
  }
  if (key === 'author_url') {
    if (value.length > 0) {
      meta.authorUrl = value;
    }
    return;
  }
  if (key === 'time') {
    if (value.length > 0) {
      meta.time = value;
    }
    return;
  }
  if (key === 'add_info') {
    if (value.length > 0) {
      meta.addInfo = value;
    }
    return;
  }
  if (key === 'tag(s)') {
    if (value.length === 0) {
      return;
    }
    const parts = value.split(',');
    const tags: string[] = [];
    for (const part of parts) {
      const t = part.trim();
      if (t.length > 0) {
        tags.push(t);
      }
    }
    if (tags.length > 0) {
      meta.tags = tags;
    }
    return;
  }
  if (key === 'global_font') {
    if (value.length === 0) {
      return;
    }
    const parts = value.split(',');
    const fonts: JianwenMeta['globalFont'] = [];
    for (const part of parts) {
      const f = part.trim();
      if (
        f === 'italic' ||
        f === 'bold' ||
        f === 'heavy' ||
        f === 'slim' ||
        f === 'serif' ||
        f === 'mono'
      ) {
        fonts.push(f);
      }
    }
    if (fonts.length > 0) {
      meta.globalFont = fonts;
    }
    return;
  }
}

function isMetaEmpty(meta: JianwenMeta): boolean {
  if (meta.title) return false;
  if (meta.author) return false;
  if (meta.authorUrl) return false;
  if (meta.time) return false;
  if (meta.addInfo) return false;
  if (meta.tags && meta.tags.length > 0) return false;
  if (meta.globalFont && meta.globalFont.length > 0) return false;
  return true;
}

function getInlineBaseLine(node: object): number {
  const loc = getNodeLocation(node);
  return loc?.line ?? 1;
}

function applyInlineParsing(blocks: BlockNode[], errors: ParseError[]): void {
  forEachInlineContainerInBlocks(blocks, (children, owner) => {
    const text = collectInlineSource(children);
    if (text.length === 0) {
      return;
    }

    const parsed = parseInlines(text, errors, getInlineBaseLine(owner));
    if (owner && typeof owner === 'object' && 'children' in owner) {
      (owner as { children: InlineNode[] }).children = parsed;
    }
  });
}

function collectInlineSource(children: InlineNode[]): string {
  let result = '';
  for (const child of children) {
    if (child.type === 'text') {
      result += child.value;
    }
  }
  return result;
}

function postProcessDocument(
  document: JianwenDocument,
  options: ParseOptions,
  errors: ParseError[],
): void {
  if (options.expandInclude) {
    const tagIndex = buildTagIndex(document.children);
    const context: IncludeExpandContext = {
      stack: [],
      maxDepth: typeof options.includeMaxDepth === 'number' ? options.includeMaxDepth : 16,
      loadFile: options.loadFile,
      tagIndex,
      fileCache: new Map(),
    };
    document.children = expandIncludesInBlocks(
      document.children,
      document,
      options,
      errors,
      context,
    );
  }
  checkFootnotes(document, errors);
}

interface IncludeExpandContext {
  stack: string[];
  maxDepth: number;
  loadFile?: (path: string, fromStack: string[]) => string | undefined;
  tagIndex: Map<string, TaggedBlock>;
  fileCache: Map<string, ParseResult>;
}

function buildTagIndex(blocks: BlockNode[]): Map<string, TaggedBlock> {
  const index = new Map<string, TaggedBlock>();
  for (const block of blocks) {
    if (block.type === 'taggedBlock') {
      if (!index.has(block.name)) {
        index.set(block.name, block);
      }
    }
  }
  return index;
}

function expandIncludesInBlocks(
  blocks: BlockNode[],
  document: JianwenDocument,
  options: ParseOptions,
  errors: ParseError[],
  context: IncludeExpandContext,
): BlockNode[] {
  const result: BlockNode[] = [];
  for (const block of blocks) {
    if (block.type === 'include') {
      const expanded = expandSingleInclude(block, document, options, errors, context);
      if (expanded && expanded.length > 0) {
        for (const b of expanded) {
          result.push(b);
        }
      } else {
        result.push(block);
      }
      continue;
    }

    if (block.type === 'quote') {
      const children = expandIncludesInBlocks(block.children, document, options, errors, context);
      result.push({ ...block, children });
      continue;
    }
    if (block.type === 'list') {
      const items = block.children.map((item) => {
        const itemChildren = expandIncludesInBlocks(
          item.children,
          document,
          options,
          errors,
          context,
        );
        return { ...item, children: itemChildren };
      });
      result.push({ ...block, children: items });
      continue;
    }
    if (block.type === 'footnotes') {
      const defs = block.children.map((def) => {
        const defChildren = expandIncludesInBlocks(
          def.children,
          document,
          options,
          errors,
          context,
        );
        return { ...def, children: defChildren };
      });
      result.push({ ...block, children: defs });
      continue;
    }
    if (block.type === 'footnoteDef') {
      const children = expandIncludesInBlocks(block.children, document, options, errors, context);
      result.push({ ...block, children });
      continue;
    }
    if (block.type === 'commentBlock') {
      const children = expandIncludesInBlocks(block.children, document, options, errors, context);
      result.push({ ...block, children });
      continue;
    }

    result.push(block);
  }
  return result;
}

function expandSingleInclude(
  block: BlockNode,
  document: JianwenDocument,
  options: ParseOptions,
  errors: ParseError[],
  context: IncludeExpandContext,
): BlockNode[] | undefined {
  if (block.type !== 'include') {
    return undefined;
  }

  const includeLoc = getNodeLocation(block);
  const includeLine = includeLoc?.line ?? 1;
  const includeColumn = includeLoc?.column;

  if (block.mode === 'tag') {
    const taggedFromIndex = context.tagIndex.get(block.target);
    const tagged = taggedFromIndex ?? findTaggedBlock(document.children, block.target);
    if (!tagged) {
      const error: ParseError = {
        message: `Include tag target "${block.target}" not found`,
        line: includeLine,
        column: includeColumn,
        severity: 'warning',
      };
      errors.push(error);
      return [block];
    }
    const cloned = cloneBlock(tagged.child);
    return [cloned];
  }

  if (context.stack.length >= context.maxDepth) {
    const error: ParseError = {
      message: `Include max depth ${context.maxDepth} exceeded for target "${block.target}"`,
      line: includeLine,
      column: includeColumn,
      severity: 'warning',
    };
    errors.push(error);
    return [block];
  }

  if (context.stack.indexOf(block.target) !== -1) {
    const error: ParseError = {
      message: `Include cycle detected for target "${block.target}"`,
      line: includeLine,
      column: includeColumn,
      severity: 'warning',
    };
    errors.push(error);
    return [block];
  }

  if (!context.loadFile) {
    const error: ParseError = {
      message: `IncludeBlock with mode "file" requires loadFile option to expand target "${block.target}"`,
      line: includeLine,
      column: includeColumn,
      severity: 'warning',
    };
    errors.push(error);
    return [block];
  }

  const cached = context.fileCache.get(block.target);
  if (cached) {
    for (const e of cached.errors) {
      errors.push({ ...e, message: `[include:${block.target}] ${e.message}` });
    }
    return cached.ast.children.map((child) => cloneBlock(child, { origin: block.target }));
  }

  const nextStack = context.stack.concat(block.target);
  const source = context.loadFile(block.target, nextStack);
  if (source === undefined) {
    const error: ParseError = {
      message: `Include target "${block.target}" could not be loaded`,
      line: includeLine,
      column: includeColumn,
      severity: 'warning',
    };
    errors.push(error);
    return [block];
  }

  const childResult = parseJianwenWithErrors(source, {
    ...options,
    expandInclude: true,
    loadFile: undefined,
  });
  context.fileCache.set(block.target, childResult);
  for (const e of childResult.errors) {
    errors.push({ ...e, message: `[include:${block.target}] ${e.message}` });
  }
  return childResult.ast.children.map((child) => cloneBlock(child, { origin: block.target }));
}

function findTaggedBlock(blocks: BlockNode[], name: string): TaggedBlock | undefined {
  for (const block of blocks) {
    if (block.type === 'taggedBlock' && block.name === name) {
      return block;
    }
  }
  return undefined;
}

function checkFootnotes(document: JianwenDocument, errors: ParseError[]): void {
  const defsById = new Map<string, FootnoteDefBlock[]>();
  collectFootnoteDefs(document.children, defsById);
  const referencedIds = new Map<string, { line: number; column?: number; origin?: string }>();
  collectFootnoteRefsInBlocks(document.children, referencedIds);

  for (const [id, location] of referencedIds) {
    if (!defsById.has(id)) {
      const originSuffix = location.origin ? ` (from include "${location.origin}")` : '';
      const error: ParseError = {
        message: `Footnote reference "${id}" has no corresponding FootnoteDefBlock${originSuffix}`,
        line: location.line,
        column: location.column,
        severity: 'warning',
      };
      errors.push(error);
    }
  }
}

function collectFootnoteDefs(blocks: BlockNode[], defsById: Map<string, FootnoteDefBlock[]>): void {
  forEachBlock(blocks, (block) => {
    if (block.type !== 'footnoteDef') {
      return;
    }
    let list = defsById.get(block.id);
    if (!list) {
      list = [];
      defsById.set(block.id, list);
    }
    list.push(block);
  });
}

function collectFootnoteRefsInBlocks(
  blocks: BlockNode[],
  referencedIds: Map<string, { line: number; column?: number; origin?: string }>,
): void {
  forEachInlineContainerInBlocks(blocks, (nodes) => {
    collectFootnoteRefsInInlines(nodes, referencedIds);
  });
}

function collectFootnoteRefsInInlines(
  nodes: InlineNode[],
  referencedIds: Map<string, { line: number; column?: number; origin?: string }>,
): void {
  walkInlines(nodes, (node) => {
    if (node.type !== 'footnoteRef') {
      return;
    }
    if (referencedIds.has(node.id)) {
      return;
    }
    const loc = getNodeLocation(node);
    const origin = getNodeOrigin(node);
    referencedIds.set(node.id, {
      line: loc?.line ?? 1,
      column: loc?.column,
      origin,
    });
  });
}
