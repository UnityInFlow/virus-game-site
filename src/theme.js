const STORAGE_KEY = 'virus-game-theme';
const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');
const label = document.getElementById('theme-label');
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
} catch {
  // A private browsing policy may deny storage; system preference still applies.
}

function activeTheme() {
  if (root.dataset.theme === 'light' || root.dataset.theme === 'dark') return root.dataset.theme;
  return darkScheme.matches ? 'dark' : 'light';
}

function updateToggle() {
  const theme = activeTheme();
  toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  label.textContent = theme === 'dark' ? 'dark lab' : 'paper light';
}

toggle.addEventListener('click', () => {
  const next = activeTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage is an enhancement, not a prerequisite for a usable theme control.
  }
  updateToggle();
  window.dispatchEvent(new Event('virus-game-themechange'));
});

const updateForSystemChange = () => {
  if (!root.dataset.theme) {
    updateToggle();
    window.dispatchEvent(new Event('virus-game-themechange'));
  }
};
if (darkScheme.addEventListener) darkScheme.addEventListener('change', updateForSystemChange);
else darkScheme.addListener(updateForSystemChange);

updateToggle();
