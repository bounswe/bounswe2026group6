'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationFileNamePattern = /^\d{8}_\d{6}__[a-z0-9_]+\.sql$/;

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

function isMigrationFile(filePath) {
  return migrationFileNamePattern.test(path.basename(filePath));
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(
      `Invalid test database name "${identifier}". Use letters, numbers and underscores only.`
    );
  }

  return `"${identifier}"`;
}

function getDbConfig() {
  const host = process.env.TEST_POSTGRES_HOST || process.env.POSTGRES_HOST || 'localhost';
  const port = Number(process.env.TEST_POSTGRES_PORT || process.env.POSTGRES_PORT || 5432);
  const user = process.env.TEST_POSTGRES_USER || process.env.POSTGRES_USER || 'neph_user';
  const password = process.env.TEST_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || 'neph_pass';
  const database = process.env.TEST_POSTGRES_DB || process.env.POSTGRES_DB || 'neph_test_db';

  process.env.NODE_ENV = 'test';
  process.env.POSTGRES_HOST = host;
  process.env.POSTGRES_PORT = String(port);
  process.env.POSTGRES_USER = user;
  process.env.POSTGRES_PASSWORD = password;
  process.env.POSTGRES_DB = database;

  return { host, port, user, password, database };
}

module.exports = async function globalSetup() {
  const db = getDbConfig();

  const adminClient = new Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: 'postgres',
  });

  await adminClient.connect();

  try {
    const dbExists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1;', [db.database]);

    if (dbExists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(db.database)};`);
    }
  } finally {
    await adminClient.end();
  }

  const initSqlPath = path.resolve(__dirname, '../../../infra/docker/postgres/init.sql');
  const initSql = fs.readFileSync(initSqlPath, 'utf-8');

  const testClient = new Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
  });

  await testClient.connect();

  try {
    await testClient.query(initSql);

    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const migrationFiles = listSqlFilesRecursive(migrationsDir)
      .filter(isMigrationFile)
      .sort((a, b) => a.localeCompare(b));

    for (const migrationFile of migrationFiles) {
      const migrationSql = fs.readFileSync(migrationFile, 'utf-8');
      await testClient.query(migrationSql);
    }
  } finally {
    await testClient.end();
  }
};
