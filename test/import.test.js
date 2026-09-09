const assert = require("node:assert/strict");
const { test } = require("node:test");
const { parseApplicantsCsvText } = require("../lib/local-data");
const { assignOnlyNewApplicants } = require("../lib/sync-applicants");
const { reviewerSlug } = require("../lib/supabase");

const reviewers = ["Vaishakh Suresh", "Viswanatha Kartha V", "Joji Panackal", "Robin Francis"];

test("current Luma exports use guest_id as the stable submission ID", () => {
  const [row] = parseApplicantsCsvText("\uFEFFguest_id,name,email\r\ngst-123,Test,test@example.com\r\n");
  assert.equal(row.submissionId, "gst-123");
  assert.equal(row.apiId, "gst-123");
});

test("legacy api_id continues to take precedence", () => {
  const [row] = parseApplicantsCsvText("api_id,guest_id,name,email\nold-123,gst-123,Test,test@example.com");
  assert.equal(row.submissionId, "old-123");
});

test("quoted multiline answers and commas survive CSV parsing", () => {
  const prompt = "Why should we select you for this hackathon? (Share anything that sets you apart - your past work, achievements, ideas you want to build, or what makes you a great fit.)";
  const [row] = parseApplicantsCsvText(`guest_id,name,"${prompt}"\ngst-123,Test,"Built tools, shipped apps.\nA second line with ""quotes""."`);
  assert.equal(row.whySelect, 'Built tools, shipped apps.\nA second line with "quotes".');
});

test("190 new registrations are assigned 48/48/47/47", () => {
  const rows = Array.from({ length: 190 }, (_, i) => ({ submissionId: `gst-${i}` }));
  const assigned = assignOnlyNewApplicants(rows, reviewers, []);
  assert.deepEqual(reviewers.map(name => assigned.filter(row => row.assignedReviewerId === reviewerSlug(name)).length), [48, 48, 47, 47]);
  assert.equal(new Set(assigned.map(row => row.submissionId)).size, 190);
});

test("reimports preserve existing assignments and balance only new records", () => {
  const existing = [{ id: "gst-1", assigned_reviewer_id: reviewerSlug(reviewers[0]) }];
  const assigned = assignOnlyNewApplicants([{ submissionId: "gst-1" }, { submissionId: "gst-2" }], reviewers, existing);
  assert.equal(assigned[0].assignedReviewerId, reviewerSlug(reviewers[0]));
  assert.equal(assigned[1].assignedReviewerId, reviewerSlug(reviewers[1]));
});
