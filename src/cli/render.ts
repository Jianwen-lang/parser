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

  fs.writeFileSync(absoluteOutput, result.html, { encoding: 'utf8' });

  if (result.errors.length > 0) {
    console.error(`Rendered with ${result.errors.length} parser warning(s)/error(s).`);
  }
  console.log(`Rendered ${options.inputFilePath} -> ${options.outputFilePath}`);
}

if (require.main === module) {
  runRenderCli(process.argv.slice(2));
}
