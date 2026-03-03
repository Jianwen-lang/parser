interface CodeFenceStartMatchResult {
  language?: string;
}

export interface AttributedCodeFenceResult {
  language?: string;
  isHtml: boolean;
}

export function matchCodeFenceStart(trimmed: string): CodeFenceStartMatchResult | undefined {
  if (!trimmed.startsWith('```')) {
    return undefined;
  }
  const m = trimmed.match(/^```([^\s`]*)\s*$/);
  if (!m) {
    return undefined;
  }
  const group = m[1];
  if (group === undefined || group.length === 0) {
    return { language: undefined };
  }
  return { language: group };
}

export function isCodeFenceEnd(trimmed: string): boolean {
  return /^```\s*$/.test(trimmed);
}

/**
 * Match code fence with optional leading attributes like [html]```
 * Returns the language and whether it's an HTML block
 */
export function matchAttributedCodeFence(trimmed: string): AttributedCodeFenceResult | undefined {
  // Match pattern: optional [attr]... followed by ```language?
  const match = trimmed.match(/^(\[.+\])*\s*```([^\s`]*)\s*$/);
  if (!match) {
    return undefined;
  }
  const attrPart = match[1] || '';
  const language = match[2] || undefined;
  const isHtml = /\[html\]/i.test(attrPart);
  return { language, isHtml };
}
