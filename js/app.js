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
        if (typeof renderShippingOrders === "function") renderShippingOrders();
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
let supabaseChannelVehicles = null;

function initSupabaseRealtime() {
  if (!supabaseClient) return;

  try {
    // Önceki kanalları kapat
    if (supabaseChannelOrders) supabaseClient.removeChannel(supabaseChannelOrders);
    if (supabaseChannelProfiles) supabaseClient.removeChannel(supabaseChannelProfiles);
    if (supabaseChannelVehicles) supabaseClient.removeChannel(supabaseChannelVehicles);

    supabaseChannelOrders = supabaseClient
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        // Değişiklik algılandığında verileri tekrar senkronize et
        await syncWithSupabase(false); // Sesli bildirimleri tetiklemek üzere sync
        
        // Sesli bildirim tetikleyicisi
        if (payload.eventType === "INSERT") {
          speakText("Yeni sipariş oluşturuldu.");
          showToast("🔔 Yeni bir sipariş geldi!", "success");
          playNotificationSound();
          
          // Tarayıcı Bildirimi (Service Worker ve Normal Bildirim Desteğiyle)
          if ("Notification" in window && Notification.permission === "granted") {
            const companyName = payload.new.customer_address.split(" [Adres:")[0] || "Müşteri";
            const notifTitle = "🔔 Yeni AYG Siparişi!";
            const notifOptions = {
              body: `${companyName} yeni bir sipariş oluşturdu.`,
              icon: "icon-192.png",
              badge: "icon-192.png",
              vibrate: [200, 100, 200],
              tag: payload.new.id
            };

            try {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistration().then(reg => {
                  if (reg) {
                    reg.showNotification(notifTitle, notifOptions);
                  } else {
                    new Notification(notifTitle, notifOptions);
                  }
                }).catch(() => {
                  new Notification(notifTitle, notifOptions);
                });
              } else {
                new Notification(notifTitle, notifOptions);
              }
            } catch (e) {
              console.warn("Bildirim hatası:", e);
            }
          }
        } else if (payload.eventType === "UPDATE") {
          const oldRecord = payload.old;
          const newRecord = payload.new;
          if (oldRecord.status !== newRecord.status) {
            if (newRecord.status === "Tamamlandı") {
              speakText("Sipariş tamamlandı.");
            } else if (newRecord.status === "Yolda") {
              speakText("Sipariş yola çıktı.");
            } else if (newRecord.status === "Teslim Edildi") {
              speakText("Sipariş teslim edildi.");
            }
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

    supabaseChannelVehicles = supabaseClient
      .channel('public:vehicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, async (payload) => {
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
      .select("name, is_admin");

    if (profilesErr) throw profilesErr;

    // Araçları çek
    let dbVehicles = [];
    const { data: dbVeh, error: vehErr } = await supabaseClient
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!vehErr) {
      dbVehicles = dbVeh || [];
    }

    // State'i güncelle
    state.orders = dbOrders || [];
    state.profiles = (dbProfiles || []).map(p => p.name);
    state.adminProfiles = (dbProfiles || []).filter(p => p.is_admin).map(p => p.name);
    state.vehicles = dbVehicles || [];
    
    // Varsayılan profilleri koru (eğer veritabanı tamamen boşsa ve yerel moddaysak)
    if (state.profiles.length === 0 && !supabaseClient) {
      state.profiles = ["Ahmet", "Mehmet", "Ali", "Ayşe", "Fatma", "Hasan"];
    }

    saveState();

    if (triggerUI) {
      if (typeof renderActiveOrders === "function") renderActiveOrders();
      if (typeof renderShippingOrders === "function") renderShippingOrders();
      if (typeof renderHistory === "function") renderHistory();
      if (typeof renderProfiles === "function") renderProfiles();
      if (typeof renderAdminProfiles === "function") renderAdminProfiles();
      if (typeof renderAdminVehicles === "function") renderAdminVehicles();
      if (typeof updateStats === "function") updateStats();
      if (typeof updateAdminUI === "function") updateAdminUI();
    }
  } catch (err) {
    console.error("Supabase senkronizasyon hatası:", err);
  }
}

function switchTab(tab) {
  if (tab === "admin" && !isAdminUser()) {
    showToast("Yönetici paneline sadece Yöneticiler erişebilir!", "error");
    return;
  }
  
  state.currentTab = tab;
  ["create", "active", "shipping", "history", "admin"].forEach((t) => {
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

  // Dashboard paneli sadece Aktif, Sevkiyat ve Geçmiş sayfalarında gösterilir
  const dashboard = document.getElementById("dashboard-panel");
  if (dashboard) {
    if (tab === "active" || tab === "shipping" || tab === "history") {
      dashboard.classList.remove("hidden");
    } else {
      dashboard.classList.add("hidden");
    }
  }

  if (tab === "active" && typeof renderActiveOrders === "function") {
    renderActiveOrders();
  }
  if (tab === "shipping" && typeof renderShippingOrders === "function") {
    renderShippingOrders();
    if (typeof initShippingMap === "function") {
      initShippingMap();
    }
  }
  if (tab === "history" && typeof renderHistory === "function") {
    renderHistory();
  }
  if (tab === "create" && typeof initOrderForm === "function" && !state.editingOrderId) {
    initOrderForm();
  }
  if (tab === "admin" && typeof switchAdminSubTab === "function") {
    switchAdminSubTab("profiles");
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

  // Tarayıcı Bildirim İzni İste (Kullanıcıyı sürekli rahatsız etmemek için hafıza kontrolü)
  if ("Notification" in window && Notification.permission === "default") {
    const isDismissed = localStorage.getItem("ayg-notification-dismissed") === "true";
    if (!isDismissed) {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          setTimeout(subscribeUserToPush, 2000);
        } else {
          // Kullanıcı izin vermediyse (reddettiyse veya kapattıysa) bir daha otomatik sorma
          localStorage.setItem("ayg-notification-dismissed", "true");
        }
      });
    }
  }

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
    if (typeof updateAdminUI === "function") updateAdminUI();

    // Yolda olan sipariş için konum takibini otomatik olarak sürdür
    if (typeof initDriverLocationTracking === "function") {
      const activeYoldaOrder = state.orders.find(o => o.status === "Yolda" && (o.picked_by === state.activeUser || o.created_by === state.activeUser));
      if (activeYoldaOrder) {
        initDriverLocationTracking(activeYoldaOrder.id);
      }
    }

    switchTab(state.currentTab || "active");

    // Web Push aboneliğini sessizce güncelle/kaydet
    if (Notification.permission === "granted") {
      setTimeout(subscribeUserToPush, 2000);
    }
  } else {
    if (typeof showProfileScreen === "function") showProfileScreen();
  }
}

function updateAdminUI() {
  const tabAdmin = document.getElementById("tab-admin");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const btnSettingsToggle = document.getElementById("btn-settings-toggle");
  const btnQrScan = document.getElementById("btn-qr-scan");
  
  const isSuper = isAdminUser();
  
  if (tabAdmin) {
    if (isSuper) {
      tabAdmin.classList.remove("hidden");
      // Admin girdiyse verileri yükle
      if (typeof renderAdminQR === "function") renderAdminQR();
      if (typeof loadShiftSettings === "function") loadShiftSettings();
      if (typeof loadAttendanceLogs === "function") loadAttendanceLogs();
      if (typeof populateNotificationTargets === "function") populateNotificationTargets();
    } else {
      tabAdmin.classList.add("hidden");
      if (state.currentTab === "admin") {
        switchTab("active");
      }
    }
  }
  
  if (btnClearHistory) {
    if (isSuper) {
      btnClearHistory.classList.remove("hidden");
    } else {
      btnClearHistory.classList.add("hidden");
    }
  }

  if (btnSettingsToggle) {
    if (isSuper) {
      btnSettingsToggle.classList.remove("hidden");
    } else {
      btnSettingsToggle.classList.add("hidden");
    }
  }

  if (btnQrScan) {
    if (state.activeUser && !isSuper) {
      btnQrScan.classList.remove("hidden");
      // Bildirimleri denetle (Kullanıcı giriş yaptığında)
      if (typeof checkStaffNotifications === "function") {
        setTimeout(checkStaffNotifications, 1000);
        if (window.notifInterval) clearInterval(window.notifInterval);
        window.notifInterval = setInterval(checkStaffNotifications, 60000); // 1 dakikada bir kontrol
      }
    } else {
      btnQrScan.classList.add("hidden");
      if (window.notifInterval) clearInterval(window.notifInterval);
    }
  }
}

// Başlat
window.addEventListener("DOMContentLoaded", init);

// Global AudioContext (Tarayıcı otomatik oynatma engellerini aşmak için)
let globalAudioContext = null;

// Kullanıcı sayfaya ilk tıkladığında ses motorunu hazırla
window.addEventListener("click", () => {
  try {
    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    } else if (globalAudioContext.state === "suspended") {
      globalAudioContext.resume();
    }
  } catch (e) {
    console.warn("Ses motoru başlatılamadı:", e);
  }
}, { once: true });

// Dinamik Zil/Bildirim Sesi
function playNotificationSound() {
  try {
    const audioContext = globalAudioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // 2 tonlu şık zil sesi (C5 ve E5)
    const playTone = (freq, start, duration) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioContext.currentTime + start);
      gain.gain.setValueAtTime(0.25, audioContext.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + start + duration);
      osc.start(audioContext.currentTime + start);
      osc.stop(audioContext.currentTime + start + duration);
    };
    playTone(523.25, 0, 0.15); // Bip
    playTone(659.25, 0.15, 0.35); // Bap
  } catch (e) {
    console.warn("Ses çalınamadı:", e);
  }
}

// =============================================
// WEB PUSH ABONELİK AYARLARI
// =============================================
const PUBLIC_VAPID_KEY = "BBgNO2NXgx6kTb2YFoR-cimPL0PwaO7GB5xDpc7xIgFeSjrRmejFC6aHsUUPgSmbIxCBLLmVVPfCJLlrEMNpjl8";

// Base64 VAPID Key'i Uint8Array'e Dönüştürme (Web Push Standardı)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Tarayıcıyı Google/Apple Push Servislerine Kaydet ve Jetonu Supabase'e Yaz
async function subscribeUserToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Web Push bu tarayıcıda desteklenmiyor.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Mevcut bir abonelik var mı kontrol et
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Yoksa yeni abonelik al
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      };
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // Aboneliği Supabase'e kaydet (upsert mantığıyla)
    if (supabaseClient && state.activeUser) {
      const { error } = await supabaseClient
        .from('push_subscriptions')
        .upsert([{ 
          profile_name: state.activeUser, 
          subscription: subscription.toJSON() 
        }], { onConflict: 'subscription' });

      if (error) {
        console.error("Abonelik Supabase'e kaydedilemedi:", error);
        if (error.message && error.message.includes("does not exist")) {
          showToast("⚠️ Veritabanında push_subscriptions tablosu bulunamadı! Lütfen SQL kodunu çalıştırın.", "warning");
        }
      } else {
        console.log("Cihaz Web Push aboneliği başarıyla kaydedildi/güncellendi.");
      }
    }
  } catch (err) {
    console.error("Web Push abonelik hatası:", err);
  }
}
