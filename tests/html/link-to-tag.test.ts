import { InlineNode, TaggedBlock } from '../../src/core/ast';
import { renderBlocksToHtml, renderInlinesToHtml } from '../../src/html/render/html';
import { buildTagIdFromName } from '../../src/html/render/utils';

describe('link-to-tag reproduction', () => {
  it('generates an id for tagged blocks', () => {
    const block: TaggedBlock = {
      type: 'taggedBlock',
      name: '线条颜色说明',
      child: {
        type: 'paragraph',
        children: [{ type: 'text', value: 'Content' }],
      },
      blockAttrs: undefined,
    };

    const html = renderBlocksToHtml([block]);
    const expectedId = buildTagIdFromName('线条颜色说明');

    // This expectation is expected to FAIL currently
    expect(html).toContain(`id="${expectedId}"`);
    expect(html).toContain('data-jw-tag="线条颜色说明"');
  });

  it('generates a matching href for links to tags', () => {
    const node: InlineNode = {
      type: 'link',
      href: '线条颜色说明',
      children: [{ type: 'text', value: 'Click me' }],
    };

    const html = renderInlinesToHtml([node]);
    const expectedId = buildTagIdFromName('线条颜色说明');

    expect(html).toContain(`href="#${expectedId}"`);
  });
});
