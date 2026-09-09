(() => {
  const key = 'codexhackathon:theme';
  const normalize = value => value === 'light' ? 'light' : 'dark';
  const apply = value => {
    const theme = normalize(value);
    document.documentElement.dataset.theme = theme;
    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  };

  // Run before styles load to avoid flashing the wrong theme on navigation.
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage may be blocked. */ }
  apply(saved);

  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        apply(theme);
        try { localStorage.setItem(key, theme); } catch { /* Still works for this page. */ }
      });
    });
  }, { once: true });

  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === key || event.key === null)) {
      apply(event.newValue);
    }
  });
})();
