async function checkAuth() {
  try {
    const res = await fetch('http://localhost:3000/auth/me', {
      credentials: 'include',
      headers: { 'X-API-Version': '1' },
    });
    if (res.ok) {
      window.location.href = '/dashboard.html';
    }
  } catch {}
}
checkAuth();