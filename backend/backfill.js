/**
 * Carga todo el historial del canal ThingSpeak desde el 12/11/2026 en la BD local.
 * Ejecutar una sola vez: node backfill.js
 */
const axios = require('axios');
const db = require('./db');

const THINGSPEAK_CHANNEL_ID = '3442278';
const THINGSPEAK_API_KEY = 'J92EB8NUEOJF1IAN';
// Inicio del ciclo de incubación (UTC)
const START_DATE = '2026-11-12T00:00:00Z';
const BATCH_SIZE = 8000; // máximo que permite ThingSpeak por petición

async function backfill() {
  let start = START_DATE;
  let totalInserted = 0;
  let totalProcessed = 0;
  let page = 1;

  console.log(`Iniciando backfill desde ${START_DATE}…`);

  while (true) {
    const url =
      `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json` +
      `?api_key=${THINGSPEAK_API_KEY}&results=${BATCH_SIZE}&start=${encodeURIComponent(start)}`;

    console.log(`[Página ${page}] GET ${url}`);
    const response = await axios.get(url);
    const feeds = response.data.feeds;

    if (!feeds || feeds.length === 0) {
      console.log('No hay más feeds. Backfill completo.');
      break;
    }

    let insertedInBatch = 0;
    for (const feed of feeds) {
      if (!feed.field1 || !feed.field2) continue;
      const mysqlDate = new Date(feed.created_at).toISOString().slice(0, 19).replace('T', ' ');
      const [result] = await db.execute(
        'INSERT IGNORE INTO readings (temperatura, humedad, timestamp) VALUES (?, ?, ?)',
        [parseFloat(feed.field1), parseFloat(feed.field2), mysqlDate]
      );
      if (result.affectedRows > 0) insertedInBatch++;
    }

    totalProcessed += feeds.length;
    totalInserted += insertedInBatch;
    console.log(`[Página ${page}] ${feeds.length} feeds procesados, ${insertedInBatch} insertados.`);

    // Si la respuesta devuelve menos que el máximo, ya no hay más páginas
    if (feeds.length < BATCH_SIZE) break;

    // Avanzar el cursor: un segundo después del último timestamp recibido
    const lastTs = feeds[feeds.length - 1].created_at;
    const nextStart = new Date(new Date(lastTs).getTime() + 1000).toISOString();
    if (nextStart === start) break; // guardia ante bucle infinito
    start = nextStart;
    page++;
  }

  console.log(`\nBackfill finalizado: ${totalProcessed} feeds procesados, ${totalInserted} insertados en la BD.`);
  await db.end();
}

backfill().catch(err => {
  console.error('Error durante el backfill:', err.message);
  process.exit(1);
});
