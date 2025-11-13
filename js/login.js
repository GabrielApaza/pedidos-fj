// js/login.js

document.getElementById("loginForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const usuario = document.getElementById("usuario").value;
  const password = document.getElementById("password").value;
  const mensaje = document.getElementById("mensaje");

  // 🔐 Usuario y contraseña fijos (podés cambiarlos)
  const USER = "admin";
  const PASS = "1234";

  if (usuario === USER && password === PASS) {
    // Guardamos la sesión
    localStorage.setItem("logueado", "true");
    // Redirige a la página principal
    window.location.href = "index1.html";
  } else {
    mensaje.textContent = "Usuario o contraseña incorrectos";
  }
});
