# SPEC 03 — Cuatro power pellets y fantasmas comestibles durante 15 segundos

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-13
> **Objetivo:** Añadir cuatro power pellets en las cuatro esquinas del laberinto: al comerlos, Pacman entra en modo "asustado" durante 15 segundos (~900 frames) durante los cuales puede comer a los fantasmas; estos, al ser comidos, vuelven a la pen y salen de inmediato.

## Scope

**In:**

- Cuatro power pellets colocados en las cuatro esquinas: `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)`. Estos sustituyen los dots existentes en esas celdas por power pellets (nuevo tipo de celda `4`).
- Al comer un power pellet (`4`), se activa el modo asustado durante 15 segundos (~900 frames). Si se come otro power pellet mientras ya está activo, el temporizador se reinicia a 15 segundos.
- Durante el modo asustado, los fantasmas se mueven huyendo de Pacman (maximizando distancia Manhattan a la celda de Pacman), ignorando su `kind` temporalmente. No permiten giro de 180° salvo callejón sin salida.
- Durante el modo asustado, los fantasmas se dibujan en azul (`#2121ff`) con ojos blancos. En los últimos ~2 segundos (120 frames) antes de que termine, parpadean entre azul y blanco para avisar.
- Al comer un fantasma mientras está asustado: se suma 200 puntos (fijo), el fantasma vuelve a la pen (`mode: 'pen'`), se resetea a sus posiciones iniciales de `GHOST_STARTS`, se pone `dir: 'up'`, `wp: 0` y sale **de inmediato** (su `releaseAt` se ajusta para que `game.frame >= releaseAt` sea cierto al volver a la pen).
- El temporizador de poder se muestra en el HUD (segundos restantes, redondeados hacia abajo).
- El modo asustado se cancela al perder una vida.
- Los power pellets cuentan para la condición de victoria (`dotsRemaining`): ganar exige comerse todos los dots normales (`2`) y todos los power pellets (`4`).

**Fuera de alcance (para futuras specs):**

- Secuencia de puntuación doble (200/400/800/1600) al comer varios fantasmas en la misma ventana de poder.
- Fantasmas con "ojos" que recorren un camino de vuelta a la pen antes de reaparecer (se usa el mecanismo de pen existente).
- Scatter/chase alternados.
- Velocidades distintas por fantasma o durante modo asustado.
- Reaparición de power pellets al perder una vida (no reaparecen).
- Nuevas casillas o cambios de geometría del laberinto distintos a convertir esas 4 celdas en power pellets.

## Data model

**maze.js:**

- Se añade un nuevo tipo de celda para power pellet: valor numérico `4`. 
- En `MAZE`, las celdas `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)` pasan de `2` (dot) a `4` (power pellet).

**game.js — estado de partida:**

```js
// Estado añadido a game
game.powerTimer = 0; // frames restantes de modo asustado. 0 = inactivo
```

**render.js:**

```js
const POWER_PELLET_COLOR = '#ffb897';
const SCARED_COLOR = '#2121ff';
const SCARED_BLINK_COLOR = '#ffffff';
```

## Implementation plan

1. **maze.js — colocar power pellets.** Cambiar las celdas `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)` de `2` a `4` en `MAZE`. Verificación: se ven 4 pellets más grandes en las esquinas.
2. **game.js — contar power pellets para victoria.** En `createGame()`, contar también las celdas con valor `4` para `dotsRemaining`. Verificación: ganar exige comerse los 4 power pellets.
3. **game.js — estado de poder.** Añadir `game.powerTimer = 0` en `createGame()`. En `resetPositions(game)`, poner `game.powerTimer = 0`. En `update(game)`, decrementar `game.powerTimer = Math.max(0, game.powerTimer-1)` cada frame. Verificación: al comer pellet el timer baja hasta 0.
4. **game.js — comer power pellet.** En `movePacman`, cuando `grid[p.y][p.x] === 4`, poner `grid[p.y][p.x] = 0`, activar `game.powerTimer = 900`. Si ya estaba activo, reiniciarlo a 900. Verificación: comer pellet activa poder y lo elimina.
5. **game.js — movimiento de fantasmas asustados (huida).** En `decideGhost(game,g)`, si `game.powerTimer > 0`, elegir entre `choices` (sin giro de 180 salvo callejón) la dirección que **maximiza** distancia Manhattan a `Math.round(p.x), Math.round(p.y)`. Ignorar `kind`. Verificación: huyen de Pacman.
6. **game.js — comer fantasma asustado.** En `update(game)`, si hay colisión y `game.powerTimer > 0`: sumar 200 puntos, enviar fantasma a pen (`mode='pen'`, volver a posición de `GHOST_STARTS[i]`, `dir='up'`, `wp=0`, `releaseAt = game.frame`), no decrementar vidas ni resetear posiciones globales. Si `game.powerTimer <= 0`, comportamiento actual. Verificación: se pueden comer fantasmas y reaparecen inmediatamente.
7. **render.js — dibujado power pellet, fantasmas asustados y HUD.** Dibujar power pellets como círculo de radio ~6px en celdas `4`. Para fantasmas, si `game.powerTimer > 0`, usar color azul base; si `game.powerTimer <= 120`, parpadear entre azul y blanco cada ~8 frames. Mantener ojos blancos. Añadir HUD con `POWER ${Math.floor(game.powerTimer/60)}`. Verificación: aspecto correcto y HUD muestra segundos.
8. **Integración.** Verificar victoria requiere 4 pellets; perder vida cancela poder; túnel y puerta unidireccional intactos; salida escalonada sigue funcionando.

## Acceptance criteria

- [ ] La consola no muestra errores al cargar ni al jugar.
- [ ] Se dibujan 4 power pellets en `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)`.
- [ ] Al comer un power pellet, `game.powerTimer` pasa a 900 frames y el pellet desaparece.
- [ ] Si se come otro power pellet con poder activo, `game.powerTimer` se reinicia a 900.
- [ ] Durante poder activo, fantasmas huyen de Pacman (maximizan distancia Manhattan). Se ignora su `kind`.
- [ ] Fantasmas asustados se dibujan en azul con ojos blancos; con `powerTimer <= 120` parpadean entre azul y blanco.
- [ ] HUD muestra `POWER N` con segundos restantes (truncados hacia abajo).
- [ ] Al comer un fantasma asustado: +200 puntos, fantasma vuelve a pen y sale de inmediato (`releaseAt = game.frame`). No se pierden vidas.
- [ ] Perder una vida pone `game.powerTimer = 0` y resetea todo correctamente.
- [ ] `dotsRemaining` cuenta power pellets: ganar exige comerse también los 4.
- [ ] No reaparecen power pellets tras perder vida.
- [ ] Puerta unidireccional para fantasmas se mantiene intacta.
- [ ] Salida escalonada desde pen (SPEC 02) sigue funcionando para fantasmas no comidos.

## Decisions

- **Sí:** Nuevo tipo de celda `4` para power pellet. Coherente con valores existentes (1 muro, 2 dot, 3 puerta, 0 vacío).
- **Sí:** Temporizador global `game.powerTimer`. Permite reiniciar al comer otro pellet.
- **Sí:** Fantasma asustado se detecta por `game.powerTimer > 0`. Evita estado duplicado.
- **Sí:** Huida = maximizar distancia Manhattan a Pacman (greedy entre direcciones válidas, sin giro de 180 salvo callejón).
- **Sí:** Al ser comido, volver a pen y `releaseAt = game.frame` para salida inmediata. Reutiliza lógica existente.
- **Sí:** Fantasma comido no pasa por "ojos recorriendo laberinto". Fuera de alcance.
- **Sí:** Puntuación fija 200 (descartada secuencia doble).
- **Sí:** Parpadeo en últimos 120 frames (~2s).
- **Sí:** HUD muestra segundos restantes.
- **Sí:** Poder se cancela al perder vida.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Colisión fantasma-asustado puede detectarse varias veces | Al enviar a pen deja de colisionar en misma posición. |
| `releaseAt = game.frame` hace salida inmediata (posible solapamiento) | Aceptado por decisión de usuario. |
| Parpadeo depende de `frame` global | Usar `frame` pasado a `draw` o `game.frame` de forma coherente. |
| Contar `4` como dot para victoria | Explícito en spec. |
| Durante huida se ignora `kind` (no usa BFS/patrullero) | Correcto según decisión. |

## Lo que **no** entra en esta spec

- Puntuación progresiva 200/400/800/1600.
- Fantasmas con ojos que vuelven a la pen recorriendo camino.
- Modo scatter/chase.
- Velocidades distintas por fantasma o durante modo asustado.
- Reaparición de power pellets al perder vida.
- Nuevos ítems, niveles o high-scores.
- Cambios en geometría del laberinto más allá de convertir las 4 esquinas en power pellets.
- Rediseño visual general distinto al indicado.
