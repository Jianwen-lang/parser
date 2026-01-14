export interface JianwenDocument {
  type: 'document';
  /** Original input text, optional, for debugging */
  source?: string;
  /** Document metadata parsed from initialization template (optional) */
  meta?: JianwenMeta;
  /** Top-level block list in document order */
  children: BlockNode[];
}

export interface JianwenMeta {
  /** [title]= */
  title?: string;
  /** [author]= */
  author?: string;
  /** [author_url]= */
  authorUrl?: string;
  /** [time]= */
  time?: string;
  /** [add_info]= */
  addInfo?: string;
  /** [tag(s)]=, parsed as comma-separated tag array */
  tags?: string[];
  /** [global_font]= font style applied to the entire document */
  globalFont?: ('italic' | 'bold' | 'heavy' | 'slim' | 'serif' | 'mono')[];
}

export type ListKind = 'bullet' | 'ordered' | 'task' | 'foldable';

export type TaskStatus = 'unknown' | 'todo' | 'in_progress' | 'not_done' | 'done';

export interface ColorAttribute {
  kind: 'preset' | 'hex';
  /** Preset name like 'red' or Hex '#A14A00' */
  value: string;
}

export interface InlineAttributes {
  color?: ColorAttribute;
  /** [!color] - used for highlight fill color or link underline color */
  secondaryColor?: ColorAttribute;
  /** Font size 1~5, [1]=1em, [2]=1.375em, [3]=1.75em, [4]=2.125em, [5]=2.5em (H1 level) */
  fontSize?: number;
  fontStyle?: ('italic' | 'bold' | 'heavy' | 'slim' | 'serif' | 'mono')[];
}

export interface BlockAttributes extends InlineAttributes {
  /** Block content alignment within its own boundary */
  align?: 'left' | 'right' | 'center';
  /** Block starting column position L/C/R */
  position?: 'L' | 'C' | 'R';
  /** Whether to truncate on the left side of current column */
  truncateLeft?: boolean;
  /** Whether to truncate on the right side of current column */
  truncateRight?: boolean;
  /** Whether the current block is collapsed by [fold] */
  fold?: boolean;
  /** Whether the current block displays on the same line as the block above (triggered by [->]) */
  sameLine?: boolean;
}

export type BlockNode =
  | ParagraphBlock
  | HeadingBlock
  | ContentTitleBlock
  | QuoteBlock
  | ListBlock
  | ListItemBlock
  | CodeBlock
  | TableBlock
  | HorizontalRuleBlock
  | ImageBlock
  | HtmlBlock
  | FootnoteDefBlock
  | FootnotesBlock
  | CommentBlock
  | DisabledBlock
  | IncludeBlock
  | TaggedBlock
  | RawBlock;

export interface ParagraphBlock {
  type: 'paragraph';
  children: InlineNode[];
  blockAttrs?: BlockAttributes;
}

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5;
  /** Whether it's a foldable heading in `#+` form */
  foldable?: boolean;
  children: InlineNode[];
  blockAttrs?: BlockAttributes;
}

export interface ContentTitleBlock {
  type: 'contentTitle';
  children: InlineNode[];
}

export interface QuoteBlock {
  type: 'quote';
  /** @ / @@ / @@@ ... nesting level */
  level: number;
  /** Quote content can contain paragraphs, lists, etc. */
  children: BlockNode[];
  blockAttrs?: BlockAttributes;
}

export interface ListBlock {
  type: 'list';
  kind: ListKind;
  /** Ordered list number style, reserved for extension */
  orderedStyle?: 'decimal';
  children: ListItemBlock[];
  blockAttrs?: BlockAttributes;
}

export interface ListItemBlock {
  type: 'listItem';
  kind: ListKind;
  /** Only valid for ordered/foldable, e.g., "1", "1.1", "1.1.1" */
  ordinal?: string;
  /** Task status: -[] / -[o] / -[x] / -[v] */
  taskStatus?: TaskStatus;
  /** Indent level, based on syntax level (- / -- / + / ++ etc.) */
  indent: number;
  /** List item content can be paragraphs, sublists, etc. */
  children: BlockNode[];
  blockAttrs?: BlockAttributes;
}

export interface CodeBlock {
  type: 'code';
  /** Language identifier in ```C */
  language?: string;
  /** Raw code content */
  value: string;
  /** True when preceded by [html] */
  htmlLike?: boolean;
  blockAttrs?: BlockAttributes;
}

export interface TableBlock {
  type: 'table';
  rows: TableRow[];
  /** Column alignment */
  align?: ('left' | 'right' | 'center')[];
  /** Attributes like alignment in [sheet,r] */
  blockAttrs?: BlockAttributes;
}

export interface TableRow {
  type: 'tableRow';
  cells: TableCell[];
}

export interface TableCell {
  type: 'tableCell';
  children: InlineNode[];
  align?: 'left' | 'right' | 'center';
}

export interface HorizontalRuleBlock {
  type: 'hr';
  /** Corresponds to ----- / ***** / ===== / ~~~~~ */
  style: 'solid' | 'dashed' | 'bold' | 'wavy';
  /** Supports [color] for advanced line styling */
  colorAttr?: ColorAttribute;
  blockAttrs?: BlockAttributes;
}

export interface ImageBlock {
  type: 'image';
  url: string;
  /** Can be represented by content title block */
  title?: string;
  /** [shape] or [rounded,img] */
  shape?: 'square' | 'rounded';
  /** [rounded=num] rounded corner radius, default 1.0 */
  roundedRadius?: number;
  blockAttrs?: BlockAttributes;
}

export interface HtmlBlock {
  type: 'html';
  /** If from [html](url), this is the reference path */
  source?: string;
  /** If from [html] + code block, this is the inline HTML text */
  value?: string;
  blockAttrs?: BlockAttributes;
}

export interface FootnotesBlock {
  type: 'footnotes';
  children: FootnoteDefBlock[];
  blockAttrs?: BlockAttributes;
}

export interface FootnoteDefBlock {
  type: 'footnoteDef';
  /** Corresponds to [fn:id] / [fn=id] */
  id: string;
  /** Footnote content can contain simple blocks */
  children: BlockNode[];
  blockAttrs?: BlockAttributes;
}

export interface CommentBlock {
  type: 'commentBlock';
  /** Comment content */
  children: BlockNode[];
  blockAttrs?: BlockAttributes;
}

export interface DisabledBlock {
  type: 'disabledBlock';
  /** Raw text, no inline parsing */
  raw: string;
  blockAttrs?: BlockAttributes;
}

export interface IncludeBlock {
  type: 'include';
  /**
   * mode: 'file' 对应语法 `[@](path)`，target 为相对路径；
   * mode: 'tag' 对应语法 `[@=name]`，target 为区块标签名称。
   */
  mode: 'file' | 'tag';
  target: string;
  blockAttrs?: BlockAttributes;
}

export interface TaggedBlock {
  type: 'taggedBlock';
  /** Block tag name, e.g., name in [tag=name] / [t=name] / [f=name] */
  name: string;
  /** The tagged block */
  child: BlockNode;
  blockAttrs?: BlockAttributes;
}

export interface RawBlock {
  type: 'raw';
  /** Raw text content, fallback for unsupported or reserved syntax */
  value: string;
  blockAttrs?: BlockAttributes;
}

export type InlineNode =
  | TextNode
  | EmphasisNode
  | StrongNode
  | UnderlineNode
  | StrikeNode
  | WaveNode
  | SuperscriptNode
  | SubscriptNode
  | HighlightNode
  | LinkNode
  | FootnoteRefNode
  | InlineCommentNode
  | InlineAttrsNode
  | CodeSpanNode;

export interface TextNode {
  type: 'text';
  value: string;
}

export interface CodeSpanNode {
  type: 'codeSpan';
  value: string;
}

export interface EmphasisNode {
  type: 'em';
  children: InlineNode[];
}

export interface StrongNode {
  type: 'strong';
  children: InlineNode[];
}

export interface UnderlineNode {
  type: 'underline';
  children: InlineNode[];
}

export interface StrikeNode {
  type: 'strike';
  children: InlineNode[];
}

export interface WaveNode {
  type: 'wave';
  children: InlineNode[];
}

export interface SuperscriptNode {
  type: 'sup';
  children: InlineNode[];
}

export interface SubscriptNode {
  type: 'sub';
  children: InlineNode[];
}

export interface HighlightNode {
  type: 'highlight';
  /**
   * mode: 'frame'  对应语法文档中的单个反引号 `...` 框选效果；
   * mode: 'marker' 对应语法文档中的成对反引号 ``...`` 荧光笔高亮。
   */
  mode: 'frame' | 'marker';
  children: InlineNode[];
  /** [color] */
  colorAttr?: ColorAttribute;
  /** [!color] */
  fillColorAttr?: ColorAttribute;
}

export interface LinkNode {
  type: 'link';
  /** url / heading / block tag */
  href: string;
  /** Text content */
  children: InlineNode[];
  colorAttr?: ColorAttribute;
  /** [!color] */
  underlineColorAttr?: ColorAttribute;
}

export interface FootnoteRefNode {
  type: 'footnoteRef';
  /** [fn:id] */
  id: string;
}

export interface InlineCommentNode {
  type: 'commentInline';
  children: InlineNode[];
}

export interface InlineAttrsNode {
  type: 'inlineAttrs';
  attrs: InlineAttributes;
  children: InlineNode[];
}
