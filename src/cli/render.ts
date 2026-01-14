import * as fs from 'fs';
import * as path from 'path';
import { DocumentTheme } from '../html/theme/theme';
import {
  DEFAULT_RUNTIME_SRC,
  HtmlDocumentOptions,
  renderJianwenToHtmlDocument,
} from '../html/convert';
import { RenderHtmlOptions } from '../html/render/utils';

interface CliOptions {
  inputFilePath: string;
  outputFilePath: string;
  theme?: DocumentTheme;
  format?: boolean;
  includeCss?: boolean;
  cssHref?: string;
  includeRuntime?: boolean;
  runtimeSrc?: string;
  includeComments?: boolean;
  includeMeta?: boolean;
}

const TAB_WIDTH = 4;

function isCombiningCodePoint(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  );
}

function isFullWidthCodePoint(code: number): boolean {
  return (
    code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x3fffd))
  );
}

function getDisplayWidth(value: string): number {
  let width = 0;
  for (const ch of value) {
    if (ch === '\t') {
      const nextStop = TAB_WIDTH - (width % TAB_WIDTH);
      width += nextStop;
      continue;
    }
    const code = ch.codePointAt(0);
    if (code === undefined) {
      continue;
    }
    if (isCombiningCodePoint(code)) {
      continue;
    }
    width += isFullWidthCodePoint(code) ? 2 : 1;
  }
  return width;
}

function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const inputFilePath = args.shift();
  if (!inputFilePath) {
    throw new Error('Missing input file path');
  }

  let outputFilePath = 'out.html';
  let theme: DocumentTheme | undefined;
  let format = false;
  let includeCss = true;
  let cssHref: string | undefined;
  let includeRuntime = false;
  let runtimeSrc: string | undefined;
  let includeComments = false;
  let includeMeta = true;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;

    if (arg === '-o' || arg === '--out') {
      const value = args.shift();
      if (!value) throw new Error('Missing value for --out');
      outputFilePath = value;
      continue;
    }

    if (arg === '--theme') {
      const value = args.shift();
      if (value !== 'light' && value !== 'dark' && value !== 'auto') {
        throw new Error('Invalid --theme value (expected light|dark|auto)');
      }
      theme = value;
      continue;
    }

    if (arg === '--format') {
      format = true;
      continue;
    }

    if (arg === '--no-css') {
      includeCss = false;
      continue;
    }

    if (arg === '--css-href') {
      const value = args.shift();
      if (!value) throw new Error('Missing value for --css-href');
      cssHref = value;
      includeCss = true;
      continue;
    }

    if (arg === '--runtime') {
      includeRuntime = true;
      continue;
    }

    if (arg === '--runtime-src') {
      const value = args.shift();
      if (!value) throw new Error('Missing value for --runtime-src');
      runtimeSrc = value;
      includeRuntime = true;
      continue;
    }

    if (arg === '--comments') {
      includeComments = true;
      continue;
    }

    if (arg === '--no-meta') {
      includeMeta = false;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      console.log(`Usage: jw-render <input.jw> [options]

Options:
  -o, --out <file>         Output HTML path (default: out.html)
  --theme <light|dark|auto> Set document theme via data-jw-theme
  --format                 Beautify output HTML
  --no-css                 Do not inline CSS
  --css-href <href>        Link CSS instead of inlining
  --runtime                Append runtime <script> tag (default src: ${DEFAULT_RUNTIME_SRC})
  --runtime-src <src>      Override runtime <script src=...>
  --comments               Include comment nodes
  --no-meta                Do not render meta header
`);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    inputFilePath,
    outputFilePath,
    theme,
    format,
    includeCss,
    cssHref,
    includeRuntime,
    runtimeSrc,
    includeComments,
    includeMeta,
  };
}

export function runRenderCli(argv: string[]): void {
  const options = parseCliArgs(argv);

  const absoluteInput = path.resolve(process.cwd(), options.inputFilePath);
  const absoluteOutput = path.resolve(process.cwd(), options.outputFilePath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`Input file not found: ${absoluteInput}`);
  }

  const baseDir = path.dirname(absoluteInput);
  const source = fs.readFileSync(absoluteInput, 'utf-8');
  const sourceLines = source.split(/\r?\n/);
  const includeLineCache = new Map<string, string[]>();

  const getIncludeLines = (target: string): string[] | undefined => {
    if (includeLineCache.has(target)) {
      return includeLineCache.get(target);
    }
    try {
      const includePath = path.resolve(baseDir, target);
      if (!fs.existsSync(includePath)) {
        includeLineCache.set(target, []);
        return undefined;
      }
      const includeSource = fs.readFileSync(includePath, 'utf-8');
      const lines = includeSource.split(/\r?\n/);
      includeLineCache.set(target, lines);
      return lines;
    } catch {
      includeLineCache.set(target, []);
      return undefined;
    }
  };

  const loadFile = (target: string): string | undefined => {
    try {
      const includePath = path.resolve(baseDir, target);
      if (!fs.existsSync(includePath)) {
        return undefined;
      }
      return fs.readFileSync(includePath, 'utf-8');
    } catch {
      return undefined;
    }
  };

  const resolveInclude: RenderHtmlOptions['resolveInclude'] = (mode, target) => {
    if (mode !== 'file' || !target.endsWith('.html')) {
      return undefined;
    }
    try {
      const includePath = path.resolve(baseDir, target);
      if (!fs.existsSync(includePath)) {
        return undefined;
      }
      return fs.readFileSync(includePath, 'utf-8');
    } catch {
      return undefined;
    }
  };

  const renderOptions: RenderHtmlOptions = {
    includeMeta: options.includeMeta,
    includeComments: options.includeComments,
    format: options.format,
    documentTheme: options.theme,
    sourceFilePath: absoluteInput,
    outputFilePath: absoluteOutput,
    resolveInclude,
  };

  const documentOptions: HtmlDocumentOptions = {
    includeCss: options.includeCss,
    cssHref: options.cssHref,
    includeRuntime: options.includeRuntime,
    runtimeSrc: options.runtimeSrc,
    format: options.format,
  };

  const result = renderJianwenToHtmlDocument(source, {
    parse: {
      expandInclude: true,
      includeMaxDepth: 10,
      loadFile,
    },
    render: renderOptions,
    document: documentOptions,
  });

  if (result.errors.length > 0) {
    console.error(`Parser reported ${result.errors.length} warning(s)/error(s).`);
    for (const error of result.errors) {
      const includeMatch = /^\[include:([^\]]+)\]\s*/.exec(error.message);
      const includeTarget = includeMatch?.[1];
      const lines = includeTarget ? (getIncludeLines(includeTarget) ?? []) : sourceLines;
      const lineText = lines[error.line - 1];
      const rawColumn = Math.max(1, error.column ?? 1);
      const safeColumn = lineText ? Math.min(rawColumn, lineText.length + 1) : rawColumn;
      const location = `${error.line}:${rawColumn}`;
      console.error(`${error.severity.toUpperCase()} ${location} ${error.message}`);

      if (includeTarget) {
        console.error(`  (from include: ${includeTarget})`);
      }
      if (lineText !== undefined) {
        const prefixText = lineText.slice(0, safeColumn - 1);
        const caretPos = getDisplayWidth(prefixText);
        console.error(`  ${lineText}`);
        console.error(`  ${' '.repeat(caretPos)}^`);
      } else {
        console.error('  (source line unavailable)');
      }
    }

    const hasError = result.errors.some((error) => error.severity === 'error');
    if (hasError) {
      console.error('Render aborted due to parser errors.');
      process.exit(1);
    }
  }

  fs.writeFileSync(absoluteOutput, result.html, { encoding: 'utf8' });
  console.log(`Rendered ${options.inputFilePath} -> ${options.outputFilePath}`);
}

if (require.main === module) {
  runRenderCli(process.argv.slice(2));
}
