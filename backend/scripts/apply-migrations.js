const fs = require('fs');
const path = require('path');

const { pool } = require('../src/db/pool');

function listSqlFilesRecursive(baseDir) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSqlFilesRecursive(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.sql')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function ensureSchemaMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function isAlreadyApplied(fileKey) {
  const result = await pool.query('SELECT 1 FROM schema_migrations WHERE file_name = $1', [fileKey]);
  return result.rowCount > 0;
}

async function markApplied(fileKey) {
  await pool.query('INSERT INTO schema_migrations (file_name) VALUES ($1)', [fileKey]);
}

async function applyMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
}

async function run() {
  const migrationSources = [
    {
      dir: path.resolve(__dirname, '../migrations'),
      keyPrefix: 'backend/migrations',
    },
  ];

  await ensureSchemaMigrationsTable();

  const allMigrations = [];

  for (const source of migrationSources) {
    const files = listSqlFilesRecursive(source.dir)
      .sort((a, b) => a.localeCompare(b))
      .map((filePath) => {
        const relativeFile = path.relative(source.dir, filePath).split(path.sep).join('/');
        const fileKey = `${source.keyPrefix}/${relativeFile}`;

        return {
          filePath,
          fileKey,
        };
      });

    allMigrations.push(...files);
  }

  for (const migration of allMigrations) {
    // Idempotency is managed by schema_migrations table.
    if (await isAlreadyApplied(migration.fileKey)) {
      console.log(`Skipping already applied migration: ${migration.fileKey}`);
      continue;
    }

    console.log(`Applying migration: ${migration.fileKey}`);
    await applyMigration(migration.filePath);
    await markApplied(migration.fileKey);
  }

  console.log('Migration step completed.');
}

run()
  .catch((error) => {
    console.error('Migration step failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
