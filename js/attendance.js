// =============================================
// VARDİYA & GİRİŞ-ÇIKIŞ (ATTENDANCE) YÖNETİMİ
// =============================================

const ATTENDANCE_SECRET_SALT = "AYG_ATTENDANCE_SECRET_2026";
let html5QrcodeScanner = null;
let activeShiftSettings = [];

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

// Giriş/Çıkış Raporlarını Yükle
async function loadAttendanceLogs() {
  if (!supabaseClient) return;

  const listContainer = document.getElementById("attendance-log-list");
  if (!listContainer) return;

  listContainer.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">Yükleniyor...</td></tr>';

  try {
    const { data, error } = await supabaseClient
      .from("attendance")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      listContainer.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400">Kayıt bulunamadı.</td></tr>';
      return;
    }

    listContainer.innerHTML = data.map(log => {
      const date = new Date(log.created_at);
      const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Eylem Rozeti
      const actionBadge = log.action_type === 'Giriş' 
        ? `<span class="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold">Giriş</span>`
        : `<span class="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-md text-[10px] font-bold">Çıkış</span>`;

      // Durum Rozeti
      let statusClass = "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800";
      if (log.late_status === 'Zamanında') statusClass = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40";
      else if (log.late_status === 'Geç Kaldı') statusClass = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40";
      else if (log.late_status === 'Erken Çıktı') statusClass = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40";
      else if (log.late_status === 'Fazla Mesai') statusClass = "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40";

      const statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${statusClass}">${log.late_status || 'Belirsiz'}</span>`;

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
          <td class="py-2.5 font-semibold text-slate-800 dark:text-slate-200">${log.profile_name}</td>
          <td class="py-2.5">${actionBadge}</td>
          <td class="py-2.5">${statusBadge}</td>
          <td class="py-2.5 text-slate-500 dark:text-slate-400">${dateStr} - ${timeStr}</td>
          <td class="py-2.5 text-right">
            <button onclick="deleteAttendanceLog('${log.id}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all active:scale-95 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error("Raporlar yüklenemedi:", e);
    listContainer.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-rose-500 font-semibold">Rapor yüklenirken hata.</td></tr>';
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
