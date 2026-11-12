# Plan de correcciones — Incubadora ESP32

**Contexto:** el ciclo de incubación empezó el 12/11/2026 y tiene huevos dentro. Cada cambio debe hacerse sin apagar la incubadora. ThingSpeak sigue guardando los datos aunque el backend se reinicie, así que reiniciar el servidor no hace perder lecturas.

Cada tarea trae un **prompt listo para pegar en Claude Code** (terminal o extensión en Antigravity). Hagan una tarea a la vez y prueben antes de pasar a la siguiente.

---

## Fase 0 — Antes de tocar nada (10 min)

1. Crear una rama de trabajo: `git checkout -b correcciones-articulo`
2. Respaldar la base: `C:\xampp\mysql\bin\mysqldump.exe -u root encubadora_db > respaldo_12nov.sql`
3. En ThingSpeak → canal → *Data Import / Export* → **Export recent data** → guardar el CSV de hoy.

---

## Fase 1 — Hoy (afecta los datos del artículo)

### 1.1 Sensor: ubicación y cambio a DHT22 (hardware + firmware)

- Mover el sensor a la altura de los huevos, lejos de la resistencia que calienta.
- Cambiar el DHT11 por un DHT22 (mismo pin GPIO 27). Volver a cargar el firmware toma pocos minutos; anotar en la bitácora la hora del cambio.
- Poner un termohigrómetro de referencia dentro de la incubadora y anotar 3 veces al día: hora, valor del sistema y valor de referencia.

```text
En codigoesp32.ino cambia el sensor de DHT11 a DHT22 (mismo pin 27). Actualiza el nombre del punto de acceso
de WiFiManager para que no diga DHT11 y actualiza README.md y docs/ARQUITECTURA.md donde diga DHT11.
No cambies nada más del firmware. Muéstrame el diff antes de guardar.
```

### 1.2 No perder lecturas (worker de ThingSpeak)

Hoy el servidor pide solo la última lectura cada 60 s y el ESP32 envía cada 20 s: se pierden unas 2 de cada 3.

```text
En backend/index.js, la función fetchThingSpeakData pide results=1 cada 60 s, pero el ESP32 envía cada 20 s,
así que se pierden lecturas. Cámbiala para que pida results=10 y recorra todos los feeds insertándolos con
INSERT IGNORE (la columna timestamp ya es UNIQUE). Agrega un script backend/backfill.js que se ejecute una sola
vez con "node backfill.js" y cargue todo el historial del canal desde el 12/11/2026 (usa el parámetro start de la
API de ThingSpeak). Explícame cómo probarlo.
```

### 1.3 Horas correctas (zona horaria)

El historial muestra la hora UTC (15:49 cuando en Ecuador eran las 10:49).

```text
Las lecturas se guardan en MySQL con la hora UTC de ThingSpeak, pero el historial del Dashboard muestra 15:49
cuando en Ecuador eran las 10:49. Revisa backend/db.js, backend/index.js y Dashboard.vue y corrige la cadena de
fechas para que: (1) en la base se guarde UTC de forma explícita (mysql2 con timezone 'Z'), (2) la API devuelva
ISO con Z, y (3) la interfaz muestre America/Guayaquil. Revisa también el contador de días del ciclo (start_date),
que usa la misma lógica. No borres datos existentes. Dame una prueba para verificar con la lectura más reciente.
```

### 1.4 Umbrales de alarma coherentes con la guía

Ahora están en 35,5–38,9 °C y 20–70 %, así que las alertas nunca se disparan. Decidir los valores con la tutora, escribirlos aquí y no cambiarlos durante el ciclo:

| Fase | Temperatura | Humedad |
|---|---|---|
| Días 1–17 | `[__–__]` °C (guía: 37,5–38) | `[__–__]` % (guía: 55–60) |
| Días 18–21 | `[__–__]` °C | `[__–__]` % (sube para la eclosión) |

```text
Quiero que los umbrales de alarma dependan de la fase del ciclo de gallina: días 1–17 y días 18–21, con valores
configurables desde el Panel Admin. Modifica la tabla settings (con un archivo SQL de migración nuevo, sin borrar
datos), el backend y el panel de configuración. El Dashboard debe usar el umbral de la fase actual según
start_date. Mantén el comportamiento de las otras aves usando los umbrales generales.
```

### 1.5 Registro de alertas en el servidor (datos para la Tabla 5)

Hoy la alerta solo existe si el navegador está abierto y no queda registrada. Para el artículo hace falta contar alertas y medir su duración.

```text
Crea en el backend un registro de eventos de alerta: una tabla alert_events (id, variable 'temperatura'|'humedad',
tipo 'bajo'|'alto', valor_extremo, umbral, inicio, fin, duracion_segundos) con su archivo SQL de migración.
Cada vez que el worker inserte una lectura, debe comparar con los umbrales vigentes: si sale del rango abre un
evento; si vuelve al rango lo cierra. Esto debe funcionar aunque nadie tenga el Dashboard abierto.
Agrega GET /api/alerts (solo ADMIN) y una tabla "Historial de alertas" en el Dashboard.
```

### 1.6 Exportar datos a CSV

```text
Agrega dos endpoints solo para ADMIN: GET /api/export/readings.csv y GET /api/export/alerts.csv, con filtros
opcionales ?desde=&hasta= y fechas en hora de Ecuador. Agrega un botón "Exportar CSV" en el Dashboard para cada uno.
```

---

## Fase 2 — Esta semana (seguridad del repositorio)

### 2.1 Claves fuera del código

Primero, a mano: en ThingSpeak → *API Keys* → **Generate New Write API Key** (la actual es pública en GitHub). Cambiar también la contraseña del administrador desde el panel.

```text
Saca los secretos del código: en backend usa un archivo .env (JWT_SECRET, THINGSPEAK_CHANNEL_ID,
THINGSPEAK_READ_KEY, credenciales MySQL) leído con dotenv, y crea .env.example sin valores reales.
En el firmware mueve la Write API Key a un archivo secrets.h y crea secrets.example.h.
Agrega .env, secrets.h y la carpeta encubadora_db/ al .gitignore y quita encubadora_db/ del repositorio con
git rm --cached. Restringe CORS a http://localhost:8080. Explícame qué debo hacer yo a mano después.
```

> Las claves viejas siguen en el historial de Git; por eso lo importante es **generar claves nuevas**. Si pueden, hagan privado el repositorio.

### 2.2 Limpieza de archivos de otro proyecto

```text
Las carpetas spec/ y skills/ y el componente HelloWorld.vue son de otro proyecto (hablan de rector, vicerrector,
avisos) y no corresponden a la incubadora. Confírmame que no se usan en ninguna parte del código y elimínalos.
```

### 2.3 Documentación al día

```text
Actualiza README.md, docs/ARQUITECTURA.md y docs/ESTADO_DEL_PROYECTO.md con los cambios hechos: sensor DHT22,
umbrales por fase, registro de alertas, exportación CSV, variables de entorno y zona horaria.
```

---

## Fase 3 — Opcional (solo si sobra tiempo; no tocar cerca del día 18)

### 3.1 Notificación al teléfono por Telegram

Haría más sólida la idea de «alerta temprana», porque hoy solo se ve en el navegador de la computadora.

```text
Agrega notificaciones por Telegram desde el backend: cuando se abra o se cierre un evento en alert_events, envía
un mensaje a un chat configurado en .env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID). Guarda en alert_events la hora de
envío de la notificación. Explícame cómo crear el bot con BotFather.
```

---

## Registro manual durante el ciclo (bitácora)

| Qué | Cuándo |
|---|---|
| Valores del sistema y del termohigrómetro de referencia | 3 veces al día |
| Ovoscopia: huevos fértiles, claros y con embrión muerto | Días 7 y 14 |
| Cambios de umbrales, de sensor o reinicios del sistema | Cada vez que ocurran |
| Simulación de falla (abrir la tapa X minutos) y tiempo hasta la alerta, con cronómetro | 3–5 veces, en días distintos |
| Huevos eclosionados | Días 21–22 |

## Al terminar el ciclo

1. Exportar `readings.csv` y `alerts.csv` desde el sistema y el CSV completo de ThingSpeak.
2. Respaldar la base con `mysqldump`.
3. Tomar las capturas del panel para las figuras del artículo, con los umbrales definitivos visibles y sin correos de usuarios.
