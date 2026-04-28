const os = require('os');
const path = require('path');
const fs = require('fs-extra');

const CREDENTIALS_PATH = path.join(os.homedir(), '.insighta', 'credentials.json');
const API_BASE = 'http://localhost:3000';

function getCredentials() {
  try {
    return fs.readJsonSync(CREDENTIALS_PATH);
  } catch {
    return null;
  }
}

function saveCredentials(data) {
  fs.ensureDirSync(path.dirname(CREDENTIALS_PATH));
  fs.writeJsonSync(CREDENTIALS_PATH, data, { spaces: 2 });
}

function clearCredentials() {
  try {
    fs.removeSync(CREDENTIALS_PATH);
  } catch {}
}

module.exports = { getCredentials, saveCredentials, clearCredentials, API_BASE, CREDENTIALS_PATH };