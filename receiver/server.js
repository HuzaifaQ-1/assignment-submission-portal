// Local HTTP receiver: accepts completed test reports from the CI pipeline and
// saves the latest one as test-report.json on this computer.
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const port = Number(process.env.RECEIVER_PORT) || 4000;
const reportFile = process.env.REPORT_FILE || path.join(__dirname, '..', 'test-report.json');
const historyDirectory = path.join(path.dirname(reportFile), 'report-history');

function findProblem(report) {
  if (!report || typeof report !== 'object') return 'The report must be a JSON object.';

  for (const field of ['repository', 'branch', 'commitSha', 'pipelineRunId', 'executedAt']) {
    if (typeof report[field] !== 'string' || report[field] === '') return `The report is missing "${field}".`;
  }

  const hasValidTests = Array.isArray(report.tests) && report.tests.every((test) => test.name && test.result);
  if (!hasValidTests) return 'The report must list each test with its name and result.';

  const summary = report.summary ?? {};
  const hasCounts = ['total', 'passed', 'failed'].every((count) => Number.isInteger(summary[count]));
  if (!hasCounts || !['passed', 'failed'].includes(summary.status)) {
    return 'The report is missing its summary counts or overall status.';
  }

  return null;
}

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('Test report receiver is running. The pipeline posts reports to /report.');
});

app.post('/report', (req, res) => {
  const problem = findProblem(req.body);
  if (problem) {
    console.warn(`Rejected a report: ${problem}`);
    return res.status(400).json({ message: problem });
  }

  const report = req.body;
  const contents = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(reportFile, contents);

  // Keep a dated copy of every report, because test-report.json is replaced each run.
  const receivedAt = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(historyDirectory, { recursive: true });
  fs.writeFileSync(path.join(historyDirectory, `${receivedAt}-${report.summary.status}.json`), contents);

  const { status, passed, total } = report.summary;
  console.log(`Saved report: ${status.toUpperCase()} ${passed}/${total} passed, commit ${report.commitSha.slice(0, 7)}, run ${report.pipelineRunId}`);
  res.status(201).json({ saved: reportFile });
});

// Only this computer can reach the receiver.
app.listen(port, '127.0.0.1', () => {
  console.log(`Report receiver listening on http://localhost:${port}/report`);
  console.log(`Reports are saved to ${reportFile}`);
});
