import {
  buildHtmlDocument,
  renderJianwenToHtmlDocument,
  DEFAULT_RUNTIME_SRC,
} from '../../src/html/convert';
import { DEFAULT_CSS } from '../../src/html/theme/theme';

describe('html/convert', () => {
  it('buildHtmlDocument inlines default CSS and title', () => {
    const html = buildHtmlDocument('<article class="jw-root"></article>');
    expect(html).toContain('<title>Jianwen</title>');
    expect(html).toContain('<style>');
    expect(html).toContain('.jw-root');
  });

  it('buildHtmlDocument can link CSS instead of inlining', () => {
    const html = buildHtmlDocument('<article class="jw-root"></article>', {
      cssHref: '/theme.css',
    });
    expect(html).toContain('<link rel="stylesheet" href="/theme.css">');
    expect(html).not.toContain(DEFAULT_CSS);
  });

  it('buildHtmlDocument can append runtime script', () => {
    const html = buildHtmlDocument('<article class="jw-root"></article>', {
      includeRuntime: true,
    });
    expect(html).toContain(`<script src="${DEFAULT_RUNTIME_SRC}"></script>`);
  });

  it('renderJianwenToHtmlDocument renders body and theme attribute', () => {
    const result = renderJianwenToHtmlDocument('#+ Foldable\\n\\n[fold]\\nX\\n', {
      render: { documentTheme: 'dark' },
      document: { includeCss: false },
    });
    expect(result.errors).toEqual([]);
    expect(result.html).toContain('class="jw-root"');
    expect(result.html).toContain('data-jw-theme="dark"');
  });
});
