const BASE_CSS = `
html,
body {
  margin: 0;
  padding: 0;
}
.jw-root {
  background-color: var(--jw-bg-color, transparent);
  color: var(--jw-text-color, inherit);
  display: flow-root;
  min-height: 100vh;
}
.jw-root > .jw-block + .jw-block { margin-top: var(--jw-block-spacing); }
.jw-root > .jw-block { margin: 0; }
.jw-table { border-collapse: collapse; }
.jw-table-cell { border: 1px solid var(--jw-border-color); padding: 0.5em; }
.jw-link { text-decoration: none; color: var(--jw-link-color, currentColor); }
.jw-link:visited { color: var(--jw-link-color, currentColor); }
.jw-link:hover { text-decoration: underline; }
.jw-underline { text-decoration: underline; }
.jw-strike { text-decoration: line-through; }
.jw-wave { text-decoration: underline; text-decoration-style: wavy; }
.jw-heading { font-weight: bold; margin: 0; }
.jw-heading.level-1 { font-size: 2.5em; }
.jw-heading.level-2 { font-size: 2em; }
.jw-heading.level-3 { font-size: 1.75em; }
.jw-heading.level-4 { font-size: 1.5em; }
.jw-heading.level-5 { font-size: 1.25em; }
.jw-foldable-section { margin: 1em 0; }
.jw-foldable-section > summary {
  cursor: pointer;
  user-select: none;
  list-style: none;
  display: flex;
  align-items: center;
}
.jw-foldable-section > summary::-webkit-details-marker {
  display: none;
}
.jw-foldable-section > summary::before {
  content: '';
  display: block;
  width: 0.5em;
  height: 0.5em;
  margin-right: 0.4em;
  flex: 0 0 auto;
  background: currentColor;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  transform: rotate(0deg);
  opacity: 0.74;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.jw-foldable-section[open] > summary::before {
  transform: rotate(90deg);
  opacity: 0.85;
}
.jw-foldable-section > summary .jw-heading {
  display: inline;
  margin: 0;
  min-width: 0;
}

.jw-content-title {
  margin-top: 0.1em;
  margin-bottom: 0;
  font-size: 0.85em;
  color: var(--jw-text-muted);
}
.jw-content-title-gap {
  display: block;
  height: 0.8em;
  min-height: 8px;
}
.jw-quote {
  margin: 0;
  border-left: 4px solid var(--jw-quote-border-color);
  padding: 0 1em;
  background: var(--jw-quote-background);
  color: var(--jw-quote-text);
}
.jw-quote > .jw-paragraph { margin: var(--jw-quote-gap) 0; }
.jw-quote > .jw-quote { margin: var(--jw-quote-gap) 0; }
[data-jw-level="2"].jw-quote { border-left-color: var(--jw-quote-border-color-2); }
[data-jw-level="3"].jw-quote { border-left-color: var(--jw-quote-border-color-3); }
.jw-paragraph { white-space: pre-wrap; line-height: var(--jw-line-height-base); }
.jw-paragraph-block { white-space: normal; }
.jw-list { padding-left: 1.25em; }
.jw-list[data-jw-list-kind="bullet"] { list-style-type: disc; }
.jw-hr { border: none; border-top: 1px solid currentColor; color: var(--jw-border-color); height: 0; background: none; padding: 0; margin: 0; }
.jw-hr[data-jw-position="L"] { width: 100%; }
.jw-hr[data-jw-position="C"] { width: 66.67%; }
.jw-hr[data-jw-position="R"] { width: 33.34%; }
.jw-hr[data-jw-hr-style="dashed"] { border-top-style: dashed; }
.jw-hr[data-jw-hr-style="bold"] { border-top-width: 4px; }
.jw-hr[data-jw-hr-style="wavy"] {
  border: none;
  height: 8px;
  color: var(--jw-border-color);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 8' preserveAspectRatio='none'%3E%3Cpath d='M0 4 Q 8 0 16 4 T 32 4' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-size: 32px 8px;
  background-repeat: repeat-x;
  background-position: center bottom;
  background-color: transparent;
}
.jw-highlight-marker { background-color: var(--jw-highlight-marker); padding: 0; }
.jw-highlight-frame { border: 1px solid var(--jw-border-color); padding: 0; border-radius: 3px; }
.jw-highlight-block {
  display: block;
  padding: 0.75em 1em;
  white-space: normal;
}
.jw-list[data-jw-list-kind="task"] { list-style: none; padding-left: 0; }
.jw-list-item[data-jw-list-kind="task"] { list-style: none; }
.jw-list-item[data-jw-list-kind="task"][data-jw-task-status] {
  position: relative;
  padding-left: 0;
  margin: 0.25em 0;
}
.jw-list-item {
  display: flex;
  flex-flow: row wrap;
  align-items: flex-start;
}
.jw-list-item[data-jw-list-kind="bullet"] {
  display: list-item;
}
.jw-list-ordinal {
  margin-right: 0.5em;
  line-height: var(--jw-line-height-base);
  flex-shrink: 0;
  color: var(--jw-text-strong);
  font-variant-numeric: tabular-nums;
}
.jw-list-task-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25em;
  height: 1.25em;
  border: 1px solid var(--jw-border-color-strong);
  background: var(--jw-surface-task);
  border-radius: 2px;
  font-size: 0.85em;
  color: transparent;
  transition: all 0.2s ease;
  box-sizing: border-box;
  margin-right: 0.5em;
  flex-shrink: 0;
  margin-top: 0.375em;
  position: relative;
  line-height: 1;
}
.jw-list-task-marker::before,
.jw-list-task-marker::after {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  content: '';
}
.jw-list-task-marker[data-jw-task-status="done"] {
  content: '✔';
}
.jw-list-task-marker[data-jw-task-status="done"]::before {
  content: '✔';
  color: var(--jw-task-done-text);
}
.jw-list-task-marker[data-jw-task-status="done"] {
  background: var(--jw-task-done-bg);
  border-color: var(--jw-task-done-bg);
}
.jw-list-task-marker[data-jw-task-status="not_done"]::before,
.jw-list-task-marker[data-jw-task-status="not_done"]::after {
  width: 0.85em;
  height: 0.12em;
  background: var(--jw-task-not-done-cross);
  border-radius: 999px;
}
.jw-list-task-marker[data-jw-task-status="not_done"]::before {
  transform: translate(-50%, -50%) rotate(45deg);
}
.jw-list-task-marker[data-jw-task-status="not_done"]::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}
.jw-list-task-marker[data-jw-task-status="not_done"] {
  background: var(--jw-border-color-strong);
  border-color: var(--jw-border-color-strong);
}
.jw-list-task-marker[data-jw-task-status="in_progress"]::before {
  width: 0.7em;
  height: 0.7em;
  border: 0.12em solid var(--jw-task-in-progress);
  border-radius: 50%;
}
.jw-list-task-marker[data-jw-task-status="unknown"] {
  /* Empty box */
}
.jw-list-item > .jw-paragraph {
  flex: 1 1 auto;
  margin: 0;
  min-width: 0;
  line-height: var(--jw-line-height-base);
}
.jw-list-item > .jw-list {
  flex-basis: 100%;
  width: 100%;
  padding-left: 2em;
  margin: var(--jw-nested-list-gap) 0 0 0;
}
.jw-list-item + .jw-list-item {
  margin-top: var(--jw-nested-list-gap);
}
.jw-list-item > .jw-code-block {
  flex-basis: 100%;
  width: 100%;
  margin-top: var(--jw-nested-list-gap);
}
.jw-list-item[data-jw-task-status="done"] > .jw-paragraph {
  text-decoration: line-through;
  color: var(--jw-text-faint);
}
.jw-list-item[data-jw-list-kind="ordered"] {
  list-style: none;
}
.jw-list-item[data-jw-list-kind="ordered"]::marker {
  content: none;
}

.jw-list-item[data-jw-list-kind="foldable"] { list-style: none; }
.jw-foldable-list-item {
  display: block;
}
.jw-foldable-list-item > summary {
  cursor: pointer;
  user-select: none;
  list-style: none;
  position: relative;
  padding-left: 1.2em;
}
.jw-foldable-list-item > summary::-webkit-details-marker {
  display: none;
}
.jw-foldable-list-item > summary::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 0.45em;
  height: 0.45em;
  background: currentColor;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  transform: translateY(-50%) rotate(0deg);
  opacity: 0.68;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.jw-foldable-list-item[open] > summary::before {
  transform: translateY(-50%) rotate(90deg);
  opacity: 0.85;
}
.jw-foldable-list-item > summary .jw-paragraph {
  display: inline;
}

.jw-image-figure { }
.jw-image { max-width: 100%; max-height: 600px; width: auto; height: auto; object-fit: contain; }
.jw-image-caption { margin-top: 0.5em; font-size: 0.9em; color: var(--jw-text-subtle); }
.jw-image-figure[data-jw-shape="rounded"] .jw-image { border-radius: 8px; }
.jw-code-block {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: var(--jw-surface-code);
  border: 1px solid var(--jw-border-color-subtle);
  border-radius: 4px;
  font-family: "JetBrains Mono", "Fira Code", Consolas, Menlo, monospace;
  font-size: 0.9em;
  line-height: 1.5;
  margin: 0;
}
.jw-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5em 0.75em;
  border-bottom: 1px solid var(--jw-border-color-subtle);
  background: var(--jw-surface-overlay-1);
}
.jw-code-lang {
  padding: 0.1em 0.4em;
  background: var(--jw-surface-overlay-2);
  color: var(--jw-text-subtle);
  font-size: 0.75em;
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.jw-code-copy {
  padding: 0.25em 0.5em;
  background: transparent;
  border: 1px solid var(--jw-border-color);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75em;
  color: var(--jw-text-subtle);
  transition: background 0.2s, border-color 0.2s;
}
.jw-code-copy:hover {
  background: var(--jw-surface-overlay-2);
  border-color: var(--jw-border-color-strong);
}
.jw-code-copy:active {
  background: var(--jw-surface-overlay-3);
}
.jw-code-content {
  display: flex;
  padding: 1em 1em 1em 0;
}
.jw-line-numbers {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 0 0.75em;
  border-right: 1px solid var(--jw-border-color-subtle);
  text-align: right;
  user-select: none;
  color: var(--jw-text-faint);
  font-variant-numeric: tabular-nums;
}
.jw-line-number {
  display: block;
  min-height: 1.5em;
}
.jw-code {
  flex: 1;
  display: block;
  overflow-x: auto;
  padding: 0 1em;
  background: transparent;
  font-family: inherit;
  white-space: pre;
}
.jw-code-line {
  display: block;
  white-space: pre;
  min-height: 1.5em;
}
.jw-disabled-block { font-family: inherit; white-space: pre-wrap; line-height: var(--jw-line-height-base); margin: 0; }
[data-jw-position="C"] { margin-left: 33.33%; }
[data-jw-position="R"] { margin-left: 66.66%; }
[data-jw-truncate-left="true"] { margin-left: 0; }
[data-jw-truncate-right="true"] { max-width: 33.33%; word-wrap: break-word; overflow-wrap: break-word; }
[data-jw-position="C"][data-jw-truncate-right="true"] { max-width: 33.33%; }
[data-jw-position="R"][data-jw-truncate-right="true"] { max-width: 33.33%; }
.jw-hr[data-jw-truncate-right="true"] { width: 33.33%; max-width: none; }
[data-jw-align="center"] { text-align: center; }
[data-jw-align="right"] { text-align: right; }
.jw-same-line-row { display: flex; flex-wrap: nowrap; gap: 0; align-items: flex-start; max-width: 100%; overflow: hidden; }
.jw-same-line-row > * { flex-shrink: 1; word-wrap: break-word; overflow-wrap: break-word; min-width: 0; }
.jw-same-line-row > [data-jw-position="L"]:not(:last-child),
.jw-same-line-row > [data-jw-position="C"]:not(:last-child),
.jw-same-line-row > [data-jw-position="R"]:not(:last-child) { flex-basis: 33.33%; max-width: 33.33%; }
.jw-same-line-row > [data-jw-position="L"]:last-child,
.jw-same-line-row > [data-jw-position="C"]:last-child,
.jw-same-line-row > [data-jw-position="R"]:last-child { flex-grow: 1; flex-basis: 0; }
.jw-same-line-row > [data-jw-position] { margin-left: 0; }
.jw-same-line-row > [data-jw-position="C"]:first-child { margin-left: 33.33%; }
.jw-same-line-row > [data-jw-position="R"]:first-child { margin-left: 66.66%; }
.jw-meta { margin: 0 0 var(--jw-block-spacing); }
.jw-meta-time,
.jw-meta-add-info,
.jw-meta-tags,
.jw-meta-author {
  color: var(--jw-quote-text);
}
.jw-meta-author-link { text-decoration: none; color: inherit; }
.jw-meta-author-link:hover { text-decoration: underline; }
.jw-comment-inline { display: none; }
.jw-comment-block { display: none; }
`;

module.exports = BASE_CSS;
