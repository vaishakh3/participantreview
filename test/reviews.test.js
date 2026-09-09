const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'review-api-test-'));
process.env.CSV_PATH = path.join(directory, 'applicants.csv');
process.env.REVIEWS_PATH = path.join(directory, 'reviews.json');
process.env.SUPABASE_URL = '';
process.env.NEXT_PUBLIC_SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_SECRET_KEY = '';
fs.writeFileSync(process.env.CSV_PATH, 'guest_id,name,email\n' + Array.from({ length: 8 }, (_, i) => `gst-${i},Applicant ${i},test${i}@example.com`).join('\n'));
const { createServer } = require('../lib/http-app');
after(() => fs.rmSync(directory, { recursive: true, force: true }));

test('waitlist persists, counts correctly, converts and clears without losing other decisions', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const initial = await (await fetch(base + '/api/bootstrap')).json();
    const reviewer = initial.selectedReviewer;
    const submissionId = initial.submissions[0].submissionId;
    const save = (decision, who = reviewer) => fetch(base + '/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer: who, submissionId, decision })
    });
    assert.equal(initial.stats.total, 2);
    const result = await (await save('waitlisted')).json();
    assert.equal(result.review.decision, 'waitlisted');
    assert.deepEqual(result.stats, { total: 2, approved: 0, rejected: 0, waitlisted: 1, pending: 1 });
    const reloaded = await (await fetch(base + '/api/bootstrap')).json();
    assert.equal(reloaded.submissions[0].review.decision, 'waitlisted');
    assert.equal(JSON.parse(fs.readFileSync(process.env.REVIEWS_PATH))[submissionId].decision, 'waitlisted');
    assert.equal((await save('unknown')).status, 400);
    assert.equal((await save(undefined)).status, 400);
    assert.equal((await save('approved', initial.reviewers[1])).status, 404);
    assert.equal((await (await fetch(base + '/api/bootstrap')).json()).stats.waitlisted, 1);
    for (const decision of ['approved', 'rejected']) {
      const updated = await (await save(decision)).json();
      assert.equal(updated.review.decision, decision);
      assert.equal(updated.stats.waitlisted, 0);
      assert.equal(updated.stats[decision], 1);
      assert.equal(updated.stats.pending, 1);
    }
    const cleared = await (await save(null)).json();
    assert.equal(cleared.review, null);
    assert.equal(cleared.stats.pending, 2);
    const icon = await fetch(base + '/icons/arrow-left.svg');
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get('content-type'), 'image/svg+xml');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
