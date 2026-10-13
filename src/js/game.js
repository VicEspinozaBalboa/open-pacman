// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    frame: 0,
    dotsRemaining: dots,
    powerTimer: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: GHOST_RELEASE_DELAYS[ g.kind ] || 0,
      mode: 'pen',
      wp: 0,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  // Puerta unidireccional: los fantasmas nunca cruzan hacia dentro (abajo).
  if ( actor === 'ghost' && dir === 'down' && grid[ ty ] && grid[ ty ][ tx ] === 3 ) {
    return false;
  }
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Primer paso del camino mas corto (BFS) desde start hasta target por celdas
// transitables para un fantasma. Devuelve la direccion inicial o null.
function bfsFirstDir( grid, start, target ) {
  const W = grid[ 0 ].length;
  const H = grid.length;
  const key = ( x, y ) => y * W + x;
  if ( start.x === target.x && start.y === target.y ) return null;

  const cameFrom = {};
  cameFrom[ key( start.x, start.y ) ] = null;
  const queue = [ { x: start.x, y: start.y } ];

  while ( queue.length ) {
    const cur = queue.shift();
    for ( const dir of Object.keys( DIRS ) ) {
      const d = DIRS[ dir ];
      let nx = cur.x + d.x;
      let ny = cur.y + d.y;
      // Envoltura del tunel.
      if ( ny === TUNNEL_ROW ) {
        if ( nx < 0 ) nx += W;
        else if ( nx >= W ) nx -= W;
      }
      if ( nx < 0 || nx >= W || ny < 0 || ny >= H ) continue;
      // Mismas reglas que canMove para fantasmas.
      if ( dir === 'down' && grid[ ny ][ nx ] === 3 ) continue;
      if ( isWall( grid, nx, ny, 'ghost' ) ) continue;
      const k = key( nx, ny );
      if ( k in cameFrom ) continue;
      cameFrom[ k ] = { from: cur, dir };
      if ( nx === target.x && ny === target.y ) {
        // Reconstruir el primer paso del camino.
        let node = { x: nx, y: ny };
        let meta = cameFrom[ k ];
        while ( !( meta.from.x === start.x && meta.from.y === start.y ) ) {
          node = meta.from;
          meta = cameFrom[ key( node.x, node.y ) ];
        }
        return meta.dir;
      }
      queue.push( { x: nx, y: ny } );
    }
  }
  return null;
}

// Elige, entre las direcciones validas, la que minimiza la distancia
// Manhattan desde la celda siguiente hasta el objetivo (tx,ty).
function chooseToward( choices, g, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - tx ) + Math.abs( g.y + d.y - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( g.kind === 'hunter' ) {
    // Persigue la celda actual de Pacman.
    g.dir = chooseToward( choices, g, Math.round( p.x ), Math.round( p.y ) );
  } else if ( g.kind === 'ambusher' ) {
    // Apunta a 4 celdas por delante de la direccion de Pacman.
    const pd = DIRS[ p.dir ] || { x: 0, y: 0 };
    let tx = Math.round( p.x ) + pd.x * 4;
    let ty = Math.round( p.y ) + pd.y * 4;
    tx = Math.max( 0, Math.min( grid[ 0 ].length - 1, tx ) );
    ty = Math.max( 0, Math.min( grid.length - 1, ty ) );
    // Si el objetivo cae en muro, usar la celda de Pacman.
    if ( isWall( grid, tx, ty, 'ghost' ) ) {
      tx = Math.round( p.x );
      ty = Math.round( p.y );
    }
    g.dir = chooseToward( choices, g, tx, ty );
  } else if ( g.kind === 'patroller' ) {
    // Recorre los waypoints en bucle; al llegar a uno, pasa al siguiente.
    let wp = PATROL_WAYPOINTS[ g.wp % PATROL_WAYPOINTS.length ];
    if ( g.x === wp.x && g.y === wp.y ) {
      g.wp = ( g.wp + 1 ) % PATROL_WAYPOINTS.length;
      wp = PATROL_WAYPOINTS[ g.wp ];
    }
    // Ruta real por el laberinto (el greedy se traba en minimos locales).
    const step = bfsFirstDir( grid, { x: g.x, y: g.y }, wp );
    g.dir = step || choices[ 0 ];
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // En la pen: espera quieto hasta su turno de liberacion.
  if ( g.mode === 'pen' ) {
    if ( game.frame >= g.releaseAt ) g.mode = 'exiting';
    else return;
  }

  // Saliendo: sube en linea recta hasta cruzar la puerta (y <= 11).
  if ( g.mode === 'exiting' ) {
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      if ( g.y <= 11 ) {
        g.mode = 'active';
        decideGhost( game, g );
        return;
      } else {
        g.dir = 'up';
        if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
      }
    }
    const de = DIRS[ g.dir ];
    g.x += de.x * g.speed;
    g.y += de.y * g.speed;
    wrapTunnel( g, width );
    return;
  }

  // Activo: estrategia segun kind.
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frame = 0;
  game.powerTimer = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.mode = 'pen';
    g.wp = 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;
  if ( game.powerTimer > 0 ) game.powerTimer--;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
