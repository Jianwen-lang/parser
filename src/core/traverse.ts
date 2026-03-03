import { BlockNode, InlineNode } from './ast';

export type BlockVisitor = (block: BlockNode) => void;

export function forEachBlock(blocks: BlockNode[], visit: BlockVisitor): void {
  for (const block of blocks) {
    visit(block);

    if (block.type === 'taggedBlock') {
      forEachBlock([block.child], visit);
      continue;
    }

    if (block.type === 'quote') {
      forEachBlock(block.children, visit);
      continue;
    }

    if (block.type === 'list') {
      forEachBlock(block.children, visit);
      continue;
    }

    if (block.type === 'listItem') {
      forEachBlock(block.children, visit);
      continue;
    }

    if (block.type === 'footnotes') {
      forEachBlock(block.children, visit);
      continue;
    }

    if (block.type === 'footnoteDef') {
      forEachBlock(block.children, visit);
      continue;
    }

    if (block.type === 'commentBlock') {
      forEachBlock(block.children, visit);
      continue;
    }
  }
}

export type InlineContainerVisitor = (nodes: InlineNode[], owner: object) => void;

export function forEachInlineContainerInBlocks(
  blocks: BlockNode[],
  visit: InlineContainerVisitor,
): void {
  forEachBlock(blocks, (block) => {
    if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'contentTitle') {
      visit(block.children, block);
      return;
    }

    if (block.type === 'table') {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          visit(cell.children, cell);
        }
      }
    }
  });
}

export type InlineVisitor = (node: InlineNode) => void;

export function walkInlines(nodes: InlineNode[], visit: InlineVisitor): void {
  for (const node of nodes) {
    visit(node);

    if (
      node.type === 'em' ||
      node.type === 'strong' ||
      node.type === 'underline' ||
      node.type === 'strike' ||
      node.type === 'wave' ||
      node.type === 'sup' ||
      node.type === 'sub' ||
      node.type === 'highlight' ||
      node.type === 'link' ||
      node.type === 'commentInline' ||
      node.type === 'inlineAttrs'
    ) {
      walkInlines(node.children, visit);
    }
  }
}
