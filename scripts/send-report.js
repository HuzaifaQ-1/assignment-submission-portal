// Builds the test report from Jest's JSON output and posts it to the local
// receiver. Runs after passing and failing tests alike, and still reports a
// failure when the tests could not run at all.
const fs = require('node:fs');
const path = require('node:path');
const { stripVTControlCharacters } = require('node:util');

const root = path.join(__dirname, '..');
const jestOutputFile = path.join(root, 'test-results.json');
const reportFile = path.join(root, 'ci-report.json');
const receiverUrl = process.env.REPORT_URL || 'http://127.0.0.1:4000/report';
const deliveryAttempts = 5;
const retryDelayMs = 2000;

function readJestResults() {
  try {
    return JSON.parse(fs.readFileSync(jestOutputFile, 'utf8'));
  } catch {
    return null;
  }
}

// Jest appends a stack trace to each failure; the report only needs the reason.
function cleanFailureMessage(message) {
  return stripVTControlCharacters(message).split(/\n\s+at /)[0].trim();
}

function readTests(jestResults) {
  return jestResults.testResults.flatMap((file) => {
    // A test file that crashes before any test starts has no individual results.
    if (file.assertionResults.length === 0) {
      return [{
        name: `Test file could not run: ${path.basename(file.name)}`,
        result: 'failed',
        failureMessage: cleanFailureMessage(file.message),
      }];
    }

    return file.assertionResults.map((test) => ({
      name: test.fullName,
      result: test.status,
      failureMessage: test.failureMessages.length > 0 ? cleanFailureMessage(test.failureMessages.join('\n')) : null,
    }));
  });
}

function buildReport(jestResults, env) {
  const tests = jestResults ? readTests(jestResults) : [];

  const testStepFailed = env.TEST_OUTCOME !== undefined && env.TEST_OUTCOME !== 'success';
  if (tests.length === 0 || (testStepFailed && !tests.some((test) => test.result === 'failed'))) {
    tests.push({
      name: 'Test run',
      result: 'failed',
      failureMessage: `The test step did not complete normally (outcome: ${env.TEST_OUTCOME ?? 'unknown'}). See the pipeline log.`,
    });
  }

  const passed = tests.filter((test) => test.result === 'passed').length;
  const failed = tests.filter((test) => test.result === 'failed').length;

  return {
    repository: env.GITHUB_REPOSITORY,
    branch: env.GITHUB_REF_NAME,
    commitSha: env.GITHUB_SHA,
    pipelineRunId: env.GITHUB_RUN_ID,
    pipelineRunUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    executedAt: new Date(jestResults?.startTime ?? Date.now()).toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed,
      failed,
      status: failed === 0 && passed > 0 ? 'passed' : 'failed',
    },
  };
}

async function deliverReport(report) {
  let lastProblem;
  for (let attempt = 1; attempt <= deliveryAttempts; attempt += 1) {
    try {
      const response = await fetch(receiverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (response.ok) return;
      lastProblem = `the receiver answered ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastProblem = error.cause?.message ?? error.message;
    }
    if (attempt < deliveryAttempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  throw new Error(lastProblem);
}

async function main() {
  const report = buildReport(readJestResults(), process.env);
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  const { status, passed, failed, total } = report.summary;
  console.log(`Test report: ${status.toUpperCase()} (${total} total, ${passed} passed, ${failed} failed)`);

  try {
    await deliverReport(report);
    console.log(`Report delivered to ${receiverUrl}`);
  } catch (error) {
    console.error(`::error::The report could not be delivered to ${receiverUrl}: ${error.message}. Is the receiver running?`);
    process.exitCode = 1;
  }
}

main();
