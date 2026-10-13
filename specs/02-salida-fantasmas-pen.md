# SPEC 02 — Salida limpia de los fantasmas de la pen

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-13
> **Objetivo:** Corregir la transición `exiting` → `active` para que, al liberarse, cada fantasma entre en la fila 11 del laberinto y arranque su estrategia sin atravesar muros ni quedar atascado.

## Scope

**In:**

- Corregir en `moveGhost` (`src/js/game.js`) la rama `mode === 'exiting'` para que **no** dé el paso extra hacia arriba después de pasar a `'active'`.
- Al alinear en la fila 11 (`y === 11`): alinear coordenadas, fijar `mode: 'active'`, elegir dirección con `decideGhost` y retornar sin mover.
- Mantener intactos: la espera escalonada (0/60/120/180 frames), la salida recta por la columna propia (13 o 14) y la puerta unidireccional.

**Fuera de alcance (para futuras specs):**

- Estrategias `hunter` / `ambusher` / `random` / `patroller` (ya definidas en SPEC 01).
- Puerta unidireccional, colisiones y `resetPositions` al perder una vida (funcionan hoy).
- Spawnear a los fantasmas ya fuera de la pen.
- Guardia genérica anti-tunelado de muros en todo el juego.
- Power pellets, scatter/chase, velocidades por fantasma.

## Data model

Esta spec **no introduce estructuras de datos nuevas**. Reutiliza el modelo de la SPEC 01:

- `game.ghosts[i].mode`: `'pen'` → `'exiting'` → `'active'`.
- `game.ghosts[i].dir`: dirección actual; durante `'exiting'` es siempre `'up'`.
- `game.ghosts[i].releaseAt` y `game.frame`: temporizadores de liberación ya existentes.
- `decideGhost( game, g )`: función existente que fija `g.dir` según `kind`.

Convenciones (sin cambios): la fila 11 (`y = 11`) es el primer pasillo transitable sobre la pen; la puerta está en `y = 12`, cols 13–14.

## Implementation plan

1. En `src/js/game.js`, rama `if ( g.mode === 'exiting' )` de `moveGhost`: en el bloque `if ( g.y <= 11 )`, alinear `g.x`/`g.y`, poner `g.mode = 'active'` y **retornar sin ejecutar el movimiento de abajo**. Verificación manual: un fantasma liberado queda en la fila 11 y nunca aparece en la fila 10 (muro).
2. En ese mismo bloque, antes del `return`, llamar `decideGhost( game, g )` para fijar la primera dirección. Verificación manual: al salir, cada fantasma arranca hacia su objetivo y no se queda detenido en `(x, 11)`.
3. Conservar sin cambios la rama `g.y > 11` (subir recto con `dir = 'up'` y `canMove`). Verificación manual: los fantasmas aún dentro de la pen siguen subiendo por su columna hasta la fila 11 y salen escalonados.

## Acceptance criteria

- [ ] La consola no muestra errores al cargar ni al jugar.
- [ ] Al liberarse, ningún fantasma ocupa una celda de muro (valor `1`) en ningún frame.
- [ ] Los 4 fantasmas alcanzan la fila 11 (`y = 11`) al salir y pasan a `mode: 'active'`.
- [ ] Al quedar activos, cada fantasma arranca su estrategia sin quedarse detenido en `(x, 11)`.
- [ ] Se mantiene la espera escalonada (~0/60/120/180 frames) y la salida recta por la puerta.
- [ ] Tras perder una vida, los fantasmas vuelven a la pen, se re-escalonan y vuelven a salir limpio.

## Decisions

- **Sí:** parche mínimo retornando antes del movimiento extra. Menor superficie de cambio y causa raíz directa.
- **Sí:** elegir la dirección inmediatamente al quedar activo. El fantasma se ve "suelto" apenas cruza la puerta.
- **Sí:** mantener la espera escalonada y la salida recta por columna propia (13/14). Ya funciona salvo la transición.
- **No:** rediseñar la salida con BFS/waypoint a una celda fija. Innecesario para el bug actual.
- **No:** guardia genérica anti-muro. Se deja para otra spec si se desea.
- **No:** cambiar las posiciones de inicio de `GHOST_STARTS`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `decideGhost` se ejecuta dos veces en `(x, 11)` (al liberar y al frame siguiente). | Impacto visual nulo; solo `random` podría cambiar de idea. Aceptable. |
| El fantasma queda un frame en `(x, 11)` al decidir y retornar. | Al frame siguiente ya avanza; inapreciable a ~60 fps. |
| Otros cruces de muro podrían existir en transiciones distintas. | Fuera de alcance; se documenta aquí. |

## Lo que **no** entra en esta spec

- Rediseño de las estrategias de movimiento de los fantasmas.
- Spawn fuera de la pen o eliminación de la espera escalonada.
- Guardia global anti-tunelado de muros.
- Power pellets, scatter/chase, velocidades por fantasma, niveles o high-scores.
