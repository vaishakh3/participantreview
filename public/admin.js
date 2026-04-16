const uploadForm = document.getElementById("uploadForm");
const csvInput = document.getElementById("csvInput");
const submitButton = document.getElementById("submitButton");
const statusBox = document.getElementById("status");

function setStatus(html) {
  statusBox.innerHTML = html;
}

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
