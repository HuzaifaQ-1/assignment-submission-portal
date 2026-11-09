const path = require('node:path');
const express = require('express');
const { validateSubmission } = require('../public/validation');

function createApp(store) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/submissions', (req, res) => {
    res.json({ submissions: store.readAll() });
  });

  app.post('/api/submissions', (req, res) => {
    const { submission, errors, isValid } = validateSubmission(req.body);
    if (!isValid) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
    }
    res.status(201).json({ submission: store.save(submission) });
  });

  // Malformed or oversized request bodies arrive here from express.json().
  app.use((error, req, res, next) => {
    if (error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ message: 'The request could not be read.' });
    }
    console.error(error);
    res.status(500).json({ message: 'The submission could not be processed.' });
  });

  return app;
}

module.exports = { createApp };
