let currentPage = 1;
let currentQuery = '';

async function doSearch(page = 1) {
  currentPage = page;
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;
  currentQuery = q;

  document.getElementById('loading').style.display = 'block';
  document.getElementById('results-table').style.display = 'none';

  const res = await apiFetch(
    `/api/profiles/search?q=${encodeURIComponent(q)}&page=${page}&limit=10`,
  );

  document.getElementById('loading').style.display = 'none';

  if (!res || !res.ok) return;
  const data = await res.json();

  if (data.status === 'error') {
    document.getElementById('results-body').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:#ff4757">${data.message}</td></tr>`;
    document.getElementById('results-table').style.display = 'table';
    return;
  }

  const tbody = document.getElementById('results-body');
  tbody.innerHTML = data.data.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.gender}</td>
      <td>${p.age}</td>
      <td>${p.age_group}</td>
      <td>${p.country_id} — ${p.country_name}</td>
    </tr>
  `).join('');

  document.getElementById('results-table').style.display = 'table';
  renderPagination(data.page, data.total_pages);
}

function renderPagination(page, totalPages) {
  const el = document.getElementById('pagination');
  if (!totalPages || totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button onclick="doSearch(${page - 1})">← Prev</button>`;
  html += `<button class="active">${page} / ${totalPages}</button>`;
  if (page < totalPages) html += `<button onclick="doSearch(${page + 1})">Next →</button>`;
  el.innerHTML = html;
}

async function init() {
  await initNav();
  document.getElementById('search-btn').addEventListener('click', () => doSearch(1));
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch(1);
  });
}

init();