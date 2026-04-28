const http = require('http');
const crypto = require('crypto');
const chalk = require('chalk');
const { saveCredentials, clearCredentials, API_BASE } = require('./config');

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge };
}

async function openBrowser(url) {
  const { default: open } = await import('open');
  await open(url);
}

async function login() {
  const PORT = 9876;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);

      if (url.pathname !== '/callback') {
        res.end('Not found');
        return;
      }

      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      const username = url.searchParams.get('username');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:48px">
          <h2>✅ Logged in as @${username}</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>
      `);

      server.close();

      if (error || !accessToken) {
        reject(new Error('Authentication failed'));
        return;
      }

      saveCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        username,
      });

      resolve(username);
    });

    server.listen(PORT, async () => {
      const authUrl = `${API_BASE}/auth/github?cli=true`;
      await openBrowser(authUrl);
      console.log(chalk.blue('Opening GitHub login in your browser...'));
      console.log(chalk.gray(`If it doesn't open, visit: ${authUrl}`));
    });

    server.on('error', reject);

    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out'));
    }, 120000);
  });
}

async function logout() {
  const { apiRequest } = require('./api');
  try {
    await apiRequest('POST', '/auth/logout');
  } catch {}
  clearCredentials();
}

module.exports = { login, logout };