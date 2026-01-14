# Jianwen 解析器设计

本文档为解析器与 HTML 渲染器的设计说明，避免与实现长期漂移。

## 1. 范围、目标与非目标

### 1.1 范围

- **解析（Core）**：把 `.jw` 文本解析为 AST，并产出诊断信息。实现位于 `parser/parser/src/core/*`。
- **渲染（HTML）**：把 AST 渲染为 HTML 字符串，并提供内置主题 CSS 与可选 runtime。实现位于 `parser/parser/src/html/*`。
- **CLI/脚本**：仓库内调试入口。实现位于 `parser/parser/src/cli/*` 与 `parser/parser/scripts/*`。

### 1.2 目标

- 面向 **Node.js 与浏览器**：核心解析与 HTML 渲染为纯字符串逻辑（不依赖 DOM）；可选 runtime 使用 DOM。
- 保持一个 **稳定的公共入口**，供上层工具复用（预览器、编辑器、构建脚本等）。
- 新语法优先按“**新增规则 + 更新 AST + 补测试**”落地，避免把语法分散到多个不一致的地方。

### 1.3 非目标（当前实现不做/不保证）

- 不在解析阶段做复杂的语义分析（例如跨文档链接校验、引用重排等）；目前仅包含 include 展开与脚注引用存在性检查。
- 不在核心解析阶段依赖文件系统或网络；文件 include 由 `loadFile` 注入。

## 2. 对外 API（推荐使用入口）

公共入口统一从 `parser/parser/src/parser.ts` 导出（库使用者直接依赖该入口而不是复制脚本逻辑）：

- 解析：`parseJianwen`、`parseJianwenWithErrors`（实现在 `parser/parser/src/core/parser.ts`）
- AST/诊断类型：`parser/parser/src/core/ast.ts`、`parser/parser/src/core/errors.ts`
- HTML：`renderDocumentToHtml`、`renderJianwenToHtmlDocument`、`buildHtmlDocument`（`parser/parser/src/html/*`）
- 主题：`DocumentTheme`、`DEFAULT_CSS`（`parser/parser/src/html/theme/theme.ts`）

核心配置项（与实现一致）：

```ts
export interface ParseOptions {
  expandInclude?: boolean;
  includeMaxDepth?: number;
  loadFile?: (path: string, fromStack: string[]) => string | undefined;
}
```

```ts
export interface RenderHtmlOptions {
  includeMeta?: boolean;
  includeComments?: boolean;
  resolveHtmlSource?: (source: string) => string | undefined;
  resolveInclude?: (mode: 'file' | 'tag', target: string) => string | undefined;
  resolveAssetPath?: (assetPath: string) => string | undefined;
  sourceFilePath?: string;
  outputFilePath?: string;
  documentWrapperTag?: string | null;
  documentTheme?: 'light' | 'dark' | 'auto';
  format?: boolean;
  suppressBlockWrapper?: boolean;
}
```

## 3. 目录结构（按当前实现）

```text
parser/parser/src/
  parser.ts                 # 对外导出聚合入口
  lexer/lexer.ts             # 行/字符扫描基础设施
  core/
    ast.ts                   # AST：唯一真相
    errors.ts                # ParseError / ParseResult
    location.ts              # 节点 location/origin 元数据（非枚举）
    clone.ts                 # include / tag 克隆
    traverse.ts              # 遍历与“行内容器”抽象
    parser.ts                # parseJianwen* 顶层流程与后处理
    block-parser.ts          # 块级解析（含属性行 pending 机制）
    block/rules/*            # 块级规则注册（include/heading/hr）
    inline-parser.ts         # 行内解析入口（scanner + rule dispatch）
    inline/rules/*           # 行内规则（backtick/bracket/style/…）
  html/
    convert.ts               # parse + render + buildDocument 一体化入口
    render/*                 # AST -> HTML（blocks/inlines/meta/utils）
    theme/*                  # base/light/dark CSS 与 runtime
    format.ts                # HTML 格式化（可选）
  cli/render.ts              # CLI 渲染入口（ts-node 调试/脚本复用）
parser/parser/scripts/
  test-render.ts             # 调试脚本：转调 runRenderCli 并追加常用 flag
```

## 4. AST 与元数据约定

### 4.1 AST 的唯一真相

AST 以 `parser/parser/src/core/ast.ts` 为准；本文档只描述关键约定，不重复粘贴全部类型定义。

### 4.2 文档元信息（Initialization Template）

`parser/parser/src/core/parser.ts` 支持在文首解析“初始化模板”：

- 模板边界：两行仅由 `_` 组成的非空行（忽略首尾空白）。
- 模板内容：从每行的第一个 `[` 起扫描，匹配若干段 `[...] = ...`，支持的 key：
  - `title`
  - `author`（支持 `name(url)` 合并写法，会拆到 `author`/`authorUrl`）
  - `author_url`
  - `time`
  - `add_info`
  - `tag(s)`（按 `,` 分隔）
  - `global_font`（按 `,` 分隔；仅接受 `italic|bold|heavy|slim|serif|mono`）

注意：当前实现**不解析** 其他 key；需要新增时应先扩展 `JianwenMeta`，再改 `applyMetaKey`，并补测试。

### 4.3 location / origin（非枚举元数据）

节点位置信息与 include 来源信息由 `parser/parser/src/core/location.ts` 管理：

- `setNodeLocation(node, { line, column })`：用于 diagnostics 与调试。
- `setNodeOrigin(node, origin)`：用于标记 include 来源（例如文件名）。

这两类信息以 `Symbol` 属性挂载，**不可枚举**，避免污染 JSON 序列化与快照输出。

### 4.4 属性模型（Inline/Block）

- `ColorAttribute`：`{ kind: 'preset' | 'hex', value: string }`
- `InlineAttributes`：支持 `color`、`secondaryColor`、`fontSize`、`fontStyle`
  - `secondaryColor` 是解析阶段的“第二颜色槽”，用于把 `[!color]` 语义映射到具体节点字段：
    - 对 `HighlightNode` 映射到 `fillColorAttr`
    - 对 `LinkNode` 映射到 `underlineColorAttr`
  - `fontSize`：当前解析器接受 `0.5~5` 且步长 `0.5`（渲染层会把数值映射到 `em`）
- `BlockAttributes` 在 `InlineAttributes` 基础上追加：
  - `align`：`left|center|right`
  - `position`：`L|C|R`（与同一行布局相关）
  - `truncateRight`（当前由 `[<-]` / `[<->]` 产出），`truncateLeft` 预留
  - `fold`：用于 foldable section
  - `sameLine`：用于同一行多列布局（`[->]`）

## 5. 解析流程（从源码视角）

整体流程在 `parser/parser/src/core/parser.ts`：

1. `parseInitializationTemplate(source)`：抽取 `meta` 并得到 `body`。
2. `parseBlocks(body, errors)`：块级解析，得到 `BlockNode[]`。
3. `applyInlineParsing(blocks, errors)`：对所有“行内容器”做行内解析。
4. 组装 `JianwenDocument { type:'document', source, meta, children }`。
5. `postProcessDocument`：
   - `expandInclude`：展开 include（可选）
   - `checkFootnotes`：检查脚注引用是否存在对应定义（warning）

## 6. 块级解析（Block Parser）

块级解析位于 `parser/parser/src/core/block-parser.ts`，核心特点是：

- **按行扫描**，空行分隔 block。
- 使用 `lexer/getLineInfo` 识别行首 Tab（最多 2 个）并计算 `tabCount`：
  - `tabCount=0/1/2` 可映射到 `position=L/C/R`（用于布局）
- 引入一个 **pending 状态**（`PendingBlockContext`），把“属性行”作用到**下一块**。

### 6.1 属性行（Attribute-only line）

属性行判定：整行仅由若干 `[...]` 片段与空白组成，且不能是 include 行（避免 `[@]` 被吞为属性行）。

属性解析（`parseAttributeLine`）支持在同一 `[...]` 内用 `,` 分隔多个 token：

- 对齐：`[c]`、`[r]`
- 布局：`[->]`、`[<-]`、`[<->]`
  - `->`/`<->`：把 block 的 `position` 右移一格（L→C→R），并设置 `sameLine=true`
  - `<-`/`<->`：设置 `truncateRight=true`
  - 连续出现超过两次 `->` 会产生 warning（`code: layout-multi-arrow`），多余的 `->` 不再生效
- 折叠：`[fold]`（设置 `pending.foldNext`，让下一块 `blockAttrs.fold=true`）
- 表格区域：`[sheet]`（设置 `pending.isSheet`，驱动后续 `|...|` 行解析为表格）
- HTML 模式：`[html]`（设置 `pending.isHtml`，影响后续代码块 `htmlLike`）
- 批注与禁用：
  - `[comment]`：把下一块包装成 `CommentBlock`
  - `[disable]` / `[d]`：把下一块解析为 `DisabledBlock`（保留 raw，不做行内解析）
- 区块标签：
  - `[tag=name]` / `[t=name]` / `[f=name]`：把下一块包装成 `TaggedBlock`

### 6.2 块类型与优先级（关键点）

当前实现存在两层“块规则”：

- `parser/parser/src/core/block/rules/*`：集中注册的规则（目前有 include/heading/hr）
- `block-parser.ts` 内的其他专用解析分支（列表、引用、代码块、表格、图片、html、脚注区域等）

解析优先级以 `block-parser.ts` 的实际顺序为准；扩展新语法时优先按现有模式把逻辑落到 `core/block/rules/*` 并在 `core/block/rules/index.ts` 注册，避免继续扩大 `block-parser.ts` 的单文件复杂度。

### 6.3 已实现的块语法摘要（与实现一致）

- 标题：`#{1,5} 文本`；可折叠标题：`#{1,5}+ 文本`
  - `#+`（foldable）会在提交 block 后设置 `pending.foldNext=true`，使紧随的下一块默认带 `fold=true`
- 引用：`@ 文本` / `@@ 文本` …（同层级连续行合并；内部递归 `parseBlocks` 并修正嵌套 level）
- 代码块：行首 ` ```lang? ` 开启，直到单独 ` ``` ` 结束
  - 支持 `[...]```lang?` 形式（目前用于 `[html]```）
  - `pending.isHtml` 或 `[html]``` 会让 `CodeBlock.htmlLike=true`
- 分割线：`---` / `***` / `===` / `~~~`（>=3 个同字符），支持前置颜色：`[red]-----`
- 表格：在 `[sheet]` pending 状态下，连续的 `|...|` 行解析为 `TableBlock`
  - 支持“对齐行”作为第一行（Jianwen 语法）或第二行（Markdown 兼容）
  - 单元格可用前缀 `[c]`/`[r]` 覆盖对齐
- 图片：`[img](url)`；`[]` 内必须包含 `img`，并支持 `rounded`/`square`/`rounded=1.2`
  - 紧随其后的内容标题行 `> xxx` 在特定条件下会被吸收为图片 `title`
- HTML 块：`[html](path)` 解析为 `HtmlBlock { source }`
- 脚注区域：`[footnotes]` 开启，直到空行结束；区域内用 `[fn=id]` 定义脚注，脚注内容可递归块级解析
- 列表（同类连续行合并；支持嵌套）：
  - 无序：`- 文本` / `-- 文本`（`-` 数量为 indent）
  - 清单：`-[] 文本` / `-[o]` / `-[x]` / `-[v]`（映射到 `TaskStatus`）
  - 有序：`1. 文本`、`1.1 文本`（层级以 `.` 分段数为 indent；可带任务标记）
  - 可折叠：`+ 文本` / `++ 文本`（`+` 数量为 indent；可带任务标记）
  - 列表项后紧随的代码块会被挂到该列表项的 children 中（见 `block-parser.ts` 的特殊处理）
- 段落 / Raw：
  - 默认聚合连续非空行成为 `ParagraphBlock`
  - 若仅一行且以 `[` 起始，会降级为 `RawBlock`（避免把未知括号结构误解析为段落）

## 7. 行内解析（Inline Parser）

行内解析位于 `parser/parser/src/core/inline-parser.ts` 与 `parser/parser/src/core/inline/rules/*`：

- 基于 `lexer/createCharScanner` 扫描。
- 以“首字符分发”的方式选择 rule（`inline/rules/index.ts`），避免每字符 O(N) 规则尝试。

当前规则集（以实现为准）：

- `\\`：转义（`\\x` → `x`），下一个字符按普通文本输出（`escapeRule`）
- `{...}`：禁用行内解析片段，返回其中内容（不包含 `{}`）（`disabledRule`）
- 行内代码：单反引号包裹（`CodeSpanNode`）
- frame highlight：两个及以上反引号包裹（`HighlightNode{mode:'frame'}`）
- `=...=`：marker highlight（`HighlightNode{mode:'marker'}`）
- `* / _ - ~ ^`：
  - `*...*`：strong
  - `/.../`：em
  - `_..._`：underline
  - `-...-`：strike
  - `~...~`：wave
  - `^...^`：sup
  - `^^...^^`：sub
- `[...]`（`bracketRule`）：
  - `[fn:id]`：脚注引用（`FootnoteRefNode`）
  - `[comment]...[/]`：行内批注（`InlineCommentNode`）
  - `[link]text(url)`：显式链接关键字
  - `[attrs]...[/]`：行内属性容器（`InlineAttrsNode`）
  - `[attrs]` + “紧随的一个行内符号片段”：将属性包裹到该单个节点（例如 `[red]``hi```、`[2]*bold*`）
  - `[attrs]text(url)`：简写链接（把 `attrs.color`→`LinkNode.colorAttr`，`attrs.secondaryColor`→`underlineColorAttr`）

示例（只描述行内标记，不代表完整语法集合）：

~~~text
`code`
``frame``
=marker=
~~~

## 8. Include 展开与脚注检查（Post-process）

### 8.1 Include（`parser/parser/src/core/parser.ts`）

include 在 AST 中是 `IncludeBlock { mode:'file'|'tag', target }`，展开逻辑在 `postProcessDocument`：

- `mode:'tag'`：在当前文档的**顶层 blocks** 中查找 `TaggedBlock`（优先使用预构建 tagIndex），克隆其 `child` 插入（不会自动覆盖 `origin`）
- `mode:'file'`：
  - 需要 `ParseOptions.loadFile` 提供内容
  - 有 maxDepth 与 cycle 检测（基于 target 字符串栈）
  - 有缓存（同一 target 只解析一次）
  - 为了避免递归读取文件，**被 include 的文档在解析时会将 `loadFile` 置为 `undefined`**：
    - 文件 include 在被 include 文档中将产生 warning 并保留 `IncludeBlock`
    - tag include 仍可在被 include 文档内部展开（不依赖 `loadFile`）
  - 克隆插入时会为节点覆盖 `origin=target`（用于后续 diagnostics 标记来源）

如果你希望把某类 include（例如 `.html`）延迟到渲染阶段处理，应在 `loadFile` 中对该类 target 返回 `undefined`，并改用 `RenderHtmlOptions.resolveInclude` 在渲染阶段注入 HTML。

### 8.2 脚注检查

`checkFootnotes` 会收集所有 `FootnoteRefNode` 的首个出现位置，并检查是否存在对应 `FootnoteDefBlock`：

- 缺失定义时产生 warning，错误消息会在 include 场景下附带来源信息（origin）。

## 9. HTML 渲染、主题与 runtime

### 9.1 渲染入口与结构

- `renderDocumentToHtml(doc, options)`：输出 body 级 HTML（默认包裹为 `<article class="jw-root">`）
- `renderJianwenToHtmlDocument(source, options)`：`parse + render + buildHtmlDocument` 一体化
- 典型结构：
  - `.jw-root`：文档根
  - `.jw-block`：默认每个 block 外层 wrapper（可用 `suppressBlockWrapper` 抑制）

渲染层的重要约定：

- `sameLine=true` 的 block 会在 `renderBlocksToHtml` 中被合并进 `.jw-same-line-row`，配合 CSS 形成三列布局。
- `heading.foldable=true` 会生成 `<details class="jw-foldable-section">`，并把紧随其后的连续 `fold=true` blocks 收纳其中。
- `CodeBlock.htmlLike=true` 会输出 `shadowrootmode="open"` 的 `<template>`，以便内嵌 HTML 自带样式隔离（依赖现代浏览器）。

### 9.2 主题 CSS

主题位于 `parser/parser/src/html/theme/*`：

- `base/css.js`：结构与组件样式（布局、代码块、列表、meta 等）
- `light/css.js`：默认变量（无需 `data-jw-theme`）
- `dark/css.js`：暗色变量（`data-jw-theme="dark"` 或 `auto + prefers-color-scheme`）
- `theme.ts` 导出：
  - `DEFAULT_CSS`：base+light+dark 拼接后的内联 CSS
  - `DocumentTheme`：`light|dark|auto`

### 9.3 runtime（可选）

`parser/parser/src/html/theme/runtime.js` 提供非常小的 runtime，只做主题切换：

- `window.JianwenTheme.setTheme(theme)`
- `window.JianwenTheme.toggleTheme()`

是否注入 runtime 由 `buildHtmlDocument`/CLI 参数控制；编译后默认路径为 `dist/src/html/theme/runtime.js`（见 `DEFAULT_RUNTIME_SRC`）。

### 9.4 资源路径与 include 渲染钩子

- `createDefaultAssetPathResolver(sourceFilePath, outputFilePath)`：把相对资源路径改写为相对输出目录的路径（用于图片/HTML 引用）
- `resolveHtmlSource`：把 `HtmlBlock.source` 解析为具体 HTML 片段
- `resolveInclude`：把 `IncludeBlock` 解析为 HTML 片段（如果 parse 阶段未展开）

## 10. CLI/脚本（仓库内调试）

CLI 位于 `parser/parser/src/cli/render.ts`，对应 `parser/parser/package.json`：

- `npm run render -- "<input.jw>" [options]`

当前参数（与 `parseCliArgs` 一致）：

- `-o, --out <file>`：输出 HTML（默认 `out.html`）
- `--theme <light|dark|auto>`：设置根节点 `data-jw-theme`
- `--format`：格式化输出 HTML
- `--no-css`：不内联 CSS
- `--css-href <href>`：改为 `<link rel="stylesheet">`
- `--runtime`：注入 runtime `<script>`
- `--runtime-src <src>`：覆盖 runtime `<script src=...>`
- `--comments`：渲染 comment 节点
- `--no-meta`：不渲染 meta header

调试脚本 `parser/parser/scripts/test-render.ts` 会转调 `runRenderCli` 并自动追加 `--format --comments --runtime`，便于快速查看效果。

## 11. 扩展指南（新增语法/节点）

### 11.1 新增块级语法

1. 在 `parser/parser/src/core/ast.ts` 增加/扩展节点类型。
2. 优先在 `parser/parser/src/core/block/rules/` 新建规则文件，并在 `rules/index.ts` 注册（注意顺序即优先级）。
3. 必要时在 `parser/parser/src/html/render/blocks.ts` 增加渲染分支。
4. 在 `parser/parser/tests/` 增加测试与快照（语法变化必须有测试）。

### 11.2 新增行内语法

1. 扩展 `InlineNode` 与相关节点字段（`core/ast.ts`）。
2. 新增 `parser/parser/src/core/inline/rules/*.ts`，并在 `inline/rules/index.ts` 按首字符注册。
3. 更新 `parser/parser/src/html/render/inlines.ts` 的渲染逻辑（如需）。
4. 补测试与快照。

## 12. 实践约束（避免实现再次漂移）

- AST/诊断/渲染输出的“规范性描述”一律以源码为准：本文档只写“当前实现是什么/为何如此/如何扩展”，不写脱离实现的理想模型。
- 如果你修改了解析语义（尤其是 include、布局、meta），应同步更新本文档对应小节与测试，避免再次出现“文档与实现偏离”的情况。
