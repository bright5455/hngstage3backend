#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { login, logout } = require('./lib/auth');
const { apiRequest } = require('./lib/api');
const { getCredentials } = require('./lib/config');
const { displayProfiles, displayProfile, displayPagination } = require('./lib/display');
const fs = require('fs');
const path = require('path');

program
  .name('insighta')
  .description('Insighta Labs+ CLI')
  .version('1.0.0');

// ── Auth commands ──────────────────────────────────────
program
  .command('login')
  .description('Login with GitHub')
  .action(async () => {
    try {
      const username = await login();
      console.log(chalk.green(`\n✅ Logged in as @${username}`));
    } catch (err) {
      console.error(chalk.red(`Login failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Logout and clear credentials')
  .action(async () => {
    const spinner = ora('Logging out...').start();
    await logout();
    spinner.succeed(chalk.green('Logged out successfully'));
  });

program
  .command('whoami')
  .description('Show current user info')
  .action(async () => {
    const spinner = ora('Fetching user info...').start();
    const data = await apiRequest('GET', '/auth/me');
    spinner.stop();
    const u = data.data;
    console.log(chalk.cyan('\nCurrent User:'));
    console.log(`  Username:   @${u.username}`);
    console.log(`  Email:      ${u.email ?? '—'}`);
    console.log(`  Role:       ${chalk.yellow(u.role)}`);
    console.log(`  Last Login: ${new Date(u.last_login_at).toLocaleString()}\n`);
  });

// ── Profiles commands ──────────────────────────────────
const profiles = program.command('profiles').description('Manage profiles');

profiles
  .command('list')
  .description('List profiles with optional filters')
  .option('--gender <gender>', 'Filter by gender')
  .option('--country <country_id>', 'Filter by country ID')
  .option('--age-group <age_group>', 'Filter by age group')
  .option('--min-age <min_age>', 'Minimum age')
  .option('--max-age <max_age>', 'Maximum age')
  .option('--sort-by <sort_by>', 'Sort by: age, created_at, gender_probability')
  .option('--order <order>', 'Order: asc or desc')
  .option('--page <page>', 'Page number', '1')
  .option('--limit <limit>', 'Results per page', '10')
  .action(async (opts) => {
    const spinner = ora('Fetching profiles...').start();
    const params = {};
    if (opts.gender) params.gender = opts.gender;
    if (opts.country) params.country_id = opts.country;
    if (opts.ageGroup) params.age_group = opts.ageGroup;
    if (opts.minAge) params.min_age = opts.minAge;
    if (opts.maxAge) params.max_age = opts.maxAge;
    if (opts.sortBy) params.sort_by = opts.sortBy;
    if (opts.order) params.order = opts.order;
    params.page = opts.page;
    params.limit = opts.limit;

    const data = await apiRequest('GET', '/api/profiles', null, params);
    spinner.stop();
    displayProfiles(data.data);
    displayPagination(data.page, data.total_pages, data.total);
  });

profiles
  .command('get <id>')
  .description('Get a single profile by ID')
  .action(async (id) => {
    const spinner = ora('Fetching profile...').start();
    const data = await apiRequest('GET', `/api/profiles/${id}`);
    spinner.stop();
    displayProfile(data.data);
  });

profiles
  .command('search <query>')
  .description('Search profiles using natural language')
  .option('--page <page>', 'Page number', '1')
  .option('--limit <limit>', 'Results per page', '10')
  .action(async (query, opts) => {
    const spinner = ora('Searching...').start();
    const data = await apiRequest('GET', '/api/profiles/search', null, {
      q: query,
      page: opts.page,
      limit: opts.limit,
    });
    spinner.stop();
    if (data.status === 'error') {
      console.error(chalk.red(data.message));
      return;
    }
    displayProfiles(data.data);
    displayPagination(data.page, data.total_pages, data.total);
  });

profiles
  .command('create')
  .description('Create a new profile (admin only)')
  .requiredOption('--name <name>', 'Name to classify')
  .action(async (opts) => {
    const spinner = ora(`Creating profile for "${opts.name}"...`).start();
    const data = await apiRequest('POST', '/api/profiles', { name: opts.name });
    spinner.stop();
    console.log(chalk.green('\n✅ Profile created:'));
    displayProfile(data.data);
  });

profiles
  .command('export')
  .description('Export profiles as CSV')
  .requiredOption('--format <format>', 'Export format (csv)')
  .option('--gender <gender>', 'Filter by gender')
  .option('--country <country_id>', 'Filter by country ID')
  .option('--age-group <age_group>', 'Filter by age group')
  .action(async (opts) => {
    if (opts.format !== 'csv') {
      console.error(chalk.red('Only csv format is supported'));
      process.exit(1);
    }

    const spinner = ora('Exporting profiles...').start();
    const { getCredentials, API_BASE } = require('./lib/config');
    const axios = require('axios');
    const creds = getCredentials();

    const params = {};
    if (opts.gender) params.gender = opts.gender;
    if (opts.country) params.country_id = opts.country;
    if (opts.ageGroup) params.age_group = opts.ageGroup;

    try {
      const res = await axios.get(`${API_BASE}/api/profiles/export`, {
        params: { ...params, format: 'csv' },
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'X-API-Version': '1',
        },
        responseType: 'text',
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `profiles_${timestamp}.csv`;
      const filepath = path.join(process.cwd(), filename);
      fs.writeFileSync(filepath, res.data);
      spinner.succeed(chalk.green(`✅ Exported to ${filepath}`));
    } catch (err) {
      spinner.fail(chalk.red(`Export failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);