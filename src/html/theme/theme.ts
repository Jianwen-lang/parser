import baseCss from './base/css';
import darkCss from './dark/css';
import lightCss from './light/css';
import presetColors from './preset/colors';

export type DocumentTheme = 'light' | 'dark' | 'auto';
export type ThemeCssPreset = 'default' | 'none';
type PresetColorName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'black'
  | 'darkgray'
  | 'gray';

export const JIANWEN_THEME_TOKEN_KEYS = [
  '--jw-line-height-base',
  '--jw-block-spacing',
  '--jw-nested-list-gap',
  '--jw-quote-gap',
  '--jw-bg-color',
  '--jw-text-color',
  '--jw-link-color',
  '--jw-quote-border-color',
  '--jw-quote-border-color-2',
  '--jw-quote-border-color-3',
  '--jw-quote-background',
  '--jw-quote-text',
  '--jw-border-color',
  '--jw-border-color-subtle',
  '--jw-border-color-strong',
  '--jw-text-muted',
  '--jw-text-subtle',
  '--jw-text-strong',
  '--jw-text-faint',
  '--jw-surface-code',
  '--jw-surface-task',
  '--jw-surface-overlay-1',
  '--jw-surface-overlay-2',
  '--jw-surface-overlay-3',
  '--jw-highlight-marker',
  '--jw-task-done-bg',
  '--jw-task-done-text',
  '--jw-task-not-done-cross',
  '--jw-task-in-progress',
  '--jw-color-red',
  '--jw-color-orange',
  '--jw-color-yellow',
  '--jw-color-green',
  '--jw-color-cyan',
  '--jw-color-blue',
  '--jw-color-purple',
  '--jw-color-black',
  '--jw-color-darkgray',
  '--jw-color-gray',
  '--jw-strong-color',
  '--jw-strong-weight',
  '--jw-underline-color',
  '--jw-underline-thickness',
  '--jw-underline-offset',
  '--jw-wave-color',
  '--jw-strike-color',
  '--jw-table-border-color',
  '--jw-table-header-bg',
  '--jw-table-header-text',
  '--jw-table-row-bg',
  '--jw-table-row-alt-bg',
  '--jw-code-block-bg',
  '--jw-code-border-color',
  '--jw-code-header-bg',
  '--jw-code-header-text',
  '--jw-code-lang-bg',
  '--jw-code-lang-text',
  '--jw-code-copy-border',
  '--jw-code-copy-hover-bg',
  '--jw-code-line-number-color',
] as const;

export type JianwenThemeTokenKey = (typeof JIANWEN_THEME_TOKEN_KEYS)[number];
export type JianwenThemeTokenValues = Record<JianwenThemeTokenKey, string>;
export type JianwenThemeTokenOverrides = Partial<JianwenThemeTokenValues>;

export interface JianwenThemeConfig {
  light?: JianwenThemeTokenOverrides;
  dark?: JianwenThemeTokenOverrides;
  includeAutoDark?: boolean;
}

export interface ThemeCssBundle {
  baseCss: string;
  lightCss: string;
  darkCss: string;
}

export interface ComposeThemeCssOptions {
  preset?: ThemeCssPreset;
  theme?: JianwenThemeConfig;
  extraCss?: string;
}

export const DEFAULT_THEME: ThemeCssBundle = {
  baseCss: String(baseCss),
  lightCss: String(lightCss),
  darkCss: String(darkCss),
};

export const PRESET_COLORS: Record<PresetColorName, string> & Record<string, string> =
  presetColors as Record<PresetColorName, string> & Record<string, string>;

export const DEFAULT_THEME_TOKENS_LIGHT: JianwenThemeTokenValues = {
  '--jw-line-height-base': '1.7',
  '--jw-block-spacing': '1em',
  '--jw-nested-list-gap': '0.35em',
  '--jw-quote-gap': '0.6em',
  '--jw-bg-color': '#ffffff',
  '--jw-text-color': '#222222',
  '--jw-link-color': '#1d4ed8',
  '--jw-quote-border-color': '#d0d0d0',
  '--jw-quote-border-color-2': '#c5c5c5',
  '--jw-quote-border-color-3': '#b8b8b8',
  '--jw-quote-background': '#f8f8f8',
  '--jw-quote-text': '#595959',
  '--jw-border-color': '#cccccc',
  '--jw-border-color-subtle': '#dddddd',
  '--jw-border-color-strong': '#999999',
  '--jw-text-muted': '#777777',
  '--jw-text-subtle': '#666666',
  '--jw-text-strong': '#555555',
  '--jw-text-faint': '#999999',
  '--jw-surface-code': '#f5f5f5',
  '--jw-surface-task': '#eeeeee',
  '--jw-surface-overlay-1': 'rgba(0, 0, 0, 0.02)',
  '--jw-surface-overlay-2': 'rgba(0, 0, 0, 0.05)',
  '--jw-surface-overlay-3': 'rgba(0, 0, 0, 0.1)',
  '--jw-highlight-marker': '#FFEB3B',
  '--jw-task-done-bg': '#333333',
  '--jw-task-done-text': '#ffffff',
  '--jw-task-not-done-cross': '#ffffff',
  '--jw-task-in-progress': '#555555',
  '--jw-color-red': PRESET_COLORS.red,
  '--jw-color-orange': PRESET_COLORS.orange,
  '--jw-color-yellow': PRESET_COLORS.yellow,
  '--jw-color-green': PRESET_COLORS.green,
  '--jw-color-cyan': PRESET_COLORS.cyan,
  '--jw-color-blue': PRESET_COLORS.blue,
  '--jw-color-purple': PRESET_COLORS.purple,
  '--jw-color-black': PRESET_COLORS.black,
  '--jw-color-darkgray': PRESET_COLORS.darkgray,
  '--jw-color-gray': PRESET_COLORS.gray,
  '--jw-strong-color': '#2b2f39',
  '--jw-strong-weight': '700',
  '--jw-underline-color': '#1d4ed8',
  '--jw-underline-thickness': '0.08em',
  '--jw-underline-offset': '0.12em',
  '--jw-wave-color': '#1d4ed8',
  '--jw-strike-color': '#767676',
  '--jw-table-border-color': '#d1d5db',
  '--jw-table-header-bg': '#f0f3f6',
  '--jw-table-header-text': '#3f4654',
  '--jw-table-row-bg': '#ffffff',
  '--jw-table-row-alt-bg': '#f9fafb',
  '--jw-code-block-bg': '#f5f5f5',
  '--jw-code-border-color': '#dddddd',
  '--jw-code-header-bg': 'rgba(0, 0, 0, 0.04)',
  '--jw-code-header-text': '#5f6672',
  '--jw-code-lang-bg': 'rgba(0, 0, 0, 0.06)',
  '--jw-code-lang-text': '#4b5563',
  '--jw-code-copy-border': '#c9ced6',
  '--jw-code-copy-hover-bg': 'rgba(0, 0, 0, 0.08)',
  '--jw-code-line-number-color': '#9aa0ad',
};

export const DEFAULT_THEME_TOKENS_DARK: JianwenThemeTokenValues = {
  '--jw-line-height-base': '1.7',
  '--jw-block-spacing': '1em',
  '--jw-nested-list-gap': '0.35em',
  '--jw-quote-gap': '0.6em',
  '--jw-bg-color': '#15171c',
  '--jw-text-color': '#e8e9ed',
  '--jw-link-color': '#8ab4f8',
  '--jw-quote-border-color': '#343843',
  '--jw-quote-border-color-2': '#2c313a',
  '--jw-quote-border-color-3': '#252a33',
  '--jw-quote-background': '#1d2028',
  '--jw-quote-text': '#c9ccd5',
  '--jw-border-color': '#333844',
  '--jw-border-color-subtle': '#282d38',
  '--jw-border-color-strong': '#434958',
  '--jw-text-muted': '#b3b7c2',
  '--jw-text-subtle': '#9aa0ad',
  '--jw-text-strong': '#d7d9e2',
  '--jw-text-faint': '#7c8494',
  '--jw-surface-code': '#1c1f26',
  '--jw-surface-task': '#262b36',
  '--jw-surface-overlay-1': 'rgba(255, 255, 255, 0.03)',
  '--jw-surface-overlay-2': 'rgba(255, 255, 255, 0.06)',
  '--jw-surface-overlay-3': 'rgba(255, 255, 255, 0.1)',
  '--jw-highlight-marker': '#d2b21f',
  '--jw-task-done-bg': '#cfd3dd',
  '--jw-task-done-text': '#1c1f26',
  '--jw-task-not-done-cross': '#eef1f7',
  '--jw-task-in-progress': '#b7bdca',
  '--jw-color-red': PRESET_COLORS.red,
  '--jw-color-orange': PRESET_COLORS.orange,
  '--jw-color-yellow': PRESET_COLORS.yellow,
  '--jw-color-green': PRESET_COLORS.green,
  '--jw-color-cyan': PRESET_COLORS.cyan,
  '--jw-color-blue': PRESET_COLORS.blue,
  '--jw-color-purple': PRESET_COLORS.purple,
  '--jw-color-black': PRESET_COLORS.black,
  '--jw-color-darkgray': PRESET_COLORS.darkgray,
  '--jw-color-gray': PRESET_COLORS.gray,
  '--jw-strong-color': '#f3f5f8',
  '--jw-strong-weight': '700',
  '--jw-underline-color': '#8ab4f8',
  '--jw-underline-thickness': '0.08em',
  '--jw-underline-offset': '0.12em',
  '--jw-wave-color': '#8ab4f8',
  '--jw-strike-color': '#98a2b3',
  '--jw-table-border-color': '#374151',
  '--jw-table-header-bg': '#1f2937',
  '--jw-table-header-text': '#d1d5db',
  '--jw-table-row-bg': '#141922',
  '--jw-table-row-alt-bg': '#171d28',
  '--jw-code-block-bg': '#1c1f26',
  '--jw-code-border-color': '#313846',
  '--jw-code-header-bg': 'rgba(255, 255, 255, 0.05)',
  '--jw-code-header-text': '#b8c2d3',
  '--jw-code-lang-bg': 'rgba(255, 255, 255, 0.08)',
  '--jw-code-lang-text': '#d1d8e3',
  '--jw-code-copy-border': '#4b5563',
  '--jw-code-copy-hover-bg': 'rgba(255, 255, 255, 0.12)',
  '--jw-code-line-number-color': '#8b95a7',
};

export const DEFAULT_THEME_CONFIG: JianwenThemeConfig = {
  light: DEFAULT_THEME_TOKENS_LIGHT,
  dark: DEFAULT_THEME_TOKENS_DARK,
  includeAutoDark: true,
};

export const DEFAULT_CSS: string = [
  DEFAULT_THEME.baseCss,
  DEFAULT_THEME.lightCss,
  DEFAULT_THEME.darkCss,
].join('\n');

function renderTokenDeclarations(tokens: JianwenThemeTokenValues): string {
  return JIANWEN_THEME_TOKEN_KEYS.map((key) => `  ${key}: ${tokens[key]};`).join('\n');
}

function renderTokenBlock(selector: string, tokens: JianwenThemeTokenValues): string {
  return `${selector} {\n${renderTokenDeclarations(tokens)}\n}`;
}

function resolveThemeConfig(theme: JianwenThemeConfig): {
  light: JianwenThemeTokenValues;
  dark: JianwenThemeTokenValues;
  includeAutoDark: boolean;
} {
  return {
    light: {
      ...DEFAULT_THEME_TOKENS_LIGHT,
      ...(theme.light ?? {}),
    },
    dark: {
      ...DEFAULT_THEME_TOKENS_DARK,
      ...(theme.dark ?? {}),
    },
    includeAutoDark: theme.includeAutoDark ?? true,
  };
}

export function renderThemeTokenCss(theme: JianwenThemeConfig): string {
  const resolved = resolveThemeConfig(theme);
  const parts = [
    renderTokenBlock(':where(.jw-root)', resolved.light),
    renderTokenBlock(':where(.jw-root)[data-jw-theme="dark"]', resolved.dark),
  ];

  if (resolved.includeAutoDark) {
    parts.push(`@media (prefers-color-scheme: dark) {
  ${renderTokenBlock(':where(.jw-root)[data-jw-theme="auto"]', resolved.dark)}
}`);
  }

  return parts.join('\n');
}

export function composeThemeCss(options: ComposeThemeCssOptions = {}): string {
  const preset = options.preset ?? 'default';
  const extraCss = options.extraCss?.trim() ?? '';
  const parts: string[] = [];

  if (preset === 'default') {
    parts.push(DEFAULT_CSS);
  }

  if (options.theme) {
    parts.push(renderThemeTokenCss(options.theme));
  }

  if (extraCss) {
    parts.push(extraCss);
  }

  return parts.join('\n');
}
