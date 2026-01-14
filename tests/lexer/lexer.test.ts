import { createCharScanner, getLineInfo } from '../../src/lexer/lexer';

describe('lexer utilities - createCharScanner', () => {
  it('tracks position and EOF correctly across newlines', () => {
    const scanner = createCharScanner('ab\nc', 10, 5);
    expect(scanner.line).toBe(10);
    expect(scanner.column).toBe(5);
    expect(scanner.index).toBe(0);
    expect(scanner.length).toBe(4);
    expect(scanner.peek()).toBe('a');
    expect(scanner.index).toBe(0);
    expect(scanner.line).toBe(10);
    expect(scanner.column).toBe(5);
    expect(scanner.next()).toBe('a');
    expect(scanner.index).toBe(1);
    expect(scanner.line).toBe(10);
    expect(scanner.column).toBe(6);
    expect(scanner.next()).toBe('b');
    expect(scanner.index).toBe(2);
    expect(scanner.line).toBe(10);
    expect(scanner.column).toBe(7);
    expect(scanner.next()).toBe('\n');
    expect(scanner.index).toBe(3);
    expect(scanner.line).toBe(11);
    expect(scanner.column).toBe(1);
    expect(scanner.next()).toBe('c');
    expect(scanner.index).toBe(4);
    expect(scanner.line).toBe(11);
    expect(scanner.column).toBe(2);
    expect(scanner.eof()).toBe(true);
    expect(scanner.peek()).toBeUndefined();
    expect(scanner.next()).toBeUndefined();
  });
});

describe('lexer utilities - getLineInfo', () => {
  it('returns raw line, content and tab count with default maxTabsForPosition', () => {
    const noTabs = getLineInfo('no tabs');
    expect(noTabs.raw).toBe('no tabs');
    expect(noTabs.content).toBe('no tabs');
    expect(noTabs.tabCount).toBe(0);

    const oneTab = getLineInfo('\tfoo');
    expect(oneTab.raw).toBe('\tfoo');
    expect(oneTab.content).toBe('foo');
    expect(oneTab.tabCount).toBe(1);

    const twoTabs = getLineInfo('\t\tfoo');
    expect(twoTabs.raw).toBe('\t\tfoo');
    expect(twoTabs.content).toBe('foo');
    expect(twoTabs.tabCount).toBe(2);
    const threeTabs = getLineInfo('\t\t\tfoo');
    expect(threeTabs.raw).toBe('\t\t\tfoo');
    expect(threeTabs.content).toBe('\tfoo');
    expect(threeTabs.tabCount).toBe(2);
  });

  it('honours custom maxTabsForPosition argument', () => {
    const info = getLineInfo('\t\t\tfoo', 3);
    expect(info.raw).toBe('\t\t\tfoo');
    expect(info.content).toBe('foo');
    expect(info.tabCount).toBe(3);
  });
});
