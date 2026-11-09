// Emails the report written by send-report.js. Email is optional, so this step
// is skipped until all of the email secrets have been configured.
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

const reportFile = path.join(__dirname, '..', 'ci-report.json');

function formatReport(report) {
  const { total, passed, failed, status } = report.summary;
  const lines = [
    `Overall result: ${status.toUpperCase()}`,
    `Repository: ${report.repository}`,
    `Branch: ${report.branch}`,
    `Commit: ${report.commitSha}`,
    `Pipeline run: ${report.pipelineRunUrl}`,
    `Executed at: ${report.executedAt}`,
    '',
    `Tests: ${total} total, ${passed} passed, ${failed} failed`,
    '',
  ];

  for (const test of report.tests) {
    lines.push(`[${test.result.toUpperCase()}] ${test.name}`);
    if (test.failureMessage) lines.push(`    ${test.failureMessage.replace(/\n/g, '\n    ')}`);
  }

  return lines.join('\n');
}

async function main() {
  const { SMTP_USER, SMTP_PASS, MAIL_TO, SMTP_HOST, SMTP_PORT } = process.env;
  if (!SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.log('Email report skipped: SMTP_USER, SMTP_PASS and MAIL_TO are not all configured.');
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const port = Number(SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const { status, passed, total } = report.summary;
  await transporter.sendMail({
    from: SMTP_USER,
    to: MAIL_TO,
    subject: `[${status.toUpperCase()}] ${report.repository} @ ${report.commitSha.slice(0, 7)}: ${passed}/${total} tests passed`,
    text: formatReport(report),
    attachments: [{ filename: 'test-report.json', path: reportFile }],
  });

  console.log('Email report sent.');
}

main().catch((error) => {
  console.error(`::error::The email report could not be sent: ${error.message}`);
  process.exitCode = 1;
});
