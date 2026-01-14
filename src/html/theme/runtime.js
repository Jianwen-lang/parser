(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const ROOT_SELECTOR = '.jw-root';
  const THEME_ATTR = 'data-jw-theme';
  const VALID_THEMES = new Set(['light', 'dark', 'auto']);

  function getRoots() {
    return Array.from(document.querySelectorAll(ROOT_SELECTOR));
  }

  function setTheme(theme) {
    if (!VALID_THEMES.has(theme)) {
      return;
    }
    for (const root of getRoots()) {
      root.setAttribute(THEME_ATTR, theme);
    }
  }

  function toggleTheme() {
    for (const root of getRoots()) {
      const current = root.getAttribute(THEME_ATTR);
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute(THEME_ATTR, next);
    }
  }

  window.JianwenTheme = Object.assign(window.JianwenTheme || {}, {
    setTheme,
    toggleTheme,
  });
})();
