async function checkAuth() {
  try {
    const res = await fetch('https://hngstage3backend-production.up.railway.app/auth/me',  {
      credentials: 'include',
      headers: { 'X-API-Version': '1' },
    });
    if (res.ok) {
      window.location.href = '/dashboard.html';
    }
  } catch {}
}
checkAuth();