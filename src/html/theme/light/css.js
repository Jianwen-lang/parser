const PRESET_COLORS = require('../preset/colors');

const LIGHT_CSS = `
:where(.jw-root) {
  color-scheme: light;
  --jw-line-height-base: 1.7;
  --jw-block-spacing: 1em;
  --jw-nested-list-gap: 0.35em;
  --jw-quote-gap: 0.6em;

  --jw-bg-color: #ffffff;
  --jw-text-color: #222222;
  --jw-link-color: #1d4ed8;

  --jw-quote-border-color: #d0d0d0;
  --jw-quote-border-color-2: #c5c5c5;
  --jw-quote-border-color-3: #b8b8b8;
  --jw-quote-background: #f8f8f8;
  --jw-quote-text: #595959;

  --jw-border-color: #cccccc;
  --jw-border-color-subtle: #dddddd;
  --jw-border-color-strong: #999999;

  --jw-text-muted: #777777;
  --jw-text-subtle: #666666;
  --jw-text-strong: #555555;
  --jw-text-faint: #999999;

  --jw-surface-code: #f5f5f5;
  --jw-surface-task: #eeeeee;
  --jw-surface-overlay-1: rgba(0, 0, 0, 0.02);
  --jw-surface-overlay-2: rgba(0, 0, 0, 0.05);
  --jw-surface-overlay-3: rgba(0, 0, 0, 0.1);

  --jw-highlight-marker: #FFEB3B;

  --jw-task-done-bg: #333333;
  --jw-task-done-text: #ffffff;
  --jw-task-not-done-cross: #ffffff;
  --jw-task-in-progress: #555555;

  --jw-color-red: ${PRESET_COLORS.red};
  --jw-color-orange: ${PRESET_COLORS.orange};
  --jw-color-yellow: ${PRESET_COLORS.yellow};
  --jw-color-green: ${PRESET_COLORS.green};
  --jw-color-cyan: ${PRESET_COLORS.cyan};
  --jw-color-blue: ${PRESET_COLORS.blue};
  --jw-color-purple: ${PRESET_COLORS.purple};
  --jw-color-black: ${PRESET_COLORS.black};
  --jw-color-darkgray: ${PRESET_COLORS.darkgray};
  --jw-color-gray: ${PRESET_COLORS.gray};
}
`;

module.exports = LIGHT_CSS;
