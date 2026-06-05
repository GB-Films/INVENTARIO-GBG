# Inventario GBG

App web para ordenar activos de Gran Berta Films: que hay, a quien pertenece, donde esta, quien lo tiene y que movimientos tuvo.

## Desarrollo local

```bash
npm ci
npm run dev
```

## Nube

Usa la nube de BANI VAULT en Firebase / Firestore. La app guarda un unico documento compartido del inventario, asi cualquier persona que abra el link ve la ultima version actualizada.

Usuarios:

- `admin` / `admin`: acceso completo.
- `crew` / `crew`: consulta y registro de movimientos.

## Deploy

El proyecto esta preparado para GitHub Pages con base `/INVENTARIO-GBG/`.
Cuando se pushea a `main`, el workflow publica el build en Pages.
