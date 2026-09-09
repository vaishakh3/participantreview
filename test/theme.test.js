const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname, '../public', file), 'utf8');
const key = 'codexhackathon:theme';

async function setup({ saved, blocked = false, page = 'index.html' } = {}) {
  const dom = new JSDOM(read(page), { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom;
  if (saved) window.localStorage.setItem(key, saved);
  window.localStorage.setItem('codexhackathon:selectedReviewer', 'Robin Francis');
  if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } });
  window.eval(read('theme.js'));
  await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  return { dom, window, root: window.document.documentElement, button: window.document.querySelector('[data-theme-toggle]') };
}

test('dark is default; toggling persists without modifying reviewer selection', async () => {
  const ui = await setup();
  try {
    assert.equal(ui.root.dataset.theme, 'dark');
    assert.equal(ui.button.getAttribute('aria-label'), 'Switch to light mode');
    ui.button.click();
    assert.equal(ui.root.dataset.theme, 'light');
    assert.equal(ui.window.localStorage.getItem(key), 'light');
    assert.equal(ui.button.title, 'Switch to dark mode');
    assert.equal(ui.window.localStorage.getItem('codexhackathon:selectedReviewer'), 'Robin Francis');
    ui.button.click();
    assert.equal(ui.window.localStorage.getItem(key), 'dark');
  } finally { ui.dom.window.close(); }
});

test('saved theme restores before DOM ready on reviewer and admin pages', async () => {
  for (const page of ['index.html', 'admin.html']) {
    const dom = new JSDOM(read(page), { url: 'http://localhost', runScripts: 'outside-only' });
    try {
      dom.window.localStorage.setItem(key, 'light');
      dom.window.eval(read('theme.js'));
      assert.equal(dom.window.document.documentElement.dataset.theme, 'light');
      assert.ok(read(page).indexOf('/theme.js') < read(page).indexOf('rel="stylesheet"'));
    } finally { dom.window.close(); }
  }
});

test('unavailable storage and invalid preferences fall back to usable dark mode', async () => {
  for (const options of [{ blocked: true }, { saved: 'invalid' }]) {
    const ui = await setup(options);
    try {
      assert.equal(ui.root.dataset.theme, 'dark');
      ui.button.click();
      assert.equal(ui.root.dataset.theme, 'light');
    } finally { ui.dom.window.close(); }
  }
});

test('theme preference syncs across tabs and resets when removed', async () => {
  const ui = await setup({ page: 'admin.html' });
  try {
    for (const value of ['light', null]) {
      ui.window.dispatchEvent(new ui.window.StorageEvent('storage', {
        key, newValue: value, storageArea: ui.window.localStorage
      }));
      assert.equal(ui.root.dataset.theme, value || 'dark');
      assert.equal(ui.button.title, value ? 'Switch to dark mode' : 'Switch to light mode');
    }
  } finally { ui.dom.window.close(); }
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('both palettes maintain AA text and visible control/focus contrast', () => {
  const dom = new JSDOM('<style>' + read('theme.css') + '</style>');
  try {
    const rules = [...dom.window.document.styleSheets[0].cssRules];
    const tokens = {};
    for (const selector of [':root', ':root[data-theme="light"]']) {
      const style = rules.find(rule => rule.selectorText === selector).style;
      for (let i = 0; i < style.length; i++) tokens[style[i]] = style.getPropertyValue(style[i]).trim();
      for (const background of ['--bg', '--panel', '--panel-strong', '--hover', '--selected']) {
        for (const foreground of ['--text', '--muted', '--muted-strong']) {
          assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, selector + foreground + background);
        }
        assert.ok(contrast(tokens['--focus'], tokens[background]) >= 3, selector + ' focus ' + background);
      }
      for (const state of ['danger', 'success', 'warning']) {
        for (const background of ['--bg', '--panel', '--' + state + '-bg']) {
          assert.ok(contrast(tokens['--' + state], tokens[background]) >= 4.5, selector + state + background);
          assert.ok(contrast(tokens['--' + state + '-border'], tokens[background]) >= 3, selector + state + ' border');
        }
      }
      assert.ok(contrast(tokens['--line'], tokens['--panel']) >= 3, selector + ' input border');
    }
  } finally { dom.window.close(); }
});
