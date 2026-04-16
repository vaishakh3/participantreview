const path = require("path");
const { loadEnv } = require("../lib/env");

loadEnv(path.join(__dirname, ".."));

const { CSV_PATH } = require("../lib/local-data");
const { syncApplicantsFromCurrentCsv } = require("../lib/sync-applicants");

async function main() {
  const result = await syncApplicantsFromCurrentCsv();
  if (!result.synced) {
    throw new Error(result.message);
  }

  console.log(
    `Synced ${result.totalApplicants} applicants from ${path.basename(CSV_PATH)} to Supabase. Added ${result.newApplicants} new applicants and preserved ${result.preservedApplicants} existing assignments.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
