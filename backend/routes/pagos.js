// backend/routes/pagos.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ======================
// Función auxiliar para recalcular estado
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
    return "Pendiente"; // fallback de seguridad
}

// ======================
// Función auxiliar para actualizar saldo_a_favor del cliente
// ======================
function actualizarSaldoCliente(cliente_id) {
    return new Promise((resolve, reject) => {
        const sqlSaldo = `
            SELECT IFNULL(SUM(ABS(saldo)), 0) AS saldo_a_favor
            FROM pedidos
            WHERE cliente_id = ? AND saldo < 0
        `;
        db.query(sqlSaldo, [cliente_id], (err, rows) => {
            if (err) return reject(err);

            const saldo_a_favor = rows[0].saldo_a_favor || 0;
            const sqlUpdateCliente = `UPDATE clientes SET saldo_a_favor = ? WHERE id = ?`;
            db.query(sqlUpdateCliente, [saldo_a_favor, cliente_id], (err2) => {
                if (err2) return reject(err2);
                resolve(saldo_a_favor);
            });
        });
    });
}

// ======================
// Registrar un pago parcial
// ======================
router.post('/', (req, res) => {
    const { pedido_id, monto } = req.body;

    if (!pedido_id || !monto) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    const sqlInsertPago = `
        INSERT INTO pagos (pedido_id, monto, fecha_pago)
        VALUES (?, ?, NOW())
    `;
    db.query(sqlInsertPago, [pedido_id, monto], (err) => {
        if (err) {
            console.error("Error al insertar pago parcial:", err.sqlMessage || err);
            return res.status(500).json({ error: 'Error al registrar pago parcial' });
        }

        // Recalcular total pagado
        const sqlTotalPagado = `SELECT SUM(monto) AS totalPagado FROM pagos WHERE pedido_id = ?`;
        db.query(sqlTotalPagado, [pedido_id], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error al recalcular total pagado' });

            const totalPagado = rows[0].totalPagado || 0;

            const sqlPedido = `SELECT total, cliente_id FROM pedidos WHERE id = ?`;
            db.query(sqlPedido, [pedido_id], (err, pedidoRows) => {
                if (err) return res.status(500).json({ error: 'Error al obtener pedido' });
                if (pedidoRows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

                const totalPedido = pedidoRows[0].total;
                const cliente_id = pedidoRows[0].cliente_id;
                const saldo = totalPedido - totalPagado; // puede ser negativo (saldo a favor)
                const estado = calcularEstado(totalPedido, totalPagado, saldo);

                //console.log("DEBUG ACTUALIZAR PEDIDO:", { totalPagado, saldo, estado, pedido_id });

                const sqlUpdatePedido = `
                    UPDATE pedidos
                    SET total_pagado = ?, saldo = ?, estado = ?
                    WHERE id = ?
                `;
                db.query(sqlUpdatePedido, [totalPagado, saldo, estado, pedido_id], async (err) => {
                    if (err) return res.status(500).json({ error: 'Error al actualizar pedido' });

                    try {
                        const saldoCliente = await actualizarSaldoCliente(cliente_id);
                        res.json({
                            success: true,
                            totalPagado,
                            saldo,
                            estado,
                            saldoCliente,
                            message: "Pago de pedido actualizado"
                        });
                    } catch (e) {
                        return res.status(500).json({ error: 'Error al actualizar saldo del cliente' });
                    }
                });
            });
        });
    });
});

// ======================
// Obtener historial de pagos con totales
// ======================
router.get('/:pedido_id/historial', (req, res) => {
    const { pedido_id } = req.params;

    const sqlPagos = `SELECT id, fecha_pago, monto FROM pagos WHERE pedido_id = ? ORDER BY fecha_pago ASC`;
    const sqlPedido = `SELECT total, total_pagado, saldo, estado FROM pedidos WHERE id = ?`;

    db.query(sqlPagos, [pedido_id], (err, pagos) => {
        if (err) return res.status(500).json({ error: 'Error al obtener pagos' });

        pagos = pagos.map(p => {
            const fecha = new Date(p.fecha_pago);
            const dia = String(fecha.getDate()).padStart(2, '0');
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const anio = fecha.getFullYear();
            const horas = String(fecha.getHours()).padStart(2, '0');
            const minutos = String(fecha.getMinutes()).padStart(2, '0');
            return { ...p, fecha_pago: `${dia}/${mes}/${anio} ${horas}:${minutos}` };
        });

        db.query(sqlPedido, [pedido_id], (err, pedidoRows) => {
            if (err) return res.status(500).json({ error: 'Error al obtener pedido' });
            if (pedidoRows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

            const pedido = pedidoRows[0];
            res.json({
                total: pedido.total,
                total_pagado: pedido.total_pagado,
                saldo: pedido.saldo,
                estado: pedido.estado,
                pagos
            });
        });
    });
});

// ======================
// Eliminar un pago parcial
// ======================
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    const sqlPago = `SELECT pedido_id FROM pagos WHERE id = ?`;
    db.query(sqlPago, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al buscar pago' });
        if (rows.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });

        const pedido_id = rows[0].pedido_id;

        const sqlDelete = `DELETE FROM pagos WHERE id = ?`;
        db.query(sqlDelete, [id], (err) => {
            if (err) return res.status(500).json({ error: 'Error al eliminar pago' });

            const sqlTotalPagado = `SELECT SUM(monto) AS totalPagado FROM pagos WHERE pedido_id = ?`;
            db.query(sqlTotalPagado, [pedido_id], (err, rowsTotal) => {
                if (err) return res.status(500).json({ error: 'Error al recalcular total pagado' });

                const totalPagado = rowsTotal[0].totalPagado || 0;

                const sqlPedido = `SELECT total, cliente_id FROM pedidos WHERE id = ?`;
                db.query(sqlPedido, [pedido_id], (err, pedidoRows) => {
                    if (err) return res.status(500).json({ error: 'Error al obtener pedido' });
                    if (pedidoRows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });

                    const totalPedido = pedidoRows[0].total;
                    const cliente_id = pedidoRows[0].cliente_id;
                    const saldo = totalPedido - totalPagado;
                    const estado = calcularEstado(totalPedido, totalPagado, saldo);

                    const sqlUpdatePedido = `
                        UPDATE pedidos
                        SET total_pagado = ?, saldo = ?, estado = ?
                        WHERE id = ?
                    `;
                    db.query(sqlUpdatePedido, [totalPagado, saldo, estado, pedido_id], async (err) => {
                        if (err) return res.status(500).json({ error: 'Error al actualizar pedido' });

                        try {
                            const saldoCliente = await actualizarSaldoCliente(cliente_id);
                            res.json({
                                success: true,
                                totalPagado,
                                saldo,
                                estado,
                                saldoCliente,
                                message: "Pago eliminado correctamente"
                            });
                        } catch (e) {
                            return res.status(500).json({ error: 'Error al actualizar saldo del cliente' });
                        }
                    });
                });
            });
        });
    });
});

module.exports = router;
