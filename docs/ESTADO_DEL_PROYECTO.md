# Estado del Proyecto — Incubadora de Huevos con ESP32

**Última actualización:** 13 de noviembre de 2026
**Estado general:** Ciclo activo — sistema en producción con ciclo de incubación iniciado el 12/11/2026.

---

## ✅ Funcionalidades Implementadas

| Área | Estado | Detalle |
|------|--------|---------|
| 🔐 Login con JWT | ✅ Completo | `backend/index.js`, `Login.vue`. Tokens con expiración 24h. |
| 👥 Roles ADMIN / CLIENTE | ✅ Completo | Middleware en API y guardias de Vue Router. |
| 👤 Crear / Editar / Eliminar usuario | ✅ Completo | Modal de edición con nombre, email, rol y contraseña opcional. |
| 📡 Indicador ESP32 Online/Offline | ✅ Completo | Punto verde animado en navbar; ≤3 min = online. |
| 📥 Sincronización ThingSpeak | ✅ Completo | Worker cada 60s, `results=10`, `INSERT IGNORE`. Sin pérdida de lecturas. |
| 🕐 Zona horaria Ecuador | ✅ Completo | mysql2 con `timezone:'Z'`; API devuelve ISO con `Z`; Dashboard muestra `America/Guayaquil`. |
| 🌡️ Lectura en vivo (Temp/Humedad) | ✅ Completo | Polling del frontend cada 60s con hora Ecuador. |
| 📈 Gráficas históricas | ✅ Completo | Chart.js, líneas de temperatura y humedad. |
| 📋 Tabla paginada de lecturas | ✅ Completo | API paginada (`?page&limit`), 20 registros por página. |
| 🚨 Alarmas de rango (frontend) | ✅ Completo | Visual (ring rojo animado) + sonora (audio loop). Botón silenciar. |
| 🗃️ Registro de alertas en servidor | ✅ Completo | Tabla `alert_events`: variable, tipo, valor extremo, umbral, inicio, fin, duración. Funciona sin navegador abierto. |
| 📲 Notificaciones Telegram | ✅ Completo | Mensaje al abrir y cerrar cada evento. `telegram_sent_at` guardado en DB. Configurado vía `.env`. |
| 📤 Exportar CSV | ✅ Completo | `GET /api/export/readings.csv` y `/alerts.csv` (ADMIN). Filtros `?desde=&hasta=` en hora Ecuador. Botones en Dashboard. |
| 🐣 Historial de alertas en Dashboard | ✅ Completo | Tabla solo para ADMIN. Filas rojas para alertas activas. Se refresca cada 60s. |
| 📦 Backfill histórico | ✅ Completo | `backend/backfill.js`: carga todo el historial del canal desde el 12/11/2026 con paginación. |
| 🐔 Guías de incubación | ✅ Completo | Gallina (21d), Codorniz (17d), Ganso (30d), Pavo (28d), Pato (28d). |
| 🔄 Control de ciclo | ✅ Completo | Iniciar/Detener por tipo de ave. Contador de días en Dashboard. |
| ⚙️ Config. de umbrales | ✅ Completo | Temp min/max, Humedad min/max desde panel Admin. |
| 🧹 Limpieza de repositorio | ✅ Completo | Eliminadas carpetas `spec/`, `skills/` y `HelloWorld.vue` de otro proyecto. |
| 🎨 UI/UX Moderna | ✅ Completo | Tailwind CSS, paleta institucional azul-celeste, cards, modales con backdrop-blur. |

---

## ⚠️ Brechas Pendientes

| Prioridad | Hallazgo | Impacto | Acción recomendada |
|-----------|----------|---------|-------------------|
| Alta | JWT secret y claves ThingSpeak/MySQL están en el código fuente (tarea 2.1 pendiente). | Riesgo de exposición si el repo es público. | Mover a `.env` y agregar a `.gitignore`. Hacer privado el repositorio. |
| Alta | CORS abierto (`app.use(cors())`). | Cualquier origen puede llamar la API. | Restringir a `http://localhost:8080`. |
| Media | Sin pruebas automatizadas. | Regresiones al modificar el código. | Añadir pruebas con Jest/Vitest. |
| Media | Umbrales no dependen de la fase del ciclo (tarea 1.4 pendiente). | Los valores son iguales para días 1-17 y 18-21. | Implementar umbrales por fase con decisión de la tutora. |

---

## 🏁 Hitos Completados

- [x] Arquitectura cliente-servidor funcional (Vue 3 + Node.js + MySQL)
- [x] Integración con ThingSpeak (sincronización automática sin pérdida de lecturas)
- [x] Sistema de autenticación y autorización por roles
- [x] CRUD completo de usuarios (con edición en modal)
- [x] Dashboard en tiempo real con alertas visuales y sonoras
- [x] Zona horaria Ecuador (`America/Guayaquil`) en toda la cadena
- [x] Registro de eventos de alerta en servidor (sin dependencia del navegador)
- [x] Notificaciones Telegram al teléfono al abrir y cerrar alertas
- [x] Exportación de lecturas y alertas a CSV con filtros de fecha
- [x] Backfill del historial completo desde el inicio del ciclo
- [x] Guías de incubación por tipo de ave con tabla diaria
- [x] Control de ciclo de incubación con contador de días
- [x] Indicador de conexión del ESP32 en tiempo real
- [x] Firmware ESP32 con WiFiManager en repositorio
- [x] Limpieza: eliminados archivos de otro proyecto (spec/, skills/, HelloWorld.vue)
- [x] Diseño UI/UX moderno con Tailwind CSS
- [x] Repositorio en GitHub (cristiantf/IncubadoraV2)

---

## 🎯 Próximos Pasos Recomendados

1. **Variables de entorno (tarea 2.1):** mover JWT secret, claves ThingSpeak y MySQL a `.env`; hacer privado el repositorio.
2. **Umbrales por fase (tarea 1.4):** definir valores con la tutora para días 1–17 y días 18–21.
3. **Pruebas automatizadas:** cubrir endpoints de autenticación y lecturas con Jest.
4. **Exportar CSV al fin del ciclo:** usar `GET /api/export/readings.csv` y `/alerts.csv` para los datos del artículo.
