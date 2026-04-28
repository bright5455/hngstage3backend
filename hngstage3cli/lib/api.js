const axios = require('axios');
const { getCredentials, saveCredentials, clearCredentials, API_BASE } = require('./config');
const chalk = require('chalk');

async function refreshTokens(refreshToken) {
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    return res.data;
  } catch {
    return null;
  }
}

async function apiRequest(method, path, data = null, params = null) {
  const creds = getCredentials();

  if (!creds) {
    console.error(chalk.red('Not logged in. Run: insighta login'));
    process.exit(1);
  }

  try {
    const res = await axios({
      method,
      url: `${API_BASE}${path}`,
      data,
      params,
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        'X-API-Version': '1',
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (err) {
    // Try refresh if 401
    if (err.response?.status === 401) {
      const newTokens = await refreshTokens(creds.refresh_token);
      if (newTokens) {
        saveCredentials({ ...creds, ...newTokens });
        return apiRequest(method, path, data, params);
      } else {
        clearCredentials();
        console.error(chalk.red('Session expired. Please login again: insighta login'));
        process.exit(1);
      }
    }

    const message = err.response?.data?.message ?? err.message;
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

module.exports = { apiRequest };