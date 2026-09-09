const state = {
  reviewers: [],
  selectedReviewer: "",
  filter: "all",
  submissions: [],
  filteredSubmissions: [],
  selectedSubmissionId: "",
  loading: false,
  saving: false,
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
const waitlistButton = document.getElementById("waitlistButton");
const statWaitlisted = document.getElementById("statWaitlisted");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const navigationPosition = document.getElementById("navigationPosition");
const queueButton = document.getElementById("queueButton");
const queueButtonLabel = document.getElementById("queueButtonLabel");
const queueDialog = document.getElementById("queueDialog");
const queuePanel = document.getElementById("queuePanel");
const queueHome = queuePanel.parentElement;
const queueSearch = document.getElementById("queueSearch");
const queueEmpty = document.getElementById("queueEmpty");
const requestStatus = document.getElementById("requestStatus");
const mobileLayout = window.matchMedia("(max-width: 900px)");
const decisionLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
};

function setRequestStatus(message, error = false) {
  requestStatus.textContent = message;
  requestStatus.classList.toggle("is-error", error);
}

function scrollToApplicant() {
  if (mobileLayout.matches) {
    document.querySelector(".workspace").scrollIntoView({ block: "start" });
  }
}

function selectApplicant(id) {
  if (state.saving || state.loading) return;
  state.selectedSubmissionId = id;
  if (queueDialog.open) queueDialog.close();
  setRequestStatus("");
  render();
  scrollToApplicant();
}

function navigateApplicant(offset) {
  const index = state.filteredSubmissions.findIndex(
    (row) => row.submissionId === state.selectedSubmissionId,
  );
  const next = state.filteredSubmissions[index + offset];
  if (next) selectApplicant(next.submissionId);
}

function renderControls() {
  const busy = state.loading || state.saving;
  const submission = currentSubmission();
  [resetButton, rejectButton, waitlistButton, approveButton].forEach(
    (button) => {
      button.disabled = busy || !submission;
    },
  );
  resetButton.disabled ||= !submission?.review;
  [
    [rejectButton, "rejected"],
    [waitlistButton, "waitlisted"],
    [approveButton, "approved"],
  ].forEach(([button, decision]) => {
    button.setAttribute(
      "aria-pressed",
      String(submission?.review?.decision === decision),
    );
  });
  reviewerSelect.disabled = busy;
  reviewerModalConfirm.disabled = busy;
  queueSearch.disabled = busy;
  queueButton.disabled = busy || !state.selectedReviewer;
  document
    .querySelectorAll(".filter-button, .submission-row")
    .forEach((button) => {
      button.disabled = busy;
    });
  const index = state.filteredSubmissions.findIndex(
    (row) => row.submissionId === state.selectedSubmissionId,
  );
  previousButton.disabled = busy || index <= 0;
  nextButton.disabled =
    busy || index < 0 || index >= state.filteredSubmissions.length - 1;
  navigationPosition.textContent = `${index + 1} of ${state.filteredSubmissions.length}`;
  queueButtonLabel.textContent = `Queue (${state.filteredSubmissions.length})`;
}

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
        `<option value="${escapeHtml(reviewer)}" ${reviewer === selectedValue ? "selected" : ""}>${escapeHtml(reviewer)}</option>`,
    ),
  ].join("");

  reviewerSelect.innerHTML = reviewers
    .map(
      (reviewer) =>
        `<option value="${escapeHtml(reviewer)}" ${reviewer === selectedValue ? "selected" : ""}>${escapeHtml(reviewer)}</option>`,
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
    reviewerModal.classList.contains("is-open") ||
    adminLoginModal.classList.contains("is-open") ||
    queueDialog.open;
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
  return (
    state.filteredSubmissions.find(
      (item) => item.submissionId === state.selectedSubmissionId,
    ) || null
  );
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
    timeStyle: "short",
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

  if (
    !state.filteredSubmissions.some(
      (item) => item.submissionId === state.selectedSubmissionId,
    )
  ) {
    state.selectedSubmissionId =
      state.filteredSubmissions[0]?.submissionId || "";
  }
}

function renderStats() {
  const counts = state.submissions.reduce(
    (accumulator, submission) => {
      accumulator.total += 1;
      accumulator[statusOf(submission)] += 1;
      return accumulator;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0, waitlisted: 0 },
  );

  statTotal.textContent = counts.total;
  statPending.textContent = counts.pending;
  statApproved.textContent = counts.approved;
  statRejected.textContent = counts.rejected;
  statWaitlisted.textContent = counts.waitlisted;
}

function renderList() {
  const search = queueSearch.value.trim().toLowerCase();
  const visible = state.filteredSubmissions.filter((row) =>
    `${row.name} ${row.organization} ${row.email}`
      .toLowerCase()
      .includes(search),
  );
  queueMeta.textContent = `${visible.length} of ${state.filteredSubmissions.length}`;
  queueEmpty.classList.toggle("is-hidden", visible.length > 0);
  submissionList.innerHTML = "";

  visible.forEach((submission) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "submission-row";
    if (submission.submissionId === state.selectedSubmissionId) {
      button.classList.add("is-selected");
    }

    const status = statusOf(submission);
    const secondary =
      submission.organization ||
      submission.applicantType ||
      "No additional details";
    const createdAt = prettyDate(submission.createdAt);
    const statusLabel = decisionLabels[status];
    button.setAttribute(
      "aria-current",
      String(submission.submissionId === state.selectedSubmissionId),
    );

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
      selectApplicant(submission.submissionId);
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
    (item) => item.submissionId === submission.submissionId,
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
  decisionBadge.textContent = decisionLabels[status];
  decisionBadge.dataset.decision = status;
  indexBadge.textContent = `${selectedIndex + 1} of ${state.filteredSubmissions.length}`;

  applicantPortfolio.textContent = submission.portfolioLink || "-";
  if (submission.portfolioLink) {
    try {
      const url = new URL(submission.portfolioLink);
      if (["http:", "https:"].includes(url.protocol)) {
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = submission.portfolioLink;
        applicantPortfolio.replaceChildren(link);
      }
    } catch {}
  }
}

function renderFilterButtons() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.filter === state.filter,
    );
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === state.filter),
    );
  });
}

function render() {
  applyFilter();
  renderStats();
  renderFilterButtons();
  renderList();
  renderDetails();
  renderControls();
}

async function loadReviewer(reviewerName) {
  if (state.loading || state.saving) return;
  state.loading = true;
  renderControls();
  setRequestStatus("Loading participants...");
  try {
    let requireExplicitSelection = !reviewerName && !getStoredReviewer();
    const metaResponse = await fetch("/api/meta");
    if (!metaResponse.ok) throw new Error("Unable to load the review desk.");
    const meta = await metaResponse.json();
    modeBadge.textContent =
      meta.mode === "supabase" ? "Shared cloud mode" : "Local file mode";

    const response = await fetch(
      `/api/bootstrap?reviewer=${encodeURIComponent(reviewerName)}`,
    );
    if (!response.ok) throw new Error("Unable to load participants.");
    const payload = await response.json();

    if (reviewerName && !payload.reviewers.includes(reviewerName)) {
      requireExplicitSelection = true;
      storeReviewer("");
    }

    state.reviewers = payload.reviewers;
    state.selectedReviewer = requireExplicitSelection
      ? ""
      : payload.selectedReviewer;
    state.submissions = requireExplicitSelection ? [] : payload.submissions;
    state.selectedSubmissionId = requireExplicitSelection
      ? ""
      : payload.submissions[0]?.submissionId || "";
    queueSearch.value = "";

    syncReviewerOptions(payload.reviewers, state.selectedReviewer);
    if (state.selectedReviewer) {
      storeReviewer(state.selectedReviewer);
    }

    render();
    ensureReviewerSelection();
    setRequestStatus("");
  } catch (error) {
    reviewerSelect.value = state.selectedReviewer;
    setRequestStatus(error.message || "Unable to load participants.", true);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "ghost-button";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => loadReviewer(reviewerName));
    requestStatus.append(" ", retry);
  } finally {
    state.loading = false;
    renderControls();
  }
}

async function updateDecision(decision) {
  const submission = currentSubmission();
  if (!submission || state.saving || state.loading) {
    return;
  }

  const reviewer = state.selectedReviewer;
  const previousIndex = state.filteredSubmissions.findIndex(
    (row) => row.submissionId === submission.submissionId,
  );
  const followingId =
    state.filteredSubmissions[previousIndex + 1]?.submissionId ||
    state.filteredSubmissions[previousIndex - 1]?.submissionId ||
    "";
  state.saving = true;
  renderControls();
  setRequestStatus("Saving...");
  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reviewer,
        submissionId: submission.submissionId,
        decision,
      }),
    });

    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "Unable to save review.");

    const target = state.submissions.find(
      (item) => item.submissionId === submission.submissionId,
    );
    target.review = payload.review;
    if (state.filter !== "all" && state.filter !== (decision || "pending")) {
      state.selectedSubmissionId = followingId;
      scrollToApplicant();
    }
    render();
    setRequestStatus(
      `${submission.name}: ${decision ? decisionLabels[decision] : "decision cleared"}.`,
    );
  } catch (error) {
    setRequestStatus(
      error.message || "Unable to save review. Try again.",
      true,
    );
  } finally {
    state.saving = false;
    renderControls();
  }
}

previousButton.addEventListener("click", () => navigateApplicant(-1));
nextButton.addEventListener("click", () => navigateApplicant(1));
queueSearch.addEventListener("input", renderList);
queueButton.addEventListener("click", () => {
  queueDialog.appendChild(queuePanel);
  queueDialog.showModal();
  syncModalBodyState();
  document.getElementById("closeQueueButton").focus();
});
document
  .getElementById("closeQueueButton")
  .addEventListener("click", () => queueDialog.close());
queueDialog.addEventListener("close", () => {
  queueHome.appendChild(queuePanel);
  syncModalBodyState();
});
mobileLayout.addEventListener("change", () => {
  if (!mobileLayout.matches && queueDialog.open) queueDialog.close();
});

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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: adminUsername.value,
      password: adminPassword.value,
    }),
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
    queueSearch.value = "";
    setRequestStatus("");
    render();
  });
});

approveButton.addEventListener("click", () => updateDecision("approved"));
rejectButton.addEventListener("click", () => updateDecision("rejected"));
waitlistButton.addEventListener("click", () => updateDecision("waitlisted"));
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

  if (
    queueDialog.open ||
    event.repeat ||
    event.target.isContentEditable ||
    ["SELECT", "INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)
  ) {
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
  if (event.key.toLowerCase() === "w") updateDecision("waitlisted");
});

const initialReviewer = getStoredReviewer();
loadReviewer(initialReviewer);
