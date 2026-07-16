// =============================================
// STOK YÖNETİMİ MODÜLÜ
// =============================================

// Stok durumlarını güncelleme ve arayüze yansıtma
async function syncStocksWithSupabase(triggerUI = true) {
  if (!supabaseClient) {
    // Supabase bağlı değilse yerel verileri yükle
    const saved = localStorage.getItem("ayg-state");
    if (saved) {
      const parsed = JSON.parse(saved);
      state.stocks = parsed.stocks || [];
    }
    if (triggerUI) renderStockPanel();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("stocks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Tablo henüz oluşturulmamışsa yerel moda düş
      if (error.message && error.message.includes("does not exist")) {
        console.warn("stocks tablosu Supabase üzerinde bulunamadı, yerel depolama kullanılıyor.");
      } else {
        throw error;
      }
    } else {
      state.stocks = data || [];
      saveState();
    }
  } catch (err) {
    console.error("Stok senkronizasyon hatası:", err);
  }

  if (triggerUI) renderStockPanel();
}

// Yeni Eksik Stok Bildirimi Oluştur
async function createStockReport(productName, requestedQty, remainingQty) {
  const name = productName.trim();
  const reqQty = parseInt(requestedQty);
  const remQty = parseInt(remainingQty);

  if (!name || isNaN(reqQty) || isNaN(remQty)) {
    showToast("Lütfen tüm alanları doğru şekilde doldurun!", "warning");
    return;
  }

  const newItem = {
    id: generateId(),
    product_name: name,
    requested_quantity: reqQty,
    remaining_quantity: remQty,
    status: "Eksik",
    created_by: state.activeUser || "Bilinmeyen",
    created_at: new Date().toISOString(),
    ordered_quantity: null,
    estimated_delivery: null,
    received_quantity: null,
    ordered_by: null,
    ordered_at: null,
    received_by: null,
    received_at: null
  };

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from("stocks").insert([newItem]);
      if (error) throw error;
      showToast("Eksik stok bildirimi buluta kaydedildi.", "success");
    } catch (err) {
      console.error("Stok ekleme hatası:", err);
      showToast("Buluta kaydedilemedi, yerel hafızaya yazılıyor.", "warning");
      state.stocks.unshift(newItem);
      saveState();
    }
  } else {
    state.stocks.unshift(newItem);
    saveState();
    showToast("Eksik stok bildirimi yerel hafızaya kaydedildi.", "success");
  }

  // Formu temizle ve arayüzü güncelle
  const nameInput = document.getElementById("stock-product-name");
  const reqInput = document.getElementById("stock-req-qty");
  const remInput = document.getElementById("stock-rem-qty");
  if (nameInput) nameInput.value = "";
  if (reqInput) reqInput.value = "";
  if (remInput) remInput.value = "";

  await syncStocksWithSupabase(true);
}

// Sipariş Verildi Durumuna Geçir
async function orderStock(stockId, orderedQty, estimatedDelivery) {
  const ordQty = parseInt(orderedQty);
  const estDelivery = estimatedDelivery.trim();

  if (isNaN(ordQty) || !estDelivery) {
    showToast("Lütfen tüm alanları doldurun!", "warning");
    return;
  }

  const updates = {
    status: "Sipariş Verildi",
    ordered_quantity: ordQty,
    estimated_delivery: estDelivery,
    ordered_by: state.activeUser || "Bilinmeyen",
    ordered_at: new Date().toISOString()
  };

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("stocks")
        .update(updates)
        .eq("id", stockId);
      if (error) throw error;
      showToast("Stok sipariş durumu güncellendi.", "success");
    } catch (err) {
      console.error("Stok sipariş hatası:", err);
      showToast("Buluta kaydedilemedi, yerel hafızada güncelleniyor.", "warning");
      updateLocalStock(stockId, updates);
    }
  } else {
    updateLocalStock(stockId, updates);
    showToast("Stok sipariş durumu yerel hafızada güncellendi.", "success");
  }

  closeStockDynamicModal();
  await syncStocksWithSupabase(true);
}

// Ürünün Gelmesi / Onaylama Durumu (Gelen adet üzerine)
async function receiveStock(stockId, receivedQty) {
  const recQty = parseInt(receivedQty);

  if (isNaN(recQty)) {
    showToast("Lütfen gelen adeti girin!", "warning");
    return;
  }

  const updates = {
    status: "Tamamlandı",
    received_quantity: recQty,
    received_by: state.activeUser || "Bilinmeyen",
    received_at: new Date().toISOString()
  };

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("stocks")
        .update(updates)
        .eq("id", stockId);
      if (error) throw error;
      showToast("Stok teslimatı başarıyla onaylandı.", "success");
    } catch (err) {
      console.error("Stok teslimat onay hatası:", err);
      showToast("Buluta kaydedilemedi, yerel hafızada onaylanıyor.", "warning");
      updateLocalStock(stockId, updates);
    }
  } else {
    updateLocalStock(stockId, updates);
    showToast("Stok teslimatı yerel hafızada onaylandı.", "success");
  }

  closeStockDynamicModal();
  await syncStocksWithSupabase(true);
}

// Stok Bildirimini Sil / İptal Et
async function deleteStock(stockId) {
  if (!confirm("Bu stok bildirim kaydını silmek istediğinize emin misiniz?")) return;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("stocks")
        .delete()
        .eq("id", stockId);
      if (error) throw error;
      showToast("Stok bildirimi silindi.", "info");
    } catch (err) {
      console.error("Stok silme hatası:", err);
      showToast("Buluttan silinemedi, yerel hafızadan kaldırılıyor.", "warning");
      state.stocks = state.stocks.filter(s => s.id !== stockId);
      saveState();
    }
  } else {
    state.stocks = state.stocks.filter(s => s.id !== stockId);
    saveState();
    showToast("Stok bildirimi yerel hafızadan silindi.", "info");
  }

  await syncStocksWithSupabase(true);
}

// Yerel Stok Güncelleme Yardımcısı
function updateLocalStock(stockId, updates) {
  state.stocks = state.stocks.map(item => {
    if (item.id === stockId) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveState();
}

// Stok Panelini Arayüze Çiz
function renderStockPanel() {
  const container = document.getElementById("page-stock");
  if (!container) return;

  const isSuper = isAdminUser();

  // Aktif Listeler (Eksik ve Sipariş Verildi) - Doğrudan açık listelenecek
  const eksikList = state.stocks.filter(s => s.status === "Eksik");
  const siparisList = state.stocks.filter(s => s.status === "Sipariş Verildi");
  
  // Tamamlananlar Listesi (Arşiv)
  const tamamlananList = state.stocks.filter(s => s.status === "Tamamlandı");

  // Arşiv açık/kapalı durumu (varsayılan: kapalı)
  if (state.archiveExpanded === undefined) state.archiveExpanded = false;
  const isArchiveExpanded = state.archiveExpanded;

  // Arşiv arama ve filtre durumları
  if (!state.archiveFilterPerson) state.archiveFilterPerson = "all";
  if (!state.archiveFilterDate) state.archiveFilterDate = "all";
  if (state.archiveSearchText === undefined) state.archiveSearchText = "";

  const archiveSearchText = state.archiveSearchText;
  const archiveFilterPerson = state.archiveFilterPerson;
  const archiveFilterDate = state.archiveFilterDate;

  // Benzersiz teslim alan personelleri çıkar
  const uniquePersonnelInArchive = [...new Set(tamamlananList.map(s => s.received_by).filter(Boolean))];

  // Tarih filtreleme hesaplamaları
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfLast7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfLast30Days = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Arşiv listesini filtrele (Arama + Personel + Tarih)
  const filteredTamamlanan = tamamlananList.filter(s => {
    const matchesSearch = s.product_name.toLowerCase().includes(archiveSearchText.toLowerCase());
    
    const matchesPerson = archiveFilterPerson === "all" || s.received_by === archiveFilterPerson;
    
    let matchesDate = true;
    if (s.received_at) {
      const recDate = new Date(s.received_at);
      if (archiveFilterDate === "today") {
        matchesDate = recDate >= startOfToday;
      } else if (archiveFilterDate === "yesterday") {
        matchesDate = recDate >= startOfYesterday && recDate < startOfToday;
      } else if (archiveFilterDate === "last7") {
        matchesDate = recDate >= startOfLast7Days;
      } else if (archiveFilterDate === "last30") {
        matchesDate = recDate >= startOfLast30Days;
      }
    } else {
      if (archiveFilterDate !== "all") matchesDate = false;
    }
    
    return matchesSearch && matchesPerson && matchesDate;
  });

  container.innerHTML = `
    <!-- BAŞLIK VE FORM -->
    <div class="space-y-4 max-w-xl mx-auto">
      <h2 class="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span class="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </span>
        <span>Stok Takip & Yönetim Sistemi</span>
      </h2>

      <!-- Eksik Bildir Form Kartı -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-4 sm:p-6 space-y-4 transition-all">
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Eksik / Biten Ürün Bildir</h3>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2 relative">
            <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Ürün Adı</label>
            <input
              id="stock-product-name"
              type="text"
              placeholder="Örn: 10'luk Matkap Ucu, Şerit Metre..."
              class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all text-sm"
              autocomplete="off"
            />
            <!-- Canlı Arama Öneri Kutusu -->
            <div id="stock-suggestions-box" class="hidden absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl shadow-premium max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50"></div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">İstenilen Adet</label>
            <input
              id="stock-req-qty"
              type="number"
              min="1"
              placeholder="Miktar"
              class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Kalan Adet</label>
            <input
              id="stock-rem-qty"
              type="number"
              min="0"
              placeholder="Mevcut Kalan (0 ise bitmiştir)"
              class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all text-sm"
            />
          </div>
        </div>

        <button
          onclick="createStockReport(
            document.getElementById('stock-product-name').value,
            document.getElementById('stock-req-qty').value,
            document.getElementById('stock-rem-qty').value
          )"
          class="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          Eksik Bildirimini Gönder
        </button>
      </div>
    </div>

    <!-- NİZAMİ İKİ SÜTUN (EKSİK VE SİPARİŞ) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
      
      <!-- SÜTUN 1: EKSİK BİLDİRİLENLER -->
      <div class="space-y-4">
        <h3 class="text-md font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-left">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <span>Eksik Bildirilenler</span>
          <span class="bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">
            ${eksikList.length}
          </span>
        </h3>
        
        <div class="space-y-3">
          ${eksikList.length === 0 ? `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              Eksik bildirilmiş ürün bulunmuyor.
            </div>
          ` : eksikList.map(s => `
            <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark space-y-3 relative group text-left">
              <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              
              <div>
                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm pr-6">${escapeHTML(s.product_name)}</h4>
                <p class="text-[10px] text-slate-400 mt-1">🚨 Eksik Bildiren: <span class="font-semibold text-slate-500 dark:text-slate-400">${escapeHTML(s.created_by)}</span> • ${formatDateRelative(s.created_at)}</p>
              </div>
              
              <div class="grid grid-cols-2 gap-2 text-center text-xs">
                <div class="bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl">
                  <p class="text-slate-400 text-[10px] font-semibold">İstenilen</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">${s.requested_quantity} Adet</p>
                </div>
                <div class="bg-red-50 dark:bg-red-950/20 p-2 rounded-xl">
                  <p class="text-red-500/80 text-[10px] font-semibold">Kalan</p>
                  <p class="font-bold text-red-600 dark:text-red-400">${s.remaining_quantity} Adet</p>
                </div>
              </div>

              <button
                onclick="openOrderStockModal('${s.id}', '${escapeHTML(s.product_name)}', ${s.requested_quantity})"
                class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                Sipariş Verildi Yap
              </button>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- SÜTUN 2: SİPARİŞ VERİLENLER -->
      <div class="space-y-4">
        <h3 class="text-md font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-left">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span>Sipariş Sürecindekiler</span>
          <span class="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full font-bold">
            ${siparisList.length}
          </span>
        </h3>
        
        <div class="space-y-3">
          ${siparisList.length === 0 ? `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              Sipariş sürecinde ürün bulunmuyor.
            </div>
          ` : siparisList.map(s => `
            <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark space-y-3 relative group text-left">
              <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              
              <div>
                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm pr-6">${escapeHTML(s.product_name)}</h4>
                <div class="text-[10px] text-slate-400 mt-1 space-y-0.5">
                  <p>🚨 Eksik Bildiren: <span class="font-semibold text-slate-550 dark:text-slate-400">${escapeHTML(s.created_by)}</span> • ${formatDateRelative(s.created_at)}</p>
                  <p>📦 Sipariş Veren: <span class="font-semibold text-slate-555 dark:text-slate-400">${escapeHTML(s.ordered_by)}</span> • ${formatDateRelative(s.ordered_at)}</p>
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-2 text-center text-xs">
                <div class="bg-indigo-50 dark:bg-indigo-950/20 p-2 rounded-xl">
                  <p class="text-indigo-500/80 text-[10px] font-semibold">Sipariş Edilen</p>
                  <p class="font-bold text-indigo-600 dark:text-indigo-400">${s.ordered_quantity} Adet</p>
                </div>
                <div class="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl">
                  <p class="text-amber-500 text-[10px] font-semibold">Geliş Süresi</p>
                  <p class="font-bold text-amber-600 dark:text-amber-400">${escapeHTML(s.estimated_delivery)}</p>
                </div>
              </div>

              <button
                onclick="openReceiveStockModal('${s.id}', '${escapeHTML(s.product_name)}', ${s.ordered_quantity})"
                class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-md"
              >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                Geldi (Teslim Al)
              </button>
            </div>
          `).join("")}
        </div>
      </div>

    </div>

    <!-- KATLANABİLİR TAMAMLANANLAR ARŞİVİ -->
    <div class="pt-8 w-full">
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark overflow-hidden transition-all duration-300">
        
        <!-- Arşiv Başlığı (Tıklanabilir) -->
        <div
          onclick="toggleArchivePanel()"
          class="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-all border-b border-slate-150 dark:border-slate-800"
        >
          <div class="flex items-center gap-2">
            <span class="text-base">📜</span>
            <h3 class="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Tamamlanan Ürünler Arşivi (${tamamlananList.length} Kayıt)
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400 font-semibold">${isArchiveExpanded ? 'Gizle' : 'Göster'}</span>
            <svg id="archive-arrow" class="w-4 h-4 text-slate-400 transition-transform duration-200 ${isArchiveExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- Arşiv İçeriği -->
        <div id="archive-content" class="${isArchiveExpanded ? '' : 'hidden'} p-4 space-y-4">
          
          <!-- Gelişmiş Filtreleme Barı -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 text-left">
            
            <!-- Arama Kutusu -->
            <div class="relative">
              <label class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 pl-1">Ürün Ara</label>
              <input
                id="archive-search-input"
                type="text"
                value="${escapeHTML(archiveSearchText)}"
                placeholder="Ürün adı yazın..."
                oninput="filterArchiveSearch(this.value)"
                class="w-full border border-slate-250 dark:border-slate-755 bg-white dark:bg-slate-950/60 rounded-xl pl-8 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all font-semibold"
              />
              <span class="absolute left-3 top-7 text-slate-400 text-xs">🔍</span>
            </div>

            <!-- Personel Filtresi -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 pl-1">Teslim Alan Personel</label>
              <select
                id="archive-person-select"
                onchange="filterArchivePerson(this.value)"
                class="w-full border border-slate-250 dark:border-slate-755 bg-white dark:bg-slate-950/60 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all font-bold cursor-pointer"
              >
                <option value="all" ${archiveFilterPerson === 'all' ? 'selected' : ''}>Tüm Personeller</option>
                ${uniquePersonnelInArchive.map(p => `
                  <option value="${escapeHTML(p)}" ${archiveFilterPerson === p ? 'selected' : ''}>${escapeHTML(p)}</option>
                `).join("")}
              </select>
            </div>

            <!-- Zaman Filtresi -->
            <div>
              <label class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 pl-1">Tamamlanma Zamanı</label>
              <select
                id="archive-date-select"
                onchange="filterArchiveDate(this.value)"
                class="w-full border border-slate-250 dark:border-slate-755 bg-white dark:bg-slate-950/60 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-850 dark:text-white transition-all font-bold cursor-pointer"
              >
                <option value="all" ${archiveFilterDate === 'all' ? 'selected' : ''}>Tüm Zamanlar</option>
                <option value="today" ${archiveFilterDate === 'today' ? 'selected' : ''}>Bugün</option>
                <option value="yesterday" ${archiveFilterDate === 'yesterday' ? 'selected' : ''}>Dün</option>
                <option value="last7" ${archiveFilterDate === 'last7' ? 'selected' : ''}>Son 7 Gün</option>
                <option value="last30" ${archiveFilterDate === 'last30' ? 'selected' : ''}>Son 30 Gün</option>
              </select>
            </div>

          </div>

          <!-- Arşiv Kayıt Listesi -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
            ${filteredTamamlanan.length === 0 ? `
              <div class="col-span-full py-8 text-center text-slate-400 text-xs">
                ${archiveSearchText ? 'Arama sonucuna uygun tamamlanmış kayıt bulunamadı.' : 'Henüz tamamlanmış bir ürün kaydı bulunmuyor.'}
              </div>
            ` : filteredTamamlanan.map(s => `
              <div class="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/40 p-4 rounded-xl relative group text-left space-y-3">
                <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
                
                <div>
                  <h4 class="font-extrabold text-slate-750 dark:text-slate-300 text-xs line-through decoration-slate-400 pr-5">${escapeHTML(s.product_name)}</h4>
                  <p class="text-[9px] text-slate-400 mt-1">Geliş Tarihi: ${formatDate(s.received_at)}</p>
                </div>

                <!-- Süreç Zaman Tüneli / Personeller -->
                <div class="space-y-1 text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                  <p>🚨 <span class="font-semibold text-slate-600 dark:text-slate-400">Bildiren:</span> ${escapeHTML(s.created_by)}</p>
                  ${s.ordered_by ? `<p>📦 <span class="font-semibold text-slate-600 dark:text-slate-400">Sipariş:</span> ${escapeHTML(s.ordered_by)} (${s.ordered_quantity} Adet)</p>` : ''}
                  <p>✅ <span class="font-semibold text-slate-600 dark:text-slate-400">Teslim Alan:</span> ${escapeHTML(s.received_by)} (${s.received_quantity} Adet)</p>
                </div>
              </div>
            `).join("")}
          </div>

        </div>
      </div>
    </div>
  `;

  // Canlı arama önerilerini başlat
  initProductAutocomplete();
}

// Arşiv Panelini Göster / Gizle
function toggleArchivePanel() {
  state.archiveExpanded = !state.archiveExpanded;
  saveState();
  renderStockPanel();
}

// Arşiv Arama Metni Filtreleme
function filterArchiveSearch(searchText) {
  state.archiveSearchText = searchText;
  renderStockPanel();
  
  const searchInput = document.getElementById("archive-search-input");
  if (searchInput) {
    searchInput.focus();
    const val = searchInput.value;
    searchInput.value = "";
    searchInput.value = val;
  }
}

// Arşiv Personel Filtreleme
function filterArchivePerson(personName) {
  state.archiveFilterPerson = personName;
  saveState();
  renderStockPanel();
}

// Arşiv Tarih Filtreleme
function filterArchiveDate(dateRange) {
  state.archiveFilterDate = dateRange;
  saveState();
  renderStockPanel();
}

// Canlı Arama (Autocomplete) Yönetimi
function initProductAutocomplete() {
  const input = document.getElementById("stock-product-name");
  const box = document.getElementById("stock-suggestions-box");
  if (!input || !box) return;

  let debounceTimer;

  input.addEventListener("input", () => {
    const val = input.value.trim();
    clearTimeout(debounceTimer);

    if (val.length < 3) {
      box.innerHTML = "";
      box.classList.add("hidden");
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/.netlify/functions/search-products?q=${encodeURIComponent(val)}`);
        if (!res.ok) throw new Error("Arama API hatası");
        const list = await res.json();

        if (list.length === 0) {
          box.innerHTML = `<div class="p-3 text-xs text-slate-400 dark:text-slate-500 text-center">Öneri bulunamadı</div>`;
          box.classList.remove("hidden");
          return;
        }

        // Önerileri listele
        box.innerHTML = list.map(item => `
          <button 
            type="button"
            class="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all focus:outline-none flex items-center gap-2 cursor-pointer"
          >
            <svg class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <span class="truncate">${escapeHTML(item)}</span>
          </button>
        `).join("");

        box.classList.remove("hidden");

        // Öneriye tıklama olayı
        const buttons = box.querySelectorAll("button");
        buttons.forEach((btn, idx) => {
          btn.addEventListener("click", () => {
            input.value = list[idx];
            box.innerHTML = "";
            box.classList.add("hidden");
          });
        });

      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }, 300);
  });

  // Tıklamayla önerileri kapatma lojiği
  document.addEventListener("click", (e) => {
    if (e.target !== input && !box.contains(e.target)) {
      box.classList.add("hidden");
    }
  });

  // Girdi alanına odaklanınca eğer içerik doluysa önerileri tekrar aç
  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 3 && box.children.length > 0) {
      box.classList.remove("hidden");
    }
  });
}

// Dinamik Modal Yönetimi
function openStockDynamicModal(title, contentHtml) {
  // Eski modal varsa kaldır
  closeStockDynamicModal();

  const modalDiv = document.createElement("div");
  modalDiv.id = "stock-dynamic-modal";
  modalDiv.className = "fixed inset-0 z-[60] bg-slate-900/60 dark:bg-black/80 flex items-center justify-center p-4";
  modalDiv.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-in">
      <div class="bg-indigo-600 dark:bg-indigo-950 text-white px-5 py-4 flex justify-between items-center">
        <h3 class="font-bold text-base">${title}</h3>
        <button onclick="closeStockDynamicModal()" class="bg-white/10 text-white/80 hover:bg-white/20 hover:text-white rounded-xl p-2 transition-all active:scale-95">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="p-5 space-y-4">
        ${contentHtml}
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);
}

function closeStockDynamicModal() {
  const existing = document.getElementById("stock-dynamic-modal");
  if (existing) {
    existing.remove();
  }
}

// "Sipariş Verildi" Modalı Aç
function openOrderStockModal(stockId, productName, defaultQty) {
  const content = `
    <div>
      <p class="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">Ürün: <span class="text-slate-800 dark:text-slate-100">${productName}</span></p>
      
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Sipariş Verilen Adet</label>
          <input
            id="modal-order-qty"
            type="number"
            value="${defaultQty}"
            min="1"
            class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white text-sm font-bold"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Ortalama Gelme Süresi</label>
          <input
            id="modal-order-delivery"
            type="text"
            placeholder="Örn: 2 gün, 1 hafta, Yarın..."
            class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white text-sm"
          />
        </div>
      </div>
      
      <div class="flex gap-2 mt-5">
        <button onclick="closeStockDynamicModal()" class="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-xs">
          İptal
        </button>
        <button
          onclick="orderStock('${stockId}', document.getElementById('modal-order-qty').value, document.getElementById('modal-order-delivery').value)"
          class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-bold hover:shadow-indigo-500/20 active:scale-95 transition-all text-xs"
        >
          Siparişi Kaydet
        </button>
      </div>
    </div>
  `;
  openStockDynamicModal("Sipariş Bilgilerini Girin", content);
}

// "Teslim Al" Modalı Aç
function openReceiveStockModal(stockId, productName, defaultQty) {
  const content = `
    <div>
      <p class="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">Ürün: <span class="text-slate-800 dark:text-slate-100">${productName}</span></p>
      
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Gelen / Teslim Alınan Adet</label>
          <input
            id="modal-receive-qty"
            type="number"
            value="${defaultQty}"
            min="1"
            class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white text-sm font-bold"
          />
        </div>
      </div>
      
      <div class="flex gap-2 mt-5">
        <button onclick="closeStockDynamicModal()" class="flex-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all text-xs">
          İptal
        </button>
        <button
          onclick="receiveStock('${stockId}', document.getElementById('modal-receive-qty').value)"
          class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold active:scale-95 transition-all text-xs"
        >
          Teslimatı Onayla
        </button>
      </div>
    </div>
  `;
  openStockDynamicModal("Teslimatı Onayla", content);
}
