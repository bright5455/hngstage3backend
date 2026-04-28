async function init() {
  const user = await initNav();
  if (!user) return;

  document.getElementById('user-role').textContent = user.role;
  document.getElementById('last-login').textContent =
    user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—';

  // Get total profiles
  const res = await apiFetch('/api/profiles?limit=1');
  if (res && res.ok) {
    const data = await res.json();
    document.getElementById('total-profiles').textContent =
      data.total?.toLocaleString() ?? '—';
  }
}

init();