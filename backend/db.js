const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'encubadora_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',       // leer/escribir DATETIME como UTC
  dateStrings: false    // devolver fechas como objetos Date (→ ISO con Z en JSON)
});

module.exports = pool;
