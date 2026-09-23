-- Crear base de datos (ejecutar previamente si es necesario: CREATE DATABASE neon_siege_db;)

-- 1. Tabla de partidas / puntuaciones
CREATE TABLE IF NOT EXISTS game_scores (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(30) NOT NULL,
    score BIGINT NOT NULL CHECK (score >= 0),
    wave_reached INT NOT NULL CHECK (wave_reached >= 1),
    time_survived_seconds INT NOT NULL CHECK (time_survived_seconds >= 0),
    enemies_killed INT NOT NULL DEFAULT 0,
    bosses_defeated INT NOT NULL DEFAULT 0,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar la consulta del Top 10 en tiempo real
CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON game_scores (score DESC, time_survived_seconds DESC);

-- Datos semilla para pruebas
INSERT INTO game_scores (player_name, score, wave_reached, time_survived_seconds, enemies_killed, bosses_defeated)
VALUES 
('CyberPilot', 14200, 11, 280, 160, 2),
('NeonStalker', 9850, 8, 195, 102, 1),
('Aram', 18900, 14, 360, 215, 2);