const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener todos los clientes con saldo a favor desde la tabla
router.get('/', (req, res) => {
  const sql = `
    SELECT clientes.*, 
           (SELECT COUNT(*) FROM pedidos WHERE cliente_id = clientes.id) AS pedidos
    FROM clientes
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ✅ Obtener pedidos de un cliente con estado recalculado
router.get('/:id/pedidos', (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT id, total, total_pagado, saldo
    FROM pedidos
    WHERE cliente_id = ?
    ORDER BY id DESC
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const pedidos = results.map(p => {
      let estado = "Pendiente";
      const total = parseFloat(p.total);
      const pagado = parseFloat(p.total_pagado || 0);
      const saldo = parseFloat(p.saldo || 0);

      if (pagado === 0) {
        estado = "Pendiente";
      } else if (saldo > 0) {
        estado = "Pagado parcialmente";
      } else if (saldo === 0) {
        estado = "Pagado totalmente";
      } else if (saldo < 0) {
        estado = "Con saldo a favor";
      }

      return { ...p, estado };
    });

    res.json(pedidos);
  });
});

// Crear un nuevo cliente (con validación de duplicados)
router.post('/', (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

  const sqlCheck = `SELECT id FROM clientes WHERE LOWER(nombre) = LOWER(?)`;
  db.query(sqlCheck, [nombre], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: "El cliente ya existe" });
    }

    const sqlInsert = `INSERT INTO clientes (nombre, saldo_a_favor) VALUES (?, 0)`;
    db.query(sqlInsert, [nombre], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        id: result.insertId,
        nombre,
        pedidos: 0,
        saldo_a_favor: 0
      });
    });
  });
});

// Editar un cliente
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

  const sqlCheck = `SELECT id FROM clientes WHERE LOWER(nombre) = LOWER(?) AND id <> ?`;
  db.query(sqlCheck, [nombre, id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: "El cliente ya existe" });
    }

    const sql = `UPDATE clientes SET nombre = ? WHERE id = ?`;
    db.query(sql, [nombre, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// Eliminar un cliente
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM clientes WHERE id = ?`;
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
