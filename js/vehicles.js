// =============================================
// ARAÇ YÖNETİMİ (ADMIN) METOTLARI
// =============================================

let tempVehiclePhotoBase64 = null;

function handleVehiclePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const imgObj = new Image();
    imgObj.onload = function() {
      const canvas = document.createElement("canvas");
      let width = imgObj.width;
      let height = imgObj.height;
      
      const maxDim = 300;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgObj, 0, 0, width, height);
      
      tempVehiclePhotoBase64 = canvas.toDataURL("image/jpeg", 0.7);
      
      const previewDiv = document.getElementById("vehicle-photo-preview");
      const img = document.getElementById("img-preview");
      
      if (previewDiv && img) {
        img.src = tempVehiclePhotoBase64;
        previewDiv.classList.remove("hidden");
      }
    };
    imgObj.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function addNewVehicleAdmin() {
  const plateInput = document.getElementById("admin-new-vehicle-plate");
  const plate = plateInput.value.trim().toUpperCase();
  
  if (!plate) {
    showToast("Lütfen araç plakasını girin!", "error");
    return;
  }
  
  const photo = tempVehiclePhotoBase64 || "";
  const newVehicle = {
    id: generateId(),
    plate: plate,
    photo: photo,
    created_at: new Date().toISOString()
  };
  
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('vehicles')
        .insert([{
          plate: plate,
          photo: photo
        }]);
      if (error) throw error;
      
      showToast("🚗 Araç başarıyla eklendi!", "success");
      plateInput.value = "";
      tempVehiclePhotoBase64 = null;
      const previewDiv = document.getElementById("vehicle-photo-preview");
      if (previewDiv) previewDiv.classList.add("hidden");
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Araç ekleme hatası:", err);
      showToast("Buluta araç eklenemedi! Plaka zaten kayıtlı olabilir.", "error");
    }
  } else {
    const exists = state.vehicles.some(v => v.plate === plate);
    if (exists) {
      showToast("Bu plaka zaten kayıtlı!", "error");
      return;
    }
    
    state.vehicles.unshift(newVehicle);
    saveState();
    
    showToast("🚗 Araç başarıyla eklendi!", "success");
    plateInput.value = "";
    tempVehiclePhotoBase64 = null;
    const previewDiv = document.getElementById("vehicle-photo-preview");
    if (previewDiv) previewDiv.classList.add("hidden");
    renderAdminVehicles();
  }
}

async function deleteVehicleAdmin(vehicleId) {
  const confirmed = await showCustomConfirm(
    "Aracı Sil?",
    "Bu aracı sistemden silmek istediğinize emin misiniz?"
  );
  if (!confirmed) return;
  
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
      if (error) throw error;
      
      showToast("Araç sistemden silindi.", "success");
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Araç silme hatası:", err);
      showToast("Araç silinemedi!", "error");
    }
  } else {
    state.vehicles = state.vehicles.filter(v => v.id !== vehicleId);
    saveState();
    showToast("Araç sistemden silindi.", "success");
    renderAdminVehicles();
  }
}

function renderAdminVehicles() {
  const container = document.getElementById("admin-vehicle-list");
  if (!container) return;
  
  if (!state.vehicles || state.vehicles.length === 0) {
    container.innerHTML = `<div class="p-4 text-xs text-slate-400 dark:text-slate-500 text-center font-medium">Kayıtlı araç bulunmamaktadır.</div>`;
    return;
  }
  
  container.innerHTML = state.vehicles.map(v => {
    const photoHtml = v.photo 
      ? `<img src="${v.photo}" class="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />`
      : `<div class="w-10 h-10 bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center rounded-lg text-[10px] font-extrabold">FOTO YOK</div>`;
      
    return `
    <div class="flex items-center justify-between p-3 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
      <div class="flex items-center gap-3">
        ${photoHtml}
        <span class="font-extrabold text-sm text-slate-700 dark:text-slate-300 uppercase">${v.plate}</span>
      </div>
      <button onclick="deleteVehicleAdmin('${v.id}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg active:scale-95 transition-all cursor-pointer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
    `;
  }).join("");
}

function switchAdminSubTab(subTab) {
  const sectProfiles = document.getElementById("admin-section-profiles");
  const sectVehicles = document.getElementById("admin-section-vehicles");
  const sectAttendanceQR = document.getElementById("admin-section-attendance-qr");
  const sectAttendanceShifts = document.getElementById("admin-section-attendance-shifts");
  const sectAttendanceNotif = document.getElementById("admin-section-attendance-notif");
  const sectAttendanceLogs = document.getElementById("admin-section-attendance-logs");
  
  const btnProfiles = document.getElementById("btn-admin-tab-profiles");
  const btnVehicles = document.getElementById("btn-admin-tab-vehicles");
  const btnAttendanceQR = document.getElementById("btn-admin-tab-attendance-qr");
  const btnAttendanceShifts = document.getElementById("btn-admin-tab-attendance-shifts");
  const btnAttendanceNotif = document.getElementById("btn-admin-tab-attendance-notif");
  const btnAttendanceLogs = document.getElementById("btn-admin-tab-attendance-logs");
  
  const adminTitle = document.getElementById("admin-title-text");
  
  if (!sectProfiles || !sectVehicles || !sectAttendanceQR || !sectAttendanceShifts || !sectAttendanceNotif || !sectAttendanceLogs) return;
  
  const activeClass = "flex-1 md:flex-none py-2.5 px-4 text-left text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2 bg-indigo-600 text-white shadow-sm";
  const inactiveClass = "flex-1 md:flex-none py-2.5 px-4 text-left text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300";

  sectProfiles.classList.add("hidden");
  sectVehicles.classList.add("hidden");
  sectAttendanceQR.classList.add("hidden");
  sectAttendanceShifts.classList.add("hidden");
  sectAttendanceNotif.classList.add("hidden");
  sectAttendanceLogs.classList.add("hidden");

  if (btnProfiles) btnProfiles.className = inactiveClass;
  if (btnVehicles) btnVehicles.className = inactiveClass;
  if (btnAttendanceQR) btnAttendanceQR.className = inactiveClass;
  if (btnAttendanceShifts) btnAttendanceShifts.className = inactiveClass;
  if (btnAttendanceNotif) btnAttendanceNotif.className = inactiveClass;
  if (btnAttendanceLogs) btnAttendanceLogs.className = inactiveClass;

  if (subTab === "profiles") {
    sectProfiles.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Personel)";
    if (btnProfiles) btnProfiles.className = activeClass;
    if (typeof renderAdminProfiles === "function") renderAdminProfiles();
  } else if (subTab === "vehicles") {
    sectVehicles.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Araçlar)";
    if (btnVehicles) btnVehicles.className = activeClass;
    if (typeof renderAdminVehicles === "function") renderAdminVehicles();
  } else if (subTab === "attendance-qr") {
    sectAttendanceQR.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Giriş/Çıkış QR Kodu)";
    if (btnAttendanceQR) btnAttendanceQR.className = activeClass;
    if (typeof renderAdminQR === "function") renderAdminQR();
  } else if (subTab === "attendance-shifts") {
    sectAttendanceShifts.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Çalışma Saatleri)";
    if (btnAttendanceShifts) btnAttendanceShifts.className = activeClass;
    if (typeof loadShiftSettings === "function") loadShiftSettings();
  } else if (subTab === "attendance-notif") {
    sectAttendanceNotif.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Personel Uyarı / Mesaj)";
    if (btnAttendanceNotif) btnAttendanceNotif.className = activeClass;
    if (typeof populateNotificationTargets === "function") populateNotificationTargets();
  } else if (subTab === "attendance-logs") {
    sectAttendanceLogs.classList.remove("hidden");
    if (adminTitle) adminTitle.textContent = "Yönetici Paneli (Son Aktiviteler)";
    if (btnAttendanceLogs) btnAttendanceLogs.className = activeClass;
    if (typeof loadAttendanceLogs === "function") loadAttendanceLogs();
  }
}
