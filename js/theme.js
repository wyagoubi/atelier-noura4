/* ==========================================================
   Atelier Noura — Theme / UI controller
   Visual-only enhancement. Does not touch Supabase, cart or orders.
========================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "atelier_noura_theme";

  function getSavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    document.querySelectorAll("[data-theme-label]").forEach((element) => {
      element.textContent = theme === "dark" ? "Light" : "Dark";
    });

    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.setAttribute("aria-label", theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
      button.setAttribute("title", theme === "dark" ? "Light mode" : "Dark mode");
      const thumb = button.querySelector(".theme-thumb");
      if (thumb) thumb.textContent = theme === "dark" ? "☀" : "☾";
    });
  }

  function createThemeButton() {
    if (document.getElementById("themeToggle")) return;

    const actions = document.querySelector(".actions");
    if (!actions) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "themeToggle";
    button.className = "theme-toggle";
    button.innerHTML = '<span class="theme-thumb">☾</span>';

    button.addEventListener("click", function () {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });

    const menu = actions.querySelector(".menu-btn");
    if (menu) actions.insertBefore(button, menu);
    else actions.appendChild(button);
  }

  function addCheckoutHeaderControls() {
    const header = document.querySelector(".site-header");
    if (!header || header.querySelector(".actions")) return;

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = '<a class="bag" href="cart.html">♡ <span id="cartCount">0</span></a>';
    header.appendChild(actions);
    const cart = (() => { try { return JSON.parse(localStorage.getItem("atelier_noura_cart") || "[]"); } catch (_) { return []; } })();
    const count = cart.reduce((sum, item) => sum + Number(item.qty || item.quantity || 0), 0);
    const badge = actions.querySelector("#cartCount");
    if (badge) badge.textContent = String(count);
  }


  function createOwnerThemeButton() {
    const button = document.getElementById("ownerTheme");
    if (!button || button.dataset.themeBound === "true") return;
    button.dataset.themeBound = "true";
    button.addEventListener("click", function () {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }

  function init() {
    applyTheme(getSavedTheme());
    addCheckoutHeaderControls();
    createThemeButton();
    createOwnerThemeButton();
    applyTheme(document.documentElement.getAttribute("data-theme") || getSavedTheme());

    const header = document.querySelector(".site-header");
    if (header) {
      const update = () => header.classList.toggle("scrolled", window.scrollY > 16);
      update();
      window.addEventListener("scroll", update, { passive: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
