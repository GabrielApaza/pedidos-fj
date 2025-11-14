// js/clientes.js

let clientesGlobal = []; // almacena todos los clientes para filtrar

document.addEventListener("DOMContentLoaded", () => {
  obtenerClientes();

  // Guardar cambios del modal de edición
  document.getElementById("formEditarCliente").addEventListener("submit", function(e) {
    e.preventDefault();

    const id = document.getElementById("editarClienteId").value;
    const nuevoNombre = document.getElementById("editarClienteNombre").value.trim();

    if (nuevoNombre === "") return alert("El nombre no puede estar vacío");

    fetch(`https://pedidos-fj.onrender.com/api/clientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre })
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          return;
        }
        obtenerClientes();
        bootstrap.Modal.getInstance(document.getElementById("modalEditarCliente")).hide();
      })
      .catch(err => console.error("Error al editar cliente:", err));
  });

  // Filtro en tiempo real
  const inputBusqueda = document.getElementById("buscarCliente");
  const btnLimpiar = document.getElementById("limpiarBusqueda");

  inputBusqueda.addEventListener("input", e => {
    const texto = e.target.value.toLowerCase();
    const filtrados = clientesGlobal.filter(c =>
      c.nombre.toLowerCase().includes(texto)
    );
    mostrarClientes(filtrados);
  });

  // Limpiar con botón ❌
  btnLimpiar.addEventListener("click", () => {
    inputBusqueda.value = "";
    mostrarClientes(clientesGlobal);
    inputBusqueda.focus();
  });

  // Limpiar con tecla ESC
  inputBusqueda.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      inputBusqueda.value = "";
      mostrarClientes(clientesGlobal);
    }
  });
});

function obtenerClientes() {
  fetch("https://pedidos-fj.onrender.com/api/clientes")
    .then(res => res.json())
    .then(clientes => {
      clientesGlobal = clientes;
      mostrarClientes(clientes);
    })
    .catch(err => console.error("Error al obtener clientes:", err));
}

function mostrarClientes(clientes) {
  const tbody = document.getElementById("tablaClientes");
  tbody.innerHTML = "";

  clientes.forEach(cliente => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td><span id="nombre-${cliente.id}">${cliente.nombre}</span></td>
      <td>$${parseFloat(cliente.saldo_a_favor || 0).toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="verPedidos(${cliente.id}, '${cliente.nombre}')">
          Ver pedidos (${cliente.pedidos})
        </button>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-warning" onclick="abrirModalEditar(${cliente.id}, '${cliente.nombre}')">✏️</button>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="eliminarCliente(${cliente.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(fila);
  });
}

function mostrarMensaje(texto, tipo = "success") {
  const mensaje = document.getElementById("mensajeCliente");
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "success" ? "green" : "red";

  setTimeout(() => {
    mensaje.textContent = "";
  }, 3000);
}

function agregarCliente() {
  const nombre = document.getElementById("nuevoCliente").value.trim();
  if (nombre === "") {
    showToast("El nombre no puede estar vacío", "danger");
    return;
  }

  fetch("https://pedidos-fj.onrender.com/api/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showToast(data.error, "danger");
        return;
      }
      document.getElementById("nuevoCliente").value = "";
      showToast("El cliente fue creado exitosamente", "success");
      obtenerClientes();
    })
    .catch(err => {
      console.error("Error al agregar cliente:", err);
      showToast("Error al agregar cliente", "danger");
    });
}

function abrirModalEditar(id, nombre) {
  document.getElementById("editarClienteId").value = id;
  document.getElementById("editarClienteNombre").value = nombre;
  new bootstrap.Modal(document.getElementById("modalEditarCliente")).show();
}

function eliminarCliente(id) {
  if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

  fetch(`https://pedidos-fj.onrender.com/api/clientes/${id}`, {
    method: "DELETE"
  })
    .then(res => res.json())
    .then(() => obtenerClientes())
    .catch(err => console.error("Error al eliminar cliente:", err));
}

function volver() {
  window.location.href = "index1.html";
}

function verPedidos(clienteId, clienteNombre) {
  document.getElementById("nombreClienteModal").textContent = clienteNombre;
  const lista = document.getElementById("listaPedidos");
  lista.innerHTML = "Cargando pedidos...";

  fetch(`https://pedidos-fj.onrender.com/api/clientes/${clienteId}/pedidos`)
    .then(res => res.json())
    .then(pedidos => {
      if (!pedidos.length) {
        lista.innerHTML = "<p>Este cliente no tiene pedidos.</p>";
        return;
      }

      lista.innerHTML = "";
      pedidos.forEach(pedido => {
        const card = document.createElement("div");
        card.className = "card mb-2";
        card.innerHTML = `
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Pedido #${pedido.id} - Total: $${pedido.total} - Estado: ${pedido.estado}</span>
            <div>
              <button class="btn btn-sm btn-success me-2" onclick="descargarPedido(${pedido.id}, '${clienteNombre}')">
                📥 Descargar
              </button>
              <button class="btn btn-sm btn-outline-primary" onclick="verHistorial(${pedido.id}, this)">
                Ver pagos
              </button>
            </div>
          </div>
          <div class="card-body d-none" id="pedido-${pedido.id}"></div>
        `;
        lista.appendChild(card);
      });
    })
    .catch(err => {
      console.error("Error al obtener pedidos:", err);
      lista.innerHTML = "<p>Error al cargar pedidos.</p>";
    });

  const modal = new bootstrap.Modal(document.getElementById("modalPedidos"));
  modal.show();
}

function verHistorial(pedidoId, btn) {
  const cardBody = btn.closest(".card").querySelector(".card-body");

  if (!cardBody.classList.contains("d-none")) {
    cardBody.classList.add("d-none");
    btn.textContent = "Ver pagos";
    return;
  }

  cardBody.innerHTML = "Cargando historial...";
  fetch(`https://pedidos-fj.onrender.com/api/pagos/${pedidoId}/historial`)
    .then(res => res.json())
    .then(data => {
      const total = Number(data.total) || 0;
      const total_pagado = Number(data.total_pagado) || 0;
      const saldo = Number(data.saldo) || 0;

      let estadoMensaje = "";
      if (saldo === 0) estadoMensaje = "TOTALMENTE PAGADO";
      else if (saldo < 0) estadoMensaje = `TOTALMENTE PAGADO (saldo a favor: $${Math.abs(saldo).toFixed(2)})`;
      else estadoMensaje = "PARCIALMENTE PAGADO";

      let html = `<p><strong>Total:</strong> $${total.toFixed(2)} | 
                     <strong>Pagado:</strong> $${total_pagado.toFixed(2)} | 
                     <strong>Saldo:</strong> $${saldo.toFixed(2)} | 
                     <strong>Estado:</strong> ${estadoMensaje}</p>`;

      html += `<table class="table table-sm table-bordered">
                 <thead class="table-secondary">
                   <tr>
                     <th>Fecha</th>
                     <th>Total ($)</th>
                     <th>Pago parcial ($)</th>
                     <th>Saldo pendiente ($)</th>
                     <th>Estado</th>
                   </tr>
                 </thead>
                 <tbody>`;

      let saldoPendiente = total;
      if (data.pagos && data.pagos.length > 0) {
        data.pagos.forEach(pago => {
          const montoPago = Number(pago.monto) || 0;
          saldoPendiente -= montoPago;

          let claseFila = "";
          let estadoFila = "";
          let saldoMostrar = saldoPendiente.toFixed(2);

          if (saldoPendiente > 0) {
            claseFila = "table-danger";
            estadoFila = "Pendiente";
          } else {
            claseFila = "table-light";
            estadoFila = "Pagado totalmente";
            saldoMostrar = "$0.00";
          }

          html += `<tr class="${claseFila}">
                     <td>${pago.fecha_pago.split("T")[0]}</td>
                     <td>$${total.toFixed(2)}</td>
                     <td>$${montoPago.toFixed(2)}</td>
                     <td>${saldoMostrar}</td>
                     <td>${estadoFila}</td>
                   </tr>`;

          if (saldoPendiente < 0) {
            html += `<tr class="table-warning">
                       <td colspan="3">—</td>
                       <td colspan="2"><strong>Saldo a favor $${Math.abs(saldoPendiente).toFixed(2)}</strong></td>
                     </tr>`;
            saldoPendiente = 0;
          }
        });
      } else {
        html += `<tr><td colspan="5" class="text-center">No hay pagos registrados</td></tr>`;
      }

      html += `</tbody></table>`;
      cardBody.innerHTML = html;
      cardBody.classList.remove("d-none");
      btn.textContent = "Ocultar pagos";
    })
    .catch(err => {
      console.error("Error al obtener historial de pagos:", err);
      cardBody.innerHTML = "<p>Error al cargar historial.</p>";
    });
}

function descargarPedido(pedidoId, clienteNombre) {
  const cardBody = document.getElementById(`pedido-${pedidoId}`);

  if (cardBody.classList.contains("d-none") || cardBody.innerHTML.trim() === "") {
    alert("Primero expanda el pedido con 'Ver pagos' para poder descargarlo.");
    return;
  }

  html2canvas(cardBody, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    const nombreArchivo = `pedido_${pedidoId}_${clienteNombre.replace(/\s+/g, "_")}.png`;
    link.download = nombreArchivo;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}
