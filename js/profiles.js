// =============================================
// PROFILE MANAGEMENT
// =============================================
function showProfileScreen() {
  document.getElementById("profile-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
  renderProfiles();
}

function renderProfiles() {
  const container = document.getElementById("profile-list");
  if (!container) return;
  
  container.innerHTML = state.profiles
    .map(
      (name) => `
  <div class="relative group bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-indigo-500 transition-all duration-200 animate-slide-in" 
       onclick="selectProfile('${name}')">
    
    <!-- Profil Silme Butonu -->
    <button onclick="confirmDeleteProfile('${name}', event)" 
            class="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200"
            title="Personeli Sil">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>

    <div class="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
      ${name.charAt(0).toUpperCase()}
    </div>
    <p class="text-white text-sm font-semibold tracking-wide text-center truncate max-w-full">${name}</p>
  </div>
`,
    )
    .join("");
}

function selectProfile(name) {
  state.activeUser = name;
  saveState();
  document.getElementById("profile-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
  document.getElementById("header-username").textContent = name;
  switchTab(state.currentTab || "active");
  speakText(`Hoş geldiniz ${name}.`);
}

async function addNewProfile() {
  const input = document.getElementById("new-profile-input");
  if (!input) return;
  const name = input.value.trim();
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
      
      input.value = "";
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
    input.value = "";
    renderProfiles();
    showToast(`"${name}" adlı personel yerel olarak eklendi!`, "success");
  }
}

async function confirmDeleteProfile(name, event) {
  event.stopPropagation(); // Profil seçilmesini engelle
  
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
      showToast(`"${name}" personeli yerel olarak silindi.`, "warning");
      
      if (!state.activeUser) {
        showProfileScreen();
      }
    }
  }
}
