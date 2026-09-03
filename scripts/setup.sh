#!/usr/bin/env bash
set -euo pipefail

echo "==> Levantando Postgres con las migraciones 001-012 aplicadas..."
docker compose up -d postgres

echo "==> Esperando a que la base de datos esté lista..."
until docker compose exec -T postgres pg_isready -U barbershop > /dev/null 2>&1; do
  sleep 1
done
echo "    Postgres OK."

echo "==> Instalando dependencias del backend..."
cd backend
npm install

echo "==> Corriendo tests unitarios (no requieren DB)..."
npx jest tests/validation.test.ts tests/booking.concurrency.test.ts

echo ""
echo "Setup completo."
echo "Para correr el test de integración de concurrencia real contra la DB:"
echo "  DATABASE_URL=postgres://barbershop:barbershop_dev_password@localhost:5432/barbershop \\"
echo "    npx jest tests/booking.integration.test.ts"
