// backend/db.js
require('dotenv').config({ path: __dirname + '/../.env' }); // 👈 Agregado para leer el archivo .env
const mysql = require('mysql2');

// DEBUG para ver si las variables se cargan
/*
console.log("DEBUG ENV:", {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: process.env.DB_PORT,
});
*/

const connection = mysql.createConnection({
  host: process.env.DB_HOST,       // 👈 Usamos variables de entorno
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Conectado a la base de datos MySQL');
});

module.exports = connection;
