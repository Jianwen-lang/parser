import baseCss from './base/css';
import darkCss from './dark/css';
import lightCss from './light/css';
import presetColors from './preset/colors';

export type DocumentTheme = 'light' | 'dark' | 'auto';

export interface ThemeCssBundle {
  baseCss: string;
  lightCss: string;
  darkCss: string;
}

export const DEFAULT_THEME: ThemeCssBundle = {
  baseCss: String(baseCss),
  lightCss: String(lightCss),
  darkCss: String(darkCss),
};

export const DEFAULT_CSS: string = [
  DEFAULT_THEME.baseCss,
  DEFAULT_THEME.lightCss,
  DEFAULT_THEME.darkCss,
].join('\n');
export const PRESET_COLORS: Record<string, string> = presetColors as Record<string, string>;
