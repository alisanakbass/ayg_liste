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

  // Ayrıştırma
  const eksikList = state.stocks.filter(s => s.status === "Eksik");
  const siparisList = state.stocks.filter(s => s.status === "Sipariş Verildi");
  // Arayüzün binlerce kayıtla şişmesini engellemek için en son tamamlanan 15 kaydı gösteriyoruz
  const tamamlananList = state.stocks.filter(s => s.status === "Tamamlandı").slice(0, 15);

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
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Ürün Adı</label>
            <input
              id="stock-product-name"
              type="text"
              placeholder="Örn: 10'luk Matkap Ucu, Şerit Metre..."
              class="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800 dark:text-white transition-all text-sm"
            />
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
          class="w-full bg-red-650 hover:bg-red-700 text-white py-3.5 rounded-xl font-bold hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          <span>⚠️</span> Eksik Bildirimini Gönder
        </button>
      </div>
    </div>

    <!-- DURUM SÜTUNLARI -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      
      <!-- SÜTUN 1: EKSİK STOKLAR -->
      <div class="space-y-4">
        <h3 class="text-md font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
            <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark space-y-3 relative group">
              <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <div>
                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm pr-6">${escapeHTML(s.product_name)}</h4>
                <p class="text-[10px] text-slate-400 mt-1">${formatDateRelative(s.created_at)} • ${escapeHTML(s.created_by)}</p>
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
                class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <span>📦</span> Sipariş Verildi Yap
              </button>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- SÜTUN 2: SİPARİŞ VERİLENLER -->
      <div class="space-y-4">
        <h3 class="text-md font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <span>Sipariş Verilenler</span>
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
            <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark space-y-3 relative group">
              <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <div>
                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm pr-6">${escapeHTML(s.product_name)}</h4>
                <p class="text-[10px] text-slate-400 mt-1">Sipariş: ${formatDateRelative(s.ordered_at)} • ${escapeHTML(s.ordered_by)}</p>
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
                class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-md"
              >
                <span>✅</span> Geldi (Teslim Al)
              </button>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- SÜTUN 3: TAMAMLANANLAR / ARŞİV -->
      <div class="space-y-4">
        <h3 class="text-md font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Tamamlananlar</span>
          <span class="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full font-bold">
            ${tamamlananList.length}
          </span>
        </h3>
        <div class="space-y-3">
          ${tamamlananList.length === 0 ? `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs">
              Tamamlanmış süreç bulunmuyor.
            </div>
          ` : tamamlananList.map(s => `
            <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark space-y-3 relative group">
              <button onclick="deleteStock('${s.id}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <div>
                <h4 class="font-extrabold text-slate-800 dark:text-white text-sm line-through decoration-slate-400 pr-6">${escapeHTML(s.product_name)}</h4>
                <p class="text-[10px] text-slate-400 mt-1">Geliş: ${formatDate(s.received_at)} • ${escapeHTML(s.received_by)}</p>
              </div>
              <div class="grid grid-cols-2 gap-2 text-center text-xs">
                <div class="bg-slate-100 dark:bg-slate-900/30 p-2 rounded-xl">
                  <p class="text-slate-400 text-[10px] font-semibold">Talep</p>
                  <p class="font-bold text-slate-500">${s.requested_quantity} Adet</p>
                </div>
                <div class="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-xl">
                  <p class="text-emerald-500 text-[10px] font-semibold">Teslim Alınan</p>
                  <p class="font-bold text-emerald-600 dark:text-emerald-400">${s.received_quantity} Adet</p>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

    </div>
  `;
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
