#!/bin/bash
# Sahte demo müşteri ve siparişleri siler. Makinelere dokunmaz.
set -e

cd "$(dirname "$0")/.."

echo "Demo verileri siliniyor..."

docker compose exec -T postgres psql -U huurgo -d huurgo <<'SQL'
DELETE FROM "Order"
WHERE "customerId" IN (
  SELECT id FROM "Customer"
  WHERE email IN (
    'jan@devriesschilderwerken.nl',
    'sven@meer-groen.nl',
    'l.bakker@bakkerclean.nl',
    'daan@huizingabouwtech.nl',
    'mila.v@xs4all.nl'
  )
);

DELETE FROM "Customer"
WHERE email IN (
  'jan@devriesschilderwerken.nl',
  'sven@meer-groen.nl',
  'l.bakker@bakkerclean.nl',
  'daan@huizingabouwtech.nl',
  'mila.v@xs4all.nl'
);

SELECT 'Silinen musteriler: ' || COUNT(*) FROM "Customer";
SELECT 'Kalan siparisler: ' || COUNT(*) FROM "Order";
SQL

echo "Temizlik tamamlandi."
