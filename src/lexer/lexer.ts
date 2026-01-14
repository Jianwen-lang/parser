export interface CharScanner {
  text: string;
  index: number;
  length: number;
  line: number;
  column: number;
  peek(): string | undefined;
  next(): string | undefined;
  eof(): boolean;
}

export function createCharScanner(text: string, baseLine = 1, baseColumn = 1): CharScanner {
  return {
    text,
    index: 0,
    length: text.length,
    line: baseLine,
    column: baseColumn,
    peek(): string | undefined {
      if (this.index >= this.length) {
        return undefined;
      }
      return this.text[this.index];
    },
    next(): string | undefined {
      if (this.index >= this.length) {
        return undefined;
      }
      const ch = this.text[this.index];
      this.index += 1;
      if (ch === '\n') {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
      return ch;
    },
    eof(): boolean {
      return this.index >= this.length;
    },
  };
}

export interface LineInfo {
  raw: string;
  content: string;
  tabCount: number;
}

export function getLineInfo(raw: string, maxTabsForPosition = 2): LineInfo {
  let index = 0;
  let tabCount = 0;
  while (index < raw.length && raw[index] === '\t' && tabCount < maxTabsForPosition) {
    tabCount += 1;
    index += 1;
  }
  const content = raw.slice(index);
  return { raw, content, tabCount };
}
