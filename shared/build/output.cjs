const fs = require("node:fs");

function writeJSON(filePath, value, pretty = false) {
  const indentation = pretty ? 2 : 0;
  const serialized = JSON.stringify(value, null, indentation);
  fs.writeFileSync(filePath, pretty ? `${serialized}\n` : serialized, "utf8");
}

module.exports = { writeJSON };
