const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const reviewer = 'Vaishakh Suresh';
const tick = () => new Promise(resolve => setImmediate(resolve));

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail('UI did not reach expected state');
}

function setup(options = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom;
  const rows = Array.from({ length: 3 }, (_, i) => ({
    submissionId: `gst-${i}`, name: `Applicant ${i}`, email: `test${i}@example.com`,
    organization: 'Test Institute', portfolioLink: 'https://example.com', whySelect: 'Built a project.',
    reviewer, review: null
  }));
  const requests = [];
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.localStorage.setItem('codexhackathon:selectedReviewer', reviewer);
  window.fetch = async (url, init) => {
    if (url === '/api/meta') return Response.json({ mode: 'local' });
    if (url.startsWith('/api/bootstrap')) {
      if (options.failLoad) return Response.json({ error: 'Unavailable' }, { status: 503 });
      return Response.json({ reviewers: [reviewer], selectedReviewer: reviewer, submissions: rows });
    }
    if (url === '/api/reviews') {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (options.save) return options.save(body);
      const row = rows.find(row => row.submissionId === body.submissionId);
      row.review = body.decision ? { decision: body.decision, reviewer } : null;
      return Response.json({ review: row.review });
    }
    throw new Error('Unexpected endpoint');
  };
  window.eval(script);
  const get = id => window.document.getElementById(id);
  return { dom, window, get, requests, options };
}

test('waitlist UI updates counts, filters, reloads, converts and clears', async () => {
  const ui = setup();
  try {
    await until(() => ui.get('applicantName').textContent === 'Applicant 0' && !ui.get('waitlistButton').disabled);
    ui.get('waitlistButton').click();
    await until(() => ui.get('decisionBadge').textContent === 'Waitlisted');
    assert.equal(ui.get('statPending').textContent, '2');
    assert.equal(ui.get('statWaitlisted').textContent, '1');
    ui.window.document.querySelector('[data-filter="waitlisted"]').click();
    assert.equal(ui.get('navigationPosition').textContent, '1 of 1');
    await ui.window.loadReviewer(reviewer);
    assert.equal(ui.get('decisionBadge').textContent, 'Waitlisted');
    ui.get('approveButton').click();
    await until(() => ui.get('statApproved').textContent === '1');
    assert.equal(ui.get('statWaitlisted').textContent, '0');
    assert.equal(ui.get('approveButton').disabled, true);
    ui.window.document.querySelector('[data-filter="approved"]').click();
    ui.get('resetButton').click();
    await until(() => ui.get('statPending').textContent === '3');
    assert.equal(ui.get('statApproved').textContent, '0');
  } finally { ui.dom.window.close(); }
});

test('slow saves block duplicate decisions and navigation', async () => {
  let finish;
  const ui = setup({ save: () => new Promise(resolve => { finish = resolve; }) });
  try {
    await until(() => !ui.get('waitlistButton').disabled);
    ui.get('waitlistButton').click();
    ui.get('approveButton').click();
    ui.get('nextButton').click();
    assert.equal(ui.requests.length, 1);
    assert.equal(ui.get('reviewerSelect').disabled, true);
    assert.equal(ui.get('applicantName').textContent, 'Applicant 0');
    finish(Response.json({ review: { reviewer, decision: 'waitlisted' } }));
    await until(() => !ui.get('waitlistButton').disabled);
    assert.equal(ui.get('decisionBadge').textContent, 'Waitlisted');
  } finally { ui.dom.window.close(); }
});

test('failed saves preserve decision and show an actionable error', async () => {
  const ui = setup({ save: () => { throw new Error('Connection lost. Try again.'); } });
  try {
    await until(() => !ui.get('waitlistButton').disabled);
    ui.get('waitlistButton').click();
    await until(() => ui.get('requestStatus').classList.contains('is-error'));
    assert.equal(ui.get('statPending').textContent, '3');
    assert.equal(ui.get('decisionBadge').textContent, 'Pending');
    assert.equal(ui.get('waitlistButton').disabled, false);
  } finally { ui.dom.window.close(); }
});

test('failed loads provide Retry and recover', async () => {
  const ui = setup({ failLoad: true });
  try {
    await until(() => ui.get('requestStatus').querySelector('button'));
    assert.equal(ui.get('approveButton').disabled, true);
    ui.options.failLoad = false;
    ui.get('requestStatus').querySelector('button').click();
    await until(() => !ui.get('approveButton').disabled);
    assert.equal(ui.get('applicantName').textContent, 'Applicant 0');
  } finally { ui.dom.window.close(); }
});

test('queue search never triggers decision shortcuts and selection closes the drawer', async () => {
  const ui = setup();
  try {
    await until(() => !ui.get('queueButton').disabled);
    ui.get('queueButton').click();
    assert.equal(ui.get('queueDialog').open, true);
    ui.get('queueSearch').value = 'Applicant 2';
    ui.get('queueSearch').dispatchEvent(new ui.window.Event('input', { bubbles: true }));
    ui.get('queueSearch').dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.window.document.querySelectorAll('.submission-row').length, 1);
    ui.window.document.querySelector('.submission-row').click();
    assert.equal(ui.get('queueDialog').open, false);
    assert.equal(ui.get('navigationPosition').textContent, '3 of 3');
    assert.equal(ui.get('nextButton').disabled, true);
    ui.get('previousButton').click();
    assert.equal(ui.get('navigationPosition').textContent, '2 of 3');
  } finally { ui.dom.window.close(); }
});
