const { createServer } = require("./app");
const { supabaseConfigured } = require("./lib/supabase");
const { CSV_PATH } = require("./lib/local-data");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";

const server = createServer();
server.listen(PORT, HOST, () => {
  console.log(`Review dashboard running at http://${HOST}:${PORT}`);
  console.log(`Mode: ${supabaseConfigured() ? "supabase" : "local"}`);
  console.log(`CSV path: ${CSV_PATH}`);
});
