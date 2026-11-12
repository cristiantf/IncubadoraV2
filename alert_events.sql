USE encubadora_db;

CREATE TABLE IF NOT EXISTS alert_events (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    variable         ENUM('temperatura', 'humedad') NOT NULL,
    tipo             ENUM('bajo', 'alto') NOT NULL,
    valor_extremo    DECIMAL(5,2) NOT NULL,
    umbral           DECIMAL(5,2) NOT NULL,
    inicio           DATETIME NOT NULL,
    fin              DATETIME NULL,
    duracion_segundos INT NULL,
    INDEX idx_variable_fin (variable, fin),
    INDEX idx_inicio (inicio)
);
