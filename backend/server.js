// backend/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

const pedidosRoutes = require('./routes/pedidos');
const clientesRoutes = require('./routes/clientes');
const pagosRoutes = require('./routes/pagos');

app.use(cors());
app.use(express.json());

app.use('/api/pedidos', pedidosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pagos', pagosRoutes);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
