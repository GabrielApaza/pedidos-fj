// js/toast.js

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // animación de entrada
  setTimeout(() => toast.classList.add("show"), 100);

  // se elimina después de 3s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
