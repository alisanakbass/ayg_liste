// =============================================
// PROFILE MANAGEMENT
// =============================================
function showProfileScreen() {
  if (typeof clearDriverLocationTracking === "function") {
    clearDriverLocationTracking();
  }
  document.getElementById("profile-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
  renderProfiles();
}

function renderProfiles() {
  const container = document.getElementById("profile-list");
  if (!container) return;

  if (!state.profiles.includes("Admin")) {
    state.profiles.unshift("Admin");
  }

  const otherProfiles = state.profiles.filter(p => p !== "Admin").sort();
  const displayList = ["Admin", ...otherProfiles];
  
  container.innerHTML = displayList
    .map(
      (name) => {
        const isAdmin = name === "Admin";

        return `
  <div class="relative group bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-500 transition-all duration-200 animate-slide-in" 
       onclick="selectProfile('${name}')">
    
    <div class="w-14 h-14 ${isAdmin ? 'bg-amber-600' : 'bg-indigo-600'} text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md ${isAdmin ? 'shadow-amber-500/20' : 'shadow-indigo-500/20'} group-hover:scale-105 transition-transform duration-200">
      ${isAdmin ? '👑' : name.charAt(0).toUpperCase()}
    </div>
    <p class="text-white text-sm font-semibold tracking-wide text-center truncate max-w-full">${isAdmin ? 'Süper Admin' : name}</p>
  </div>
`;
      }
    )
    .join("");
}

function showCustomPasswordModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById("password-modal");
    const input = document.getElementById("admin-password-input");
    if (!modal || !input) {
      const password = prompt("Lütfen Yönetici (Admin) şifresini girin:");
      resolve(password);
      return;
    }

    input.value = "";
    modal.classList.remove("hidden");
    setTimeout(() => input.focus(), 50);

    const btnCancel = document.getElementById("password-btn-cancel");
    const btnConfirm = document.getElementById("password-btn-confirm");

    const cleanup = (result) => {
      modal.classList.add("hidden");
      btnCancel.onclick = null;
      btnConfirm.onclick = null;
      input.onkeypress = null;
      resolve(result);
    };

    btnCancel.onclick = () => cleanup(null);
    btnConfirm.onclick = () => cleanup(input.value);
    
    input.onkeypress = (event) => {
      if (event.key === "Enter") {
        cleanup(input.value);
      }
    };
  });
}

async function selectProfile(name) {
  if (name === "Admin") {
    if (supabaseClient) {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session || !session.user.email.toLowerCase().startsWith("admin")) {
          showToast("Bu profile sadece Admin e-postasıyla giriş yapmış kullanıcılar erişebilir!", "error");
          return;
        }
      } catch (e) {
        showToast("Oturum doğrulaması başarısız oldu!", "error");
        return;
      }
    } else {
      showToast("Bulut bağlantısı yok, Admin profili seçilemez.", "error");
      return;
    }
  }

  if (typeof clearDriverLocationTracking === "function") {
    clearDriverLocationTracking();
  }
  state.activeUser = name;
  saveState();
  document.getElementById("profile-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
  document.getElementById("header-username").textContent = name;
  
  if (typeof updateAdminUI === "function") updateAdminUI();
  switchTab(state.currentTab || "active");

  // iOS ve genel tarayıcılarda kullanıcı tıklaması (etkileşim) anında bildirim izni isteme
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted" && typeof subscribeUserToPush === "function") {
          subscribeUserToPush();
        }
      });
    } else if (Notification.permission === "granted" && typeof subscribeUserToPush === "function") {
      subscribeUserToPush();
    }
  }

  speakText(`Hoş geldiniz ${name === 'Admin' ? 'Yönetici' : name}.`);
}

async function addNewProfile() {
  const input = document.getElementById("new-profile-input");
  if (!input) return;
  const name = input.value.trim();
  await createProfile(name, input, false);
}

async function addNewProfileAdmin() {
  const input = document.getElementById("admin-new-profile-input");
  if (!input) return;
  const name = input.value.trim();
  
  const switchEl = document.getElementById("admin-new-profile-is-admin");
  const isAdmin = switchEl ? switchEl.checked : false;
  
  await createProfile(name, input, isAdmin);
}

async function createProfile(name, inputElement, isAdmin = false) {
  if (!isAdminUser()) {
    showToast("Personel ekleme yetkiniz yok!", "error");
    return;
  }

  if (!name) {
    showToast("İsim boş olamaz!", "error");
    return;
  }
  
  if (state.profiles.includes(name)) {
    showToast("Bu personel zaten mevcut!", "error");
    return;
  }

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('profiles').insert([{ name, is_admin: isAdmin }]);
      if (error) throw error;
      
      inputElement.value = "";
      
      const switchEl = document.getElementById("admin-new-profile-is-admin");
      if (switchEl) switchEl.checked = false;
      
      await syncWithSupabase(true);
      showToast(`"${name}" adlı personel buluta eklendi!`, "success");
    } catch (err) {
      console.error("Profil ekleme hatası:", err);
      showToast("Buluta personel eklenemedi!", "error");
    }
  } else {
    state.profiles.push(name);
    if (isAdmin) {
      if (!state.adminProfiles) state.adminProfiles = [];
      state.adminProfiles.push(name);
    }
    saveState();
    inputElement.value = "";
    
    const switchEl = document.getElementById("admin-new-profile-is-admin");
    if (switchEl) switchEl.checked = false;
    
    renderProfiles();
    renderAdminProfiles();
    showToast(`"${name}" adlı personel yerel olarak eklendi!`, "success");
  }
}

async function confirmDeleteProfile(name, event) {
  event.stopPropagation(); // Profil seçilmesini engelle
  
  if (!isAdminUser()) {
    showToast("Personel silme yetkiniz yok!", "error");
    return;
  }

  if (name === "Admin") {
    showToast("Süper Admin (Admin) profili silinemez!", "error");
    return;
  }

  if (confirm(`"${name}" adlı personeli silmek istediğinize emin misiniz? (Oluşturduğu siparişler kaybolmaz)`)) {
    
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('profiles').delete().eq('name', name);
        if (error) throw error;
        
        if (state.activeUser === name) {
          state.activeUser = null;
        }
        
        await syncWithSupabase(true);
        showToast(`"${name}" personeli buluttan silindi.`, "warning");
        
        if (!state.activeUser) {
          showProfileScreen();
        }
      } catch (err) {
        console.error("Profil silme hatası:", err);
        showToast("Buluttan personel silinemedi!", "error");
      }
    } else {
      state.profiles = state.profiles.filter(p => p !== name);
      if (state.activeUser === name) {
        state.activeUser = null;
      }
      saveState();
      renderProfiles();
      renderAdminProfiles();
      showToast(`"${name}" personeli yerel olarak silindi.`, "warning");
      
      if (!state.activeUser) {
        showProfileScreen();
      }
    }
  }
}

let editingProfileName = null;

function startProfileNameUpdate(name) {
  editingProfileName = name;
  renderAdminProfiles();
}

function cancelProfileNameUpdate() {
  editingProfileName = null;
  renderAdminProfiles();
}

async function saveProfileNameUpdate(oldName) {
  const input = document.getElementById(`edit-profile-input-${oldName}`);
  if (!input) return;
  const newName = input.value.trim();
  
  if (!newName) {
    showToast("Personel ismi boş olamaz!", "error");
    return;
  }
  
  if (newName === oldName) {
    cancelProfileNameUpdate();
    return;
  }
  
  if (state.profiles.includes(newName) && newName !== "Admin") {
    showToast("Bu isimde bir personel zaten var!", "error");
    return;
  }

  if (!isAdminUser()) {
    showToast("Personel düzenleme yetkiniz yok!", "error");
    return;
  }

  if (supabaseClient) {
    try {
      showToast("Personel ismi güncelleniyor...", "info");
      
      const { error } = await supabaseClient
        .from('profiles')
        .update({ name: newName })
        .eq('name', oldName);
        
      if (error) throw error;

      if (state.activeUser === oldName) {
        state.activeUser = newName;
      }
      
      await syncWithSupabase(true);
      showToast(`Personel ismi "${newName}" olarak güncellendi!`, "success");
      cancelProfileNameUpdate();
    } catch (err) {
      console.error("Profil güncelleme hatası:", err);
      showToast("Bulutta personel ismi güncellenemedi!", "error");
    }
  } else {
    state.profiles = state.profiles.map(p => p === oldName ? newName : p);
    if (state.adminProfiles && state.adminProfiles.includes(oldName)) {
      state.adminProfiles = state.adminProfiles.map(p => p === oldName ? newName : p);
    }
    if (state.activeUser === oldName) {
      state.activeUser = newName;
    }
    saveState();
    renderProfiles();
    renderAdminProfiles();
    showToast(`Personel ismi "${newName}" olarak güncellendi!`, "success");
    cancelProfileNameUpdate();
  }
}

function renderAdminProfiles() {
  const container = document.getElementById("admin-profile-list");
  if (!container) return;
  
  const displayProfiles = state.profiles.filter(p => p !== "Admin");
  
  if (displayProfiles.length === 0) {
    container.innerHTML = `<p class="p-4 text-center text-xs text-slate-400">Hiç personel bulunamadı.</p>`;
    return;
  }

  const isSuperAdmin = isAdminUser();

  container.innerHTML = displayProfiles
    .map(
      (name) => {
        const isAdmin = state.adminProfiles && state.adminProfiles.includes(name);
        const isEditing = name === editingProfileName;
        
        if (isEditing) {
          return `
      <div class="flex items-center justify-between p-3.5 bg-indigo-50/20 dark:bg-indigo-950/20 border-l-4 border-indigo-500 animate-slide-in gap-3">
        <div class="flex-1 flex gap-2">
          <input
            id="edit-profile-input-${name}"
            type="text"
            value="${escapeHTML(name)}"
            class="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-350 focus:border-indigo-500 focus:outline-none text-xs font-semibold"
            onkeypress="if (event.key === 'Enter') saveProfileNameUpdate('${name}');"
          />
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            onclick="saveProfileNameUpdate('${name}')"
            class="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow flex items-center justify-center w-7 h-7"
            title="Kaydet"
          >
            ✓
          </button>
          <button
            onclick="cancelProfileNameUpdate()"
            class="p-2 bg-slate-400 hover:bg-slate-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow flex items-center justify-center w-7 h-7"
            title="İptal"
          >
            ✕
          </button>
        </div>
      </div>
          `;
        }

        const privilegeButton = isSuperAdmin 
          ? `<button
              onclick="toggleAdminPrivilege('${name}', event)"
              class="px-2.5 py-1.5 ${isAdmin ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300' : 'bg-amber-500 hover:bg-amber-600 text-white'} rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer border border-transparent"
              title="${isAdmin ? 'Yönetici Yetkisini Kaldır' : 'Yönetici Yetkisi Ver'}"
            >
              ${isAdmin ? '🛡️ Yetkiyi Kaldır' : '👑 Yönetici Yap'}
            </button>`
          : "";

        return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors animate-slide-in gap-3 group">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 ${isAdmin ? 'bg-amber-600/10 text-amber-650 dark:text-amber-400' : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'} rounded-lg flex items-center justify-center font-bold text-sm">
            ${isAdmin ? '👑' : escapeHTML(name.charAt(0).toUpperCase())}
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${escapeHTML(name)}</span>
            ${isAdmin ? '<span class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Yönetici</span>' : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ${privilegeButton}
          <button
            onclick="startProfileNameUpdate('${name}')"
            class="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            title="İsmi Düzenle"
          >
            ✏️ Düzenle
          </button>
          <button
            onclick="confirmDeleteProfile('${name}', event)"
            class="px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-650 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            title="Personeli Sil"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Sil
          </button>
        </div>
      </div>
    `;
      }
    )
    .join("");
}

// Personel Yönetici Yetkisini Aç/Kapat (Sadece Süper Admin)
async function toggleAdminPrivilege(name, event) {
  event.stopPropagation();
  
  if (!isAdminUser()) {
    showToast("Yönetici yetkilerini sadece Yöneticiler değiştirebilir!", "error");
    return;
  }

  if (!state.adminProfiles) {
    state.adminProfiles = [];
  }

  const isCurrentlyAdmin = state.adminProfiles.includes(name);
  const nextStatus = !isCurrentlyAdmin;

  if (supabaseClient) {
    try {
      showToast("Yetki güncelleniyor...", "info");
      
      const { error } = await supabaseClient
        .from('profiles')
        .update({ is_admin: nextStatus })
        .eq('name', name);
        
      if (error) throw error;

      await syncWithSupabase(true);
      showToast(`"${name}" adlı personelin yetkisi başarıyla güncellendi!`, "success");
    } catch (err) {
      console.error("Yetki güncelleme hatası:", err);
      showToast("Bulutta yetki güncellenemedi!", "error");
    }
  } else {
    // Local / Çevrimdışı mod
    if (isCurrentlyAdmin) {
      state.adminProfiles = state.adminProfiles.filter(p => p !== name);
    } else {
      state.adminProfiles.push(name);
    }
    saveState();
    renderProfiles();
    renderAdminProfiles();
    showToast(`"${name}" adlı personelin yetkisi yerel olarak güncellendi!`, "success");
  }
}
