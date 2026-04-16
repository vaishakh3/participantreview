const fs = require("fs");
const path = require("path");
const { parseCsv } = require("./csv");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CSV_PATH = process.env.CSV_PATH || path.join(DATA_DIR, "applicants.csv");
const REVIEWS_PATH = path.join(DATA_DIR, "reviews.json");
const REVIEWERS_PATH = path.join(ROOT, "config", "reviewers.json");

const CSV_COLUMNS = {
  id: "api_id",
  name: "name",
  email: "email",
  reviewerPrompt:
    "Why should we select you for this hackathon? (Share anything that sets you apart - your past work, achievements, ideas you want to build, or what makes you a great fit.)",
  type: "Are you a Student or Professional?",
  org: "Company/Institute",
  portfolio: "GitHub/Portfolio link",
  createdAt: "created_at",
  chatgptEmail: "Your Chatgpt Email"
};

function ensureJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
  }
}

function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readReviewersConfig() {
  ensureJsonFile(REVIEWERS_PATH, {
    reviewers: [
      "Reviewer 1",
      "Reviewer 2",
      "Reviewer 3",
      "Reviewer 4",
      "Reviewer 5",
      "Reviewer 6"
    ]
  });

  const config = readJson(REVIEWERS_PATH, { reviewers: [] });
  return Array.isArray(config.reviewers)
    ? config.reviewers.filter((name) => typeof name === "string" && name.trim())
    : [];
}

function readLocalReviews() {
  ensureJsonFile(REVIEWS_PATH, {});
  return readJson(REVIEWS_PATH, {});
}

function stableSubmissionId(row, index) {
  return (
    String(row[CSV_COLUMNS.id] || "").trim() ||
    String(row[CSV_COLUMNS.email] || "").trim() ||
    `${String(row[CSV_COLUMNS.name] || "submission").trim()}-${index + 1}`
  );
}

function loadApplicantsFromCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    return [];
  }

  const text = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }

  const [header, ...records] = rows;
  const normalizedHeader = header.map((key) => String(key || "").replace(/^\uFEFF/, ""));

  return records
    .filter((cells) => cells.some((value) => String(value || "").trim()))
    .map((cells, index) => {
      const row = {};
      normalizedHeader.forEach((key, columnIndex) => {
        row[key] = cells[columnIndex] || "";
      });

      return {
        submissionId: stableSubmissionId(row, index),
        apiId: String(row[CSV_COLUMNS.id] || "").trim(),
        name: String(row[CSV_COLUMNS.name] || "").trim() || "Unnamed Applicant",
        email: String(row[CSV_COLUMNS.email] || "").trim(),
        applicantType: String(row[CSV_COLUMNS.type] || "").trim(),
        organization: String(row[CSV_COLUMNS.org] || "").trim(),
        portfolioLink: String(row[CSV_COLUMNS.portfolio] || "").trim(),
        whySelect: String(row[CSV_COLUMNS.reviewerPrompt] || "").trim(),
        createdAt: String(row[CSV_COLUMNS.createdAt] || "").trim(),
        chatgptEmail: String(row[CSV_COLUMNS.chatgptEmail] || "").trim(),
        raw: row
      };
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || "") || 0;
      const rightTime = Date.parse(right.createdAt || "") || 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.submissionId.localeCompare(right.submissionId);
    });
}

function assignApplicantsEvenly(applicants, reviewers) {
  if (!reviewers.length) {
    return applicants.map((applicant) => ({ ...applicant, reviewer: "" }));
  }

  return applicants.map((applicant, index) => ({
    ...applicant,
    reviewer: reviewers[index % reviewers.length]
  }));
}

module.exports = {
  CSV_PATH,
  REVIEWS_PATH,
  REVIEWERS_PATH,
  ensureJsonFile,
  readJson,
  writeJson,
  readReviewersConfig,
  readLocalReviews,
  loadApplicantsFromCsv,
  assignApplicantsEvenly
};
