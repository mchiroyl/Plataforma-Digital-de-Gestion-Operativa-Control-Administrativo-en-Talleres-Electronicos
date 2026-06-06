#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env.prod ]]; then
  echo "Error: no existe .env.prod en el directorio actual"
  exit 1
fi

set -a
source .env.prod
set +a

pushd ../../backend >/dev/null
npm ci
npx prisma migrate deploy
npm run prisma:seed
npm run security:db:prod
popd >/dev/null

echo "Migraciones, seed y seguridad DB aplicadas correctamente."
