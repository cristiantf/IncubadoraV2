const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'encubadora_secreta_123';

// Middleware de autenticación
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

// --- AUTH ROUTES ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });
    
    const token = jwt.sign({ id: user.id, role: user.role, nombre: user.nombre }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, nombre: user.nombre, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- USERS CRUD (ADMIN ONLY) ---
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, nombre, email, role, created_at FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      'INSERT INTO users (nombre, email, password, role) VALUES (?, ?, ?, ?)',
      [nombre, email, hashedPassword, role || 'CLIENTE']
    );
    res.json({ id: result.insertId, message: 'Usuario creado' });
  } catch (error) {
    res.status(500).json({ error: 'Error creando usuario (puede que el email ya exista)' });
  }
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
});

app.put('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre, email, password, role } = req.body;
  try {
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.execute(
        'UPDATE users SET nombre = ?, email = ?, password = ?, role = ? WHERE id = ?',
        [nombre, email, hashedPassword, role, req.params.id]
      );
    } else {
      await db.execute(
        'UPDATE users SET nombre = ?, email = ?, role = ? WHERE id = ?',
        [nombre, email, role, req.params.id]
      );
    }
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
});

// --- SETTINGS ROUTES (Admin can update, any authenticated can read) ---
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM settings WHERE id = 1');
    res.json(rows[0] || { temp_min: 37.5, temp_max: 37.9, hum_min: 50.0, hum_max: 70.0 });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/settings', authMiddleware, adminMiddleware, async (req, res) => {
  const { temp_min, temp_max, hum_min, hum_max } = req.body;
  try {
    await db.execute(
      'UPDATE settings SET temp_min = ?, temp_max = ?, hum_min = ?, hum_max = ? WHERE id = 1',
      [temp_min, temp_max, hum_min, hum_max]
    );
    res.json({ message: 'Configuración actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando configuración' });
  }
});

app.post('/api/settings/start', authMiddleware, adminMiddleware, async (req, res) => {
  const { bird_type } = req.body;
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      'UPDATE settings SET start_date = ?, bird_type = ? WHERE id = 1',
      [now, bird_type || 'gallina']
    );
    res.json({ message: 'Ciclo iniciado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar ciclo' });
  }
});

app.post('/api/settings/stop', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.execute(
      'UPDATE settings SET start_date = NULL WHERE id = 1'
    );
    res.json({ message: 'Ciclo detenido' });
  } catch (error) {
    res.status(500).json({ error: 'Error al detener ciclo' });
  }
});

// --- READINGS ROUTES ---
app.get('/api/readings', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const [rows] = await db.execute(
      'SELECT * FROM readings ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM readings');
    
    res.json({
      data: rows,
      total: countResult[0].total,
      page,
      totalPages: Math.ceil(countResult[0].total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.get('/api/readings/latest', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1');
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- ALERTS ---
app.get('/api/alerts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM alert_events ORDER BY inicio DESC LIMIT 200'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- EXPORT CSV ---
// Convierte un Date de MySQL (UTC) a string para CSV en hora Ecuador.
const toEcuadorCSV = (d) =>
  new Date(d).toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).replace('T', ' ');

// Convierte un string de fecha en hora Ecuador a DATETIME UTC para WHERE.
// Acepta "YYYY-MM-DD" o "YYYY-MM-DDTHH:MM:SS".
const ecuadorToMySQL = (s) => {
  if (!s) return null;
  const iso = s.includes('T') ? s : `${s}T00:00:00`;
  return new Date(`${iso}-05:00`).toISOString().slice(0, 19).replace('T', ' ');
};

const buildDateWhere = (field, desde, hasta) => {
  const d = ecuadorToMySQL(desde);
  const h = ecuadorToMySQL(hasta);
  if (d && h)   return { clause: ` WHERE ${field} BETWEEN ? AND ?`, params: [d, h] };
  if (d)        return { clause: ` WHERE ${field} >= ?`,           params: [d] };
  if (h)        return { clause: ` WHERE ${field} <= ?`,           params: [h] };
  return { clause: '', params: [] };
};

app.get('/api/export/readings.csv', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { clause, params } = buildDateWhere('timestamp', req.query.desde, req.query.hasta);
    const [rows] = await db.execute(
      `SELECT id, timestamp, temperatura, humedad FROM readings${clause} ORDER BY timestamp ASC`,
      params
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="readings.csv"');
    let csv = 'id,fecha_hora_ecuador,temperatura_c,humedad_pct\n';
    for (const r of rows) {
      csv += `${r.id},"${toEcuadorCSV(r.timestamp)}",${r.temperatura},${r.humedad}\n`;
    }
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exportando lecturas' });
  }
});

app.get('/api/export/alerts.csv', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { clause, params } = buildDateWhere('inicio', req.query.desde, req.query.hasta);
    const [rows] = await db.execute(
      `SELECT * FROM alert_events${clause} ORDER BY inicio ASC`,
      params
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alerts.csv"');
    let csv = 'id,variable,tipo,valor_extremo,umbral,inicio_ecuador,fin_ecuador,duracion_segundos\n';
    for (const a of rows) {
      csv += `${a.id},${a.variable},${a.tipo},${a.valor_extremo},${a.umbral},"${toEcuadorCSV(a.inicio)}","${a.fin ? toEcuadorCSV(a.fin) : ''}",${a.duracion_segundos ?? ''}\n`;
    }
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error exportando alertas' });
  }
});

// Evalúa una variable contra sus umbrales y abre/cierra eventos en alert_events.
// createdAt: string ISO 8601 UTC del ThingSpeak feed.
const processAlertVariable = async (variable, value, min, max, createdAt) => {
  const tsDate = new Date(createdAt);
  const tsMySQL = tsDate.toISOString().slice(0, 19).replace('T', ' ');
  const isLow = value < min;
  const isHigh = value > max;
  const outOfRange = isLow || isHigh;

  const [open] = await db.execute(
    'SELECT * FROM alert_events WHERE variable = ? AND fin IS NULL ORDER BY inicio DESC LIMIT 1',
    [variable]
  );

  if (outOfRange) {
    if (open.length === 0) {
      const tipo = isLow ? 'bajo' : 'alto';
      const umbral = isLow ? min : max;
      await db.execute(
        'INSERT INTO alert_events (variable, tipo, valor_extremo, umbral, inicio) VALUES (?, ?, ?, ?, ?)',
        [variable, tipo, value, umbral, tsMySQL]
      );
      console.log(`[Alertas] ABIERTO: ${variable} ${tipo} (valor=${value}, umbral=${umbral})`);
    } else {
      const ev = open[0];
      const worse = ev.tipo === 'bajo' ? value < ev.valor_extremo : value > ev.valor_extremo;
      if (worse) {
        await db.execute('UPDATE alert_events SET valor_extremo = ? WHERE id = ?', [value, ev.id]);
      }
    }
  } else if (open.length > 0) {
    const ev = open[0];
    const duracion = Math.round((tsDate - new Date(ev.inicio)) / 1000);
    await db.execute(
      'UPDATE alert_events SET fin = ?, duracion_segundos = ? WHERE id = ?',
      [tsMySQL, Math.max(0, duracion), ev.id]
    );
    console.log(`[Alertas] CERRADO: ${variable}, duración ${duracion}s`);
  }
};

// --- WORKER (Fetch from ThingSpeak) ---
const THINGSPEAK_CHANNEL_ID = '3442278';
const THINGSPEAK_API_KEY = 'J92EB8NUEOJF1IAN';

const fetchThingSpeakData = async () => {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_API_KEY}&results=10`;
    const response = await axios.get(url);
    const feeds = response.data.feeds;

    if (!feeds || feeds.length === 0) return;

    // Obtener umbrales una vez por ciclo del worker
    const [settingsRows] = await db.execute('SELECT * FROM settings WHERE id = 1');
    const s = settingsRows[0] || { temp_min: 37.5, temp_max: 37.9, hum_min: 50, hum_max: 70 };

    let inserted = 0;
    for (const feed of feeds) {
      if (!feed.field1 || !feed.field2) continue;
      const mysqlDate = new Date(feed.created_at).toISOString().slice(0, 19).replace('T', ' ');
      const [result] = await db.execute(
        'INSERT IGNORE INTO readings (temperatura, humedad, timestamp) VALUES (?, ?, ?)',
        [parseFloat(feed.field1), parseFloat(feed.field2), mysqlDate]
      );
      if (result.affectedRows > 0) {
        inserted++;
        // Evaluar alertas para cada lectura nueva, en orden cronológico
        await processAlertVariable('temperatura', parseFloat(feed.field1), s.temp_min, s.temp_max, feed.created_at);
        await processAlertVariable('humedad', parseFloat(feed.field2), s.hum_min, s.hum_max, feed.created_at);
      }
    }
    console.log(`[Worker] Procesados ${feeds.length} feeds, insertados ${inserted} nuevos.`);
  } catch (error) {
    console.error('[Worker] Error fetching from ThingSpeak:', error.message);
  }
};

// Correr el worker cada minuto (60000 ms)
setInterval(fetchThingSpeakData, 60000);
// Correr inmediatamente al iniciar
fetchThingSpeakData();

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
