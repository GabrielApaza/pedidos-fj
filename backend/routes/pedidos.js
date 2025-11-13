// backend/routes/pedidos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ======================
// Función auxiliar para calcular estado
// ======================
function calcularEstado(total, totalPagado, saldo) {
  total = Number(total);
  totalPagado = Number(totalPagado);
  saldo = Number(saldo);

  if (saldo === 0 && totalPagado === total) {
    return "Pagado totalmente";
  }
  if (saldo < 0) {
    return "Saldo a favor";
  }
  if (totalPagado > 0 && saldo > 0) {
    return "Pagado parcialmente";
  }
  if (totalPagado === 0 && saldo === total) {
    return "Pendiente";
  }
  return "Pendiente"; // fallback
}

// ======================
// Obtener resumen de pedidos
// ======================
router.get('/resumen', (req, res) => {
  const sql = `
    SELECT
      SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'Pagado parcialmente' THEN 1 ELSE 0 END) AS parciales,
      SUM(saldo) AS deuda_total
    FROM pedidos
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error al obtener resumen:", err);
      return res.status(500).json({ error: "Error al obtener resumen" });
    }
    const row = results[0] || {};
    res.json({
      pendientes: row.pendientes || 0,
      parciales: row.parciales || 0,
      deuda_total: row.deuda_total || 0
    });
  });
});

// ======================
// Obtener pedidos (con filtros opcionales por cliente, fecha y estado)
// ======================
router.get('/', (req, res) => {
  const { cliente, fecha, estado } = req.query;

  let sql = `
    SELECT pedidos.id,
           clientes.nombre AS cliente,
           DATE_FORMAT(pedidos.fecha_creacion, '%d/%m/%Y') AS fecha_mostrar,
           DATE(pedidos.fecha_creacion) AS fecha_iso,
           pedidos.total,
           pedidos.total_pagado,
           pedidos.saldo,
           pedidos.estado
    FROM pedidos
    JOIN clientes ON pedidos.cliente_id = clientes.id
    WHERE 1=1
  `;

  const params = [];

  if (cliente) {
    sql += " AND clientes.nombre LIKE ?";
    params.push(`%${cliente}%`);
  }

  if (fecha) {
    sql += " AND DATE(pedidos.fecha_creacion) = ?";
    params.push(fecha);
  }

  sql += " ORDER BY pedidos.fecha_creacion DESC";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    // Calcular estado en backend con la función auxiliar
    const pedidosConEstado = results.map(p => {
      const estadoCalc = calcularEstado(p.total, p.total_pagado, p.saldo);
      return {
        ...p,
        fecha_creacion: p.fecha_mostrar,
        estado: estadoCalc
      };
    });

    // 🔎 Si hay filtro por estado, aplicarlo después de calcular
    let filtrados = pedidosConEstado;
    if (estado) {
      filtrados = pedidosConEstado.filter(p => p.estado === estado);
    }

    res.json(filtrados);
  });
});

// ======================
// Crear nuevo pedido (acepta id_cliente o cliente_nombre)
// ======================
router.post('/', (req, res) => {
  const { id_cliente, cliente_nombre, total } = req.body;

  if (!total) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  if (id_cliente) {
    return insertarPedido(id_cliente);
  }

  if (!cliente_nombre) {
    return res.status(400).json({ error: "Debe especificar id_cliente o cliente_nombre" });
  }

  const sqlBuscarCliente = "SELECT id FROM clientes WHERE nombre = ?";
  db.query(sqlBuscarCliente, [cliente_nombre], (err, resultados) => {
    if (err) {
      console.error("Error al buscar cliente:", err);
      return res.status(500).json({ error: "Error al buscar cliente" });
    }

    if (resultados.length > 0) {
      insertarPedido(resultados[0].id);
    } else {
      const sqlInsertCliente = "INSERT INTO clientes (nombre) VALUES (?)";
      db.query(sqlInsertCliente, [cliente_nombre], (err, resCliente) => {
        if (err) {
          console.error("Error al crear cliente:", err);
          return res.status(500).json({ error: "Error al crear cliente" });
        }
        insertarPedido(resCliente.insertId);
      });
    }
  });

  function insertarPedido(clienteId) {
    const total_pagado = 0;
    const saldo = parseFloat(total);
    const estado = "Pendiente"; // 👈 siempre al crear

    const sqlPedido = `
      INSERT INTO pedidos (cliente_id, total, total_pagado, saldo, estado)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(sqlPedido, [clienteId, total, total_pagado, saldo, estado], (err, result) => {
      if (err) {
        console.error("Error al crear pedido:", err);
        return res.status(500).json({ error: "Error al crear el pedido" });
      }
      res.json({ message: "Pedido creado correctamente", id: result.insertId });
    });
  }
});

// ======================
// Historial de pagos de un pedido
// ======================
router.get('/:pedidoId/historial', (req, res) => {
  const { pedidoId } = req.params;

  const sqlPagos = `
    SELECT id, DATE_FORMAT(fecha_pago, '%d/%m/%Y %H:%i') AS fecha_pago, monto
    FROM pagos
    WHERE pedido_id = ?
    ORDER BY fecha_pago ASC
  `;

  db.query(sqlPagos, [pedidoId], (err, pagos) => {
    if (err) {
      console.error("Error al obtener historial de pagos:", err);
      return res.status(500).json({ error: 'Error al obtener historial de pagos' });
    }

    const sqlPedido = `SELECT total, total_pagado, saldo FROM pedidos WHERE id = ?`;
    db.query(sqlPedido, [pedidoId], (err, pedidoRows) => {
      if (err) {
        console.error("Error al obtener datos del pedido:", err);
        return res.status(500).json({ error: 'Error al obtener datos del pedido' });
      }

      if (pedidoRows.length === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      const total = parseFloat(pedidoRows[0].total);
      const total_pagado = parseFloat(pedidoRows[0].total_pagado);
      const saldo = parseFloat(pedidoRows[0].saldo);

      const estadoCalc = calcularEstado(total, total_pagado, saldo);

      let estadoMensaje = '';
      if (estadoCalc === 'Pagado totalmente') {
        estadoMensaje = '✅ Pedido pagado totalmente';
      } else if (estadoCalc === 'Saldo a favor') {
        estadoMensaje = `💰 Saldo a favor: $${Math.abs(saldo).toFixed(2)}`;
      } else if (estadoCalc === 'Pagado parcialmente') {
        estadoMensaje = `🟡 Pagado parcialmente: $${total_pagado.toFixed(2)} / $${total.toFixed(2)}`;
      } else {
        estadoMensaje = `Pendiente de pago: $${saldo.toFixed(2)}`;
      }

      res.json({
        pagos,
        total,
        total_pagado,
        saldo,
        estadoMensaje
      });
    });
  });
});

// ======================
// Actualizar pedido
// ======================
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { cliente_nombre, fecha_creacion, total, estado } = req.body;

  if (!cliente_nombre || !fecha_creacion || !total || !estado) {
    return res.status(400).json({ error: 'Faltan datos para actualizar el pedido' });
  }

  const sql = `
    UPDATE pedidos
    JOIN clientes ON pedidos.cliente_id = clientes.id
    SET clientes.nombre = ?, pedidos.fecha_creacion = ?, pedidos.total = ?, pedidos.estado = ?
    WHERE pedidos.id = ?
  `;

  db.query(sql, [cliente_nombre, fecha_creacion, total, estado, id], (err) => {
    if (err) {
      console.error("Error al actualizar pedido:", err.sqlMessage || err);
      return res.status(500).json({ error: 'Error al actualizar pedido' });
    }
    res.json({ success: true, message: 'Pedido actualizado correctamente' });
  });
});

// ======================
// Eliminar pedido
// ======================
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const sqlPagos = `DELETE FROM pagos WHERE pedido_id = ?`;
  db.query(sqlPagos, [id], (err) => {
    if (err) {
      console.error("Error al eliminar pagos del pedido:", err);
      return res.status(500).json({ error: 'Error al eliminar pagos del pedido' });
    }

    const sqlPedido = `DELETE FROM pedidos WHERE id = ?`;
    db.query(sqlPedido, [id], (err, result) => {
      if (err) {
        console.error("Error al eliminar pedido:", err);
        return res.status(500).json({ error: 'Error al eliminar pedido' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      res.json({ success: true, message: 'Pedido eliminado correctamente' });
    });
  });
});

module.exports = router;
