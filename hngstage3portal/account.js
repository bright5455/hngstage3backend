async function init() {
  const user = await initNav();
  if (!user) return;

  document.getElementById('account-avatar').src = user.avatar_url ?? '';
  document.getElementById('acc-username').textContent = `@${user.username}`;
  document.getElementById('acc-email').textContent = user.email ?? '—';
  document.getElementById('acc-role').textContent = user.role;
  document.getElementById('acc-last-login').textContent =
    user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—';
  document.getElementById('acc-created').textContent =
    new Date(user.created_at).toLocaleString();
}

init();