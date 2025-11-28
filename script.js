const API_KEY = "bf29e9adb54942158a3141400252811";
const GEO_LIMIT = 6;
const AUTO_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

let state = {
  current: null,
  data: null,
  unit: localStorage.getItem("weather_unit") || "metric",
  favorites: JSON.parse(localStorage.getItem("weather_favorites") || "[]"),
  theme: localStorage.getItem("weather_theme") || "light",
  autoUpdateTimer: null,
  forecastMode: "daily",
};

const el = {
  searchInput: document.getElementById("search-input"),
  suggestions: document.getElementById("suggestions"),
  refreshBtn: document.getElementById("refresh-btn"),
  unitToggle: document.getElementById("unit-toggle"),
  themeToggle: document.getElementById("theme-toggle"),
  favoritesBox: document.getElementById("favorites"),
  locationName: document.getElementById("location-name"),
  weatherDesc: document.getElementById("weather-desc"),
  timestamp: document.getElementById("timestamp"),
  temp: document.getElementById("temp"),
  weatherIcon: document.getElementById("weather-icon"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  forecast: document.getElementById("forecast"),
  saveFavBtn: document.getElementById("save-fav"),
  removeFavBtn: document.getElementById("remove-fav"),
  loading: document.getElementById("loading"),
  errorMsg: document.getElementById("error-msg"),
  lastUpdated: document.getElementById("last-updated"),
};

function showLoading(show = true) {
  el.loading.classList.toggle("hidden", !show);
}
function showError(msg) {
  el.errorMsg.textContent = msg || "";
  el.errorMsg.classList.toggle("hidden", !msg);
}
function formatTemp(val) {
  const sign = state.unit === "metric" ? "°C" : "°F";
  return `${Math.round(val)}${sign}`;
}
function saveState() {
  localStorage.setItem("weather_favorites", JSON.stringify(state.favorites));
  localStorage.setItem("weather_unit", state.unit);
  localStorage.setItem("weather_theme", state.theme);
}
function applyTheme() {
  document.documentElement.classList.toggle("dark", state.theme === "dark");
  saveState();
}

let suggestTimer = null;
el.searchInput.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(fetchSuggestions, 300);
});

async function fetchSuggestions() {
  const q = el.searchInput.value.trim();
  if (!q) return (el.suggestions.innerHTML = "", el.suggestions.classList.add("hidden"));

  const url = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url);
    const list = await res.json();
    renderSuggestions(list.slice(0, GEO_LIMIT));
  } catch {
    renderSuggestions([]);
  }
}

function renderSuggestions(list) {
  el.suggestions.innerHTML = "";
  if (!list.length) return el.suggestions.classList.add("hidden");

  list.forEach((item) => {
    const li = document.createElement("li");
    li.className = "px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700";
    li.textContent = `${item.name}, ${item.country}`;
    li.onclick = () => {
      el.searchInput.value = li.textContent;
      selectCity(item);
      el.suggestions.classList.add("hidden");
    };
    el.suggestions.appendChild(li);
  });

  el.suggestions.classList.remove("hidden");
}

async function fetchWeather(lat, lon) {
  showLoading(true);

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${lat},${lon}&days=5&aqi=yes`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    showLoading(false);
    return json;
  } catch (err) {
    showLoading(false);
    showError("Failed to fetch weather data.");
    throw err;
  }
}

function renderCurrent(name, data) {
  state.data = data;

  el.locationName.textContent = `${data.location.name}, ${data.location.country}`;
  el.weatherDesc.textContent = data.current.condition.text;
  el.timestamp.textContent = "Local Time: " + data.location.localtime;

  const tempVal = state.unit === "metric" ? data.current.temp_c : data.current.temp_f;
  el.temp.textContent = formatTemp(tempVal);

  el.weatherIcon.src = `https:${data.current.condition.icon}`;
  el.humidity.textContent = `${data.current.humidity}%`;

  const wind = state.unit === "metric" ? `${data.current.wind_kph} km/h` : `${data.current.wind_mph} mph`;
  el.wind.textContent = wind;

  el.pressure.textContent = `${data.current.pressure_mb} hPa`;

  el.lastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  el.lastUpdated.classList.remove("hidden");

  const isFav = state.favorites.some((f) => f.lat === state.current.lat && f.lon === state.current.lon);
  el.saveFavBtn.classList.toggle("hidden", isFav);
  el.removeFavBtn.classList.toggle("hidden", !isFav);
}

function renderForecast(data) {
  el.forecast.innerHTML = "";

  if (state.forecastMode === "hourly") {
    data.forecast.forecastday[0].hour.forEach((hour) => {
      const temp = state.unit === "metric" ? hour.temp_c : hour.temp_f;

      const card = document.createElement("div");
      card.className =
        "p-3 rounded-lg bg-slate-50 dark:bg-slate-700 flex justify-between items-center fade-in";

      card.innerHTML = `
        <div>
          <div class="text-sm font-semibold">${hour.time.split(" ")[1]}</div>
          <div class="text-xs">${hour.condition.text}</div>
        </div>
        <div class="text-right">
          <img src="https:${hour.condition.icon}" class="w-10 h-10" />
          <div class="text-sm">${formatTemp(temp)}</div>
        </div>
      `;
      el.forecast.appendChild(card);
    });

    return;
  }

  data.forecast.forecastday.forEach((day) => {
    const max = state.unit === "metric" ? day.day.maxtemp_c : day.day.maxtemp_f;
    const min = state.unit === "metric" ? day.day.mintemp_c : day.day.mintemp_f;

    const card = document.createElement("div");
    card.className =
      "p-3 rounded-lg bg-slate-50 dark:bg-slate-700 flex justify-between items-center fade-in";
    card.innerHTML = `
      <div>
        <div class="text-sm font-medium">${day.date}</div>
        <div class="text-xs text-slate-400">${day.day.condition.text}</div>
      </div>
      <div class="text-right">
        <img src="https:${day.day.condition.icon}" class="w-12 h-12" />
        <div class="text-sm font-medium">${formatTemp(max)} / <span class="text-slate-400">${formatTemp(min)}</span></div>
      </div>
    `;
    el.forecast.appendChild(card);
  });
}

async function selectCity({ name, lat, lon }) {
  state.current = { name, lat, lon };
  try {
    const data = await fetchWeather(lat, lon);
    renderCurrent(name, data);
    renderForecast(data);
    resetAutoUpdate();
  } catch {}
}

function renderFavorites() {
  el.favoritesBox.innerHTML = "";

  if (!state.favorites.length)
    return (el.favoritesBox.innerHTML = `<div class="text-sm text-slate-500">Belum ada favorit</div>`);

  state.favorites.forEach((f, i) => {
    const btn = document.createElement("button");
    btn.className = "px-3 py-1 rounded-full border hover:shadow-sm";
    btn.textContent = f.name;
    btn.onclick = () => selectCity(f);

    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.className = "ml-2 text-red-500 text-sm";
    remove.onclick = (e) => {
      e.stopPropagation();
      state.favorites.splice(i, 1);
      saveState();
      renderFavorites();
    };

    const wrap = document.createElement("div");
    wrap.className = "flex items-center";
    wrap.append(btn, remove);

    el.favoritesBox.append(wrap);
  });
}

el.saveFavBtn.onclick = () => {
  if (!state.current) return;
  if (!state.favorites.some((f) => f.lat === state.current.lat))
    state.favorites.push(state.current);
  saveState();
  renderFavorites();
  el.saveFavBtn.classList.add("hidden");
  el.removeFavBtn.classList.remove("hidden");
};

el.removeFavBtn.onclick = () => {
  state.favorites = state.favorites.filter((f) => f.lat !== state.current.lat);
  saveState();
  renderFavorites();
  el.saveFavBtn.classList.remove("hidden");
  el.removeFavBtn.classList.add("hidden");
};

el.unitToggle.checked = state.unit === "imperial";
el.unitToggle.onchange = () => {
  state.unit = el.unitToggle.checked ? "imperial" : "metric";
  saveState();
  if (state.current) selectCity(state.current);
};

el.themeToggle.onclick = () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
};

el.refreshBtn.onclick = async () => {
  if (!state.current) return;
  showLoading(true);
  const updated = await fetchWeather(state.current.lat, state.current.lon);
  renderCurrent(state.current.name, updated);
  renderForecast(updated);

  const toast = document.createElement("div");
  toast.className =
    "fixed bottom-5 right-5 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-md text-sm";
  toast.textContent = "Weather updated";
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
};

const forecastToggle = document.createElement("button");
forecastToggle.className =
  "mt-3 px-3 py-2 border rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition";
forecastToggle.textContent = "Switch to HOURLY";

forecastToggle.onclick = () => {
  state.forecastMode = state.forecastMode === "daily" ? "hourly" : "daily";
  forecastToggle.textContent = state.forecastMode === "daily" ? "Switch to HOURLY" : "Switch to DAILY";
  if (state.data) renderForecast(state.data);
};

el.forecast.before(forecastToggle);

function resetAutoUpdate() {
  clearInterval(state.autoUpdateTimer);
  state.autoUpdateTimer = setInterval(() => {
    if (state.current) selectCity(state.current);
  }, AUTO_UPDATE_INTERVAL_MS);
}

(function init() {
  applyTheme();
  renderFavorites();
  showError(null);
  showLoading(false);

  if (state.favorites.length) selectCity(state.favorites[0]);
})();
