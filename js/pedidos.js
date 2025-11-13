// js/pedidos.js
document.addEventListener("DOMContentLoaded", () => {
  filtrarPedidos();
  obtenerClientes();
  document.getElementById("filtroCliente").addEventListener("input", filtrarPedidos);
  document.getElementById("filtroEstado").addEventListener("change", filtrarPedidos);

  const filtroFecha = document.getElementById("filtroFecha");
  if (filtroFecha) filtroFecha.addEventListener("change", filtrarPedidos);

  document.getElementById("formCrearPedido").addEventListener("submit", crearPedido);

  const formEditar = document.getElementById("editarPedidoForm");
  if (formEditar) formEditar.addEventListener("submit", guardarCambiosPedido);

  // ================================
  // Filtro Cliente: Escape y botón "x"
  // ================================
  const filtroCliente = document.getElementById("filtroCliente");
  const btnClear = document.getElementById("clearCliente");

  filtroCliente.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      filtroCliente.value = "";
      btnClear.style.display = "none";
      filtrarPedidos();
    }
  });

  filtroCliente.addEventListener("input", () => {
    btnClear.style.display = filtroCliente.value ? "block" : "none";
  });

  btnClear.addEventListener("click", () => {
    filtroCliente.value = "";
    btnClear.style.display = "none";
    filtrarPedidos();
  });
});

// ======================
// Variables globales
// ======================
let pedidosOriginales = [];
let clientesOriginales = [];

// ======================
// ✅ Toast moderno (igual que clientes.html)
// ======================
function showToast(mensaje, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-message ${tipo}`;
  toast.textContent = mensaje;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ======================
// Obtener pedidos
// ======================
function obtenerPedidos(cliente = "", fecha = "", estado = "") {
  let url = "http://localhost:3000/api/pedidos?";
  if (cliente) url += `cliente=${encodeURIComponent(cliente)}&`;
  if (fecha) url += `fecha=${encodeURIComponent(fecha)}&`;
  if (estado) url += `estado=${encodeURIComponent(estado)}&`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      pedidosOriginales = data;
      mostrarPedidos(data);
    })
    .catch(err => console.error("Error al obtener pedidos:", err));
}

// ======================
// Mostrar pedidos
// ======================
function mostrarPedidos(pedidos) {
  const tbody = document.getElementById("tablaPedidos");
  tbody.innerHTML = "";

  pedidos.forEach(pedido => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${pedido.cliente}</td>
      <td>${(pedido.fecha_creacion || '').split("T")[0]}</td>
      <td>$${Number(pedido.total).toFixed(2)}</td>
      <td>$${Number(pedido.total_pagado).toFixed(2)}</td>
      <td><input type="number" min="0" step="0.01" id="pago-${pedido.id}" class="form-control form-control-sm" placeholder="Monto"></td>
      <td><button class="btn btn-sm btn-outline-success" onclick="registrarPago(${pedido.id})">🔄</button></td>
      <td>$${Number(pedido.saldo).toFixed(2)}</td>
      <td>${pedido.estado}</td>
      <td><button class="btn btn-sm btn-outline-primary" onclick='abrirEditarPedido(${JSON.stringify(pedido)})'>✏️</button></td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="eliminarPedido(${pedido.id})">🗑️</button></td>
      <td><button class="btn btn-sm btn-outline-info" onclick="verHistorial(${pedido.id}, '${pedido.cliente}')">📜</button></td>
    `;
    tbody.appendChild(fila);
  });
}

// ======================
// Eliminar pedido (SweetAlert2)
// ======================
function eliminarPedido(pedidoId) {
  Swal.fire({
    title: '¿Eliminar pedido?',
    text: "Esta acción no se puede deshacer",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`http://localhost:3000/api/pedidos/${pedidoId}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast("Pedido eliminado correctamente", "success");
            filtrarPedidos();
          } else {
            showToast("Error al eliminar pedido", "error");
          }
        })
        .catch(err => console.error("Error al eliminar pedido:", err));
    }
  });
}

// ======================
// Abrir modal editar
// ======================
function abrirEditarPedido(pedido) {
  document.getElementById("editarPedidoId").value = pedido.id;
  document.getElementById("editarCliente").value = pedido.cliente;
  document.getElementById("editarFecha").value = pedido.fecha_creacion ? pedido.fecha_creacion.split("T")[0] : "";
  document.getElementById("editarTotal").value = pedido.total;
  document.getElementById("editarEstado").value = pedido.estado;

  new bootstrap.Modal(document.getElementById("editarPedidoModal")).show();
}

// ======================
// Guardar cambios pedido
// ======================
function guardarCambiosPedido(e) {
  e.preventDefault();

  const id = document.getElementById("editarPedidoId").value;
  const cliente_nombre = document.getElementById("editarCliente").value.trim();
  const fecha_creacion = document.getElementById("editarFecha").value;
  const total = document.getElementById("editarTotal").value;
  const estado = document.getElementById("editarEstado").value;

  if (!cliente_nombre || !fecha_creacion || !total || !estado) {
    showToast("Todos los campos son obligatorios", "error");
    return;
  }

  fetch(`http://localhost:3000/api/pedidos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_nombre, fecha_creacion, total, estado })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showToast("Error: " + data.error, "error");
        return;
      }
      showToast("Pedido actualizado", "success");
      bootstrap.Modal.getInstance(document.getElementById("editarPedidoModal")).hide();
      filtrarPedidos();
    })
    .catch(err => console.error("Error al actualizar pedido:", err));
}

// ======================
// Registrar pago
// ======================
function registrarPago(pedidoId) {
  const monto = parseFloat(document.getElementById(`pago-${pedidoId}`).value);
  if (!monto || monto <= 0) {
    showToast("Ingrese un monto válido", "error");
    return;
  }

  fetch("http://localhost:3000/api/pagos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedido_id: pedidoId, monto })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast("Pago de pedido actualizado", "success");
        filtrarPedidos();
      } else {
        showToast("Error al registrar pago", "error");
      }
    })
    .catch(err => console.error("Error al registrar pago:", err));
}

// ======================
// Eliminar pago parcial (SweetAlert2)
// ======================
function eliminarPago(pagoId, pedidoId, clienteNombre) {
  Swal.fire({
    title: '¿Eliminar pago parcial?',
    text: "Esta acción no se puede deshacer",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`http://localhost:3000/api/pagos/${pagoId}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            verHistorial(pedidoId, clienteNombre);
            filtrarPedidos();
            showToast("Pago eliminado", "success");
          } else {
            showToast("Error al eliminar pago", "error");
          }
        })
        .catch(err => console.error("Error al eliminar pago:", err));
    }
  });
}

// ======================
// Ver historial
// ======================
function verHistorial(pedidoId, clienteNombre) {
  fetch(`http://localhost:3000/api/pedidos/${pedidoId}/historial`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showToast("Error al obtener historial", "error");
        return;
      }

      const total = Number(data.total) || 0;
      const total_pagado = Number(data.total_pagado) || 0;
      const saldo = Number(data.saldo) || 0;

      let contenido = `<h5>Historial de pagos - ${clienteNombre}</h5>`;
      contenido += `<strong>Total:</strong> $${total.toFixed(2)}<br>`;
      contenido += `<strong>Pagado:</strong> $${total_pagado.toFixed(2)}<br>`;
      contenido += `<strong>Saldo:</strong> $${saldo.toFixed(2)}<br>`;

      let estadoTexto = "";
      if (total_pagado === 0) {
        estadoTexto = "PENDIENTE";
      } else if (saldo < 0) {
        estadoTexto = `TOTALMENTE PAGADO (saldo a favor: $${Math.abs(saldo).toFixed(2)})`;
      } else if (saldo === 0) {
        estadoTexto = "TOTALMENTE PAGADO";
      } else {
        estadoTexto = "PARCIALMENTE PAGADO";
      }

      const colorEstado = (estadoTexto === "PENDIENTE" || saldo > 0) ? 'red' : 'green';
      contenido += `<strong>Estado:</strong> <span style="font-weight:bold;color:${colorEstado};">${estadoTexto}</span><hr>`;

      contenido += `<table class="table table-sm table-bordered">
                      <thead class="table-secondary">
                        <tr>
                          <th>Fecha</th>
                          <th>Total</th>
                          <th>Pago parcial</th>
                          <th>Saldo pendiente</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead><tbody>`;

      let saldoPendiente = total;
      if (data.pagos && data.pagos.length > 0) {
        data.pagos.forEach((pago) => {
          const montoPago = Number(pago.monto) || 0;
          saldoPendiente -= montoPago;

          let estadoFila = saldoPendiente > 0 ? "Pendiente" : "Pagado totalmente";
          let saldoMostrar = saldoPendiente > 0 ? `$${saldoPendiente.toFixed(2)}` : "$0.00";

          contenido += `<tr id="filaPago-${pago.id}">
                          <td>${pago.fecha_pago}</td>
                          <td>$${total.toFixed(2)}</td>
                          <td>$${montoPago.toFixed(2)}</td>
                          <td>${saldoMostrar}</td>
                          <td>${estadoFila}</td>
                          <td><button class="btn btn-sm btn-outline-danger" onclick="eliminarPago(${pago.id}, ${pedidoId}, '${clienteNombre}')">Eliminar</button></td>
                        </tr>`;

          if (saldoPendiente < 0) {
            contenido += `<tr class="table-warning">
                            <td colspan="4">—</td>
                            <td colspan="2"><strong>Saldo a favor $${Math.abs(saldoPendiente).toFixed(2)}</strong></td>
                          </tr>`;
            saldoPendiente = 0;
          }
        });
      } else {
        contenido += `<tr><td colspan="6" class="text-center">No hay pagos registrados</td></tr>`;
      }

      contenido += `</tbody></table>`;
      document.getElementById("modalHistorialBody").innerHTML = contenido;
      new bootstrap.Modal(document.getElementById("modalHistorial")).show();
    })
    .catch(err => console.error("Error al obtener historial:", err));
}

// ======================
// Filtrar pedidos
// ======================
function filtrarPedidos() {
  const cliente = document.getElementById("filtroCliente").value.trim();
  const fecha = document.getElementById("filtroFecha") ? document.getElementById("filtroFecha").value : "";
  const estado = document.getElementById("filtroEstado").value;
  obtenerPedidos(cliente, fecha, estado);
}

// ======================
// Obtener clientes
// ======================
function obtenerClientes() {
  fetch("http://localhost:3000/api/clientes")
    .then(res => res.json())
    .then(data => {
      clientesOriginales = data;
      llenarListaClientes(data);
    })
    .catch(err => console.error("Error al obtener clientes:", err));
}

function llenarListaClientes(clientes) {
  const lista = document.getElementById("listaClientes");
  if (!lista) return;
  lista.innerHTML = "";
  clientes.forEach(cliente => {
    const option = document.createElement("option");
    option.value = cliente.nombre;
    lista.appendChild(option);
  });
}

// ======================
// Crear pedido
// ======================
function crearPedido(e) {
  e.preventDefault();

  const cliente_nombre = document.getElementById("clienteNombre").value.trim();
  const total = document.getElementById("totalInput").value;

  if (!cliente_nombre || !total) {
    showToast("Todos los campos son obligatorios", "error");
    return;
  }

  const clienteExistente = clientesOriginales.find(c => c.nombre.toLowerCase() === cliente_nombre.toLowerCase());
  const id_cliente = clienteExistente ? clienteExistente.id : null;

  fetch("http://localhost:3000/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_cliente, cliente_nombre, total })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showToast("Error: " + data.error, "error");
        return;
      }
      showToast("Pedido creado", "success");
      document.getElementById("formCrearPedido").reset();
      bootstrap.Modal.getInstance(document.getElementById("modalCrearPedido")).hide();
      filtrarPedidos();
      obtenerClientes();
    })
    .catch(err => console.error("Error al crear pedido:", err));
}

// ======================
// Volver
// ======================
function volver() {
  window.location.href = "index1.html";
}

// ======================
// Alias
// ======================
function cargarPedidos(cliente = "", fecha = "") {
  filtrarPedidos();
}
