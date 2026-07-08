// =============================================
// THEME MANAGEMENT
// =============================================
function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  saveState();
  applyTheme();
}

function applyTheme() {
  const html = document.documentElement;
  const iconSun = document.getElementById("theme-icon-sun");
  const iconMoon = document.getElementById("theme-icon-moon");

  if (state.theme === "dark") {
    html.classList.add("dark");
    if (iconSun && iconMoon) {
      iconSun.classList.remove("hidden");
      iconMoon.classList.add("hidden");
    }
  } else {
    html.classList.remove("dark");
    if (iconSun && iconMoon) {
      iconSun.classList.add("hidden");
      iconMoon.classList.remove("hidden");
    }
  }
}
