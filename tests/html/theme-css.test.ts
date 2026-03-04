import {
  composeThemeCss,
  DEFAULT_THEME,
  DEFAULT_THEME_TOKENS_DARK,
  DEFAULT_THEME_TOKENS_LIGHT,
  renderThemeTokenCss,
} from '../../src/html/theme/theme';

describe('html/theme css', () => {
  it('contains expected default token values in light/dark themes', () => {
    expect(DEFAULT_THEME.lightCss).toContain(
      `--jw-bg-color: ${DEFAULT_THEME_TOKENS_LIGHT['--jw-bg-color']}`,
    );
    expect(DEFAULT_THEME.lightCss).toContain(
      `--jw-link-color: ${DEFAULT_THEME_TOKENS_LIGHT['--jw-link-color']}`,
    );
    expect(DEFAULT_THEME.lightCss).toContain('--jw-strong-color:');
    expect(DEFAULT_THEME.lightCss).toContain('--jw-table-header-bg:');
    expect(DEFAULT_THEME.lightCss).toContain('--jw-code-header-bg:');

    expect(DEFAULT_THEME.darkCss).toContain(
      `--jw-bg-color: ${DEFAULT_THEME_TOKENS_DARK['--jw-bg-color']}`,
    );
    expect(DEFAULT_THEME.darkCss).toContain(
      `--jw-link-color: ${DEFAULT_THEME_TOKENS_DARK['--jw-link-color']}`,
    );
    expect(DEFAULT_THEME.darkCss).toContain('--jw-strong-color:');
    expect(DEFAULT_THEME.darkCss).toContain('--jw-table-header-bg:');
    expect(DEFAULT_THEME.darkCss).toContain('--jw-code-header-bg:');
  });

  it('does not apply global html/body reset in base css', () => {
    expect(DEFAULT_THEME.baseCss).not.toContain('html,');
    expect(DEFAULT_THEME.baseCss).toContain('.jw-root');
  });

  it('composes default css when no options are provided', () => {
    const css = composeThemeCss();
    expect(css).toContain(DEFAULT_THEME.baseCss.trim());
    expect(css).toContain(DEFAULT_THEME.lightCss.trim());
    expect(css).toContain(DEFAULT_THEME.darkCss.trim());
  });

  it('supports none preset with and without custom css', () => {
    expect(composeThemeCss({ preset: 'none' })).toBe('');
    expect(composeThemeCss({ preset: 'none', extraCss: '.x{color:red;}' })).toBe('.x{color:red;}');
  });

  it('appends extra css after default css for override priority', () => {
    const extraCss = '.override-marker{color:blue;}';
    const css = composeThemeCss({ preset: 'default', extraCss });
    expect(css.endsWith(extraCss)).toBe(true);
  });

  it('renders theme token css blocks for light/dark and auto dark', () => {
    const css = renderThemeTokenCss({
      light: {
        ...DEFAULT_THEME_TOKENS_LIGHT,
        '--jw-strong-color': '#112233',
      },
      dark: {
        ...DEFAULT_THEME_TOKENS_DARK,
        '--jw-strong-color': '#ddeeff',
      },
      includeAutoDark: true,
    });

    expect(css).toContain(':where(.jw-root) {');
    expect(css).toContain(':where(.jw-root)[data-jw-theme="dark"] {');
    expect(css).toContain(':where(.jw-root)[data-jw-theme="auto"] {');
    expect(css).toContain('--jw-strong-color: #112233;');
    expect(css).toContain('--jw-strong-color: #ddeeff;');
  });

  it('supports theme composition without preset css', () => {
    const css = composeThemeCss({
      preset: 'none',
      theme: {
        light: {
          '--jw-strong-color': '#101010',
        },
        dark: {
          '--jw-strong-color': '#efefef',
        },
      },
      extraCss: '.x{y:z;}',
    });

    expect(css).not.toContain(DEFAULT_THEME.baseCss.trim());
    expect(css).toContain(':where(.jw-root) {');
    expect(css).toContain('--jw-bg-color:');
    expect(css).toContain('--jw-strong-color: #101010;');
    expect(css).toContain('--jw-strong-color: #efefef;');
    expect(css.endsWith('.x{y:z;}')).toBe(true);
  });
});
