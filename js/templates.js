// =============================================
// DİNAMİK ARAYÜZ VE MODAL ŞABLONLARI
// =============================================
(function() {
  const injectTemplates = () => {
    // 1. ONAY MODALI (CUSTOM CONFIRM)
    if (!document.getElementById("confirm-modal")) {
      const confirmModalDiv = document.createElement("div");
      confirmModalDiv.id = "confirm-modal";
      confirmModalDiv.className = "hidden fixed inset-0 z-[60] bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4";
      confirmModalDiv.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xs flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-in">
          <div class="p-5 text-center space-y-3">
            <div class="inline-flex p-2.5 bg-amber-500/10 text-amber-500 rounded-full">
              <i data-lucide="alert-triangle" class="w-8 h-8"></i>
            </div>
            <h3 class="font-bold text-slate-800 dark:text-slate-200 text-base" id="confirm-title">Emin misiniz?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400" id="confirm-message">Bu işlemi onaylıyor musunuz?</p>
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <button id="confirm-btn-cancel" class="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-xs">İptal</button>
            <button id="confirm-btn-ok" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-bold hover:shadow-lg active:scale-95 transition-all text-xs">Evet, Onayla</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmModalDiv);
    }

    // 2. ADMİN ŞİFRE MODALI
    if (!document.getElementById("password-modal")) {
      const passwordModalDiv = document.createElement("div");
      passwordModalDiv.id = "password-modal";
      passwordModalDiv.className = "hidden fixed inset-0 z-[60] bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4";
      passwordModalDiv.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xs flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-in">
          <div class="p-5 text-center space-y-3">
            <div class="inline-flex p-2.5 bg-indigo-500/10 text-indigo-500 rounded-full">
              <i data-lucide="lock" class="w-8 h-8"></i>
            </div>
            <h3 class="font-bold text-slate-800 dark:text-slate-200 text-base">Yönetici Girişi</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Lütfen yönetici şifresini girin:</p>
            <input id="admin-password-input" type="password" placeholder="Şifre" class="w-full text-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all text-sm font-bold tracking-widest" />
          </div>
          <div class="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <button id="password-btn-cancel" class="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-xs cursor-pointer">İptal</button>
            <button id="password-btn-confirm" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-bold hover:shadow-indigo-500/20 hover:shadow-lg active:scale-95 transition-all text-xs cursor-pointer">Giriş Yap</button>
          </div>
        </div>
      `;
      document.body.appendChild(passwordModalDiv);
    }
    
    // Lucide ikonlarını çiz
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectTemplates);
  } else {
    injectTemplates();
  }
})();
