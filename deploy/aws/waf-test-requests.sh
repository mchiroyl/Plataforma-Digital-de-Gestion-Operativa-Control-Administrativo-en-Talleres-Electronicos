#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://app.tudominio.com}"

echo "[1/3] Prueba SQLi"
curl -i "${BASE_URL}/api/public/tracking/ORD-2026-00001?token=' OR 1=1 --"

echo "\n[2/3] Prueba XSS"
curl -i "${BASE_URL}/api/public/tracking/%3Cscript%3Ealert(1)%3C/script%3E?token=x"

echo "\n[3/3] Prueba rate-limit rafaga"
for i in $(seq 1 120); do
  curl -s -o /dev/null -w "%{http_code}\n" "${BASE_URL}/api/public/health"
done

echo "\nValidar en AWS WAF: Sampled requests, Allowed/Blocked, y reglas activadas."
