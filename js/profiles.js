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
  
  const profilesList = (state.profilesDetail && state.profilesDetail.length > 0)
    ? state.profilesDetail
    : state.profiles.map(name => ({
        id: name,
        name: name,
        email: name.toLowerCase() + "@ayg.com",
        is_admin: state.adminProfiles && state.adminProfiles.includes(name),
        photo: null
      }));

  const displayProfiles = profilesList.filter(p => p.name !== "Admin");
  
  if (displayProfiles.length === 0) {
    container.innerHTML = `<p class="p-4 text-center text-xs text-slate-400">Hiç personel bulunamadı.</p>`;
    return;
  }

  const isSuperAdmin = isAdminUser();

  container.innerHTML = displayProfiles
    .map(
      (profile) => {
        const { id, name, email, is_admin: isAdmin, photo } = profile;
        
        const photoHtml = photo 
          ? `<img src="${photo}" class="w-8 h-8 rounded-lg object-cover shadow-sm" alt="${escapeHTML(name)}" />`
          : `<div class="w-8 h-8 ${isAdmin ? 'bg-amber-600/10 text-amber-600 dark:text-amber-400' : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'} rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">${escapeHTML(name.charAt(0).toUpperCase())}</div>`;

        const privilegeButton = isSuperAdmin 
          ? `<button
              onclick="toggleAdminPrivilege('${escapeHTML(name)}', event)"
              class="px-2.5 py-1.5 ${isAdmin ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300' : 'bg-amber-500 hover:bg-amber-600 text-white'} rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer border border-transparent"
              title="${isAdmin ? 'Yönetici Yetkisini Kaldır' : 'Yönetici Yetkisi Ver'}"
            >
              ${isAdmin ? '🛡️ Yetki Kaldır' : '👑 Yönetici Yap'}
            </button>`
          : "";

        return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors animate-slide-in gap-3 group">
        <div class="flex items-center gap-3">
          ${photoHtml}
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${escapeHTML(name)}</span>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">${escapeHTML(email || '')}</span>
            ${isAdmin ? '<span class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mt-0.5">Yönetici</span>' : ''}
          </div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ${privilegeButton}
          <button
            onclick="openEditPersonnelModal('${id}')"
            class="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-650 dark:text-slate-300 rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            title="Personeli Düzenle"
          >
            ✏️ Düzenle
          </button>
          <button
            onclick="deletePersonnel('${id}', '${escapeHTML(name)}')"
            class="px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-655 dark:text-red-400 hover:bg-red-600 hover:text-white rounded-lg font-bold text-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
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

// Görseli İstemcide Yeniden Boyutlandıran ve Sıkıştıran Helper
function resizeAndCompressImage(file, maxWidth = 120, maxHeight = 120, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // En boy oranını koruyarak yeniden boyutlandırma
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG formatında sıkıştırıp base64 olarak alıyoruz
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// Dosya Seçici Değişikliğini Dinle (Ekleme Formu)
let personnelAddPhotoBase64 = null;
function handleAddPersonnelPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) { // Limit 5MB (Bunu zaten sıkıştıracağız ama çok büyük dosyaları tarayıcı kasmasın diye engelliyoruz)
    showToast("Profil fotoğrafı boyutu en fazla 5MB olabilir!", "warning");
    event.target.value = "";
    return;
  }

  showToast("Fotoğraf optimize ediliyor...", "info");

  resizeAndCompressImage(file, 120, 120, 0.7).then(compressedBase64 => {
    personnelAddPhotoBase64 = compressedBase64;
    showToast("Profil fotoğrafı optimize edildi ve eklendi.", "success");
  }).catch(err => {
    console.error("Görsel optimizasyon hatası:", err);
    showToast("Görsel optimize edilemedi!", "error");
  });
}

// Dosya Seçici Değişikliğini Dinle (Düzenleme Formu)
let personnelEditPhotoBase64 = undefined;
function handleEditPersonnelPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 5 * 1024 * 1024) {
    showToast("Profil fotoğrafı boyutu en fazla 5MB olabilir!", "warning");
    event.target.value = "";
    return;
  }

  showToast("Fotoğraf optimize ediliyor...", "info");

  resizeAndCompressImage(file, 120, 120, 0.7).then(compressedBase64 => {
    personnelEditPhotoBase64 = compressedBase64;
    showToast("Yeni profil fotoğrafı optimize edildi.", "success");
  }).catch(err => {
    console.error("Görsel optimizasyon hatası:", err);
    showToast("Görsel optimize edilemedi!", "error");
  });
}

// Yeni Personel Ekle (Admin Yetkisiyle)
async function submitAddPersonnel() {
  if (!isAdminUser()) {
    showToast("Personel ekleme yetkiniz yok!", "error");
    return;
  }

  const nameInput = document.getElementById("admin-new-profile-input");
  const emailInput = document.getElementById("admin-new-profile-email");
  const passwordInput = document.getElementById("admin-new-profile-password");
  const switchEl = document.getElementById("admin-new-profile-is-admin");
  const photoInput = document.getElementById("admin-new-profile-photo");

  if (!nameInput || !emailInput || !passwordInput) return;

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const isAdmin = switchEl ? switchEl.checked : false;

  if (!name || !email || !password) {
    showToast("Ad Soyad, E-posta ve Şifre zorunludur!", "warning");
    return;
  }

  if (password.length < 6) {
    showToast("Şifre en az 6 karakter olmalıdır!", "warning");
    return;
  }

  if (!supabaseClient) {
    showToast("Bulut bağlantısı yok, personel oluşturulamaz.", "error");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showToast("Oturumunuz kapandı. Lütfen tekrar giriş yapın.", "error");
      return;
    }

    showToast(`"${name}" personeli oluşturuluyor...`, "info");

    const response = await fetch('/.netlify/functions/manage-personnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action: 'create',
        name,
        email,
        password,
        isAdmin,
        photo: personnelAddPhotoBase64
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Personel eklenemedi.");
    }

    showToast(`"${name}" personeli başarıyla oluşturuldu!`, "success");

    nameInput.value = "";
    emailInput.value = "";
    passwordInput.value = "";
    if (switchEl) switchEl.checked = false;
    if (photoInput) photoInput.value = "";
    personnelAddPhotoBase64 = null;

    await syncWithSupabase(true);
  } catch (err) {
    console.error("Personel ekleme hatası:", err);
    showToast(err.message, "error");
  }
}

// Personel Sil (Admin Yetkisiyle)
async function deletePersonnel(id, name) {
  if (!isAdminUser()) {
    showToast("Personel silme yetkiniz yok!", "error");
    return;
  }

  if (name === "Admin") {
    showToast("Süper Admin silinemez!", "error");
    return;
  }

  if (!confirm(`"${name}" adlı personeli ve ilişkili kullanıcı hesabını silmek istediğinize emin misiniz?`)) {
    return;
  }

  if (!supabaseClient) {
    showToast("Bulut bağlantısı yok, personel silinemez.", "error");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showToast("Oturumunuz kapandı. Lütfen tekrar giriş yapın.", "error");
      return;
    }

    showToast("Personel siliniyor...", "info");

    const response = await fetch('/.netlify/functions/manage-personnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action: 'delete',
        id: id
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Personel silinemedi.");
    }

    showToast(`"${name}" personeli başarıyla silindi.`, "success");
    
    if (state.activeUser === name) {
      state.activeUser = null;
      saveState();
    }

    await syncWithSupabase(true);

    if (!state.activeUser) {
      if (typeof showProfileScreen === "function") showProfileScreen();
    }
  } catch (err) {
    console.error("Personel silme hatası:", err);
    showToast(err.message, "error");
  }
}

// Düzenleme Modalı Aç/Kapa
async function openEditPersonnelModal(id) {
  const modal = document.getElementById("edit-personnel-modal");
  const idInput = document.getElementById("edit-personnel-id");
  const nameInput = document.getElementById("edit-personnel-name");
  const emailInput = document.getElementById("edit-personnel-email");
  const passwordInput = document.getElementById("edit-personnel-password");
  const switchEl = document.getElementById("edit-personnel-is-admin");
  const photoInput = document.getElementById("edit-personnel-photo");

  if (!modal || !idInput || !nameInput || !emailInput || !passwordInput) {
    showToast("Arayüz elemanları yüklenemedi!", "error");
    return;
  }

  const profile = state.profilesDetail.find(p => p.id === id);
  if (!profile) {
    showToast("Profil bulunamadı!", "error");
    return;
  }

  idInput.value = profile.id;
  nameInput.value = profile.name;
  emailInput.value = profile.email || "";
  passwordInput.value = "";
  if (switchEl) switchEl.checked = !!profile.is_admin;
  if (photoInput) photoInput.value = "";
  
  personnelEditPhotoBase64 = undefined;

  modal.classList.remove("hidden");
}

function closeEditPersonnelModal() {
  const modal = document.getElementById("edit-personnel-modal");
  if (modal) modal.classList.add("hidden");
}

// Düzenleme Gönder
async function submitEditPersonnel() {
  const idInput = document.getElementById("edit-personnel-id");
  const nameInput = document.getElementById("edit-personnel-name");
  const emailInput = document.getElementById("edit-personnel-email");
  const passwordInput = document.getElementById("edit-personnel-password");
  const switchEl = document.getElementById("edit-personnel-is-admin");

  if (!idInput || !nameInput || !emailInput || !passwordInput) return;

  const id = idInput.value;
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const isAdmin = switchEl ? switchEl.checked : false;

  if (!name || !email) {
    showToast("Ad Soyad ve E-posta zorunludur!", "warning");
    return;
  }

  if (password && password.length < 6) {
    showToast("Yeni şifre en az 6 karakter olmalıdır!", "warning");
    return;
  }

  if (!supabaseClient) {
    showToast("Bulut bağlantısı yok, personel güncellenemez.", "error");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      showToast("Oturumunuz kapandı. Lütfen tekrar giriş yapın.", "error");
      return;
    }

    showToast(`"${name}" bilgileri güncelleniyor...`, "info");

    const updateBody = {
      action: 'update',
      id,
      name,
      email,
      isAdmin,
      photo: personnelEditPhotoBase64
    };

    if (password) {
      updateBody.password = password;
    }

    const response = await fetch('/.netlify/functions/manage-personnel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(updateBody)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Personel güncellenemedi.");
    }

    showToast(`"${name}" personeli başarıyla güncellendi!`, "success");
    closeEditPersonnelModal();

    await syncWithSupabase(true);
  } catch (err) {
    console.error("Personel güncelleme hatası:", err);
    showToast(err.message, "error");
  }
}
