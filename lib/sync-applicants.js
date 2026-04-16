const path = require("path");
const { loadEnv } = require("./env");

loadEnv(path.join(__dirname, ".."));

const {
  CSV_PATH,
  loadApplicantsFromCsv,
  readReviewersConfig
} = require("./local-data");
const {
  supabaseConfigured,
  fetchExistingApplicants,
  upsertReviewers,
  upsertApplicants,
  reviewerSlug
} = require("./supabase");

function assignOnlyNewApplicants(csvApplicants, reviewers, existingApplicants) {
  const reviewerIds = reviewers.map(reviewerSlug);
  const existingById = new Map(existingApplicants.map((item) => [item.id, item]));
  const reviewerCounts = new Map(reviewerIds.map((id) => [id, 0]));

  for (const applicant of existingApplicants) {
    if (reviewerCounts.has(applicant.assigned_reviewer_id)) {
      reviewerCounts.set(
        applicant.assigned_reviewer_id,
        reviewerCounts.get(applicant.assigned_reviewer_id) + 1
      );
    }
  }

  return csvApplicants.map((applicant) => {
    const existing = existingById.get(applicant.submissionId);
    if (existing && existing.assigned_reviewer_id) {
      return {
        ...applicant,
        assignedReviewerId: existing.assigned_reviewer_id
      };
    }

    let chosenReviewerId = reviewerIds[0];
    for (const reviewerId of reviewerIds) {
      if (reviewerCounts.get(reviewerId) < reviewerCounts.get(chosenReviewerId)) {
        chosenReviewerId = reviewerId;
      }
    }

    reviewerCounts.set(chosenReviewerId, reviewerCounts.get(chosenReviewerId) + 1);

    return {
      ...applicant,
      assignedReviewerId: chosenReviewerId
    };
  });
}

async function syncApplicantsFromCurrentCsv() {
  if (!supabaseConfigured()) {
    return {
      mode: "local",
      synced: false,
      message: "Supabase is not configured. CSV replaced locally only."
    };
  }

  const reviewers = readReviewersConfig();
  if (!reviewers.length) {
    throw new Error("No reviewers found in config/reviewers.json");
  }

  await upsertReviewers(reviewers);
  const csvApplicants = loadApplicantsFromCsv();
  const existingApplicants = await fetchExistingApplicants();
  const applicants = assignOnlyNewApplicants(csvApplicants, reviewers, existingApplicants);

  await upsertApplicants(
    applicants.map((applicant) => ({
      id: applicant.submissionId,
      name: applicant.name,
      email: applicant.email || null,
      applicant_type: applicant.applicantType || null,
      organization: applicant.organization || null,
      portfolio_link: applicant.portfolioLink || null,
      why_select: applicant.whySelect || null,
      created_at: applicant.createdAt || null,
      chatgpt_email: applicant.chatgptEmail || null,
      assigned_reviewer_id: applicant.assignedReviewerId || null,
      raw: applicant.raw
    }))
  );

  const existingIds = new Set(existingApplicants.map((item) => item.id));
  const newApplicants = applicants.filter((item) => !existingIds.has(item.submissionId)).length;

  return {
    mode: "supabase",
    synced: true,
    csvPath: CSV_PATH,
    totalApplicants: applicants.length,
    newApplicants,
    preservedApplicants: applicants.length - newApplicants
  };
}

module.exports = {
  assignOnlyNewApplicants,
  syncApplicantsFromCurrentCsv
};
