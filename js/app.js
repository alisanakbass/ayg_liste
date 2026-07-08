// =============================================
// MAIN APP ROUTING & CORE UTILITIES
// =============================================

// BroadcastChannel (sekme senkronizasyonu - Supabase olmadığında yedek olarak çalışır)
let bc;
function initBroadcastChannel() {
  try {
    bc = new BroadcastChannel("ayg-orders");
    bc.onmessage = (e) => {
      if (e.data.type === "STATE_UPDATE" && !supabaseClient) {
        state.orders = e.data.orders;
        saveState();
        if (typeof renderActiveOrders === "function") renderActiveOrders();
        if (typeof renderHistory === "function") renderHistory();
        if (typeof updateStats === "function") updateStats();
        if (e.data.voiceMsg) {
          speakText(e.data.voiceMsg);
        }
      }
    };
  } catch (e) {
    /* BroadcastChannel desteklenmiyor */
  }
}

function broadcastUpdate(voiceMsg) {
  if (supabaseClient) return; // Supabase bağlıysa realtime çalışır, broadcast'e gerek yoktur
  try {
    if (bc) {
      bc.postMessage({ 
        type: "STATE_UPDATE", 
        orders: state.orders,
        voiceMsg: voiceMsg
      });
    }
  } catch (e) {}
}

// Supabase Real-time Dinleyicisi
let supabaseChannelOrders = null;
let supabaseChannelProfiles = null;

function initSupabaseRealtime() {
  if (!supabaseClient) return;

  try {
    // Önceki kanalları kapat
    if (supabaseChannelOrders) supabaseClient.removeChannel(supabaseChannelOrders);
    if (supabaseChannelProfiles) supabaseClient.removeChannel(supabaseChannelProfiles);

    supabaseChannelOrders = supabaseClient
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        // Değişiklik algılandığında verileri tekrar senkronize et
        await syncWithSupabase(false); // Sesli bildirimleri tetiklemek üzere sync
        
        // Sesli bildirim tetikleyicisi
        if (payload.eventType === "INSERT") {
          speakText("Yeni sipariş oluşturuldu.");
          showToast("🔔 Yeni bir sipariş geldi!", "success");
        } else if (payload.eventType === "UPDATE") {
          const oldRecord = payload.old;
          const newRecord = payload.new;
          if (oldRecord.status !== newRecord.status && newRecord.status === "Tamamlandı") {
            speakText("Sipariş tamamlandı.");
          }
        }
      })
      .subscribe();

    supabaseChannelProfiles = supabaseClient
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
        await syncWithSupabase(false);
      })
      .subscribe();
  } catch (e) {
    console.error("Supabase Realtime aboneliğinde hata:", e);
  }
}

// Supabase'den Verileri Çek ve Yerel Durumu Güncelle
async function syncWithSupabase(triggerUI = true) {
  if (!supabaseClient) return;

  try {
    // Siparişleri çek
    const { data: dbOrders, error: ordersErr } = await supabaseClient
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersErr) throw ordersErr;

    // Profilleri çek
    const { data: dbProfiles, error: profilesErr } = await supabaseClient
      .from("profiles")
      .select("name");

    if (profilesErr) throw profilesErr;

    // State'i güncelle
    state.orders = dbOrders || [];
    state.profiles = (dbProfiles || []).map(p => p.name);
    
    // Varsayılan profilleri koru (eğer veritabanı tamamen boşsa)
    if (state.profiles.length === 0) {
      state.profiles = ["Ahmet", "Mehmet", "Ali", "Ayşe", "Fatma", "Hasan"];
    }

    saveState();

    if (triggerUI) {
      if (typeof renderActiveOrders === "function") renderActiveOrders();
      if (typeof renderHistory === "function") renderHistory();
      if (typeof renderProfiles === "function") renderProfiles();
      if (typeof renderAdminProfiles === "function") renderAdminProfiles();
      if (typeof updateStats === "function") updateStats();
    }
  } catch (err) {
    console.error("Supabase senkronizasyon hatası:", err);
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  ["create", "active", "history", "admin"].forEach((t) => {
    const page = document.getElementById(`page-${t}`);
    if (page) page.classList.add("hidden");
    const el = document.getElementById(`tab-${t}`);
    if (el) {
      el.classList.remove("tab-active", "text-indigo-600", "dark:text-indigo-400");
      el.classList.add("text-slate-500", "dark:text-slate-400");
    }
  });
  
  const activePage = document.getElementById(`page-${tab}`);
  if (activePage) activePage.classList.remove("hidden");
  
  const activeEl = document.getElementById(`tab-${tab}`);
  if (activeEl) {
    activeEl.classList.add("tab-active", "text-indigo-600", "dark:text-indigo-400");
    activeEl.classList.remove("text-slate-500", "dark:text-slate-400");
  }

  // Dashboard paneli sadece Aktif ve Geçmiş sayfalarında gösterilir
  const dashboard = document.getElementById("dashboard-panel");
  if (dashboard) {
    if (tab === "active" || tab === "history") {
      dashboard.classList.remove("hidden");
    } else {
      dashboard.classList.add("hidden");
    }
  }

  if (tab === "active" && typeof renderActiveOrders === "function") {
    renderActiveOrders();
  }
  if (tab === "history" && typeof renderHistory === "function") {
    renderHistory();
  }
  if (tab === "create" && typeof initOrderForm === "function" && !state.editingOrderId) {
    initOrderForm();
  }
  if (tab === "admin" && typeof renderAdminProfiles === "function") {
    renderAdminProfiles();
  }
  if (typeof updateStats === "function") updateStats();
}

function showToast(message, type = "success", duration = 4000) {
  const icons = {
    success: `<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    error: `<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    warning: `<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
  };

  const colors = {
    success: "bg-emerald-600 dark:bg-emerald-700 text-white shadow-emerald-500/10",
    error: "bg-red-600 dark:bg-red-700 text-white shadow-red-500/10",
    warning: "bg-amber-500 dark:bg-amber-600 text-white shadow-amber-500/10",
  };

  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${colors[type]} px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center border border-white/10`;
  toast.innerHTML = `${icons[type]} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), duration + 500);
}

function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateRelative(isoStr) {
  if (!isoStr) return "—";
  const now = new Date();
  const date = new Date(isoStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Şimdi";
  if (diffMins < 60) return `${diffMins} dk önce`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;

  return formatDate(isoStr);
}

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.remove("hidden");
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.add("hidden");
}

// =============================================
// APP INIT
// =============================================
async function init() {
  loadState();
  initBroadcastChannel();

  if (supabaseClient) {
    // Supabase bağlıysa bulutla eşle ve dinlemeye başla
    await syncWithSupabase(true);
    initSupabaseRealtime();
  }

  if (state.activeUser) {
    const mainApp = document.getElementById("main-app");
    if (mainApp) mainApp.classList.remove("hidden");
    const headerUser = document.getElementById("header-username");
    if (headerUser) headerUser.textContent = state.activeUser;
    switchTab("active");
  } else {
    if (typeof showProfileScreen === "function") showProfileScreen();
  }
}

// Başlat
window.addEventListener("DOMContentLoaded", init);
