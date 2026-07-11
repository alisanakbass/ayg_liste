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
    const password = await showCustomPasswordModal();
    if (password === null) return; // Kullanıcı iptal etti
    if (password !== state.adminPassword) {
      showToast("Hatalı yönetici şifresi!", "error");
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
  await createProfile(name, input);
}

async function addNewProfileAdmin() {
  const input = document.getElementById("admin-new-profile-input");
  if (!input) return;
  const name = input.value.trim();
  await createProfile(name, input);
}

async function createProfile(name, inputElement) {
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
      const { error } = await supabaseClient.from('profiles').insert([{ name }]);
      if (error) throw error;
      
      inputElement.value = "";
      // Realtime kanalı ile senkronize olacak, beklemeye gerek yok ama anında güncellensin:
      await syncWithSupabase(true);
      showToast(`"${name}" adlı personel buluta eklendi!`, "success");
    } catch (err) {
      console.error("Profil ekleme hatası:", err);
      showToast("Buluta personel eklenemedi!", "error");
    }
  } else {
    state.profiles.push(name);
    saveState();
    inputElement.value = "";
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

function renderAdminProfiles() {
  const container = document.getElementById("admin-profile-list");
  if (!container) return;
  
  const displayProfiles = state.profiles.filter(p => p !== "Admin");
  
  if (displayProfiles.length === 0) {
    container.innerHTML = `<p class="p-4 text-center text-xs text-slate-400">Hiç personel bulunamadı.</p>`;
    return;
  }

  // Yöneticiler yetki değiştirebilir
  const isSuperAdmin = isAdminUser();

  container.innerHTML = displayProfiles
    .map(
      (name) => {
        const isAdmin = state.adminProfiles && state.adminProfiles.includes(name);
        
        // Yetki butonunun HTML'i
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
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors animate-slide-in gap-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 ${isAdmin ? 'bg-amber-600/10 text-amber-650 dark:text-amber-400' : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'} rounded-lg flex items-center justify-center font-bold text-sm">
            ${isAdmin ? '👑' : name.charAt(0).toUpperCase()}
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${name}</span>
            ${isAdmin ? '<span class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Yönetici</span>' : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          ${privilegeButton}
          <button
            onclick="confirmDeleteProfile('${name}', event)"
            class="px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
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
