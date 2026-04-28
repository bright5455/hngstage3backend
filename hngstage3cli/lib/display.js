const Table = require('cli-table3');
const chalk = require('chalk');

function displayProfiles(data) {
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Gender'),
      chalk.cyan('Age'),
      chalk.cyan('Group'),
      chalk.cyan('Country'),
    ],
    style: { head: [], border: [] },
  });

  data.forEach(p => {
    table.push([
      p.name,
      p.gender,
      String(p.age),
      p.age_group,
      `${p.country_id} — ${p.country_name}`,
    ]);
  });

  console.log(table.toString());
}

function displayProfile(p) {
  const table = new Table({ style: { head: [], border: [] } });
  table.push(
    { ID: p.id },
    { Name: p.name },
    { Gender: p.gender },
    { 'Gender Probability': String(p.gender_probability) },
    { Age: String(p.age) },
    { 'Age Group': p.age_group },
    { 'Country ID': p.country_id },
    { 'Country Name': p.country_name },
    { 'Country Probability': String(p.country_probability) },
    { 'Created At': new Date(p.created_at).toLocaleString() },
  );
  console.log(table.toString());
}

function displayPagination(page, totalPages, total) {
  console.log(
    chalk.gray(`\nPage ${page}/${totalPages} — ${total} total results`),
  );
}

module.exports = { displayProfiles, displayProfile, displayPagination };