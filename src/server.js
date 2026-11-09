const path = require('node:path');
const { createApp } = require('./app');
const { createSubmissionStore } = require('./store');

const port = Number(process.env.PORT) || 3000;
const dataFile = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'submissions.json');

createApp(createSubmissionStore(dataFile)).listen(port, '127.0.0.1', () => {
  console.log(`Assignment portal running at http://localhost:${port}`);
});
