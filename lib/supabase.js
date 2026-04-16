const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function ensureSupabaseConfig() {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function buildUrl(pathname, params) {
  const url = new URL(`/rest/v1/${pathname}`, SUPABASE_URL.endsWith("/") ? SUPABASE_URL : `${SUPABASE_URL}/`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }
  return url;
}

async function supabaseFetch(pathname, { method = "GET", params, body, headers } = {}) {
  ensureSupabaseConfig();

  const response = await fetch(buildUrl(pathname, params), {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${message}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function reviewerSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchReviewers() {
  const rows = await supabaseFetch("reviewers", {
    params: {
      select: "id,name,sort_order",
      order: "sort_order.asc,name.asc"
    }
  });

  return Array.isArray(rows) ? rows : [];
}

async function fetchApplicantsForReviewer(reviewerName) {
  const reviewerId = reviewerSlug(reviewerName);
  const applicantRows = await supabaseFetch("applicants", {
    params: {
      select:
        "id,name,email,applicant_type,organization,portfolio_link,why_select,created_at,chatgpt_email,assigned_reviewer_id,raw",
      assigned_reviewer_id: `eq.${reviewerId}`,
      order: "created_at.asc,id.asc"
    }
  });

  const reviewRows = await supabaseFetch("reviews", {
    params: {
      select: "applicant_id,reviewer_id,decision,updated_at",
      reviewer_id: `eq.${reviewerId}`
    }
  });

  const reviewsByApplicantId = new Map(
    (Array.isArray(reviewRows) ? reviewRows : []).map((row) => [row.applicant_id, row])
  );

  return (Array.isArray(applicantRows) ? applicantRows : []).map((row) => {
    const review = reviewsByApplicantId.get(row.id);
    return {
      ...row,
      reviewer_name: reviewerName,
      review_decision: review?.decision || null,
      review_updated_at: review?.updated_at || null
    };
  });
}

async function fetchExistingApplicants() {
  const rows = await supabaseFetch("applicants", {
    params: {
      select: "id,assigned_reviewer_id,created_at",
      order: "created_at.asc,id.asc"
    }
  });

  return Array.isArray(rows) ? rows : [];
}

async function upsertReviewDecision({ reviewerName, applicantId, decision }) {
  const reviewerId = reviewerSlug(reviewerName);

  const applicantRows = await supabaseFetch("applicants", {
    params: {
      select: "id,assigned_reviewer_id",
      id: `eq.${applicantId}`
    }
  });

  const applicant = Array.isArray(applicantRows) ? applicantRows[0] : null;
  if (!applicant || applicant.assigned_reviewer_id !== reviewerId) {
    return { found: false };
  }

  if (!decision) {
    await supabaseFetch("reviews", {
      method: "DELETE",
      params: {
        applicant_id: `eq.${applicantId}`,
        reviewer_id: `eq.${reviewerId}`
      },
      headers: {
        Prefer: "return=minimal"
      }
    });
    return { found: true };
  }

  await supabaseFetch("reviews", {
    method: "POST",
    body: [
      {
        applicant_id: applicantId,
        reviewer_id: reviewerId,
        decision,
        updated_at: new Date().toISOString()
      }
    ],
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    }
  });

  return { found: true };
}

async function upsertReviewers(reviewers) {
  if (!reviewers.length) {
    return [];
  }

  return supabaseFetch("reviewers", {
    method: "POST",
    body: reviewers.map((name, index) => ({
      id: reviewerSlug(name),
      name,
      sort_order: index + 1
    })),
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    }
  });
}

async function upsertApplicants(applicants) {
  if (!applicants.length) {
    return [];
  }

  return supabaseFetch("applicants", {
    method: "POST",
    body: applicants,
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    }
  });
}

module.exports = {
  supabaseConfigured,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  fetchReviewers,
  fetchApplicantsForReviewer,
  fetchExistingApplicants,
  upsertReviewDecision,
  upsertReviewers,
  upsertApplicants,
  reviewerSlug
};
