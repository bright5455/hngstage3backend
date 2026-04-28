let currentPage = 1;
let currentUser = null;

function getFilters() {
  return {
    gender: document.getElementById('filter-gender').value,
    age_group: document.getElementById('filter-age-group').value,
    country_id: document.getElementById('filter-country').value,
    min_age: document.getElementById('filter-min-age').value,
    max_age: document.getElementById('filter-max-age').value,
    sort_by: document.getElementById('filter-sort').value,
    order: document.getElementById('filter-order').value,
  };
}

function buildQuery(filters, page) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  params.set('page', page);
  params.set('limit', '10');
  return params.toString();
}

async function loadProfiles(page = 1) {
  currentPage = page;
  const filters = getFilters();
  const query = buildQuery(filters, page);

  document.getElementById('loading').style.display = 'block';
  document.getElementById('profiles-table').style.display = 'none';

  const res = await apiFetch(`/api/profiles?${query}`);
  if (!res || !res.ok) return;

  const data = await res.json();
  renderTable(data.data);
  renderPagination(data.page, data.total_pages);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('profiles-table').style.display = 'table';
}

function renderTable(profiles) {
  const tbody = document.getElementById('profiles-body');
  tbody.innerHTML = profiles.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.gender}</td>
      <td>${p.age}</td>
      <td>${p.age_group}</td>
      <td>${p.country_id} — ${p.country_name}</td>
      <td>
        <a href="profile_detail.html?id=${p.id}" style="color:#6c63ff">View</a>
        ${currentUser?.role === 'admin' ? `<button onclick="deleteProfile('${p.id}')" style="color:red;border:none;background:none;cursor:pointer;margin-left:8px">Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderPagination(page, totalPages) {
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (page > 1) html += `<button onclick="loadProfiles(${page - 1})">← Prev</button>`;
  html += `<button class="active">${page} / ${totalPages}</button>`;
  if (page < totalPages) html += `<button onclick="loadProfiles(${page + 1})">Next →</button>`;
  el.innerHTML = html;
}

async function deleteProfile(id) {
  if (!confirm('Delete this profile?')) return;
  const res = await apiFetch(`/api/profiles/${id}`, { method: 'DELETE' });
  if (res && res.status === 204) loadProfiles(currentPage);
}

async function init() {
  currentUser = await initNav();
  if (!currentUser) return;

  if (currentUser.role === 'admin') {
    document.getElementById('create-btn').style.display = 'block';
  }

  document.getElementById('apply-filters').addEventListener('click', () => loadProfiles(1));
  document.getElementById('reset-filters').addEventListener('click', () => {
    document.querySelectorAll('.filters select, .filters input').forEach(el => el.value = '');
    loadProfiles(1);
  });

  document.getElementById('create-btn').addEventListener('click', () => {
    document.getElementById('create-modal').style.display = 'flex';
  });
  document.getElementById('create-cancel').addEventListener('click', () => {
    document.getElementById('create-modal').style.display = 'none';
  });
  document.getElementById('create-submit').addEventListener('click', async () => {
    const name = document.getElementById('create-name').value;
    if (!name) return;
    const res = await apiFetch('/api/profiles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    if (res && res.ok) {
      document.getElementById('create-modal').style.display = 'none';
      loadProfiles(1);
    }
  });

  loadProfiles(1);
}

init();