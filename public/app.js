const { validateSubmission, isValidSubmissionUrl } = window.SubmissionValidation;
const config = window.PORTAL_CONFIG;

const FIELD_NAMES = ['name', 'registrationNumber', 'assignmentTitle', 'submissionUrl'];

const form = document.getElementById('submission-form');
const formStatus = document.getElementById('form-status');
const submitButton = form.querySelector('button[type="submit"]');
const submissionList = document.getElementById('submission-list');
const emptyMessage = document.getElementById('empty-message');
const submissionCount = document.getElementById('submission-count');

const serverBackend = {
  async list() {
    const response = await fetch('api/submissions');
    if (!response.ok) throw new Error('Could not load submissions.');
    return (await response.json()).submissions;
  },

  async save(submission) {
    const response = await fetch('api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    if (response.status === 400) return { errors: (await response.json()).errors ?? {} };
    if (!response.ok) throw new Error('Could not save the submission.');
    return { errors: {} };
  },
};

// GitHub Pages has no server, so the demo keeps submissions in this browser.
function createBrowserBackend() {
  const storageKey = 'assignment-portal-submissions';
  let submissions = [];
  try {
    submissions = JSON.parse(localStorage.getItem(storageKey)) ?? [];
  } catch {
    // Browser storage can be unavailable; the demo then lasts until the page closes.
  }

  return {
    async list() {
      return submissions;
    },

    async save(submission) {
      submissions = [{ ...submission, submittedAt: new Date().toISOString() }, ...submissions];
      try {
        localStorage.setItem(storageKey, JSON.stringify(submissions));
      } catch {
        // Keep the in-memory copy when browser storage is unavailable.
      }
      return { errors: {} };
    },
  };
}

const backend = config.mode === 'demo' ? createBrowserBackend() : serverBackend;

function setStatus(message, kind) {
  formStatus.textContent = message;
  formStatus.dataset.kind = kind;
}

function showFieldErrors(errors) {
  for (const field of FIELD_NAMES) {
    const message = errors[field] ?? '';
    document.getElementById(`${field}-error`).textContent = message;
    document.getElementById(field).setAttribute('aria-invalid', String(Boolean(message)));
  }
  const firstInvalid = FIELD_NAMES.find((field) => errors[field]);
  if (firstInvalid) document.getElementById(firstInvalid).focus();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function createSubmissionLink(url) {
  if (!isValidSubmissionUrl(url)) return createElement('p', 'submission-link', url);
  const link = createElement('a', 'submission-link', url);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function renderSubmissions(submissions) {
  emptyMessage.hidden = submissions.length > 0;
  submissionCount.textContent = submissions.length > 0 ? String(submissions.length) : '';
  submissionList.replaceChildren(
    ...submissions.map((submission) => {
      const item = createElement('li', 'submission', '');
      const submittedAt = new Date(submission.submittedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      item.append(
        createElement('h3', 'submission-title', submission.assignmentTitle),
        createElement('p', 'submission-student', `${submission.name} · ${submission.registrationNumber}`),
        createSubmissionLink(submission.submissionUrl),
        createElement('p', 'submission-time', submittedAt),
      );
      return item;
    }),
  );
}

async function refreshSubmissions() {
  try {
    renderSubmissions(await backend.list());
  } catch {
    setStatus('Saved submissions could not be loaded. Refresh the page to try again.', 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { submission, errors, isValid } = validateSubmission(Object.fromEntries(new FormData(form)));
  showFieldErrors(errors);
  if (!isValid) {
    setStatus('Please correct the highlighted fields.', 'error');
    return;
  }

  submitButton.disabled = true;
  try {
    const result = await backend.save(submission);
    if (Object.keys(result.errors).length > 0) {
      showFieldErrors(result.errors);
      setStatus('Please correct the highlighted fields.', 'error');
      return;
    }
    form.reset();
    setStatus('Your submission has been saved.', 'success');
    await refreshSubmissions();
  } catch {
    setStatus('The submission could not be saved. Please try again.', 'error');
  } finally {
    submitButton.disabled = false;
  }
});

if (config.mode === 'demo') {
  document.getElementById('demo-banner').hidden = false;
  document.getElementById('build-info').textContent = `Published from commit ${config.commit}`;
}

refreshSubmissions();
