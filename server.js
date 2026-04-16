const { handleRequest } = require("./app");

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
