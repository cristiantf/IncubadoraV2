# Arquitectura Técnica — Incubadora ESP32

**Última actualización:** 13 de noviembre de 2026

## Propósito y Alcance

El sistema permite a usuarios autenticados consultar en tiempo real la temperatura y humedad de una incubadora, revisar el historial con gráficas, recibir alertas visuales, sonoras y por Telegram, y consultar guías de incubación por tipo de ave. Un administrador gestiona usuarios, configura umbrales de alarma, controla el ciclo de incubación y exporta datos a CSV.

El origen de telemetría es un **ESP32 con sensor DHT11** que publica lecturas en **ThingSpeak** cada 20 segundos. El firmware (`codigoesp32.ino`) está versionado en la raíz del repositorio.

---

## Diagrama de Componentes

```mermaid
flowchart LR
  ESP["ESP32 + DHT11 (GPIO 27)\nLEDs: Verde OK / Rojo Error\nWiFiManager"] -->|HTTPS cada 20s| TS["ThingSpeak\nCanal 3442278\nfield1=Temp, field2=Hum"]
  TS -->|feeds.json?results=10 cada 60s| API["API Express\nlocalhost:3001\nWorker + Alert Engine + REST"]
  API -->|SQL| DB[("MySQL\nencubadora_db\nreadings · alert_events\nsettings · users")]
  API -->|Bot API| TG["Telegram\nNotificación al teléfono"]
  FE["Vue 3 SPA\nlocalhost:8080"] -->|HTTP + Bearer JWT| API
  U["👤 Usuario / Administrador"] --> FE
```

---

## Capas del Sistema

| Capa | Tecnología | Responsabilidad |
|------|-----------|----------------|
| **Hardware / Firmware** | ESP32, DHT11, WiFiManager, ThingSpeak lib | Lectura de sensor, conexión Wi-Fi y publicación de telemetría |
| **Integración externa** | ThingSpeak (Canal 3442278) | Recibe y expone temperatura (`field1`) y humedad (`field2`) |
| **Ingesta (Worker)** | Node.js `setInterval` + Axios | Consulta ThingSpeak cada 60s con `results=10`; inserta con `INSERT IGNORE` |
| **Motor de alertas** | Node.js (en worker) | Por cada lectura nueva evalúa umbrales; abre/cierra eventos en `alert_events` |
| **Notificaciones** | Telegram Bot API + dotenv | Envía mensaje HTML al abrir o cerrar un evento; guarda `telegram_sent_at` |
| **API REST** | Express, jsonwebtoken, bcrypt | Autenticación, autorización por rol, CRUD usuarios, settings, lecturas, alertas, CSV |
| **Base de datos** | MySQL con `mysql2/promise` (`timezone:'Z'`) | Persiste usuarios, configuración, lecturas y eventos de alerta en UTC |
| **Interfaz web** | Vue 3, Vue Router, Axios, Chart.js, Tailwind CSS | Dashboard, alertas, historial de alertas, exportación CSV |

---

## Flujo de Telemetría y Alertas

```mermaid
sequenceDiagram
  participant ESP as ESP32 + DHT11
  participant TS as ThingSpeak
  participant W as Worker (Node.js)
  participant DB as MySQL
  participant TG as Telegram
  participant FE as Frontend Vue

  loop cada 20 segundos
    ESP->>TS: HTTP GET (temp + hum)
  end

  loop cada 60 segundos
    W->>TS: GET feeds.json?results=10
    TS-->>W: hasta 10 feeds (field1, field2, created_at)
    loop por cada feed nuevo
      W->>DB: INSERT IGNORE INTO readings
      W->>DB: SELECT alert_events abierto (variable)
      alt fuera de rango y sin evento abierto
        W->>DB: INSERT alert_events (inicio)
        W->>TG: sendMessage — ALERTA ABIERTA
        W->>DB: UPDATE telegram_sent_at
      else volvió al rango y hay evento abierto
        W->>TG: sendMessage — ALERTA CERRADA
        W->>DB: UPDATE alert_events (fin, duracion, telegram_sent_at)
      end
    end
  end

  FE->>W: GET /api/readings/latest (JWT)
  W-->>FE: temperatura, humedad, timestamp (ISO UTC con Z)
  FE->>FE: toEcuadorTime() → muestra en America/Guayaquil
```

---

## Zona Horaria

| Capa | Comportamiento |
|------|---------------|
| ThingSpeak | Publica timestamps en ISO 8601 UTC (ej. `2026-11-12T15:49:00Z`) |
| Worker | Convierte a MySQL DATETIME sin zona: `2026-11-12 15:49:00` (UTC) |
| mysql2 | `timezone: 'Z'` → lee DATETIME como UTC y devuelve `Date` UTC |
| API REST | `res.json()` serializa `Date` → ISO con `Z` (ej. `"2026-11-12T15:49:00.000Z"`) |
| Frontend | `toEcuadorTime()` con `timeZone: 'America/Guayaquil'` → muestra `10:49` |

---

## Modelo de Datos

```mermaid
erDiagram
  USERS {
    int id PK
    varchar nombre
    varchar email UK
    varchar password
    enum role "ADMIN|CLIENTE"
    timestamp created_at
  }
  SETTINGS {
    int id PK
    decimal temp_min
    decimal temp_max
    decimal hum_min
    decimal hum_max
    datetime start_date "NULL si no hay ciclo"
    varchar bird_type "gallina|codorniz|ganso|pavo|pato"
  }
  READINGS {
    int id PK
    decimal temperatura
    decimal humedad
    datetime timestamp UK
    timestamp created_at
  }
  ALERT_EVENTS {
    int id PK
    enum variable "temperatura|humedad"
    enum tipo "bajo|alto"
    decimal valor_extremo
    decimal umbral
    datetime inicio
    datetime fin "NULL = evento abierto"
    int duracion_segundos "NULL = evento abierto"
    datetime telegram_sent_at "NULL si no se envió"
  }
```

> `settings` usa una única fila (`id = 1`). `alert_events` registra cada período fuera de rango; `fin = NULL` indica alerta activa.

---

## API REST Completa

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/login` | ❌ Pública | Valida credenciales → emite JWT 24h |
| `GET` | `/api/users` | ADMIN | Lista todos los usuarios |
| `POST` | `/api/users` | ADMIN | Crea usuario con contraseña hasheada (bcrypt) |
| `PUT` | `/api/users/:id` | ADMIN | Edita nombre, email, rol y contraseña opcional |
| `DELETE` | `/api/users/:id` | ADMIN | Elimina usuario |
| `GET` | `/api/settings` | Autenticado | Obtiene umbrales de alarma y estado del ciclo |
| `POST` | `/api/settings` | ADMIN | Actualiza umbrales de temperatura y humedad |
| `POST` | `/api/settings/start` | ADMIN | Inicia ciclo → guarda `start_date` y `bird_type` |
| `POST` | `/api/settings/stop` | ADMIN | Finaliza ciclo → `start_date = NULL` |
| `GET` | `/api/readings` | Autenticado | Lista lecturas paginadas (`?page=1&limit=20`) |
| `GET` | `/api/readings/latest` | Autenticado | Retorna la lectura más reciente |
| `GET` | `/api/alerts` | ADMIN | Lista los últimos 200 eventos de alerta |
| `GET` | `/api/export/readings.csv` | ADMIN | Descarga lecturas en CSV (`?desde=&hasta=` hora Ecuador) |
| `GET` | `/api/export/alerts.csv` | ADMIN | Descarga alertas en CSV (`?desde=&hasta=` hora Ecuador) |

---

## Variables de Entorno

El backend lee `backend/.env` al iniciar (via `dotenv`). Copiar desde `backend/.env.example`:

| Variable | Descripción |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot generado por @BotFather |
| `TELEGRAM_CHAT_ID` | ID del chat al que se enviarán las notificaciones |

> Las credenciales MySQL y el JWT secret aún están en el código (pendiente tarea 2.1).

---

## Scripts Utilitarios

| Script | Uso | Descripción |
|--------|-----|-------------|
| `backend/backfill.js` | `node backfill.js` (una vez) | Carga todo el historial del canal ThingSpeak desde el 12/11/2026 |
| `backend/reset-admin.js` | `node reset-admin.js` | Resetea la contraseña del administrador |

---

## Despliegue Local

| Servicio | Comando | Puerto |
|---------|---------|--------|
| MySQL (XAMPP) | XAMPP Control Panel → Start MySQL | 3306 |
| Backend API | `node backend/index.js` | 3001 |
| Frontend | `npm run dev` (raíz) | 8080 |
| Inicio automático | `iniciar_sistema.bat` | — |

---

## Firmware ESP32

| Parámetro | Valor |
|-----------|-------|
| Archivo | `codigoesp32.ino` |
| Sensor | DHT11 en **GPIO 27** |
| LED Verde | GPIO 26 (envío exitoso) |
| LED Rojo | GPIO 25 (lectura / error) |
| Gestión Wi-Fi | WiFiManager (AP: `ESP32-Incubadora`, clave: `12345678`) |
| Canal ThingSpeak | `3442278` |
| Frecuencia de envío | Cada **20 segundos** |

---

## Decisiones Técnicas Pendientes

1. **Variables de entorno completas (tarea 2.1):** mover JWT secret, claves ThingSpeak y credenciales MySQL a `.env`.
2. **CORS:** restringir a `http://localhost:8080` (o dominio de producción).
3. **URL de API:** centralizar en variable `VITE_API_URL` en el frontend.
4. **Escalabilidad:** modelar entidades `Incubadora` y `Ciclo` para soportar más de una unidad.
