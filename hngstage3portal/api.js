const API_BASE = 'http://localhost:3000';
const API_HEADERS = { 'X-API-Version': '1', 'Content-Type': 'application/json' };

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...API_HEADERS, ...options.headers },
  });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      return apiFetch(path, options);
    }
    window.location.href = '/index.html';
    return;
  }

  return res;
}

async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getMe() {
  const res = await apiFetch('/auth/me');
  if (!res || !res.ok) return null;
  const data = await res.json();
  return data.data;
}

async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = '/index.html';
}

async function initNav() {
  const user = await getMe();
  if (!user) { window.location.href = '/index.html'; return; }

  const avatar = document.getElementById('avatar');
  const username = document.getElementById('username');
  if (avatar) avatar.src = user.avatar_url ?? '';
  if (username) username.textContent = `@${user.username}`;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  return user;
}