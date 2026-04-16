const adminLoginCard = document.getElementById("adminLoginCard");
const uploadCard = document.getElementById("uploadCard");
const adminAuthForm = document.getElementById("adminAuthForm");
const adminAuthUsername = document.getElementById("adminAuthUsername");
const adminAuthPassword = document.getElementById("adminAuthPassword");
const adminAuthError = document.getElementById("adminAuthError");
const adminAuthSubmit = document.getElementById("adminAuthSubmit");
const uploadForm = document.getElementById("uploadForm");
const csvInput = document.getElementById("csvInput");
const submitButton = document.getElementById("submitButton");
const statusBox = document.getElementById("status");

function setStatus(html) {
  statusBox.innerHTML = html;
}

function showUploadCard() {
  adminLoginCard.classList.add("is-hidden");
  uploadCard.classList.remove("is-hidden");
}

function showLoginCard() {
  uploadCard.classList.add("is-hidden");
  adminLoginCard.classList.remove("is-hidden");
}

async function checkSession() {
  const response = await fetch("/api/admin/session");
  const payload = await response.json();
  if (payload.authenticated) {
    showUploadCard();
  } else {
    showLoginCard();
  }
}

adminAuthForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminAuthError.classList.add("is-hidden");
  adminAuthSubmit.disabled = true;
  adminAuthSubmit.textContent = "Signing in…";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: adminAuthUsername.value,
        password: adminAuthPassword.value
      })
    });

    if (!response.ok) {
      adminAuthError.classList.remove("is-hidden");
      adminAuthPassword.select();
      return;
    }

    showUploadCard();
  } finally {
    adminAuthSubmit.disabled = false;
    adminAuthSubmit.textContent = "Continue";
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!csvInput.files?.length) {
    setStatus("<p>Please choose a CSV file first.</p>");
    return;
  }

  const formData = new FormData();
  formData.append("csv", csvInput.files[0]);

  submitButton.disabled = true;
  submitButton.textContent = "Uploading…";
  setStatus("<p>Uploading and syncing applicants…</p>");

  try {
    const response = await fetch("/api/admin/upload-csv", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed");
    }

    const result = payload.syncResult || {};
    setStatus(`
      <p><strong>Upload complete.</strong></p>
      <p>Mode: ${result.mode || "local"}</p>
      <p>Total applicants in CSV: ${result.totalApplicants ?? "n/a"}</p>
      <p>New applicants added: ${result.newApplicants ?? 0}</p>
      <p>Existing applicants preserved: ${result.preservedApplicants ?? 0}</p>
    `);
  } catch (error) {
    setStatus(`<p>${error.message}</p>`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Upload and Sync";
  }
});

checkSession();
