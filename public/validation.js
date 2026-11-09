// Validation rules shared by the server and the page, so the portal and the
// GitHub Pages demo always apply exactly the same checks.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SubmissionValidation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function isValidSubmissionUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    const usesWebProtocol = url.protocol === 'http:' || url.protocol === 'https:';
    const hasDomain = url.hostname.split('.').filter(Boolean).length >= 2;
    return usesWebProtocol && hasDomain;
  }

  function validateSubmission(input) {
    const source = input ?? {};
    const submission = {
      name: clean(source.name),
      registrationNumber: clean(source.registrationNumber),
      assignmentTitle: clean(source.assignmentTitle),
      submissionUrl: clean(source.submissionUrl),
    };

    const errors = {};
    if (!submission.name) errors.name = 'Name is required.';
    if (!submission.registrationNumber) errors.registrationNumber = 'Registration number is required.';
    if (!submission.assignmentTitle) errors.assignmentTitle = 'Assignment title is required.';
    if (!submission.submissionUrl) {
      errors.submissionUrl = 'Submission URL is required.';
    } else if (!isValidSubmissionUrl(submission.submissionUrl)) {
      errors.submissionUrl = 'Enter a valid web link, for example https://github.com/you/assignment.';
    }

    return { submission, errors, isValid: Object.keys(errors).length === 0 };
  }

  return { validateSubmission, isValidSubmissionUrl };
});
