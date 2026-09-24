# Neon Siege — Especificación de Assets (Sprites y Recursos)

> Documento maestro para el equipo. Indica **dónde** va cada recurso, **cómo** se llama
> y **qué dimensiones** debe tener. Cualquier sprite que siga estas reglas encaja
> directamente con el motor (`src/config.js` + `src/systems/SpriteRender.js`).

---

## REGLAS GENERALES OBLIGATORIAS

1. **Formato:** PNG-32 con transparencia (canal alpha). Nunca JPG.
2. **Grilla uniforme:** todos los frames de un sheet miden exactamente lo mismo.
3. **Dimensiones enteras:** `frameW` y `frameH` deben ser enteros (evita decimales como 204.8 → causan saltos).
4. **Alineación:** el personaje va **centrado** en su celda y **sin cambiar de posición** entre frames (salvo el movimiento natural de la animación).
5. **Orientación base:** mirando a la **derecha** o **de frente**. El motor voltea con `flipX`; no entregar ya volteado.
6. **Sin sombras ni marcos horneados** dentro de las celdas.
7. **Anclaje (pivot):** por defecto abajo-centro (los pies al suelo). Configurable por asset.

---

## CÓMO RECORTAR PARA QUE NO SALTE (flujo del equipo)

1. En **Photoshop**, abrir el spritesheet de referencia.
2. Activar vista → **Cuadrícula** con el tamaño de celda exacto (ej: 64×64 px).
3. Recortar cada frame **al tamaño exacto** y exportarlo como PNG.
4. Nombrar los frames en orden:  `walk_1.png`, `walk_2.png`, `walk_3.png`, …
5. Empaquetar con la herramienta **`spritesheet.html`** (raíz de `frontend/`).
6. Exportar el sheet final a la carpeta correspondiente (abajo).

---

## 1. PERSONAJE PRINCIPAL — `ASSETS/CHARACTERS/`

Un sheet **por arma** (el estado visual depende del arma equipada).

| Archivo | Grilla | Frame | Tamaño total |
|---|---|---|---|
| `player_pistol.png`  | 6 col × 5 filas | 64 × 64 | 384 × 320 |
| `player_shotgun.png` | 6 col × 5 filas | 64 × 64 | 384 × 320 |
| `player_plasma.png`  | 6 col × 5 filas | 64 × 64 | 384 × 320 |

**Mapa de filas (idéntico en los 3 sheets):**

| Fila | Animación | Frames | Descripción |
|---|---|---|---|
| 0 | `idle`   | 4 | reposo / respiración |
| 1 | `walk`   | 6 | movimiento |
| 2 | `attack` | 3 | disparo |
| 3 | `hurt`   | 2 | recepción de daño |
| 4 | `die`    | 5 | muerte |

---

## 2. ENEMIGOS — `ASSETS/ENEMIES/`

| Archivo | Grilla | Frame | Tamaño total | Animaciones |
|---|---|---|---|---|
| `hunter.png`   | 4 col × 2 filas | 64 × 64 | 256 × 128 | `walk`(4), `attack`(3) |
| `ranger.png`   | 4 col × 2 filas | 64 × 64 | 256 × 128 | `walk`(4), `attack`(2) |
| `swarm.png`    | 4 col × 1 fila  | 48 × 48 | 192 × 48  | `walk`(4) |
| `tank.png`     | 4 col × 2 filas | 96 × 96 | 384 × 192 | `walk`(4), `attack`(3) |
| `kamikaze.png` | 4 col × 1 fila  | 48 × 48 | 192 × 48  | `walk`(4) |

**Mapa de filas:** fila 0 = `walk`, fila 1 = `attack` (si aplica).

---

## 3. JEFES — `ASSETS/BOSSES/`

| Archivo | Grilla | Frame | Tamaño total |
|---|---|---|---|
| `void_colossus.png` (GOLIATH) | 6 col × 5 filas | 128 × 128 | 768 × 640 |
| `void_tempest.png`  (TEMPEST) | 6 col × 5 filas | 128 × 128 | 768 × 640 |

**Mapa de filas (idéntico en los 2 jefes):**

| Fila | Animación | Frames |
|---|---|---|
| 0 | `idle`    | 4 |
| 1 | `walk`    | 6 |
| 2 | `attack`  | 4 |
| 3 | `special` | 4 |
| 4 | `die`     | 5 |

---

## 4. PROYECTILES — `ASSETS/PROJECTILES/`

| Archivo | Tamaño | Uso |
|---|---|---|
| `bullet_pistol.png`  | 16 × 16 | bala rápido (neón cian) |
| `bullet_shotgun.png` | 12 × 12 | perdigón (rosa) |
| `bullet_plasma.png`  | 24 × 12 | rayo energía (verde) |
| `bullet_enemy.png`   | 16 × 16 | proyectil enemigo (rojo/amarillo) |

> Opcional: si no se proveen, el motor usa partículas geométricas neón (ya implementado).

---

## 5. PICKUPS — `ASSETS/PICKUPS/`

| Archivo | Tamaño | Uso |
|---|---|---|
| `pickup_exp.png`        | 24 × 24 | gema de experiencia (morado) |
| `pickup_heal.png`       | 24 × 24 | botiquín (verde) |
| `pickup_ammo_shotgun.png` | 24 × 24 | munición escopeta (rosa) |
| `pickup_ammo_plasma.png`  | 24 × 24 | munición plasma (verde) |

---

## 6. EFECTOS — `ASSETS/FX/`

| Archivo | Grilla | Frame | Total | Uso |
|---|---|---|---|---|
| `explosion.png` | 6 col × 1 fila | 64 × 64 | 384 × 64 | explosiones (6 frames) |
| `impact.png`    | 4 col × 1 fila | 32 × 32 | 128 × 32 | impactos (4 frames) |

---

## 7. ENTORNO — `ASSETS/tiles/`

| Archivo | Tamaño | Uso |
|---|---|---|
| `floor_metal.png` | 64 × 64 | ✅ ya existe (tile suelo) |
| `wall_tech.png`   | 64 × 64 | pared tecnológica |
| `obstacle_box.png`| 64 × 64 | obstáculo / caja |

---

## 8. AUDIO — `ASSETS/AUDIO/`

**`AUDIO/BGM/`**
| Archivo | Uso |
|---|---|
| `arena_theme.mp3` | música de fondo de la arena |

**`AUDIO/SFX/`**
| Archivo | Uso |
|---|---|
| `shoot.wav`     | disparo |
| `dash.wav`      | habilidad especial |
| `hit.wav`       | recibir daño |
| `explosion.wav` | muerte de enemigo / explosión |
| `pickup.wav`    | recoger objeto (opcional) |
| `levelup.wav`   | subida de nivel (opcional) |

> Compatibles con el `AssetManager` actual. Si faltan, el juego corre sin audio.

---

## FUENTES RECOMENDADAS (licencias)

- **Kenney.nl** — CC0 (dominio público). Búsqueda: "top down shooter".
- **OpenGameArt.org** — filtrar "LPC" (grillas estrictas). CC-BY / CC0.
- **Freesound.org** — sonidos CC0.
- Recursos propios: indicar herramienta (Photoshop / Aseprite) en la documentación.
