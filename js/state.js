// =============================================
// STATE & STORAGE
// =============================================
let state = {
  activeUser: null,
  profiles: ["Ahmet", "Mehmet", "Ali", "Ayşe", "Fatma", "Hasan"],
  vehicles: [],
  orders: [],
  stocks: [],
  currentTab: "active",
  modalOrderId: null,
  shippingOrderId: null,
  editingOrderId: null, // Düzenlenen siparişin ID'si
  historyPage: 1, // Geçmiş sekmesi sayfa numarası
  pickerLat: null,
  pickerLng: null,
  pickerMarker: null,
  pickerMapInstance: null,
  isMapCollapsed: true,
  mapInstance: null,
  mapMarkers: {},
  activeGeolocationWatch: null,
  wakeLockInstance: null,
  theme: "light",
  voiceEnabled: false,
  supabaseUrl: "https://fnwikxmspdxamsostbnb.supabase.co",
  supabaseKey: "sb_publishable_tlsSFNjL-zfH-KUWShqIkQ_H5G97Hvd",
  modalSortOrder: "unchecked-first", // 'normal', 'unchecked-first', 'checked-first'
  currentModalOrder: null,
  adminProfiles: []
};

let supabaseClient = null;

function loadState() {
  // Oturum yönetimi Supabase Auth üzerinden asenkron yönetileceği için local storage tabanlı kilit kontrolü kaldırıldı.

  const saved = localStorage.getItem("ayg-state");
  if (saved) {
    const parsed = JSON.parse(saved);
    state.profiles = parsed.profiles || state.profiles;
    state.adminProfiles = parsed.adminProfiles || [];
    state.vehicles = parsed.vehicles || [];
    state.orders = parsed.orders || [];
    state.stocks = parsed.stocks || [];
    state.activeUser = parsed.activeUser || null;
    state.theme = parsed.theme || "light";
    state.voiceEnabled = parsed.voiceEnabled !== undefined ? parsed.voiceEnabled : false;
    state.supabaseUrl = parsed.supabaseUrl || state.supabaseUrl;
    state.supabaseKey = parsed.supabaseKey || state.supabaseKey;
  }

  if (typeof applyTheme === "function") applyTheme();

  const voiceToggle = document.getElementById("settings-voice-toggle");
  if (voiceToggle) voiceToggle.checked = state.voiceEnabled;

  // Supabase istemcisini başlat
  initSupabaseClient();
}

function saveState() {
  // Sadece aktif siparişleri ve en son 10 geçmiş siparişi localStorage'a kaydet (performans optimizasyonu)
  const activeOrders = state.orders.filter(o => o.status !== "Teslim Edildi");
  const recentHistory = state.orders
    .filter(o => o.status === "Teslim Edildi")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);
  
  const ordersToSave = [...activeOrders, ...recentHistory];

  localStorage.setItem(
    "ayg-state",
    JSON.stringify({
      profiles: state.profiles,
      adminProfiles: state.adminProfiles || [],
      vehicles: state.vehicles,
      orders: ordersToSave,
      stocks: state.stocks || [],
      activeUser: state.activeUser,
      theme: state.theme,
      voiceEnabled: state.voiceEnabled,
      supabaseUrl: state.supabaseUrl,
      supabaseKey: state.supabaseKey
    }),
  );
}

function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
  );
}

// Supabase İstemci Başlatıcı
function initSupabaseClient() {
  const urlInput = document.getElementById("supabase-url-input");
  const keyInput = document.getElementById("supabase-key-input");

  if (urlInput) urlInput.value = state.supabaseUrl;
  if (keyInput) keyInput.value = state.supabaseKey;

  if (state.supabaseUrl && state.supabaseKey) {
    try {
      if (typeof supabasejs !== "undefined" || (window.supabase && typeof window.supabase.createClient === "function")) {
        const creator = window.supabase ? window.supabase.createClient : supabasejs.createClient;
        supabaseClient = creator(state.supabaseUrl, state.supabaseKey);
        updateSupabaseStatusText("Bağlı (Bulut Senkronizasyonu Aktif)", "text-emerald-500");
      }
    } catch (e) {
      console.error("Supabase başlatılamadı:", e);
      updateSupabaseStatusText("Bağlantı Hatası!", "text-red-500");
    }
  } else {
    supabaseClient = null;
    updateSupabaseStatusText("Yerel Mod (LocalStorage)", "text-slate-400 dark:text-slate-500");
  }
}

function updateSupabaseStatusText(text, colorClass) {
  const statusEl = document.getElementById("supabase-status-text");
  if (statusEl) {
    statusEl.textContent = `Durum: ${text}`;
    statusEl.className = `text-[10px] font-bold text-center mt-1 ${colorClass}`;
  }
}

// Supabase Ayarlarını Kaydet ve Bağlan
async function saveSupabaseSettings() {
  const url = document.getElementById("supabase-url-input").value.trim();
  const key = document.getElementById("supabase-key-input").value.trim();

  if (!url || !key) {
    // Bilgiler boşsa yerel moda dön
    state.supabaseUrl = "";
    state.supabaseKey = "";
    supabaseClient = null;
    saveState();
    updateSupabaseStatusText("Yerel Mod (LocalStorage)", "text-slate-400 dark:text-slate-500");
    showToast("Bağlantı temizlendi. Yerel moda geçildi.", "warning");

    // Yerel siparişleri yükle ve arayüzü çiz
    if (typeof loadOrders === "function") loadOrders();
    return;
  }

  updateSupabaseStatusText("Bağlanıyor...", "text-amber-500 animate-pulse");

  try {
    const creator = window.supabase ? window.supabase.createClient : supabasejs.createClient;
    const testClient = creator(url, key);

    // Basit bir okuma testi yaparak API anahtarlarının doğruluğunu doğrula
    const { data, error } = await testClient.from("orders").select("id").limit(1);

    if (error && error.code !== "PGRST116") { // PGRST116: Tablo boş veya bulunamadı hatası olabilir, ama erişim hatası değilse (örn: CORS veya yetki)
      throw error;
    }

    // Bağlantı başarılı!
    state.supabaseUrl = url;
    state.supabaseKey = key;
    supabaseClient = testClient;
    saveState();

    updateSupabaseStatusText("Bağlı (Bulut Senkronizasyonu Aktif)", "text-emerald-500");
    showToast("Bulut bağlantısı başarıyla kuruldu!", "success");

    // Verileri buluttan çek
    if (typeof syncWithSupabase === "function") {
      await syncWithSupabase();
    }

  } catch (err) {
    console.error("Supabase test hatası:", err);
    updateSupabaseStatusText("Bağlantı Başarısız! (Bilgileri Kontrol Edin)", "text-red-500");
    showToast("Bağlantı kurulamadı. SQL şeması kurulu mu veya API Key doğru mu?", "error");
  }
}

// Global Yetki Kontrolü
function isAdminUser() {
  return state.activeUser === "Admin" || (state.adminProfiles && state.adminProfiles.includes(state.activeUser));
}

// HTML Karakterlerini Temizleme (XSS Koruması)
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
