const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createSubmissionStore(filePath) {
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  function save(submission) {
    const saved = {
      id: crypto.randomUUID(),
      ...submission,
      submittedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify([saved, ...readAll()], null, 2));
    return saved;
  }

  return { readAll, save };
}

module.exports = { createSubmissionStore };
