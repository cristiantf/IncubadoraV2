# 🥚 Incubadora de Huevos — Sistema de Monitoreo con ESP32

Sistema completo de monitoreo y control para incubadora de huevos, con hardware IoT, backend en Node.js y panel web en Vue 3.

[![Estado](https://img.shields.io/badge/Estado-Prototipo%20Funcional-blue)](./docs/ESTADO_DEL_PROYECTO.md)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](./backend)
[![Frontend](https://img.shields.io/badge/Frontend-Vue%203%20%2B%20Vite%20%2B%20Tailwind-purple)](./src)
[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%2B%20DHT11-orange)](./codigoesp32.ino)

---

## 📐 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  ESP32 + DHT11 (GPIO 27)                                    │
│  LEDs indicadores: Verde (OK) / Rojo (Error)                │
│  WiFiManager → ThingSpeak (Canal 3442278) cada 20s          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS API (ThingSpeak)
┌──────────────────────▼──────────────────────────────────────┐
│  Backend Node.js + Express  (localhost:3001)                 │
│  Worker: ThingSpeak → MySQL cada 60s (results=10)           │
│  Alert engine: evalúa umbrales por lectura                  │
│  API REST: Auth JWT, Usuarios, Settings, Readings, Alerts   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP Axios + Telegram Bot API
┌──────────────────────▼──────────────────────────────────────┐
│  Frontend Vue 3 + Vite + Tailwind CSS  (localhost:8080)      │
│  Dashboard, gráficas, historial alertas, exportar CSV        │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Funcionalidades Implementadas

| Módulo | Función |
|--------|---------|
| 🔐 **Autenticación** | Login con JWT, roles ADMIN / CLIENTE |
| 👥 **Gestión de Usuarios** | Crear, Editar (modal), Eliminar |
| 📡 **Estado del ESP32** | Indicador Online / Desconectado en tiempo real |
| 🌡️ **Lecturas en Vivo** | Temperatura y Humedad, zona horaria Ecuador |
| 📈 **Gráficas Históricas** | Chart.js con historial paginado |
| 🚨 **Alertas de Rango** | Visual + Sonora cuando T°/Hr salen del límite |
| 🗃️ **Registro de Alertas** | Tabla `alert_events` en servidor: inicio, fin, duración, valor extremo |
| 📲 **Notificaciones Telegram** | Mensaje al teléfono al abrir y cerrar cada alerta |
| 📥 **Sin pérdida de lecturas** | Worker pide 10 resultados por ciclo; `backfill.js` carga el historial completo |
| 📤 **Exportar CSV** | Lecturas y alertas con filtros de fecha, en hora Ecuador (solo ADMIN) |
| 🐔 **Guía de Incubación** | Tablas diarias por tipo de ave (Gallina, Codorniz, Ganso, Pavo, Pato) |
| 🔄 **Control de Ciclo** | Iniciar/Detener ciclo de incubación por ave |
| ⚙️ **Configuración de Alarmas** | Umbrales de temperatura y humedad configurables |

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Hardware | ESP32, Sensor DHT11, LEDs |
| Conectividad | WiFiManager, ThingSpeak API |
| Base de Datos | MySQL / MariaDB (via XAMPP) |
| Backend | Node.js 20+, Express, bcrypt, jsonwebtoken, axios, dotenv |
| Frontend | Vue 3, Vite, Tailwind CSS, Chart.js, Vue Router, Axios |
| Notificaciones | Telegram Bot API |

---

## 🚀 Inicio Rápido

### Requisitos
- [XAMPP](https://www.apachefriends.org/) con MySQL activo
- [Node.js 20+](https://nodejs.org/) y npm

### 1. Configurar la Base de Datos (solo la primera vez)
```powershell
# Desde la raíz del proyecto
Get-Content init.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
Get-Content settings.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
Get-Content alter.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
Get-Content alert_events.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
Get-Content alert_events_telegram.sql | & "C:\xampp\mysql\bin\mysql.exe" -u root
```

### 2. Configurar Variables de Entorno
```bash
# Copia la plantilla y rellena con tus credenciales de Telegram
cp backend/.env.example backend/.env
```
Edita `backend/.env`:
```
TELEGRAM_BOT_TOKEN=<token del bot de BotFather>
TELEGRAM_CHAT_ID=<tu chat id>
```

### 3. Iniciar el Backend
```bash
cd backend
npm install      # solo la primera vez
node index.js
# → Escuchando en http://localhost:3001
```

### 4. Cargar historial de ThingSpeak (una sola vez)
```bash
cd backend
node backfill.js
# → Carga todas las lecturas desde el 12/11/2026
```

### 5. Iniciar el Frontend
```bash
# Desde la raíz del proyecto
npm install      # solo la primera vez
npm run dev
# → Aplicación en http://localhost:8080
```

### ⚡ Inicio Automático
Haz doble clic en **`iniciar_sistema.bat`** para abrir el backend y frontend en terminales separadas.

---

## 🔑 Credenciales por Defecto

| | |
|---|---|
| **URL Aplicación** | http://localhost:8080 |
| **URL API** | http://localhost:3001 |
| **Admin Email** | `admin@admin.com` |
| **Admin Contraseña** | `admin123` |

---

## 📡 Configuración del ESP32

El sketch `codigoesp32.ino` requiere:
1. **Librería WiFiManager** – Genera un punto de acceso `ESP32-Incubadora` en el primer arranque.
2. **Sensor DHT11** conectado al **GPIO 27**
3. **LED Verde** en GPIO 26 (confirmación de envío exitoso)
4. **LED Rojo** en GPIO 25 (indicador de lectura / error)
5. El sketch envía datos a **ThingSpeak canal `3442278`** cada 20 segundos.

---

## 📂 Estructura del Repositorio

```
├── backend/                    # API REST y Worker (Node.js + Express)
│   ├── index.js                # Rutas, worker ThingSpeak y motor de alertas
│   ├── db.js                   # Pool MySQL con timezone UTC
│   ├── backfill.js             # Carga historial completo desde ThingSpeak
│   ├── .env.example            # Plantilla de variables de entorno
│   └── reset-admin.js          # Script para resetear contraseña de admin
├── src/                        # Frontend (Vue 3 + Vite)
│   ├── components/
│   │   ├── Dashboard.vue       # Panel principal, alertas, CSV export
│   │   ├── AdminUsers.vue      # Gestión de usuarios (modal de edición)
│   │   └── Login.vue           # Formulario de autenticación
│   ├── router.js               # Rutas con guardias de autenticación
│   └── main.js                 # Interceptor Axios global (401 → logout)
├── docs/                       # Documentación técnica del proyecto
├── codigoesp32.ino             # Sketch de Arduino para ESP32 + DHT11
├── init.sql                    # Creación de la base de datos y tablas base
├── settings.sql                # Configuración inicial de parámetros
├── alter.sql                   # Migración: start_date y bird_type
├── alert_events.sql            # Migración: tabla alert_events
├── alert_events_telegram.sql   # Migración: columna telegram_sent_at
└── iniciar_sistema.bat         # Script de inicio rápido
```

---

## 📚 Documentación Adicional

- [Guía de Puesta en Marcha](./guia.md) — Instrucciones detalladas de instalación y solución de problemas
- [Arquitectura Técnica](./docs/ARQUITECTURA.md)
- [Estado del Proyecto](./docs/ESTADO_DEL_PROYECTO.md)
- [Casos de Uso](./docs/CASOS_DE_USO.md)
- [Historias de Usuario](./docs/HISTORIAS_DE_USUARIO.md)
