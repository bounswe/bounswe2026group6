const fs = require('fs');
const path = require('path');

const { pool } = require('../src/db/pool');

const MIGRATION_LOCK_KEY = 2026041501;

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

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applySingleMigrationAtomically(client, migration) {
  const sql = fs.readFileSync(migration.filePath, 'utf8');

  await client.query('BEGIN');

  try {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE file_name = $1', [
      migration.fileKey,
    ]);

    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      console.log(`Skipping already applied migration: ${migration.fileKey}`);
      return;
    }

    console.log(`Applying migration: ${migration.fileKey}`);
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (file_name) VALUES ($1)', [migration.fileKey]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function run() {
  const migrationSources = [
    {
      dir: path.resolve(__dirname, '../migrations'),
      keyPrefix: 'backend/migrations',
    },
  ];

  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await ensureSchemaMigrationsTable(client);

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
      await applySingleMigrationAtomically(client, migration);
    }

    console.log('Migration step completed.');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } catch (_error) {
      // Best effort unlock.
    }

    client.release();
  }
}

run()
  .catch((error) => {
    console.error('Migration step failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
