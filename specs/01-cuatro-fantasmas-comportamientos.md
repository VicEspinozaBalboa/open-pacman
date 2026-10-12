# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Implementado
> **Depende de:** Ninguna
> **Fecha:** 2026-10-12
> **Objetivo:** Dotar al juego de cuatro fantasmas, cada uno con una estrategia de movimiento propia (cazador, emboscador, aleatorio y patrullero), que salen escalonados de la pen por una puerta de un solo sentido.

## Scope

**In:**

- Cuatro fantasmas definidos en `GHOST_STARTS` con un `kind` por fantasma: `hunter`, `ambusher`, `random`, `patroller`.
- Estrategias de movimiento, todas activas en todo momento (sin modos scatter/chase):
  - `hunter`: persigue a Pacman minimizando distancia Manhattan.
  - `ambusher`: apunta 4 celdas por delante de la dirección de Pacman.
  - `random`: elige al azar entre las direcciones válidas.
  - `patroller`: recorre en bucle una lista fija de waypoints.
- Salida escalonada de la pen por temporizador: retardos de 0, 60, 120 y 180 frames; el fantasma espera **quieto** en su celda hasta su turno.
- Puerta de la pen **unidireccional para fantasmas**: solo se cruza hacia arriba al salir, nunca hacia dentro una vez liberados.
- Color fijo por `kind` (rojo, cian, rosa, naranja).
- Contador de frames en el estado de la partida para los temporizadores.

**Fuera de alcance (para futuras specs):**

- Modo asustado / power pellets (no existen en el juego actual).
- Alternancia scatter/chase por temporizadores.
- Fantasmas comidos con ojos que vuelven a la pen y reaparecen (hoy una colisión reinicia posiciones).
- Aumento de dificultad por velocidad, niveles o high-scores.
- Cambios en el laberinto o en la forma/neumática de dibujar los fantasmas.

## Data model

```js
// maze.js — datos de la capa de laberinto
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter' },
  { x: 14, y: 14, kind: 'ambusher' },
  { x: 13, y: 13, kind: 'random' },
  { x: 14, y: 13, kind: 'patroller' },
];

// Retardos de liberación en frames (~60fps)
const GHOST_RELEASE_DELAYS = {
  hunter: 0,
  ambusher: 60,
  random: 120,
  patroller: 180,
};

// Ruta fija del patrullero (celdas transitables, en bucle)
const PATROL_WAYPOINTS = [
  { x: 1, y: 1 }, { x: 26, y: 1 },
  { x: 26, y: 29 }, { x: 1, y: 29 },
];
```

```js
// game.js — estado de la partida (cambios)
game.frame = 0; // se incrementa en cada update();

// cada fantasma en game.ghosts añade:
{
  x, y, dir, speed, kind,
  releaseAt: GHOST_RELEASE_DELAYS[ kind ], // frames que debe esperar
  mode: 'pen',   // 'pen' → espera · 'exiting' → sale · 'active' → estrategia
}

// render.js — color por personalidad
const GHOST_COLORS = {
  hunter: '#ff0000',
  ambusher: '#00ffff',
  random: '#ffb8ff',
  patroller: '#ffb852',
};
```

Convenciones:

- Coordenadas: celda `(x,y)`, origen arriba-izquierda, `x∈[0,27]`, `y∈[0,30]`.
- Un fantasma con `mode: 'pen'` no se mueve hasta que `game.frame >= releaseAt`.
- El objetivo del `ambusher` se recorta a `x∈[0,27]`, `y∈[0,30]`; si cae en muro, usa la celda de Pacman.

## Implementation plan

1. En `src/js/maze.js`, ampliar `GHOST_STARTS` a 4 entradas y añadir `GHOST_RELEASE_DELAYS` y `PATROL_WAYPOINTS` (añadir ambos a los globals `window`). El juego sigue arrancando con 4 fantasmas; los `kind` aún desconocidos caen en la rama `random` existente.
2. En `src/js/game.js`, añadir `game.frame` (incrementado en `update`) y, en `createGame`, los campos `releaseAt`/`mode` por fantasma. Actualizar `resetPositions` para devolver a los fantasmas a `mode: 'pen'` y reiniciar `game.frame = 0`. El juego sigue funcionando igual que antes.
3. En `src/js/game.js`, implementar los modos `'pen'` (quieto) y `'exiting'` (subir hasta salir por la puerta, `y <= 11`) dentro de `moveGhost`/`decideGhost`, y hacer la puerta (valor `3`) unidireccional para fantasmas en `canMove` (bloquear solo el cruce hacia abajo). Verificación manual: los fantasmas esperan y salen en orden sin reingresar.
4. En `src/js/game.js`, implementar las 4 estrategias en `decideGhost` según `kind` (`hunter`, `ambusher`, `random`, `patroller`), manteniendo la prohibición de giro de 180 salvo en callejón sin salida. Verificación manual: cada fantasma se comporta de forma reconociblemente distinta.
5. En `src/js/render.js`, sustituir `GHOST_COLORS` por un objeto indexado por `kind` y ajustar `draw` para dibujar con `GHOST_COLORS[ g.kind ]`. Verificación manual: 4 fantasmas con 4 colores fijos.

## Acceptance criteria

- [ ] La consola no muestra errores al cargar ni al jugar.
- [ ] Se dibujan 4 fantasmas, cada uno con un color distinto y estable.
- [ ] El `hunter` se mueve, en cada cruce, hacia Pacman por distancia Manhattan.
- [ ] El `ambusher` apunta a una celda situada 4 delante de la dirección de Pacman.
- [ ] El `random` elige siempre una dirección válida al azar.
- [ ] El `patroller` recorre los waypoints en bucle y vuelve al primero tras el último.
- [ ] Al inicio, los 4 fantasmas esperan en la pen y salen escalonados (~0/60/120/180 frames) sin apilarse.
- [ ] Ningún fantasma ya liberado vuelve a cruzar la puerta hacia dentro de la pen.
- [ ] Ningún fantasma se queda atascado dentro de la pen; todos llegan a salir.
- [ ] Tras perder una vida, los fantasmas vuelven a la pen y se re-escalonan.
- [ ] Pacman sigue bloqueado por la puerta (no puede entrar en la pen).

## Decisions

- **Sí:** cuatro personalidades simples (`hunter`/`ambusher`/`random`/`patroller`). Cubren la petición con datos y lógica mínimos.
- **Sí:** mantener `kind` como string en `GHOST_STARTS`; cambio mínimo y coherente con el contrato global actual (`maze.js` → `GHOST_STARTS`).
- **Sí:** siempre en comportamiento, sin scatter/chase. Evita temporizadores y estados globales extra.
- **Sí:** salida escalonada con el fantasma quieto (0/60/120/180 frames). Predecible y fácil de ajustar.
- **Sí:** puerta unidireccional para fantasmas. Evita que aleatorio/patrullero se encierren, como el arcade.
- **Sí:** color fijo por `kind`. Da identidad visual aunque cambie el orden del array.
- **Sí:** misma velocidad (`GHOST_SPEED`) para todos. La dificultad la marca la estrategia.
- **No:** modo asustado y power pellets. Requiere ítems y lógica de estados que van en otra spec.
- **No:** fantasmas comidos con ojos que regresan. Cambia el modelo de colisión actual; otra spec.
- **No:** waypoints del patrullero calculados en runtime. La lista fija es más simple y trazable.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El objetivo del `ambusher` cae fuera del mapa o sobre un muro. | Recortar a los límites de la rejilla y, si es muro, usar la celda de Pacman. |
| Un waypoint del patrullero cae en una celda no transitable. | Validar en la implementación que cada waypoint tenga valor `0` o `2` en `MAZE`. |
| Un fantasma se atasca al salir de la pen. | El interior conecta siempre con la puerta en cols 13/14; el modo `exiting` apunta a `(13 o 14, 11)` y se prueba manualmente. |
| El `hunter`/`patroller` oscila entre dos celdas del objetivo. | Las decisiones solo se toman en celdas alineadas y se prohíbe el giro de 180 salvo callejón sin salida. |
| `resetPositions` deja `game.frame` avanzado y los fantasmas salen al instante. | Reiniciar `game.frame = 0` y `mode = 'pen'` en cada pérdida de vida. |

## Lo que **no** entra en esta spec

- Power pellets / modo asustado y comer fantasmas.
- Fantasmas con ojos que vuelven a la pen y reaparecen.
- Alternancia scatter/chase por temporizador.
- Velocidades distintas por fantasma, niveles o high-scores.
- Cambios en el laberinto o rediseño visual de los fantasmas.
