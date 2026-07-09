// =============================================
// VARDİYA & GİRİŞ-ÇIKIŞ (ATTENDANCE) YÖNETİMİ
// =============================================

const ATTENDANCE_SECRET_SALT = "AYG_ATTENDANCE_SECRET_2026";
let html5QrcodeScanner = null;
let activeShiftSettings = [];

// Filtreleme ve sayfalama durumları
let attendanceCurrentPage = 1;
const attendanceItemsPerPage = 10;
let attendanceFilters = {
  profile: 'All',
  action: 'All',
  status: 'All',
  date: ''
};

// Bugünün tarihini YYYY-MM-DD formatında al
function getFormattedToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Bugün için geçerli QR kod içeriğini üret
function generateDailyQRText() {
  const todayStr = getFormattedToday();
  // Format: AYG-ATTENDANCE-YYYY-MM-DD-SALT
  return `AYG-ATTENDANCE-${todayStr}-${ATTENDANCE_SECRET_SALT}`;
}

// QR Kod Doğrulama
function verifyQRText(text) {
  const expectedText = generateDailyQRText();
  return text === expectedText;
}

// =============================================
// YÖNETİCİ (ADMIN) METOTLARI
// =============================================

// Yöneticinin ekranında QR kodu göster
function renderAdminQR() {
  const qrContainer = document.getElementById("admin-qr-container");
  const qrDateSpan = document.getElementById("admin-qr-date");
  if (!qrContainer) return;

  qrContainer.innerHTML = ""; // Temizle
  const qrText = generateDailyQRText();
  const todayStr = getFormattedToday();

  // QR kodu oluştur
  new QRCode(qrContainer, {
    text: qrText,
    width: 180,
    height: 180,
    colorDark: "#1e1b4b", // indigo-950
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  if (qrDateSpan) {
    qrDateSpan.textContent = `Bugünün Kodu: ${todayStr}`;
  }
}

// Vardiya saatlerini veritabanından çek ve admin paneline bas
async function loadShiftSettings() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("shift_settings")
      .select("*")
      .order("day_index", { ascending: true });

    if (error) throw error;

    activeShiftSettings = data || [];
    renderShiftSettingsUI();
  } catch (e) {
    console.error("Vardiya saatleri yüklenemedi:", e);
    showToast("Vardiya saatleri yüklenirken hata oluştu.", "error");
  }
}

// Vardiya Ayarları Arayüzünü Oluştur
function renderShiftSettingsUI() {
  const container = document.getElementById("shift-settings-container");
  if (!container) return;

  if (activeShiftSettings.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-400 py-2">Kayıt bulunamadı.</div>`;
    return;
  }

  container.innerHTML = activeShiftSettings.map(s => {
    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div class="flex items-center gap-2 sm:w-1/4">
          <input 
            type="checkbox" 
            id="shift-active-${s.day_index}" 
            ${s.is_active ? 'checked' : ''} 
            class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
          <label for="shift-active-${s.day_index}" class="text-xs font-bold text-slate-700 dark:text-slate-200">
            ${s.day_name}
          </label>
        </div>
        <div class="flex items-center gap-2 flex-1 justify-end">
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Giriş:</span>
          <input 
            type="time" 
            id="shift-start-${s.day_index}" 
            value="${s.start_time.substring(0, 5)}" 
            class="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none"
          />
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Çıkış:</span>
          <input 
            type="time" 
            id="shift-end-${s.day_index}" 
            value="${s.end_time.substring(0, 5)}" 
            class="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none"
          />
        </div>
      </div>
    `;
  }).join('');
}

// Vardiya Ayarlarını Kaydet
async function saveShiftSettings() {
  if (!supabaseClient) return;

  try {
    const promises = activeShiftSettings.map(s => {
      const isActive = document.getElementById(`shift-active-${s.day_index}`).checked;
      const startTime = document.getElementById(`shift-start-${s.day_index}`).value + ":00";
      const endTime = document.getElementById(`shift-end-${s.day_index}`).value + ":00";

      return supabaseClient
        .from("shift_settings")
        .update({
          is_active: isActive,
          start_time: startTime,
          end_time: endTime
        })
        .eq("day_index", s.day_index);
    });

    const results = await Promise.all(promises);
    const hasError = results.some(r => r.error);
    if (hasError) throw new Error("Bazı vardiyalar kaydedilemedi.");

    showToast("Vardiya saatleri başarıyla kaydedildi!", "success");
    await loadShiftSettings();
  } catch (e) {
    console.error("Vardiya kaydedilemedi:", e);
    showToast("Hata: Ayarlar kaydedilemedi.", "error");
  }
}

// Personel listesini duyuru seçeneğine yükle
function populateNotificationTargets() {
  const select = document.getElementById("notif-target-select");
  if (!select) return;

  // Temizle (sadece Herkes seçeneği kalsın)
  select.innerHTML = '<option value="Tümü">Herkes (Tümü)</option>';

  const otherProfiles = state.profiles.filter(p => p !== "Admin");
  otherProfiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

// Manuel uyarı / mesaj gönder
async function sendCustomNotification() {
  if (!supabaseClient) return;

  const targetSelect = document.getElementById("notif-target-select");
  const messageInput = document.getElementById("notif-message-input");

  if (!messageInput || !messageInput.value.trim()) {
    showToast("Lütfen göndermek için bir mesaj yazın.", "warning");
    return;
  }

  const target = targetSelect ? targetSelect.value : "Tümü";
  const message = messageInput.value.trim();

  try {
    const { error } = await supabaseClient
      .from("notifications")
      .insert([{
        profile_name: target,
        message: message,
        is_read: false
      }]);

    if (error) throw error;

    showToast(`"${target}" kullanıcısına uyarı başarıyla gönderildi.`, "success");
    messageInput.value = ""; // Temizle
  } catch (e) {
    console.error("Bildirim gönderilemedi:", e);
    showToast("Bildirim gönderilirken hata oluştu.", "error");
  }
}

// Personel filtresi dropdown'ını doldur
function populateAttendanceFilterProfiles() {
  const select = document.getElementById("attendance-filter-profile");
  if (!select) return;

  // Seçili değeri koruyarak temizle (sadece Tümü kalsın)
  const currentVal = select.value || 'All';
  select.innerHTML = '<option value="All">Tümü</option>';

  const otherProfiles = state.profiles.filter(p => p !== "Admin");
  otherProfiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });

  select.value = currentVal;
}

// Filtreleri uygula
function applyAttendanceFilters() {
  attendanceFilters.profile = document.getElementById("attendance-filter-profile")?.value || 'All';
  attendanceFilters.action = document.getElementById("attendance-filter-action")?.value || 'All';
  attendanceFilters.status = document.getElementById("attendance-filter-status")?.value || 'All';
  attendanceFilters.date = document.getElementById("attendance-filter-date")?.value || '';

  attendanceCurrentPage = 1; // Filtre değişince sayfa 1'e döner
  loadAttendanceLogs();
}

// Sayfa değiştir
function changeAttendancePage(direction) {
  attendanceCurrentPage += direction;
  loadAttendanceLogs();
}

// Giriş/Çıkış Raporlarını Filtrelere ve Sayfalamaya Göre Yükle
async function loadAttendanceLogs() {
  if (!supabaseClient) return;

  // Personel filtresini ilk kez veya her yüklemede doldur
  populateAttendanceFilterProfiles();

  const timelineContainer = document.getElementById("attendance-timeline-list");
  const paginationContainer = document.getElementById("attendance-pagination");
  const pageInfo = document.getElementById("attendance-page-info");
  const btnPrev = document.getElementById("btn-attendance-prev");
  const btnNext = document.getElementById("btn-attendance-next");

  if (!timelineContainer) return;

  timelineContainer.innerHTML = '<div class="text-center text-xs text-slate-400 py-6">Yükleniyor...</div>';

  try {
    // 1. Sorguyu oluştur
    let query = supabaseClient
      .from("attendance")
      .select("*", { count: "exact" });

    // 2. Filtreleri uygula
    if (attendanceFilters.profile !== "All") {
      query = query.eq("profile_name", attendanceFilters.profile);
    }
    if (attendanceFilters.action !== "All") {
      query = query.eq("action_type", attendanceFilters.action);
    }
    if (attendanceFilters.status !== "All") {
      query = query.eq("late_status", attendanceFilters.status);
    }
    if (attendanceFilters.date) {
      const dateStart = new Date(attendanceFilters.date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(attendanceFilters.date);
      dateEnd.setHours(23, 59, 59, 999);

      query = query
        .gte("created_at", dateStart.toISOString())
        .lte("created_at", dateEnd.toISOString());
    }

    // 3. Sıralama ve Sayfalama (Range) ekle
    const from = (attendanceCurrentPage - 1) * attendanceItemsPerPage;
    const to = from + attendanceItemsPerPage - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // 4. Günün Metriklerini (İstatistiklerini) güncelle
    await loadTodayGeneralStats();

    // 5. Kayıt yoksa ekrana bas
    if (!data || data.length === 0) {
      timelineContainer.innerHTML = '<div class="text-center text-xs text-slate-400 py-6">Kayıt bulunamadı.</div>';
      if (paginationContainer) paginationContainer.classList.add("hidden");
      return;
    }

    // 6. Zaman tüneli loglarını render et
    timelineContainer.innerHTML = data.map(log => {
      const date = new Date(log.created_at);
      const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
      
      const isGiris = log.action_type === 'Giriş';
      const initial = log.profile_name.charAt(0).toUpperCase();

      let statusColor = "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800";
      if (log.late_status === 'Zamanında') statusColor = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/20";
      else if (log.late_status === 'Geç Kaldı') statusColor = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/20";
      else if (log.late_status === 'Erken Çıktı') statusColor = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/20";
      else if (log.late_status === 'Fazla Mesai') statusColor = "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/20";

      return `
        <div class="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800/60 rounded-2xl hover:shadow-sm transition-all duration-200 animate-fade-in">
          <div class="w-9 h-9 rounded-full ${isGiris ? 'bg-emerald-600' : 'bg-rose-600'} text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            ${initial}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${log.profile_name}</h4>
              <span class="text-[10px] text-slate-400 font-semibold shrink-0">${dateStr} - ${timeStr}</span>
            </div>
            <div class="flex items-center justify-between mt-1.5 gap-2">
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${isGiris ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}">
                  ${log.action_type}
                </span>
                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${statusColor}">
                  ${log.late_status || 'Belirsiz'}
                </span>
              </div>
              <button onclick="deleteAttendanceLog('${log.id}')" class="text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-all active:scale-95 cursor-pointer" title="Sil">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 7. Sayfalama Kontrollerini Yönet
    if (paginationContainer) {
      paginationContainer.classList.remove("hidden");
      const totalPages = Math.ceil(count / attendanceItemsPerPage) || 1;
      
      if (pageInfo) pageInfo.textContent = `Sayfa ${attendanceCurrentPage} / ${totalPages}`;
      if (btnPrev) btnPrev.disabled = attendanceCurrentPage <= 1;
      if (btnNext) btnNext.disabled = attendanceCurrentPage >= totalPages;
    }

  } catch (e) {
    console.error("Raporlar yüklenemedi:", e);
    timelineContainer.innerHTML = '<div class="text-center text-xs text-rose-500 font-semibold py-6">Rapor yüklenirken hata oluştu.</div>';
  }
}

// Bugünün İstatistiklerini Hesapla ve Arayüze Bas (Genel Metrikler)
async function loadTodayGeneralStats() {
  if (!supabaseClient) return;

  const totalSpan = document.getElementById("stats-attendance-total");
  const lateSpan = document.getElementById("stats-attendance-late");
  
  if (!totalSpan && !lateSpan) return;

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseClient
      .from("attendance")
      .select("profile_name, action_type, late_status")
      .gte("created_at", startOfToday.toISOString());

    if (error) throw error;

    const uniqueAttendees = new Set(
      data
        .filter(log => log.action_type === 'Giriş')
        .map(log => log.profile_name)
    );

    const uniqueLateAttendees = new Set(
      data
        .filter(log => log.action_type === 'Giriş' && log.late_status === 'Geç Kaldı')
        .map(log => log.profile_name)
    );

    if (totalSpan) totalSpan.textContent = uniqueAttendees.size;
    if (lateSpan) lateSpan.textContent = uniqueLateAttendees.size;

  } catch (e) {
    console.error("Genel metrikler yüklenemedi:", e);
  }
}

// Log kaydını sil
async function deleteAttendanceLog(logId) {
  if (!supabaseClient) return;

  const onay = confirm("Bu giriş-çıkış kaydını silmek istediğinize emin misiniz?");
  if (!onay) return;

  try {
    const { error } = await supabaseClient
      .from("attendance")
      .delete()
      .eq("id", logId);

    if (error) throw error;

    showToast("Kayıt başarıyla silindi.", "success");
    await loadAttendanceLogs();
  } catch (e) {
    console.error("Kayıt silinemedi:", e);
    showToast("Kayıt silinirken hata oluştu.", "error");
  }
}

// QR Kod alanını aç/kapat (collapsible)
function toggleAdminQRCollapse() {
  const wrapper = document.getElementById("admin-qr-collapse-wrapper");
  const btn = document.getElementById("btn-toggle-qr-collapse");
  if (!wrapper || !btn) return;

  if (wrapper.classList.contains("hidden")) {
    wrapper.classList.remove("hidden");
    btn.textContent = "Kodu Gizle";
  } else {
    wrapper.classList.add("hidden");
    btn.textContent = "Kodu Göster";
  }
}

// =============================================
// PERSONEL (STAFF) METOTLARI
// =============================================

// QR Tarayıcı Modalı Aç
function openQRScannerModal() {
  const modal = document.getElementById("qr-scanner-modal");
  const statusDiv = document.getElementById("qr-scanner-status");
  if (!modal) return;

  modal.classList.remove("hidden");
  if (statusDiv) statusDiv.textContent = "Kamera başlatılıyor...";

  // 100ms sonra kamerayı başlat (render gecikmesini önlemek için)
  setTimeout(() => {
    try {
      html5QrcodeScanner = new Html5Qrcode("qr-reader");
      html5QrcodeScanner.start(
        { facingMode: "environment" }, // Arka kamera tercih et
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        async (decodedText) => {
          // QR Kod başarıyla okunduğunda
          await handleScannedQR(decodedText);
        },
        (errorMessage) => {
          // Tarama esnasındaki hatalar (sessizce yoksayılabilir)
        }
      ).then(() => {
        if (statusDiv) statusDiv.textContent = "QR kodunu hizalayın.";
      }).catch(err => {
        console.error("Kamera başlatma hatası:", err);
        if (statusDiv) statusDiv.textContent = "Kamera başlatılamadı. İzinlerinizi kontrol edin.";
      });
    } catch (e) {
      console.error(e);
      if (statusDiv) statusDiv.textContent = "Kamera hatası oluştu.";
    }
  }, 300);
}

// QR Tarayıcı Modalı Kapat
function closeQRScannerModal() {
  const modal = document.getElementById("qr-scanner-modal");
  if (!modal) return;

  modal.classList.add("hidden");

  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner = null;
    }).catch(err => {
      console.error("Kamera durdurma hatası:", err);
      html5QrcodeScanner = null;
    });
  }
}

// Taranan QR kodu işle
async function handleScannedQR(qrText) {
  // Kamerayı hemen kapat (çoklu tetiklemeyi önlemek için)
  closeQRScannerModal();

  if (!verifyQRText(qrText)) {
    showToast("Geçersiz veya eski bir QR kod okuttunuz! Lütfen yöneticinin ekranındaki güncel kodu okutun.", "error");
    speakText("Geçersiz QR kod.");
    return;
  }

  // Kullanıcı adı
  const username = state.activeUser;
  if (!username || username === "Admin") {
    showToast("Yönetici girişiyle bu işlem yapılamaz.", "warning");
    return;
  }

  if (!supabaseClient) {
    showToast("Veritabanı bağlantısı yok.", "error");
    return;
  }

  try {
    // 1. Personelin bugünkü son kaydını bul (Giriş mi Çıkış mı yapacağını belirlemek için)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data: lastLogs, error: logErr } = await supabaseClient
      .from("attendance")
      .select("*")
      .eq("profile_name", username)
      .gte("created_at", startOfToday.toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (logErr) throw logErr;

    // Otomatik Eylem Tespiti: Son kayıt yoksa veya Çıkış ise -> Giriş yapar. Son kayıt Giriş ise -> Çıkış yapar.
    let actionType = 'Giriş';
    if (lastLogs && lastLogs.length > 0 && lastLogs[0].action_type === 'Giriş') {
      actionType = 'Çıkış';
    }

    // 2. Zaman durumunu (Geç kaldı, Erken çıktı vb.) hesapla
    const lateStatus = await calculateLateStatus(actionType);

    // 3. Veritabanına kaydet
    const { error: insErr } = await supabaseClient
      .from("attendance")
      .insert([{
        profile_name: username,
        action_type: actionType,
        late_status: lateStatus
      }]);

    if (insErr) throw insErr;

    const basariMesaji = `${username} için ${actionType} işlemi başarıyla kaydedildi! Durum: ${lateStatus}`;
    showToast(basariMesaji, "success");
    speakText(`${actionType} işlemi onaylandı. ${lateStatus === 'Geç Kaldı' ? 'Geç kaldınız.' : ''}`);

  } catch (e) {
    console.error("Giriş/çıkış kaydedilemedi:", e);
    showToast("Giriş/Çıkış kaydı sırasında bir hata oluştu.", "error");
  }
}

// Vardiya ayarlarına göre geç kalma / erken çıkma durumunu hesapla
async function calculateLateStatus(actionType) {
  if (!supabaseClient) return 'Zamanında';

  try {
    const today = new Date();
    const dayIndex = today.getDay(); // 0: Pazar, 1: Pazartesi ...

    // Bugünün vardiya ayarlarını çek
    const { data: shift, error } = await supabaseClient
      .from("shift_settings")
      .select("*")
      .eq("day_index", dayIndex)
      .single();

    if (error || !shift || !shift.is_active) {
      return 'Zamanında'; // Vardiya yoksa veya pasifse durum zamanında varsayılır
    }

    const nowTimeStr = today.toTimeString().substring(0, 8); // 'HH:MM:SS'

    if (actionType === 'Giriş') {
      // Giriş saati kontrolü
      const limitStart = shift.start_time; // '08:30:00'
      // 5 dakika tolerans
      const limitDate = new Date();
      const [sh, sm, ss] = limitStart.split(':').map(Number);
      limitDate.setHours(sh, sm + 5, ss, 0); // Tolerans dahil limit saat

      if (today > limitDate) {
        return 'Geç Kaldı';
      }
      return 'Zamanında';
    } else {
      // Çıkış saati kontrolü
      const limitEnd = shift.end_time; // '18:00:00'
      const limitDate = new Date();
      const [eh, em, es] = limitEnd.split(':').map(Number);
      limitDate.setHours(eh, em, es, 0);

      if (today < limitDate) {
        return 'Erken Çıktı';
      }
      // Mesai bitişinden 30 dk sonrası Fazla Mesai sayılabilir
      const overtimeDate = new Date();
      overtimeDate.setHours(eh, em + 30, es, 0);
      if (today > overtimeDate) {
        return 'Fazla Mesai';
      }
      return 'Zamanında';
    }
  } catch (e) {
    console.error(e);
    return 'Zamanında';
  }
}

// =============================================
// BİLDİRİM VE UYARI DİNLEYİCİSİ
// =============================================

// Kullanıcının okunmamış bildirimlerini kontrol et
async function checkStaffNotifications() {
  const username = state.activeUser;
  if (!username || username === "Admin" || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from("notifications")
      .select("*")
      .or(`profile_name.eq.${username},profile_name.eq.Tümü`)
      .eq("is_read", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      // Her bildirimi tek tek göster ve okundu olarak işaretle
      for (const notif of data) {
        // Büyük ve dikkat çekici bir Toast uyarısı göster
        showToast(`⚠️ YÖNETİCİ UYARISI: ${notif.message}`, "warning");
        speakText("Yöneticiden yeni bir uyarı aldınız.");

        // Okundu işaretle
        await supabaseClient
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notif.id);
      }
    }
  } catch (e) {
    console.error("Bildirimler denetlenirken hata:", e);
  }
}
