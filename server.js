const { handleRequest } = require("./lib/http-app");

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
