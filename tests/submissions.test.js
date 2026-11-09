const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createSubmissionStore } = require('../src/store');

const validSubmission = {
  name: 'Ayesha Khan',
  registrationNumber: 'FA22-BCS-042',
  assignmentTitle: 'DevOps Lab Mid',
  submissionUrl: 'https://github.com/ayesha/devops-lab-mid',
};

let dataDirectory;
let dataFile;
let app;

beforeEach(() => {
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-test-'));
  dataFile = path.join(dataDirectory, 'submissions.json');
  app = createApp(createSubmissionStore(dataFile));
});

afterEach(() => {
  fs.rmSync(dataDirectory, { recursive: true, force: true });
});

async function listSubmissions(portal = app) {
  const response = await request(portal).get('/api/submissions').expect(200);
  return response.body.submissions;
}

test('Complete details and a valid submission URL: saved and shown in the list', async () => {
  const response = await request(app).post('/api/submissions').send(validSubmission);

  expect(response.status).toBe(201);
  const submissions = await listSubmissions();
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject(validSubmission);
});

test('Missing registration number: rejected with a validation message', async () => {
  const { registrationNumber, ...incomplete } = validSubmission;

  const response = await request(app).post('/api/submissions').send(incomplete);

  expect(response.status).toBe(400);
  expect(response.body.errors.registrationNumber).toBe('Registration number is required.');
  expect(await listSubmissions()).toHaveLength(0);
});

test('Invalid submission URL: rejected and not saved', async () => {
  const response = await request(app)
    .post('/api/submissions')
    .send({ ...validSubmission, submissionUrl: 'not-a-valid-url' });

  expect(response.status).toBe(400);
  expect(response.body.errors.submissionUrl).toMatch(/valid web link/);
  expect(await listSubmissions()).toHaveLength(0);
});

test('Unsafe javascript: link: rejected and not saved', async () => {
  const response = await request(app)
    .post('/api/submissions')
    .send({ ...validSubmission, submissionUrl: 'javascript:alert(1)' });

  expect(response.status).toBe(400);
  expect(await listSubmissions()).toHaveLength(0);
});

test('Saved submissions are still listed after the portal restarts', async () => {
  await request(app).post('/api/submissions').send(validSubmission).expect(201);

  const restartedApp = createApp(createSubmissionStore(dataFile));

  expect(await listSubmissions(restartedApp)).toHaveLength(1);
});
