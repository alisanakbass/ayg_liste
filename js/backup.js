// =============================================
// EXPORT & IMPORT DATA
// =============================================
function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `ayg_depo_yedek_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Veri yedeği başarıyla indirildi!", "success");
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedState = JSON.parse(e.target.result);
      if (importedState && Array.isArray(importedState.orders) && Array.isArray(importedState.profiles)) {
        state.orders = importedState.orders;
        state.profiles = importedState.profiles;
        if (importedState.activeUser) {
          state.activeUser = importedState.activeUser;
        }
        saveState();
        if (typeof broadcastUpdate === "function") broadcastUpdate();
        
        // Arayüz yenile
        if (state.activeUser) {
          document.getElementById("header-username").textContent = state.activeUser;
          document.getElementById("profile-screen").classList.add("hidden");
          document.getElementById("main-app").classList.remove("hidden");
          if (typeof switchTab === "function") switchTab(state.currentTab);
        } else {
          if (typeof showProfileScreen === "function") showProfileScreen();
        }
        
        if (typeof closeSettingsModal === "function") closeSettingsModal();
        showToast("Veriler başarıyla içe aktarıldı!", "success");
        speakText("Veri yedek yüklemesi tamamlandı.");
      } else {
        showToast("Geçersiz yedek dosyası yapısı!", "error");
      }
    } catch (err) {
      showToast("Dosya okunamadı veya JSON geçersiz!", "error");
    }
  };
  reader.readAsText(file);
}
