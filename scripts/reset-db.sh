#!/usr/bin/env bash
set -euo pipefail

echo "==> Esto borra TODOS los datos de la base local y vuelve a correr las migraciones desde cero."
read -p "Confirmar? (y/N) " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Cancelado."
  exit 0
fi

docker compose down -v
docker compose up -d postgres

until docker compose exec -T postgres pg_isready -U barbershop > /dev/null 2>&1; do
  sleep 1
done

echo "Base de datos reiniciada con las migraciones aplicadas."
