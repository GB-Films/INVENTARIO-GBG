# Inventario GBG

App web para ordenar activos de Gran Berta Films: que hay, a quien pertenece, donde esta, quien lo tiene y que movimientos tuvo.

## Desarrollo local

```bash
npm ci
npm run dev
```

## Nube

Usa el mismo Supabase compartido de BANI-PRESU / Entregas mediante la tabla `app_state` y la key `gbg-inventory-state`.

## Deploy

El proyecto esta preparado para GitHub Pages con base `/INVENTARIO-GBG/`.
Cuando se pushea a `main`, el workflow publica el build en Pages.
