import { parseJianwen } from '../../src/core/parser';

describe('Meta Author Syntax', () => {
  it('parses author with link syntax [author]=Name(Link)', () => {
    const source = `________
[author]=UE-DND(https://github.com/UE-DND)
________
Content`;
    const doc = parseJianwen(source);
    expect(doc.meta).toBeDefined();
    expect(doc.meta?.author).toBe('UE-DND');
    expect(doc.meta?.authorUrl).toBe('https://github.com/UE-DND');
  });

  it('parses author without link syntax [author]=Name', () => {
    const source = `________
[author]=Simple Name
________
Content`;
    const doc = parseJianwen(source);
    expect(doc.meta).toBeDefined();
    expect(doc.meta?.author).toBe('Simple Name');
    expect(doc.meta?.authorUrl).toBeUndefined();
  });

  it('parses author with parentheses in name [author]=Name (Alias)(Link)', () => {
    const source = `________
[author]=Name (Alias)(https://example.com)
________
Content`;
    const doc = parseJianwen(source);
    expect(doc.meta).toBeDefined();
    expect(doc.meta?.author).toBe('Name (Alias)');
    expect(doc.meta?.authorUrl).toBe('https://example.com');
  });
});
