import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  const target = process.argv[2] ?? 'local';
  const appUser = required('DB_APP_USER');
  const appPassword = required('DB_APP_PASSWORD');
  const sqlTemplate = readFileSync(join(__dirname, '..', 'prisma', 'security', 'rls.sql'), 'utf8');
  const sql = sqlTemplate
    .replaceAll('__APP_USER__', quoteIdentifier(appUser))
    .replaceAll('__APP_USER_NAME__', quoteLiteral(appUser))
    .replaceAll('__APP_PASSWORD_TEXT__', quoteLiteral(appPassword));
  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx prisma db execute --stdin --schema prisma/schema.prisma'], {
      cwd: join(__dirname, '..'),
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    });
  } else {
    execFileSync('npx', ['prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'], {
      cwd: join(__dirname, '..'),
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    });
  }

  console.log(`Seguridad de base aplicada para ${target}.`);
  console.log(`Rol runtime configurado: ${appUser}`);
  console.log('Use APP_DATABASE_URL en el backend para que RLS se aplique de verdad.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
