const PRESET_COLORS = require('../preset/colors');

const DARK_CSS = `
:where(.jw-root)[data-jw-theme="dark"] {
  color-scheme: dark;
  --jw-line-height-base: 1.7;
  --jw-block-spacing: 1em;
  --jw-nested-list-gap: 0.35em;
  --jw-quote-gap: 0.6em;

  --jw-bg-color: #15171c;
  --jw-text-color: #e8e9ed;
  --jw-link-color: #8ab4f8;

  --jw-quote-border-color: #343843;
  --jw-quote-border-color-2: #2c313a;
  --jw-quote-border-color-3: #252a33;
  --jw-quote-background: #1d2028;
  --jw-quote-text: #c9ccd5;

  --jw-border-color: #333844;
  --jw-border-color-subtle: #282d38;
  --jw-border-color-strong: #434958;

  --jw-text-muted: #b3b7c2;
  --jw-text-subtle: #9aa0ad;
  --jw-text-strong: #d7d9e2;
  --jw-text-faint: #7c8494;

  --jw-surface-code: #1c1f26;
  --jw-surface-task: #262b36;
  --jw-surface-overlay-1: rgba(255, 255, 255, 0.03);
  --jw-surface-overlay-2: rgba(255, 255, 255, 0.06);
  --jw-surface-overlay-3: rgba(255, 255, 255, 0.1);

  --jw-highlight-marker: #d2b21f;

  --jw-task-done-bg: #cfd3dd;
  --jw-task-done-text: #1c1f26;
  --jw-task-not-done-cross: #eef1f7;
  --jw-task-in-progress: #b7bdca;

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

@media (prefers-color-scheme: dark) {
  :where(.jw-root)[data-jw-theme="auto"] {
    color-scheme: dark;
    --jw-line-height-base: 1.7;
    --jw-block-spacing: 1em;
    --jw-nested-list-gap: 0.35em;
    --jw-quote-gap: 0.6em;

    --jw-bg-color: #15171c;
    --jw-text-color: #e8e9ed;
    --jw-link-color: #8ab4f8;

    --jw-quote-border-color: #343843;
    --jw-quote-border-color-2: #2c313a;
    --jw-quote-border-color-3: #252a33;
    --jw-quote-background: #1d2028;
    --jw-quote-text: #c9ccd5;

    --jw-border-color: #333844;
    --jw-border-color-subtle: #282d38;
    --jw-border-color-strong: #434958;

    --jw-text-muted: #b3b7c2;
    --jw-text-subtle: #9aa0ad;
    --jw-text-strong: #d7d9e2;
    --jw-text-faint: #7c8494;

    --jw-surface-code: #1c1f26;
    --jw-surface-task: #262b36;
    --jw-surface-overlay-1: rgba(255, 255, 255, 0.03);
    --jw-surface-overlay-2: rgba(255, 255, 255, 0.06);
    --jw-surface-overlay-3: rgba(255, 255, 255, 0.1);

    --jw-highlight-marker: #d2b21f;

    --jw-task-done-bg: #cfd3dd;
    --jw-task-done-text: #1c1f26;
    --jw-task-not-done-cross: #eef1f7;
    --jw-task-in-progress: #b7bdca;

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
}
`;

module.exports = DARK_CSS;
