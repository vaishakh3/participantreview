const state = {
  reviewers: [],
  selectedReviewer: "",
  filter: "all",
  submissions: [],
  filteredSubmissions: [],
  selectedSubmissionId: ""
};

const REVIEWER_STORAGE_KEY = "codexhackathon:selectedReviewer";

const reviewerSelect = document.getElementById("reviewerSelect");
const reviewerModal = document.getElementById("reviewerModal");
const reviewerModalSelect = document.getElementById("reviewerModalSelect");
const reviewerModalConfirm = document.getElementById("reviewerModalConfirm");
const adminLoginModal = document.getElementById("adminLoginModal");
const adminEntryButton = document.getElementById("adminEntryButton");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");
const adminLoginError = document.getElementById("adminLoginError");
const adminCancelButton = document.getElementById("adminCancelButton");
const submissionList = document.getElementById("submissionList");
const applicantName = document.getElementById("applicantName");
const applicantEmail = document.getElementById("applicantEmail");
const applicantType = document.getElementById("applicantType");
const applicantOrg = document.getElementById("applicantOrg");
const applicantCreatedAt = document.getElementById("applicantCreatedAt");
const applicantPortfolio = document.getElementById("applicantPortfolio");
const applicantChatgptEmail = document.getElementById("applicantChatgptEmail");
const applicantWhy = document.getElementById("applicantWhy");
const decisionBadge = document.getElementById("decisionBadge");
const indexBadge = document.getElementById("indexBadge");
const emptyState = document.getElementById("emptyState");
const detailView = document.getElementById("detailView");
const queueMeta = document.getElementById("queueMeta");
const statTotal = document.getElementById("statTotal");
const statPending = document.getElementById("statPending");
const statApproved = document.getElementById("statApproved");
const statRejected = document.getElementById("statRejected");
const approveButton = document.getElementById("approveButton");
const rejectButton = document.getElementById("rejectButton");
const resetButton = document.getElementById("resetButton");
const modeBadge = document.getElementById("modeBadge");

function getStoredReviewer() {
  try {
    return window.localStorage.getItem(REVIEWER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function storeReviewer(name) {
  try {
    if (name) {
      window.localStorage.setItem(REVIEWER_STORAGE_KEY, name);
    } else {
      window.localStorage.removeItem(REVIEWER_STORAGE_KEY);
    }
  } catch {}
}

function syncReviewerOptions(reviewers, selectedValue) {
  const optionsMarkup = [
    '<option value="">Choose reviewer</option>',
    ...reviewers.map(
      (reviewer) =>
        `<option value="${escapeHtml(reviewer)}" ${reviewer === selectedValue ? "selected" : ""}>${escapeHtml(reviewer)}</option>`
    )
  ].join("");

  reviewerSelect.innerHTML = reviewers
    .map(
      (reviewer) =>
        `<option value="${escapeHtml(reviewer)}" ${reviewer === selectedValue ? "selected" : ""}>${escapeHtml(reviewer)}</option>`
    )
    .join("");
  reviewerModalSelect.innerHTML = optionsMarkup;
  reviewerModalSelect.value = selectedValue || "";
}

function openReviewerModal() {
  reviewerModal.classList.add("is-open");
  document.body.classList.add("has-modal-open");
  reviewerModalSelect.value = state.selectedReviewer || "";
}

function closeReviewerModal() {
  reviewerModal.classList.remove("is-open");
  syncModalBodyState();
}

function openAdminLoginModal() {
  adminLoginModal.classList.add("is-open");
  adminLoginError.classList.add("is-hidden");
  adminLoginForm.reset();
  syncModalBodyState();
  adminUsername.focus();
}

function closeAdminLoginModal() {
  adminLoginModal.classList.remove("is-open");
  syncModalBodyState();
}

function syncModalBodyState() {
  const anyModalOpen =
    reviewerModal.classList.contains("is-open") || adminLoginModal.classList.contains("is-open");
  document.body.classList.toggle("has-modal-open", anyModalOpen);
}

function ensureReviewerSelection() {
  if (!state.selectedReviewer) {
    openReviewerModal();
    return;
  }
  closeReviewerModal();
}

function currentSubmission() {
  return state.filteredSubmissions.find((item) => item.submissionId === state.selectedSubmissionId) || null;
}

function statusOf(submission) {
  return submission.review?.decision || "pending";
}

function prettyDate(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyFilter() {
  state.filteredSubmissions = state.submissions.filter((submission) => {
    const status = statusOf(submission);
    if (state.filter === "all") {
      return true;
    }
    return status === state.filter;
  });

  if (!state.filteredSubmissions.some((item) => item.submissionId === state.selectedSubmissionId)) {
    state.selectedSubmissionId = state.filteredSubmissions[0]?.submissionId || "";
  }
}

function renderStats() {
  const counts = state.submissions.reduce(
    (accumulator, submission) => {
      accumulator.total += 1;
      accumulator[statusOf(submission)] += 1;
      return accumulator;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );

  statTotal.textContent = counts.total;
  statPending.textContent = counts.pending;
  statApproved.textContent = counts.approved;
  statRejected.textContent = counts.rejected;
}

function renderList() {
  queueMeta.textContent = `${state.filteredSubmissions.length} shown`;
  submissionList.innerHTML = "";

  state.filteredSubmissions.forEach((submission) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "submission-row";
    if (submission.submissionId === state.selectedSubmissionId) {
      button.classList.add("is-selected");
    }

    const status = statusOf(submission);
    const secondary = submission.organization || submission.applicantType || "No additional details";
    const createdAt = prettyDate(submission.createdAt);
    const statusLabel = status === "pending" ? "Pending" : status === "approved" ? "Approved" : "Rejected";

    button.innerHTML = `
      <div class="row-topline">
        <span class="row-name">${escapeHtml(submission.name)}</span>
        <span class="status-dot" data-decision="${status}"></span>
      </div>
      <div class="row-org">${escapeHtml(secondary)}</div>
      <div class="row-meta">
        <span>${escapeHtml(createdAt)}</span>
        <span>${escapeHtml(statusLabel)}</span>
      </div>
    `;

    button.addEventListener("click", () => {
      state.selectedSubmissionId = submission.submissionId;
      render();
    });

    submissionList.appendChild(button);
  });
}

function renderDetails() {
  const submission = currentSubmission();

  if (!submission) {
    detailView.classList.add("is-hidden");
    emptyState.classList.remove("is-hidden");
    applicantName.textContent = "No applicant selected";
    return;
  }

  const status = statusOf(submission);
  const selectedIndex = state.filteredSubmissions.findIndex(
    (item) => item.submissionId === submission.submissionId
  );

  detailView.classList.remove("is-hidden");
  emptyState.classList.add("is-hidden");

  applicantName.textContent = submission.name;
  applicantEmail.textContent = submission.email || "-";
  applicantType.textContent = submission.applicantType || "-";
  applicantOrg.textContent = submission.organization || "-";
  applicantCreatedAt.textContent = prettyDate(submission.createdAt);
  applicantChatgptEmail.textContent = submission.chatgptEmail || "-";
  applicantWhy.textContent = submission.whySelect || "No answer submitted.";
  decisionBadge.textContent = status;
  decisionBadge.dataset.decision = status;
  indexBadge.textContent = `${selectedIndex + 1} of ${state.filteredSubmissions.length}`;

  if (submission.portfolioLink) {
    applicantPortfolio.innerHTML = `<a href="${escapeHtml(submission.portfolioLink)}" target="_blank" rel="noreferrer">${escapeHtml(submission.portfolioLink)}</a>`;
  } else {
    applicantPortfolio.textContent = "-";
  }
}

function renderFilterButtons() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === state.filter);
  });
}

function render() {
  applyFilter();
  renderStats();
  renderFilterButtons();
  renderList();
  renderDetails();
}

async function loadReviewer(reviewerName) {
  const requireExplicitSelection = !reviewerName && !getStoredReviewer();
  const metaResponse = await fetch("/api/meta");
  const meta = await metaResponse.json();
  modeBadge.textContent = meta.mode === "supabase" ? "Shared cloud mode" : "Local file mode";

  const response = await fetch(`/api/bootstrap?reviewer=${encodeURIComponent(reviewerName)}`);
  const payload = await response.json();

  state.reviewers = payload.reviewers;
  state.selectedReviewer = requireExplicitSelection ? "" : payload.selectedReviewer;
  state.submissions = requireExplicitSelection ? [] : payload.submissions;
  state.selectedSubmissionId = requireExplicitSelection ? "" : payload.submissions[0]?.submissionId || "";

  syncReviewerOptions(payload.reviewers, state.selectedReviewer);
  if (state.selectedReviewer) {
    storeReviewer(state.selectedReviewer);
  }

  render();
  ensureReviewerSelection();
}

async function updateDecision(decision) {
  const submission = currentSubmission();
  if (!submission) {
    return;
  }

  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      reviewer: state.selectedReviewer,
      submissionId: submission.submissionId,
      decision
    })
  });

  if (!response.ok) {
    const payload = await response.json();
    window.alert(payload.error || "Unable to save review.");
    return;
  }

  const target = state.submissions.find((item) => item.submissionId === submission.submissionId);
  target.review = decision
    ? {
        reviewer: state.selectedReviewer,
        decision
      }
    : null;

  render();
}

reviewerSelect.addEventListener("change", (event) => {
  loadReviewer(event.target.value);
});

reviewerModalConfirm.addEventListener("click", () => {
  if (!reviewerModalSelect.value) {
    reviewerModalSelect.focus();
    return;
  }
  loadReviewer(reviewerModalSelect.value);
});

adminEntryButton.addEventListener("click", () => {
  openAdminLoginModal();
});

adminCancelButton.addEventListener("click", () => {
  closeAdminLoginModal();
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminLoginError.classList.add("is-hidden");

  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: adminUsername.value,
      password: adminPassword.value
    })
  });

  if (!response.ok) {
    adminLoginError.classList.remove("is-hidden");
    adminPassword.select();
    return;
  }

  window.location.href = "/admin.html";
});

reviewerModalSelect.addEventListener("change", (event) => {
  if (event.target.value) {
    reviewerModalConfirm.disabled = false;
  }
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    render();
  });
});

approveButton.addEventListener("click", () => updateDecision("approved"));
rejectButton.addEventListener("click", () => updateDecision("rejected"));
resetButton.addEventListener("click", () => updateDecision(null));

window.addEventListener("keydown", (event) => {
  if (reviewerModal.classList.contains("is-open")) {
    return;
  }

  if (adminLoginModal.classList.contains("is-open")) {
    if (event.key === "Escape") {
      closeAdminLoginModal();
    }
    return;
  }

  if (event.target.tagName === "SELECT") {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (event.key.toLowerCase() === "a") {
    updateDecision("approved");
  }

  if (event.key.toLowerCase() === "r") {
    updateDecision("rejected");
  }

  if (event.key.toLowerCase() === "c") {
    updateDecision(null);
  }
});

const initialReviewer = getStoredReviewer();
loadReviewer(initialReviewer);
