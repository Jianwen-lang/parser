# @jianwen--lang/parser

Jianwen（简文）是一种类似 Markdown 的轻量级标记语言，针对网页博客、公众号等内容发布场景的排版能力进行优化。本包提供 Jianwen 的 **TypeScript 核心解析器**（输出结构化 AST）以及 **HTML 渲染器**，用于在编辑器、渲染服务、静态站点生成等场景复用同一套解析语义。

- **环境无关**：核心解析不依赖 DOM，可在 Node.js 与浏览器（经打包）运行
- **错误容忍**：解析会尽可能继续，并返回诊断信息
- **可扩展**：通过 AST 节点与规则扩展语法

## 安装

```bash
npm i @jianwen--lang/parser
```

## 快速开始：解析为 AST

```ts
import { parseJianwenWithErrors } from '@jianwen--lang/parser';

const source = `
# 标题

这里是 *简文* 内容
`.trim();

const { ast, errors } = parseJianwenWithErrors(source);
if (errors.length > 0) {
  console.warn(errors);
}

console.log(ast.type); // "document"
```

常用类型：

- `JianwenDocument`：文档 AST 根节点
- `ParseError`：诊断信息结构

## 渲染：AST -> HTML

```ts
import { parseJianwenWithErrors, renderDocumentToHtml } from '@jianwen--lang/parser';

const { ast, errors } = parseJianwenWithErrors(source);
const html = renderDocumentToHtml(ast, { includeMeta: true, format: true });
```

如果你希望直接得到完整 HTML 文档（含 `<html>`/`<head>`/`<body>` 与默认 CSS）：

```ts
import { renderJianwenToHtmlDocument } from '@jianwen--lang/parser';

const { html, ast, errors } = renderJianwenToHtmlDocument(source, {
  document: { format: true },
});
```

## Include：文件/标签展开（可选）

解析阶段支持将 `[@](path)`（文件 include）或 `[@=tag]`（标签 include）按需展开。开启方式：

```ts
import { parseJianwenWithErrors } from '@jianwen--lang/parser';
import * as fs from 'node:fs';

const { ast, errors } = parseJianwenWithErrors(source, {
  expandInclude: true,
  includeMaxDepth: 8,
  loadFile: (path) => fs.readFileSync(path, 'utf8'),
});
```

说明：

- 若启用 `expandInclude` 但未提供 `loadFile`，文件 include 会保留为 AST 节点并产生 warning。
- include 解析内置缓存，并带有最大深度与循环检测。

## API 概览

- 解析
  - `parseJianwen(source, options?) => JianwenDocument`
  - `parseJianwenWithErrors(source, options?) => { ast: JianwenDocument; errors: ParseError[] }`
  - `ParseOptions`：`expandInclude` / `includeMaxDepth` / `loadFile`
- 渲染
  - `renderDocumentToHtml(doc, options?) => string`
  - `renderJianwenToHtmlDocument(source, options?) => { html; ast; errors }`
  - `buildHtmlDocument(bodyHtml, options?) => string`

## 规范与扩展

语法与 AST 设计约定请参考项目仓库内的规范文档（例如 `docs/standards.md` 与语言语法文档）。

## License

MIT（见 `LICENSE`）。
