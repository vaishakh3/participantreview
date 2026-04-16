const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./lib/env");

loadEnv(__dirname);

const {
  supabaseConfigured,
  fetchReviewers,
  fetchApplicantsForReviewer,
  upsertReviewDecision
} = require("./lib/supabase");
const { syncApplicantsFromCurrentCsv } = require("./lib/sync-applicants");
const {
  CSV_PATH,
  REVIEWS_PATH,
  REVIEWERS_PATH,
  readJson,
  writeJson,
  readReviewersConfig,
  readLocalReviews,
  loadApplicantsFromCsv,
  assignApplicantsEvenly
} = require("./lib/local-data");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");

function reviewerStats(applicants, reviewerName) {
  const assigned = applicants.filter((item) => item.reviewer === reviewerName);
  const approved = assigned.filter((item) => item.review?.decision === "approved").length;
  const rejected = assigned.filter((item) => item.review?.decision === "rejected").length;
  return {
    total: assigned.length,
    approved,
    rejected,
    pending: assigned.length - approved - rejected
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png"
  };

  try {
    const body = fs.readFileSync(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    response.end(body);
  } catch (error) {
    sendJson(response, 404, { error: "Not found" });
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

function parseMultipartCsvUpload(body, contentType) {
  const match = /boundary=(?:"?([^";]+)"?)/i.exec(contentType || "");
  if (!match) {
    throw new Error("Missing multipart boundary");
  }

  const boundary = `--${match[1]}`;
  const bodyString = body.toString("binary");
  const parts = bodyString.split(boundary);

  for (const part of parts) {
    if (!part.includes('name="csv"')) {
      continue;
    }

    const separator = "\r\n\r\n";
    const headerEnd = part.indexOf(separator);
    if (headerEnd === -1) {
      continue;
    }

    let fileContent = part.slice(headerEnd + separator.length);
    fileContent = fileContent.replace(/\r\n--$/, "").replace(/\r\n$/, "");
    return Buffer.from(fileContent, "binary").toString("utf8");
  }

  throw new Error("No csv file field found");
}

function sanitizeDecision(value) {
  return value === "approved" || value === "rejected" ? value : null;
}

function getEnvSummary() {
  return {
    mode: supabaseConfigured() ? "supabase" : "local",
    csvPath: CSV_PATH,
    adminPath: "/admin.html"
  };
}

function normalizeSupabaseSubmission(record) {
  return {
    submissionId: record.id,
    apiId: record.id,
    name: record.name || "Unnamed Applicant",
    email: record.email || "",
    applicantType: record.applicant_type || "",
    organization: record.organization || "",
    portfolioLink: record.portfolio_link || "",
    whySelect: record.why_select || "",
    createdAt: record.created_at || "",
    chatgptEmail: record.chatgpt_email || "",
    reviewer: record.reviewer_name || "",
    raw: record.raw || {},
    review: record.review_decision
      ? {
          reviewer: record.reviewer_name || "",
          decision: record.review_decision,
          updatedAt: record.review_updated_at || null
        }
      : null
  };
}

async function buildSupabaseBootstrapState(reviewer) {
  const reviewers = await fetchReviewers();
  const selectedReviewer = reviewer || reviewers[0]?.name || "";
  const records = await fetchApplicantsForReviewer(selectedReviewer);
  const submissions = records.map(normalizeSupabaseSubmission);

  return {
    reviewers: reviewers.map((item) => item.name),
    selectedReviewer,
    stats: selectedReviewer ? reviewerStats(submissions, selectedReviewer) : null,
    submissions
  };
}

function buildLocalBootstrapState(reviewer) {
  const reviewers = readReviewersConfig();
  const reviews = readLocalReviews();
  const applicants = assignApplicantsEvenly(loadApplicantsFromCsv(), reviewers).map((submission) => ({
    ...submission,
    review: reviews[submission.submissionId] || null
  }));
  const selectedReviewer = reviewer || reviewers[0] || "";
  const submissions = applicants.filter((item) =>
    selectedReviewer ? item.reviewer === selectedReviewer : true
  );

  return {
    reviewers,
    selectedReviewer,
    stats: selectedReviewer ? reviewerStats(applicants, selectedReviewer) : null,
    submissions
  };
}

async function buildBootstrapState(reviewer) {
  if (supabaseConfigured()) {
    return buildSupabaseBootstrapState(reviewer);
  }
  return buildLocalBootstrapState(reviewer);
}

async function saveReviewDecision({ reviewer, submissionId, decision }) {
  if (supabaseConfigured()) {
    return upsertReviewDecision({ reviewerName: reviewer, applicantId: submissionId, decision });
  }

  const state = buildLocalBootstrapState(reviewer);
  const submission = state.submissions.find(
    (item) => item.submissionId === submissionId && item.reviewer === reviewer
  );

  if (!submission) {
    return { found: false };
  }

  const reviews = readLocalReviews();
  if (decision) {
    reviews[submissionId] = {
      reviewer,
      decision,
      updatedAt: new Date().toISOString()
    };
  } else {
    delete reviews[submissionId];
  }
  writeJson(REVIEWS_PATH, reviews);
  return { found: true };
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const reviewer = url.searchParams.get("reviewer") || "";
    const state = await buildBootstrapState(reviewer);
    return sendJson(response, 200, state);
  }

  if (request.method === "GET" && url.pathname === "/api/meta") {
    return sendJson(response, 200, getEnvSummary());
  }

  if (request.method === "POST" && url.pathname === "/api/reviews") {
    const body = await readRequestBody(request);
    const parsed = JSON.parse(body || "{}");
    const submissionId = String(parsed.submissionId || "").trim();
    const reviewer = String(parsed.reviewer || "").trim();
    const decision = sanitizeDecision(parsed.decision);

    if (!submissionId || !reviewer) {
      return sendJson(response, 400, { error: "Missing reviewer or submissionId" });
    }

    const saved = await saveReviewDecision({ reviewer, submissionId, decision });
    if (!saved.found) {
      return sendJson(response, 404, { error: "Submission not found for reviewer" });
    }

    const nextState = await buildBootstrapState(reviewer);
    return sendJson(response, 200, {
      ok: true,
      stats: nextState.stats,
      review: nextState.submissions.find((item) => item.submissionId === submissionId)?.review || null
    });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/upload-csv") {
    const contentType = request.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return sendJson(response, 400, { error: "Expected multipart form upload" });
    }

    const body = await readRequestBody(request);
    const csvText = parseMultipartCsvUpload(Buffer.from(body, "utf8"), contentType);
    if (!csvText.trim()) {
      return sendJson(response, 400, { error: "Uploaded CSV was empty" });
    }

    fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
    fs.writeFileSync(CSV_PATH, csvText, "utf8");

    const syncResult = await syncApplicantsFromCurrentCsv();
    return sendJson(response, 200, {
      ok: true,
      csvPath: CSV_PATH,
      syncResult
    });
  }

  return sendJson(response, 404, { error: "Unknown API route" });
}

function createServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      Promise.resolve(handleApi(request, response, url)).catch((error) => {
        console.error(error);
        if (!response.headersSent) {
          sendJson(response, 500, { error: error.message || "Unexpected server error" });
        }
      });
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(PUBLIC_DIR, requestedPath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      return sendJson(response, 403, { error: "Forbidden" });
    }

    return sendFile(response, filePath);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Review dashboard running at http://${HOST}:${PORT}`);
    console.log(`Mode: ${supabaseConfigured() ? "supabase" : "local"}`);
    console.log(`CSV path: ${CSV_PATH}`);
  });
}

module.exports = {
  createServer,
  buildBootstrapState,
  CSV_PATH,
  REVIEWS_PATH,
  REVIEWERS_PATH,
  loadApplicantsFromCsv,
  assignApplicantsEvenly,
  readReviewersConfig
};
