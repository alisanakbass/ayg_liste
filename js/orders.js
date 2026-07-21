// =============================================
// ORDERS MANAGEMENT
// =============================================
const URGENCY_ORDER = { "Çok Acil": 0, Acil: 1, Normal: 2 };
const URGENCY_BADGE = {
  "Çok Acil": "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20",
  Acil: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20",
  Normal: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
};
const URGENCY_ICON = { "Çok Acil": "🔴", Acil: "🟠", Normal: "🔵" };

function renderNavigationButton(o) {
  const addr = (o.customer_address || "").trim();
  const isLink = addr.startsWith("http://") || addr.startsWith("https://") || addr.includes("maps.apple") || addr.includes("apple.com") || addr.includes("yandex.") || addr.includes("goo.gl");
  
  let href;
  if (isLink) {
    href = addr;
  } else {
    const hasCoords = o.destination_lat && o.destination_lng;
    const query = hasCoords 
      ? `${o.destination_lat},${o.destination_lng}` 
      : encodeURIComponent(addr);
    href = `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  
  return `
<a href="${href}" 
   target="_blank" 
   class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-500/20 transition-all active:scale-95 shadow-sm shrink-0"
   title="Yol Tarifi Al">
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
  <span>Yol Tarifi</span>
</a>
`;
}

function toggleOrderNoteInput() {
  const container = document.getElementById("order-note-container");
  const btnText = document.getElementById("btn-toggle-note-text");
  if (!container) return;
  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    container.classList.remove("hidden");
    if (btnText) btnText.textContent = "📝 Sipariş Açıklamasını Gizle";
    const noteInp = document.getElementById("order-note");
    if (noteInp) noteInp.focus();
  } else {
    container.classList.add("hidden");
    if (btnText) btnText.textContent = "📝 + Sipariş Açıklaması Ekle";
  }
}

function toggleModalNote() {
  const noteBox = document.getElementById("modal-note-box");
  const noteArrow = document.getElementById("modal-note-arrow");
  if (!noteBox) return;
  const isHidden = noteBox.classList.contains("hidden");
  if (isHidden) {
    noteBox.classList.remove("hidden");
    if (noteArrow) noteArrow.style.transform = "rotate(180deg)";
  } else {
    noteBox.classList.add("hidden");
    if (noteArrow) noteArrow.style.transform = "rotate(0deg)";
  }
}

let orderItemCount = 0;

function initOrderForm() {
  orderItemCount = 0;
  document.getElementById("order-address").value = "";
  const noteEl = document.getElementById("order-note");
  if (noteEl) noteEl.value = "";
  const noteContainer = document.getElementById("order-note-container");
  if (noteContainer) noteContainer.classList.add("hidden");
  const btnToggleText = document.getElementById("btn-toggle-note-text");
  if (btnToggleText) btnToggleText.textContent = "📝 + Sipariş Açıklaması Ekle";
  const openLinkBtn = document.getElementById("btn-open-address-link");
  if (openLinkBtn) openLinkBtn.classList.add("hidden");
  document.getElementById("order-urgency").value = "Normal";
  document.getElementById("order-items-list").innerHTML = "";
  
  const recipientEl = document.getElementById("order-recipient");
  if (recipientEl) recipientEl.value = "";

  document.getElementById("create-page-title").textContent = "Yeni Sipariş Oluştur";
  document.getElementById("btn-save-order").querySelector('span').textContent = "Siparişi Kaydet";
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  state.editingOrderId = null;
  state.pickerLat = null;
  state.pickerLng = null;
  if (state.pickerMarker) {
    state.pickerMarker = null;
  }
  
  // Taslak siparişi yüklemeyi dene, yoksa boş ürün satırı ekle
  const hasDraft = loadAdminOrderDraft();
  if (!hasDraft) {
    addOrderItem();
  }

  // Dinleyicileri bağla (Taslağa anlık yazması için)
  const recEl = document.getElementById("order-recipient");
  const addrEl = document.getElementById("order-address");
  const urgEl = document.getElementById("order-urgency");

  if (recEl && !recEl.dataset.listenerAttached) {
    recEl.addEventListener("input", saveAdminOrderDraft);
    recEl.dataset.listenerAttached = "true";
  }
  if (addrEl && !addrEl.dataset.listenerAttached) {
    addrEl.addEventListener("input", saveAdminOrderDraft);
    addrEl.dataset.listenerAttached = "true";
  }
  if (urgEl && !urgEl.dataset.listenerAttached) {
    urgEl.addEventListener("change", saveAdminOrderDraft);
    urgEl.dataset.listenerAttached = "true";
  }
  if (noteEl && !noteEl.dataset.listenerAttached) {
    noteEl.addEventListener("input", saveAdminOrderDraft);
    noteEl.dataset.listenerAttached = "true";
  }
}

// Taslak Siparişi LocalStorage'a Kaydet
function saveAdminOrderDraft() {
  if (state.editingOrderId) return; // Düzenleme modunda taslağı bozma

  const recipient = document.getElementById("order-recipient") ? document.getElementById("order-recipient").value.trim() : "";
  const address = document.getElementById("order-address") ? document.getElementById("order-address").value.trim() : "";
  const urgency = document.getElementById("order-urgency") ? document.getElementById("order-urgency").value : "Normal";
  const note = document.getElementById("order-note") ? document.getElementById("order-note").value.trim() : "";

  localStorage.setItem("ayg-admin-draft-recipient", recipient);
  localStorage.setItem("ayg-admin-draft-address", address);
  localStorage.setItem("ayg-admin-draft-urgency", urgency);
  localStorage.setItem("ayg-admin-draft-note", note);

  if (state.pickerLat && state.pickerLng) {
    localStorage.setItem("ayg-admin-draft-lat", state.pickerLat);
    localStorage.setItem("ayg-admin-draft-lng", state.pickerLng);
  } else {
    localStorage.removeItem("ayg-admin-draft-lat");
    localStorage.removeItem("ayg-admin-draft-lng");
  }

  const itemDivs = document.querySelectorAll('[id^="item-"]');
  const items = [];
  for (const div of itemDivs) {
    const nameEl = document.getElementById(`${div.id}-name`);
    const qtyEl = document.getElementById(`${div.id}-qty`);
    const unitEl = document.getElementById(`${div.id}-unit`);
    if (!nameEl || !qtyEl) continue;
    const name = nameEl.value.trim();
    const qty = parseInt(qtyEl.value) || 1;
    const unit = unitEl ? unitEl.value : "adet";
    
    items.push({
      product_name: name,
      requested_quantity: qty,
      unit: unit
    });
  }
  localStorage.setItem("ayg-admin-draft-items", JSON.stringify(items));
}

// Taslak Siparişi LocalStorage'dan Yükle
function loadAdminOrderDraft() {
  const recipient = localStorage.getItem("ayg-admin-draft-recipient");
  const address = localStorage.getItem("ayg-admin-draft-address");
  const urgency = localStorage.getItem("ayg-admin-draft-urgency");
  const note = localStorage.getItem("ayg-admin-draft-note");
  const lat = localStorage.getItem("ayg-admin-draft-lat");
  const lng = localStorage.getItem("ayg-admin-draft-lng");
  const itemsStr = localStorage.getItem("ayg-admin-draft-items");

  let hasData = false;

  if (recipient && document.getElementById("order-recipient")) {
    document.getElementById("order-recipient").value = recipient;
    hasData = true;
  }
  if (address && document.getElementById("order-address")) {
    document.getElementById("order-address").value = address;
    hasData = true;
  }
  if (urgency && document.getElementById("order-urgency")) {
    document.getElementById("order-urgency").value = urgency;
    hasData = true;
  }
  if (note && document.getElementById("order-note")) {
    document.getElementById("order-note").value = note;
    const container = document.getElementById("order-note-container");
    if (container) container.classList.remove("hidden");
    const btnToggleText = document.getElementById("btn-toggle-note-text");
    if (btnToggleText) btnToggleText.textContent = "📝 Sipariş Açıklamasını Gizle";
    hasData = true;
  }
  if (lat && lng) {
    state.pickerLat = parseFloat(lat);
    state.pickerLng = parseFloat(lng);
    hasData = true;
  }

  if (itemsStr) {
    try {
      const items = JSON.parse(itemsStr);
      if (items && items.length > 0) {
        document.getElementById("order-items-list").innerHTML = "";
        orderItemCount = 0;
        items.forEach(item => {
          addOrderItem(item.product_name, item.requested_quantity, item.unit);
        });
        hasData = true;
        return hasData;
      }
    } catch (e) {
      console.error("Yönetici taslak ürünleri yüklenirken hata:", e);
    }
  }
  return hasData;
}

// Taslak Siparişi Temizle
function clearAdminOrderDraft() {
  localStorage.removeItem("ayg-admin-draft-recipient");
  localStorage.removeItem("ayg-admin-draft-address");
  localStorage.removeItem("ayg-admin-draft-urgency");
  localStorage.removeItem("ayg-admin-draft-note");
  localStorage.removeItem("ayg-admin-draft-lat");
  localStorage.removeItem("ayg-admin-draft-lng");
  localStorage.removeItem("ayg-admin-draft-items");
}

// Sipariş Listesini Onay ile Temizle
function confirmClearOrderList() {
  if (confirm("Sipariş listesindeki tüm ürünleri temizlemek istediğinize emin misiniz?")) {
    clearAdminOrderDraft();
    initOrderForm();
    showToast("Sipariş listesi temizlendi.", "success");
  }
}

function addOrderItem(name = "", qty = 1, unit = "adet") {
  orderItemCount++;
  const id = `item-${orderItemCount}`;
  const div = document.createElement("div");
  div.className =
    "flex flex-col sm:flex-row gap-2 sm:items-center bg-slate-50 dark:bg-slate-900/60 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 animate-slide-in";
  div.id = id;
  div.innerHTML = `
<div class="relative flex-1 w-full">
  <input type="text" placeholder="Ürün adı" 
    class="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 sm:px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs sm:text-sm text-slate-800 dark:text-white font-semibold" 
    id="${id}-name" value="${escapeHTML(name)}" title="${escapeHTML(name)}" autocomplete="off" />
</div>
<div class="flex items-center gap-2 justify-between sm:justify-start shrink-0 w-full sm:w-auto">
  <div class="flex items-center gap-1.5 flex-1 sm:flex-initial">
    <select 
      class="flex-1 sm:w-24 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs text-center text-slate-800 dark:text-white font-semibold cursor-pointer" 
      id="${id}-unit">
      <option value="adet" ${unit === "adet" ? "selected" : ""}>Adet</option>
      <option value="kilo" ${unit === "kilo" ? "selected" : ""}>Kilo</option>
      <option value="çuval" ${unit === "çuval" ? "selected" : ""}>Çuval</option>
      <option value="m³" ${unit === "m³" ? "selected" : ""}>m³ (Metreküp)</option>
      <option value="kutu" ${unit === "kutu" ? "selected" : ""}>Kutu</option>
      <option value="paket" ${unit === "paket" ? "selected" : ""}>Paket</option>
      <option value="metre" ${unit === "metre" ? "selected" : ""}>Metre</option>
      <option value="litre" ${unit === "litre" ? "selected" : ""}>Litre</option>
    </select>
    <input type="number" placeholder="Miktar" min="1"
      class="w-20 sm:w-20 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs sm:text-sm text-center text-slate-800 dark:text-white font-bold" 
      id="${id}-qty" value="${qty}" />
  </div>
  <button onclick="removeOrderItem('${id}')" 
    class="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-lg active:scale-90 transition-all cursor-pointer shrink-0"
    title="Ürünü Çıkar">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
  </button>
</div>
`;
  document.getElementById("order-items-list").appendChild(div);

  // Dinleyicileri bağla
  const nameInp = div.querySelector(`#${id}-name`);
  const unitSel = div.querySelector(`#${id}-unit`);
  const qtyInp = div.querySelector(`#${id}-qty`);
  if (nameInp) nameInp.addEventListener("input", () => {
    nameInp.title = nameInp.value;
    saveAdminOrderDraft();
  });
  if (unitSel) unitSel.addEventListener("change", saveAdminOrderDraft);
  if (qtyInp) qtyInp.addEventListener("input", saveAdminOrderDraft);

  saveAdminOrderDraft();
}

function removeOrderItem(id) {
  const el = document.getElementById(id);
  if (el) {
    const allItems = document.querySelectorAll('[id^="item-"]');
    if (allItems.length <= 1) {
      showToast("En az bir ürün eklemelisiniz!", "warning");
      return;
    }
    el.remove();
    saveAdminOrderDraft();
  }
}

async function saveOrder() {
  const address = document.getElementById("order-address").value.trim();
  const phoneEl = document.getElementById("order-phone");
  const phone = phoneEl ? phoneEl.value.trim() : "";
  const urgency = document.getElementById("order-urgency").value;
  const noteEl = document.getElementById("order-note");
  const note = noteEl ? noteEl.value.trim() : "";
  const recipientEl = document.getElementById("order-recipient");
  const recipient = recipientEl ? recipientEl.value.trim() || "Genel" : "Genel";
  const createdBy = state.activeUser || "Bilinmeyen";

  if (!address) {
    showToast("Lütfen müşteri adresi girin!", "error");
    return;
  }

  const itemDivs = document.querySelectorAll('[id^="item-"]');
  const items = [];
  for (const div of itemDivs) {
    const idBase = div.id;
    const nameEl = document.getElementById(`${idBase}-name`);
    const qtyEl = document.getElementById(`${idBase}-qty`);
    const unitEl = document.getElementById(`${idBase}-unit`);
    if (!nameEl || !qtyEl) continue;
    const name = nameEl.value.trim();
    const qty = parseInt(qtyEl.value) || 1;
    const unit = unitEl ? unitEl.value : "adet";
    if (name) {
      items.push({
        product_name: name,
        requested_quantity: qty,
        fulfilled_quantity: qty,
        unit: unit,
      });
    }
  }

  if (items.length === 0) {
    showToast("Lütfen geçerli en az 1 ürün adı girin!", "error");
    return;
  }

  let voiceMsg = "";
  
  const destLat = state.pickerLat;
  const destLng = state.pickerLng;

  if (state.editingOrderId) {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({ 
            customer_address: address, 
            customer_phone: phone,
            urgency, 
            note,
            items, 
            created_by: createdBy, 
            recipient: recipient,
            destination_lat: destLat,
            destination_lng: destLng
          })
          .eq('id', state.editingOrderId);
        if (error) throw error;
        
        showToast("Sipariş başarıyla güncellendi!", "success");
        voiceMsg = "Sipariş güncellendi.";
        state.editingOrderId = null;
        state.pickerLat = null;
        state.pickerLng = null;
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Sipariş güncelleme hatası:", err);
        showToast("Bulutta sipariş güncellenemedi!", "error");
        return;
      }
    } else {
      const orderIndex = state.orders.findIndex(o => o.id === state.editingOrderId);
      if (orderIndex !== -1) {
        state.orders[orderIndex].customer_address = address;
        state.orders[orderIndex].customer_phone = phone;
        state.orders[orderIndex].urgency = urgency;
        state.orders[orderIndex].note = note;
        state.orders[orderIndex].items = items;
        state.orders[orderIndex].created_by = createdBy;
        state.orders[orderIndex].recipient = recipient;
        state.orders[orderIndex].destination_lat = destLat;
        state.orders[orderIndex].destination_lng = destLng;
        
        showToast("Sipariş başarıyla güncellendi!", "success");
        voiceMsg = "Sipariş güncellendi.";
        state.editingOrderId = null;
        state.pickerLat = null;
        state.pickerLng = null;
        saveState();
        broadcastUpdate(voiceMsg);
      }
    }
  } else {
    // YENI SIPARIS
    const order = {
      id: generateId(),
      customer_address: address,
      customer_phone: phone,
      urgency,
      note,
      status: "Bekliyor",
      created_by: createdBy,
      recipient: recipient,
      created_at: new Date().toISOString(),
      picked_by: null,
      items,
      destination_lat: destLat,
      destination_lng: destLng
    };

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('orders').insert([order]);
        if (error) throw error;
        
        clearAdminOrderDraft(); // Taslağı sil
        showToast("✅ Sipariş kaydedildi!", "success");
        voiceMsg = "Yeni sipariş oluşturuldu.";
        state.pickerLat = null;
        state.pickerLng = null;
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Sipariş ekleme hatası:", err);
        showToast("Buluta sipariş eklenemedi!", "error");
        return;
      }
    } else {
      state.orders.unshift(order);
      clearAdminOrderDraft(); // Taslağı sil
      showToast("✅ Sipariş kaydedildi!", "success");
      voiceMsg = "Yeni sipariş oluşturuldu.";
      state.pickerLat = null;
      state.pickerLng = null;
      saveState();
      broadcastUpdate(voiceMsg);
    }
  }

  speakText(voiceMsg);
  initOrderForm();
  switchTab("active");
}

function editOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== "Bekliyor") return;

  state.editingOrderId = orderId;
  state.pickerLat = order.destination_lat || null;
  state.pickerLng = order.destination_lng || null;
  
  switchTab("create");
  
  document.getElementById("create-page-title").textContent = "Siparişi Düzenle";
  document.getElementById("btn-save-order").querySelector('span').textContent = "Değişiklikleri Kaydet";
  document.getElementById("btn-cancel-edit").classList.remove("hidden");

  document.getElementById("order-address").value = order.customer_address;
  document.getElementById("order-urgency").value = order.urgency;
  
  const noteEl = document.getElementById("order-note");
  const noteVal = order.note || order.description || "";
  if (noteEl) noteEl.value = noteVal;
  const noteContainer = document.getElementById("order-note-container");
  const btnToggleText = document.getElementById("btn-toggle-note-text");
  if (noteVal) {
    if (noteContainer) noteContainer.classList.remove("hidden");
    if (btnToggleText) btnToggleText.textContent = "📝 Sipariş Açıklamasını Gizle";
  } else {
    if (noteContainer) noteContainer.classList.add("hidden");
    if (btnToggleText) btnToggleText.textContent = "📝 + Sipariş Açıklaması Ekle";
  }
  
  const phoneEl = document.getElementById("order-phone");
  if (phoneEl) phoneEl.value = order.customer_phone || "";
  
  const recipientEl = document.getElementById("order-recipient");
  if (recipientEl) recipientEl.value = order.recipient || "";

  const list = document.getElementById("order-items-list");
  list.innerHTML = "";
  orderItemCount = 0;
  
  order.items.forEach(item => {
    addOrderItem(item.product_name, item.requested_quantity, item.unit || "adet");
  });
}

function cancelEditOrder() {
  initOrderForm();
  switchTab("active");
}

async function deleteOrder(orderId) {
  if (confirm("Bu siparişi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        
        showToast("Sipariş silindi.", "warning");
        speakText("Sipariş silindi.");
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Sipariş silme hatası:", err);
        showToast("Buluttan sipariş silinemedi!", "error");
      }
    } else {
      state.orders = state.orders.filter(o => o.id !== orderId);
      saveState();
      broadcastUpdate("Bir sipariş silindi.");
      speakText("Sipariş silindi.");
      renderActiveOrders();
      updateStats();
      showToast("Sipariş silindi.", "warning");
    }
  }
}

function onFilterChange() {
  renderActiveOrders();
}

function getFilteredOrders(orders, searchInputId, urgencyFilterId) {
  const searchInput = document.getElementById(searchInputId);
  const urgencyFilter = document.getElementById(urgencyFilterId);
  if (!searchInput || !urgencyFilter) return orders;

  const search = searchInput.value.toLowerCase().trim();
  const urgency = urgencyFilter.value;
  
  const dateFilter = document.getElementById("history-date-filter");
  const filterDateVal = dateFilter ? dateFilter.value : "";

  return orders.filter(o => {
    const matchUrgency = urgency === "All" || o.urgency === urgency;
    
    let matchDate = true;
    if (filterDateVal && o.completed_at) {
      const oDate = new Date(o.completed_at).toDateString();
      const fDate = new Date(filterDateVal).toDateString();
      matchDate = oDate === fDate;
    }
    const matchSearch = !search || 
      o.customer_address.toLowerCase().includes(search) ||
      (o.created_by && o.created_by.toLowerCase().includes(search)) ||
      (o.recipient && o.recipient.toLowerCase().includes(search)) ||
      (o.picked_by && o.picked_by.toLowerCase().includes(search)) ||
      o.items.some(i => i.product_name.toLowerCase().includes(search));
    
    return matchUrgency && matchSearch && matchDate;
  });
}

function renderActiveOrders() {
  const activeOrders = state.orders.filter(o => o.status === "Bekliyor" || o.status === "Hazırlanıyor");
  const filtered = getFilteredOrders(activeOrders, "active-search-input", "active-urgency-filter");

  const bekliyor = filtered
    .filter((o) => o.status === "Bekliyor")
    .sort(
      (a, b) =>
        URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
        new Date(a.created_at) - new Date(b.created_at),
    );

  const hazirlaniyor = filtered.filter(
    (o) => o.status === "Hazırlanıyor",
  );

  const bContainer = document.getElementById("list-bekliyor");
  const hContainer = document.getElementById("list-hazirlaniyor");
  if (!bContainer || !hContainer) return;

  bContainer.innerHTML =
    bekliyor.length === 0
      ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Aranan kriterde bekleyen sipariş yok</div>'
      : bekliyor.map((o) => renderOrderCard(o)).join("");

  hContainer.innerHTML =
    hazirlaniyor.length === 0
      ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Aranan kriterde hazırlanan sipariş yok</div>'
      : hazirlaniyor.map((o) => renderHazirlaniyorCard(o)).join("");
  
  updateStats();
}

function renderBekliyorCard(o) {
  return renderOrderCard(o);
}

function renderOrderCard(o) {
  const itemSummary = o.items
    ? o.items.map((i) => `${i.product_name} (${i.requested_quantity} ${i.unit || "adet"})`).join(", ")
    : "Ürün bilgisi yok";
  const hasNote = !!(o.note || o.description);

  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between relative group hover:border-indigo-500 dark:hover:border-indigo-400 transition-all duration-200 animate-slide-in">
  
  <!-- Düzenleme ve Silme Butonları -->
  <div class="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
    <button onclick="editOrder('${o.id}')" 
            class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Siparişi Düzenle">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
    </button>
    <button onclick="deleteOrder('${o.id}')" 
            class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Siparişi Sil">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>
  </div>

  <div class="mb-4">
    <div class="flex justify-between items-center gap-2 mb-3">
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
        ${hasNote ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">📝 Not</span>` : ""}
      </div>

      <!-- MÜŞTERİ / ALICI İSMİ (İKONSUZ CANLI KIRMIZI HAP BADGE) -->
      <span class="font-black text-xs sm:text-sm text-white bg-red-600 dark:bg-red-600 px-3.5 py-1 rounded-full shadow-sm shadow-red-600/30 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[240px] text-center shrink-0" title="Müşteri / Alıcı">
        ${escapeHTML(o.recipient || "") || "GENEL MÜŞTERİ"}
      </span>

      <span class="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">${formatDateRelative(o.created_at)}</span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-start gap-1 justify-between">
      <span class="flex items-start gap-1 min-w-0 flex-1">
        <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate pr-4">${escapeHTML(o.customer_address)}</span>
      </span>
      ${renderNavigationButton(o)}
    </p>
    <p class="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800 line-clamp-2 break-words" title="${escapeHTML(itemSummary)}">
      <b>Ürünler:</b> ${itemSummary}
    </p>
  </div>
  
  <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
    <div class="flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase">
      <span>👤 Temsilci: ${escapeHTML(o.created_by || "") || "—"}</span>
      <span class="text-indigo-600 dark:text-indigo-400 normal-case font-bold">🚚 Şoför: ${escapeHTML(o.shipped_by || "") || "—"}</span>
      ${o.customer_phone ? `<a href="tel:${o.customer_phone}" class="text-emerald-600 dark:text-emerald-400 normal-case font-bold flex items-center gap-0.5 mt-0.5 hover:underline">📞 Ara: ${escapeHTML(o.customer_phone)}</a>` : ""}
    </div>
    <div class="flex gap-2">
      <button onclick="openModal('${o.id}')" 
        class="bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer">
        🔍 Detay
      </button>
      <button onclick="startPicking('${o.id}')" 
        class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Hazırlamaya Başla
      </button>
    </div>
  </div>
</div>
`;
}

function renderHazirlaniyorCard(o) {
  const canAccess = !o.picked_by || o.picked_by === state.activeUser;
  const hasNote = !!(o.note || o.description);

  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between hover:border-indigo-500 transition-all duration-200 animate-slide-in">
  <div class="mb-4">
    <div class="flex justify-between items-center gap-2 mb-3">
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
        ${hasNote ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">📝 Not</span>` : ""}
      </div>

      <!-- MÜŞTERİ / ALICI İSMİ (İKONSUZ CANLI KIRMIZI HAP BADGE) -->
      <span class="font-black text-xs sm:text-sm text-white bg-red-600 dark:bg-red-600 px-3.5 py-1 rounded-full shadow-sm shadow-red-600/30 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[240px] text-center shrink-0" title="Müşteri / Alıcı">
        ${escapeHTML(o.recipient || "") || "GENEL MÜŞTERİ"}
      </span>

      <span class="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">${formatDateRelative(o.created_at)}</span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-2 flex items-start gap-1 justify-between">
      <span class="flex items-start gap-1 min-w-0 flex-1">
        <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate pr-4">${escapeHTML(o.customer_address)}</span>
      </span>
      ${renderNavigationButton(o)}
    </p>
    <div class="flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase mb-2.5">
      <div class="flex justify-between items-center w-full">
        <span>👤 Temsilci: ${escapeHTML(o.created_by || "") || "—"}</span>
        <span class="text-indigo-600 dark:text-indigo-400 normal-case font-bold">🚚 Şoför: ${escapeHTML(o.shipped_by || "") || "—"}</span>
      </div>
      ${o.customer_phone ? `<a href="tel:${o.customer_phone}" class="text-emerald-600 dark:text-emerald-400 normal-case font-bold flex items-center gap-0.5 mt-0.5 hover:underline">📞 Ara: ${escapeHTML(o.customer_phone)}</a>` : ""}
    </div>
    <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
      <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      <span>Hazırlayan: <b>${escapeHTML(o.picked_by || "") || "—"}</b></span>
    </p>
  </div>
  
  <div class="border-t border-slate-100 dark:border-slate-800 pt-3 flex gap-2">
    ${
      canAccess
        ? `<button onclick="openModal('${o.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Detay ve Tamamla
           </button>`
        : `<button onclick="openModal('${o.id}')" 
                   class="bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer" 
                   title="Sipariş Detayı">
             🔍 Detay
           </button>
           <div class="flex-1 text-slate-500 bg-slate-50/50 dark:bg-slate-900 text-xs py-2.5 rounded-xl font-semibold text-center flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
             <span>Kilitli</span>
           </div>
           <button onclick="takeoverPicking('${o.id}')" 
                   class="bg-slate-100 dark:bg-slate-700 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 text-slate-600 dark:text-slate-300 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-0.5 border border-slate-200 dark:border-slate-700 cursor-pointer" 
                   title="Görevi Devral">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
             Devral
           </button>`
    }
  </div>
</div>
`;
}

async function startPicking(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== "Bekliyor") {
    showToast("Bu sipariş artık mevcut değil!", "error");
    renderActiveOrders();
    return;
  }

  const confirmed = await showCustomConfirm(
    "Siparişi Hazırla?",
    "Bu siparişi hazırlamaya başlamak istediğinize emin misiniz?"
  );
  if (!confirmed) return;

  const voiceMsg = `${state.activeUser} siparişi hazırlamaya başladı.`;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .update({ status: 'Hazırlanıyor', picked_by: state.activeUser })
        .eq('id', orderId);
      if (error) throw error;
      
      showToast("🚀 Sipariş hazırlama sürecine alındı!", "success");
      speakText(voiceMsg);
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Sipariş hazırlama hatası:", err);
      showToast("Bulutta sipariş kilitlenemedi!", "error");
    }
  } else {
    order.status = "Hazırlanıyor";
    order.picked_by = state.activeUser;
    saveState();
    broadcastUpdate(voiceMsg);
    speakText(voiceMsg);
    renderActiveOrders();
    showToast("🚀 Sipariş hazırlama sürecine alındı!", "success");
  }
}

async function takeoverPicking(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;
  
  if (confirm(`Bu siparişi hazırlayan kişi şu an "${order.picked_by}". Görevi devralmak istediğinize emin misiniz?`)) {
    const oldPicker = order.picked_by;
    const voiceMsg = `Hazırlanan sipariş ${oldPicker} personeli yerine ${state.activeUser} tarafından devralındı.`;

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({ picked_by: state.activeUser })
          .eq('id', orderId);
        if (error) throw error;

        showToast(`Sipariş ${oldPicker} adlı personelden devralındı!`, "success");
        speakText(voiceMsg);
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Görev devralma hatası:", err);
        showToast("Bulutta görev devralınamadı!", "error");
      }
    } else {
      order.picked_by = state.activeUser;
      saveState();
      broadcastUpdate(voiceMsg);
      speakText(voiceMsg);
      renderActiveOrders();
      showToast(`Sipariş ${oldPicker} adlı personelden devralındı!`, "success");
    }
  }
}

function openModal(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;
  state.modalOrderId = orderId;
  state.currentModalOrder = order;
  
  document.getElementById("modal-address").textContent = order.customer_address;
  document.getElementById("modal-picker").innerHTML = `👷 Hazırlayan: ${order.picked_by || "—"} ${order.customer_phone ? `<a href="tel:${order.customer_phone}" class="ml-3 text-emerald-600 dark:text-emerald-400 font-bold hover:underline">📞 Ara: ${order.customer_phone}</a>` : ""}`;

  const badge = document.getElementById("modal-urgency-badge");
  badge.textContent = `${URGENCY_ICON[order.urgency]} ${order.urgency}`;
  badge.className = `px-3 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[order.urgency]}`;
  
  // Sipariş Açıklaması / Notu Hazırla
  const note = (order.note || order.description || "").trim();
  const noteBox = document.getElementById("modal-note-box");
  const noteText = document.getElementById("modal-note-text");
  const noteBtnText = document.getElementById("modal-note-btn-text");
  const noteArrow = document.getElementById("modal-note-arrow");

  if (noteBox) noteBox.classList.add("hidden");
  if (noteArrow) noteArrow.style.transform = "rotate(0deg)";

  if (note) {
    if (noteText) noteText.textContent = note;
    if (noteBtnText) noteBtnText.textContent = "📝 Sipariş Açıklamasını Göster";
  } else {
    if (noteText) noteText.textContent = "Bu siparişte ek bir açıklama / not yazılmamış.";
    if (noteBtnText) noteBtnText.textContent = "📝 Sipariş Açıklaması (Not Yok)";
  }

  renderModalItems();
  document.getElementById("detail-modal").classList.remove("hidden");
}

function renderModalItems() {
  const order = state.currentModalOrder;
  if (!order) return;

  const itemsContainer = document.getElementById("modal-items");
  if (!itemsContainer) return;

  const isEditable = order.status === "Hazırlanıyor" && (!order.picked_by || order.picked_by === state.activeUser);
  
  // Siparişi tamamla butonunu göster/gizle (Sadece düzenlenebilir ise gösterilir)
  const completeBtn = document.getElementById("btn-complete-order");
  if (completeBtn) {
    if (isEditable) {
      completeBtn.classList.remove("hidden");
    } else {
      completeBtn.classList.add("hidden");
    }
  }

  // Sıralama butonunun metnini güncelle
  const sortBtn = document.getElementById("modal-sort-btn");
  if (sortBtn) {
    if (state.modalSortOrder === "unchecked-first") {
      sortBtn.textContent = "⇅ Sırala: Tiksizler Üstte";
    } else if (state.modalSortOrder === "checked-first") {
      sortBtn.textContent = "⇅ Sırala: Tikliler Üstte";
    } else {
      sortBtn.textContent = "⇅ Sırala: Varsayılan";
    }
  }

  // Orijinal indeksleri koruyarak eşle
  let mappedItems = order.items.map((item, idx) => ({ ...item, originalIndex: idx }));

  if (state.modalSortOrder === "unchecked-first") {
    mappedItems.sort((a, b) => (a.checked === b.checked) ? 0 : a.checked ? 1 : -1);
  } else if (state.modalSortOrder === "checked-first") {
    mappedItems.sort((a, b) => (a.checked === b.checked) ? 0 : a.checked ? -1 : 1);
  }

  itemsContainer.innerHTML = mappedItems
    .map(
      (item) => {
        const isChecked = item.checked || false;
        const rowClass = isChecked 
          ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60" 
          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700";

        const disableControls = !isEditable || isChecked ? 'disabled opacity-50' : '';
        const disableInput = !isEditable || isChecked ? 'disabled' : '';
        const disableTick = !isEditable ? 'disabled opacity-50 cursor-not-allowed' : 'cursor-pointer';
        const tickAction = !isEditable ? '' : `onclick="toggleItemChecked(${item.originalIndex}, event)"`;

        return `
<div class="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors duration-200 ${rowClass}">
  <div class="flex items-start gap-3 flex-1 min-w-0">
    <!-- Tik Kutusu -->
    <button ${tickAction} ${!isEditable ? 'disabled' : ''}
      class="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all active:scale-95 mt-0.5 ${disableTick} ${
        isChecked 
          ? "bg-emerald-600 border-emerald-600 text-white" 
          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent"
      }">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
    </button>
    <div class="min-w-0 flex-1">
      <p class="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base break-words whitespace-normal leading-snug ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''}" title="${escapeHTML(item.product_name || '')}">📦 ${escapeHTML(item.product_name || '')}</p>
      <p class="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1 uppercase tracking-wide">Talep Edilen: ${item.requested_quantity} ${item.unit || "adet"}</p>
    </div>
  </div>
  <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-2 sm:pt-0">
    <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Depodaki:</span>
    <div class="flex items-center gap-1.5 font-bold">
      <button onclick="event.stopPropagation(); event.preventDefault(); adjustQty(${item.originalIndex}, -1); saveModalOrderProgress();" class="w-8 h-8 bg-red-50 dark:bg-red-500/10 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg font-bold text-lg hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center" ${disableControls}>−</button>
      <input type="number" id="fulfilled-${item.originalIndex}" value="${item.fulfilled_quantity}" min="0" max="${item.requested_quantity}"
        class="w-14 text-center border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg py-1.5 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        onclick="event.stopPropagation();"
        onchange="validateQty(${item.originalIndex}, ${item.requested_quantity}); saveModalOrderProgress();" ${disableInput} />
      <button onclick="event.stopPropagation(); event.preventDefault(); adjustQty(${item.originalIndex}, 1, ${item.requested_quantity}); saveModalOrderProgress();" class="w-8 h-8 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded-lg font-bold text-lg hover:bg-green-100 dark:hover:bg-green-200 active:scale-95 transition-all flex items-center justify-center" ${disableControls}>+</button>
    </div>
  </div>
</div>
`;
      }
    )
    .join("");
}

function adjustQty(idx, delta, max) {
  const input = document.getElementById(`fulfilled-${idx}`);
  if (!input) return;
  let val = parseInt(input.value) || 0;
  val = Math.max(0, Math.min(max || 99999, val + delta));
  input.value = val;
}

function validateQty(idx, max) {
  const input = document.getElementById(`fulfilled-${idx}`);
  if (!input) return;
  let val = parseInt(input.value) || 0;
  if (val < 0) val = 0;
  if (val > max) val = max;
  input.value = val;
}

function closeModal() {
  document.getElementById("detail-modal").classList.add("hidden");
  state.modalOrderId = null;
}

async function completeOrder() {
  const order = state.orders.find((o) => o.id === state.modalOrderId);
  if (!order) return;

  order.items.forEach((item, idx) => {
    const input = document.getElementById(`fulfilled-${idx}`);
    if (input) item.fulfilled_quantity = parseInt(input.value) || 0;
  });

  const shortItems = order.items.filter(
    (i) => i.fulfilled_quantity < i.requested_quantity,
  );

  const completedTime = new Date().toISOString();
  let voiceMsg = "";
  let backorder = null;

  if (shortItems.length > 0) {
    backorder = {
      id: generateId(),
      customer_address: order.customer_address,
      recipient: order.recipient || "Genel",
      urgency: "Çok Acil",
      status: "Bekliyor",
      created_by: state.activeUser || "Bilinmeyen",
      created_at: new Date().toISOString(),
      picked_by: null,
      parent_order_id: order.id,
      items: shortItems.map((i) => ({
        product_name: i.product_name,
        requested_quantity: i.requested_quantity - i.fulfilled_quantity,
        fulfilled_quantity: i.requested_quantity - i.fulfilled_quantity,
      })),
    };
    voiceMsg = `Sipariş tamamlandı. Eksik kalan ürünler için çok acil statüsünde yeni sipariş oluşturuldu.`;
  } else {
    voiceMsg = `Sipariş tamamlandı.`;
  }

  if (supabaseClient) {
    try {
      // Orijinal siparişi güncelle
      const { error: completeErr } = await supabaseClient
        .from('orders')
        .update({ status: 'Tamamlandı', completed_at: completedTime, items: order.items })
        .eq('id', order.id);
      
      if (completeErr) throw completeErr;

      // Eğer backorder varsa ekle
      if (backorder) {
        const { error: backorderErr } = await supabaseClient
          .from('orders')
          .insert([backorder]);
        if (backorderErr) throw backorderErr;
        
        showToast(
          "⚠️ Eksik kalan ürünler için otomatik acil sipariş oluşturuldu!",
          "warning",
          5000,
        );
      } else {
        showToast("✅ Sipariş toplandı! Sevkiyata hazır.", "success");
      }

      speakText(voiceMsg);
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Sipariş tamamlama hatası:", err);
      showToast("Bulutta sipariş tamamlanamadı!", "error");
    }
  } else {
    // YEREL MOD
    order.status = "Tamamlandı";
    order.completed_at = completedTime;

    if (backorder) {
      state.orders.unshift(backorder);
      showToast(
        "⚠️ Eksik kalan ürünler için otomatik acil sipariş oluşturuldu!",
        "warning",
        5000,
      );
    } else {
      showToast("✅ Sipariş toplandı! Sevkiyata hazır.", "success");
    }

    saveState();
    broadcastUpdate(voiceMsg);
    speakText(voiceMsg);
    renderActiveOrders();
    updateStats();
  }
  
  closeModal();
}

const HISTORY_ITEMS_PER_PAGE = 10;

function renderHistory() {
  const completed = state.orders.filter((o) => o.status === "Teslim Edildi");
  const filtered = getFilteredOrders(completed, "history-search-input", "history-urgency-filter");

  filtered.sort(
    (a, b) =>
      new Date(b.delivered_at || b.completed_at || b.created_at) -
      new Date(a.delivered_at || a.completed_at || a.created_at),
  );

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / HISTORY_ITEMS_PER_PAGE));

  if (state.historyPage > totalPages) {
    state.historyPage = totalPages;
  }
  if (state.historyPage < 1) {
    state.historyPage = 1;
  }

  const startIndex = (state.historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
  const endIndex = startIndex + HISTORY_ITEMS_PER_PAGE;
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  const container = document.getElementById("list-gecmis");
  if (!container) return;
  
  container.innerHTML =
    paginatedOrders.length === 0
      ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-12 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Geçmişte aranan kriterde sipariş bulunamadı</div>'
      : paginatedOrders
          .map(
            (o) => {
              const totalItemsCount = o.items.length;
              const totalQty = o.items.reduce((sum, i) => sum + (parseInt(i.fulfilled_quantity) || 0), 0);
              
              const isFullyFulfilled = o.items.every(
                (i) => (parseInt(i.fulfilled_quantity) || 0) === (parseInt(i.requested_quantity) || 0)
              );

              const fulfillmentBadge = isFullyFulfilled
                ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-0.5 shadow-sm">
                    <span>✓</span> Eksiksiz
                   </span>`
                : `<span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center gap-0.5 shadow-sm">
                    <span>⚠</span> Kısmi (Eksikli)
                   </span>`;

              const isAdmin = isAdminUser();
              const deleteButton = isAdmin
                ? `<button onclick="deleteHistoryOrder('${o.id}')" 
                    class="bg-red-50 dark:bg-red-500/10 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer border border-red-200 dark:border-red-500/20" 
                    title="Siparişi Sil">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                   </button>`
                : "";

              return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 space-y-4 hover:border-slate-300 transition-all animate-slide-in">
  <div class="flex justify-between items-center">
    <div class="flex flex-wrap gap-1.5 items-center">
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
      ${fulfillmentBadge}
    </div>
    <span class="text-xs text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <span>T.Tarihi: ${formatDate(o.delivered_at || o.completed_at || o.created_at)}</span>
    </span>
  </div>
  
  <div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-start gap-1.5 justify-between">
      <span class="flex items-start gap-1.5 min-w-0 flex-1">
        <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate pr-4">${o.customer_address}</span>
      </span>
      ${renderNavigationButton(o)}
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
      <span>👤 Temsilci: <b>${o.created_by || "—"}</b></span>
      <span>🚚 Şoför: <b>${escapeHTML(o.shipped_by || "") || "—"}</b></span>
      <span>👷 Hazırlayan: <b>${o.picked_by || "—"}</b></span>
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
      <span>🚛 Plaka: <b class="text-indigo-600 dark:text-indigo-400">${o.vehicle_plate || "—"}</b></span>
      <span>⏱ Sevkiyat Süresi: <b class="text-amber-600 dark:text-amber-400">${formatDuration(o.shipped_at, o.delivered_at)}</b></span>
    </div>
    ${o.carried_material ? `
    <div class="text-xs text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
      <b>Taşınan Malzeme:</b> ${o.carried_material}
    </div>
    ` : ""}
  </div>

  <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
    <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
      <span>📦 ${totalItemsCount} Kalem Ürün</span>
      <span class="text-slate-300 dark:text-slate-600">|</span>
      <span>Toplam ${totalQty} adet toplandı</span>
    </span>
  </div>

  <div class="flex gap-2">
    <button onclick="openModal('${o.id}')" 
      class="flex-1 bg-slate-100 hover:bg-indigo-600 hover:text-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
      Detayları Gör
    </button>
    ${deleteButton}
  </div>
</div>
`;
            }
          )
          .join("");

  // Pagination controls update
  const paginator = document.getElementById("history-pagination");
  const prevBtn = document.getElementById("btn-history-prev");
  const nextBtn = document.getElementById("btn-history-next");
  const pageInfo = document.getElementById("history-page-info");

  if (paginator) {
    if (totalItems > HISTORY_ITEMS_PER_PAGE) {
      paginator.classList.remove("hidden");
      if (prevBtn) prevBtn.disabled = state.historyPage === 1;
      if (nextBtn) nextBtn.disabled = state.historyPage === totalPages;
      if (pageInfo) pageInfo.textContent = `Sayfa ${state.historyPage} / ${totalPages} (${totalItems} Sipariş)`;
    } else {
      paginator.classList.add("hidden");
    }
  }
}

function changeHistoryPage(delta) {
  state.historyPage += delta;
  renderHistory();
}

async function deleteHistoryOrder(orderId) {
  if (!isAdminUser()) {
    showToast("Bu işlemi sadece yönetici yapabilir!", "error");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Siparişi Sil?",
    "Bu tamamlanmış siparişi geçmişten kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!"
  );

  if (!confirmed) return;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) throw error;

      showToast("Sipariş geçmişten silindi.", "warning");
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Geçmiş sipariş silme hatası:", err);
      showToast("Buluttan sipariş silinemedi!", "error");
    }
  } else {
    state.orders = state.orders.filter(o => o.id !== orderId);
    saveState();
    renderHistory();
    updateStats();
    showToast("Sipariş yerel geçmişten silindi.", "warning");
  }
}

function updateStats() {
  const bekliyor = state.orders.filter(o => o.status === "Bekliyor").length;
  const hazirlaniyor = state.orders.filter(o => o.status === "Hazırlanıyor").length;
  const shipping = state.orders.filter(o => o.status === "Tamamlandı" || o.status === "Yolda").length;
  
  const bugunStr = new Date().toDateString();
  const tamamlandi = state.orders.filter(o => {
    if (o.status !== "Teslim Edildi" || !o.delivered_at) return false;
    return new Date(o.delivered_at).toDateString() === bugunStr;
  }).length;

  const statsBekliyor = document.getElementById("stats-bekliyor");
  const statsHazirlaniyor = document.getElementById("stats-hazirlaniyor");
  const statsShipping = document.getElementById("stats-shipping");
  const statsTamamlandi = document.getElementById("stats-tamamlandi");
  
  if (statsBekliyor) statsBekliyor.textContent = bekliyor;
  if (statsHazirlaniyor) statsHazirlaniyor.textContent = hazirlaniyor;
  if (statsShipping) statsShipping.textContent = shipping;
  if (statsTamamlandi) statsTamamlandi.textContent = tamamlandi;
  
  const countBekliyor = document.getElementById("count-bekliyor");
  const countHazirlaniyor = document.getElementById("count-hazirlaniyor");
  const countYolacikacak = document.getElementById("count-yolacikacak");
  const countYolda = document.getElementById("count-yolda");
  
  if (countBekliyor) countBekliyor.textContent = bekliyor;
  if (countHazirlaniyor) countHazirlaniyor.textContent = hazirlaniyor;
  
  const yolacikacakCount = state.orders.filter(o => o.status === "Tamamlandı").length;
  const yoldaCount = state.orders.filter(o => o.status === "Yolda").length;
  if (countYolacikacak) countYolacikacak.textContent = yolacikacakCount;
  if (countYolda) countYolda.textContent = yoldaCount;

  // Rozet adetlerini güncelle
  updateTabBadges(bekliyor, hazirlaniyor, yolacikacakCount, yoldaCount);
}

function updateTabBadges(bekliyor, hazirlaniyor, yolacikacakCount, yoldaCount) {
  const activeCount = (bekliyor !== undefined ? bekliyor : state.orders.filter(o => o.status === "Bekliyor").length) + 
                      (hazirlaniyor !== undefined ? hazirlaniyor : state.orders.filter(o => o.status === "Hazırlanıyor").length);

  const shippingCount = (yolacikacakCount !== undefined ? yolacikacakCount : state.orders.filter(o => o.status === "Tamamlandı").length) + 
                        (yoldaCount !== undefined ? yoldaCount : state.orders.filter(o => o.status === "Yolda").length);

  const stockCount = (state.stocks || []).filter(s => s.status === "Eksik" || s.status === "Sipariş Verildi").length;

  // Masaüstü sekmeleri
  setBadgeValue("tab-active", activeCount);
  setBadgeValue("tab-shipping", shippingCount);
  setBadgeValue("tab-stock", stockCount);

  // Mobil sekmeleri
  setBadgeValue("fab-badge-active", activeCount, true);
  setBadgeValue("fab-badge-shipping", shippingCount, true);
  setBadgeValue("fab-badge-stock", stockCount, true);
}

function setBadgeValue(btnId, count, isDirectSpan = false) {
  let badge;
  if (isDirectSpan) {
    badge = document.getElementById(btnId);
  } else {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (!btn.classList.contains("relative")) {
      btn.classList.add("relative");
    }
    badge = btn.querySelector(".tab-badge");
    if (!badge && count > 0) {
      badge = document.createElement("span");
      badge.className = "tab-badge absolute top-1.5 right-2 bg-red-600 dark:bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4";
      btn.appendChild(badge);
    }
  }

  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
      if (isDirectSpan) {
        badge.className = "bg-red-600 dark:bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[16px] h-4 ml-auto";
      }
    } else {
      badge.classList.add("hidden");
      if (isDirectSpan) {
        badge.className = "hidden";
      }
    }
  }
}

async function toggleItemChecked(idx, event) {
  event.stopPropagation();
  const order = state.currentModalOrder;
  if (!order) return;
  const item = order.items[idx];
  if (!item) return;

  const currentChecked = item.checked || false;

  if (!currentChecked) {
    const confirmed = await showCustomConfirm(
      "Ürün Toplandı mı?",
      `"${item.product_name}" ürününün tamamını (${item.requested_quantity} adet) topladığınızdan emin misiniz?`
    );
    
    if (confirmed) {
      item.checked = true;
      item.fulfilled_quantity = item.requested_quantity; // otomatik tamamla
      await saveModalOrderProgress();
    }
  } else {
    const confirmed = await showCustomConfirm(
      "İşareti Kaldır?",
      `"${item.product_name}" ürünü üzerindeki toplandı işaretini kaldırmak istiyor musunuz?`
    );
    
    if (confirmed) {
      item.checked = false;
      await saveModalOrderProgress();
    }
  }
}

async function saveModalOrderProgress() {
  const order = state.currentModalOrder;
  if (!order) return;

  order.items.forEach((item, idx) => {
    const input = document.getElementById(`fulfilled-${idx}`);
    if (input) item.fulfilled_quantity = parseInt(input.value) || 0;
  });

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .update({ items: order.items })
        .eq('id', order.id);
      if (error) throw error;
      
      renderModalItems();
      if (typeof renderActiveOrders === "function") renderActiveOrders();
    } catch (err) {
      console.error("Sipariş ilerlemesi kaydedilemedi:", err);
      showToast("İlerleme buluta kaydedilemedi!", "error");
    }
  } else {
    saveState();
    renderModalItems();
    if (typeof renderActiveOrders === "function") renderActiveOrders();
  }
}

function toggleModalSort() {
  if (state.modalSortOrder === "unchecked-first") {
    state.modalSortOrder = "checked-first";
  } else if (state.modalSortOrder === "checked-first") {
    state.modalSortOrder = "normal";
  } else {
    state.modalSortOrder = "unchecked-first";
  }
  renderModalItems();
}

function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    if (!modal) {
      resolve(confirm(`${title}\n\n${message}`));
      return;
    }

    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    modal.classList.remove("hidden");

    const btnCancel = document.getElementById("confirm-btn-cancel");
    const btnOk = document.getElementById("confirm-btn-ok");

    const cleanup = (result) => {
      modal.classList.add("hidden");
      btnCancel.onclick = null;
      btnOk.onclick = null;
      resolve(result);
    };

    btnCancel.onclick = () => cleanup(false);
    btnOk.onclick = () => cleanup(true);
  });
}

async function clearAllHistory() {
  if (!isAdminUser()) {
    showToast("Geçmişi temizleme yetkiniz yok!", "error");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Geçmişi Temizle?",
    "Tamamlanmış tüm geçmiş siparişleri kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!"
  );

  if (!confirmed) return;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('status', 'Teslim Edildi');
      if (error) throw error;

      showToast("Geçmiş siparişler başarıyla temizlendi!", "success");
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Geçmişi temizleme hatası:", err);
      showToast("Buluttan geçmiş siparişler silinemedi!", "error");
    }
  } else {
    state.orders = state.orders.filter(o => o.status !== "Teslim Edildi");
    saveState();
    renderHistory();
    updateStats();
    showToast("Geçmiş siparişler yerel olarak temizlendi!", "success");
  }
}

// =============================================
// SEVKİYAT SÜRECİ VE YARDIMCI FONKSİYONLAR
// =============================================

function formatDuration(start, end) {
  if (!start || !end) return "—";
  const diffMs = new Date(end) - new Date(start);
  if (diffMs < 0) return "0 sn";
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  let parts = [];
  if (hrs > 0) parts.push(`${hrs} sa`);
  if (mins > 0) parts.push(`${mins} dk`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} sn`);
  return parts.join(" ");
}

function getLiveTimerText(startIso) {
  if (!startIso) return "00:00";
  const diffMs = new Date() - new Date(startIso);
  if (diffMs < 0) return "00:00";
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const pad = (n) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

function renderShippingOrders() {
  const shippingOrders = state.orders.filter(o => o.status === "Tamamlandı" || o.status === "Yolda");
  
  const searchInput = document.getElementById("shipping-search-input");
  const urgencyFilter = document.getElementById("shipping-urgency-filter");
  let filtered = shippingOrders;
  
  if (searchInput && urgencyFilter) {
    const search = searchInput.value.toLowerCase().trim();
    const urgency = urgencyFilter.value;
    filtered = shippingOrders.filter(o => {
      const matchUrgency = urgency === "All" || o.urgency === urgency;
      const matchSearch = !search || 
        o.customer_address.toLowerCase().includes(search) ||
        (o.vehicle_plate && o.vehicle_plate.toLowerCase().includes(search)) ||
        (o.created_by && o.created_by.toLowerCase().includes(search)) ||
        (o.recipient && o.recipient.toLowerCase().includes(search)) ||
        (o.picked_by && o.picked_by.toLowerCase().includes(search)) ||
        o.items.some(i => i.product_name.toLowerCase().includes(search));
      return matchUrgency && matchSearch;
    });
  }

  const yolacikacak = filtered.filter(o => o.status === "Tamamlandı")
    .sort((a, b) => new Date(a.completed_at || a.created_at) - new Date(b.completed_at || b.created_at));
  const yolda = filtered.filter(o => o.status === "Yolda")
    .sort((a, b) => new Date(a.shipped_at || a.created_at) - new Date(b.shipped_at || b.created_at));

  const yacContainer = document.getElementById("list-yolacikacak");
  const yoldaContainer = document.getElementById("list-yolda");
  if (!yacContainer || !yoldaContainer) return;

  yacContainer.innerHTML = yolacikacak.length === 0
    ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Yola çıkacak sipariş yok</div>'
    : yolacikacak.map(o => renderYolaCikacakCard(o)).join("");

  yoldaContainer.innerHTML = yolda.length === 0
    ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Yolda olan sipariş yok</div>'
    : yolda.map(o => renderYoldaCard(o)).join("");

  updateStats();
}

function renderYolaCikacakCard(o) {
  const itemSummary = o.items
    .map((i) => `${i.product_name} (${i.fulfilled_quantity} ${i.unit || "adet"})`)
    .join(", ");
  const hasNote = !!(o.note || o.description);

  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between relative group hover:border-indigo-500 dark:hover:border-indigo-400 transition-all duration-200 animate-slide-in">
  <div class="mb-4">
    <div class="flex justify-between items-center gap-2 mb-3">
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
        ${hasNote ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">📝 Not</span>` : ""}
      </div>

      <!-- MÜŞTERİ / ALICI İSMİ (İKONSUZ CANLI KIRMIZI HAP BADGE) -->
      <span class="font-black text-xs sm:text-sm text-white bg-red-600 dark:bg-red-600 px-3.5 py-1 rounded-full shadow-sm shadow-red-600/30 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[240px] text-center shrink-0" title="Müşteri / Alıcı">
        ${escapeHTML(o.recipient || "") || "GENEL MÜŞTERİ"}
      </span>

      <span class="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">Hazırlandı: ${formatDateRelative(o.completed_at)}</span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-start gap-1 justify-between">
      <span class="flex items-start gap-1 min-w-0 flex-1">
        <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate pr-4">${o.customer_address}</span>
      </span>
      ${renderNavigationButton(o)}
    </p>
    <p class="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2 truncate">
      <b>Taşınacak Ürünler:</b> ${itemSummary}
    </p>
    <div class="flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase">
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span>👤 Temsilci: ${o.created_by || "—"}</span>
        <span>🚚 Şoför: ${escapeHTML(o.shipped_by || "") || "—"}</span>
        <span>👷 Hazırlayan: ${o.picked_by || "—"}</span>
      </div>
      ${o.customer_phone ? `<a href="tel:${o.customer_phone}" class="text-emerald-600 dark:text-emerald-400 normal-case font-bold flex items-center gap-0.5 mt-0.5 hover:underline">📞 Ara: ${escapeHTML(o.customer_phone)}</a>` : ""}
    </div>
  </div>
  
  <div class="border-t border-slate-100 dark:border-slate-800 pt-3 mt-1 flex justify-between gap-2">
    <button onclick="openModal('${o.id}')" 
      class="bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer">
      🔍 Detay
    </button>
    <button onclick="startShipping('${o.id}')" 
      class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M13 16h6m-6 0H6m13 0a2 2 0 002-2v-4a1 1 0 00-1-1h-6v7"/></svg>
      Yola Çıktı
    </button>
  </div>
</div>
`;
}

function renderYoldaCard(o) {
  const itemSummary = o.carried_material || o.items
    .map((i) => `${i.product_name} (${i.fulfilled_quantity} ${i.unit || "adet"})`)
    .join(", ");
  const hasNote = !!(o.note || o.description);
  
  const timerText = getLiveTimerText(o.shipped_at);
  
  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between relative group hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 animate-slide-in">
  <div class="mb-4">
    <div class="flex justify-between items-center gap-2 mb-3">
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
        ${hasNote ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">📝 Not</span>` : ""}
      </div>

      <!-- MÜŞTERİ / ALICI İSMİ (İKONSUZ CANLI KIRMIZI HAP BADGE) -->
      <span class="font-black text-xs sm:text-sm text-white bg-red-600 dark:bg-red-600 px-3.5 py-1 rounded-full shadow-sm shadow-red-600/30 uppercase tracking-wide truncate max-w-[160px] sm:max-w-[240px] text-center shrink-0" title="Müşteri / Alıcı">
        ${escapeHTML(o.recipient || "") || "GENEL MÜŞTERİ"}
      </span>

      <span class="text-xs text-purple-600 dark:text-purple-400 font-extrabold flex items-center gap-1 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-500/20 shrink-0">
        <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span> Yolda
      </span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-start gap-1 justify-between">
      <span class="flex items-start gap-1 min-w-0 flex-1">
        <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate pr-4">${o.customer_address}</span>
      </span>
      ${renderNavigationButton(o)}
    </p>
    <p class="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2 truncate">
      <b>Yüklenen Malzeme:</b> ${itemSummary}
    </p>
    <div class="flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase mb-3">
      <div class="grid grid-cols-2 gap-2">
        <div>🚛 Araç: <b class="text-slate-700 dark:text-slate-300 normal-case">${o.vehicle_plate || "—"}</b></div>
        <div>👷 Hazırlayan: <span class="normal-case">${o.picked_by || "—"}</span></div>
        <div>👤 Temsilci: <span class="normal-case">${o.created_by || "—"}</span></div>
        <div>🚚 Şoför: <b class="text-indigo-600 dark:text-indigo-400 normal-case">${escapeHTML(o.shipped_by || "") || "—"}</b></div>
      </div>
      ${o.customer_phone ? `<a href="tel:${o.customer_phone}" class="text-emerald-600 dark:text-emerald-400 normal-case font-bold flex items-center gap-0.5 mt-1 hover:underline">📞 Ara: ${escapeHTML(o.customer_phone)}</a>` : ""}
    </div>
    <div class="flex items-center justify-between bg-amber-50 dark:bg-amber-500/5 px-3 py-2 rounded-xl border border-amber-200/50 dark:border-amber-500/10">
      <span class="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
        ⏱ Sevkiyat Süresi:
      </span>
      <span class="text-sm font-extrabold text-amber-600 dark:text-amber-400 shipping-timer" data-start="${o.shipped_at}">
        ${timerText}
      </span>
    </div>
  </div>
  
  <div class="border-t border-slate-100 dark:border-slate-800 pt-3 mt-1 flex justify-between gap-2">
    <button onclick="openModal('${o.id}')" 
      class="bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer">
      🔍 Detay
    </button>
    <button onclick="deliverOrder('${o.id}')" 
      class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      Teslim Edildi
    </button>
  </div>
</div>
`;
}

function startShipping(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  state.shippingOrderId = orderId;
  
  const select = document.getElementById("shipping-vehicle-select");
  if (select) select.value = "";
  
  const label = document.getElementById("selected-vehicle-label");
  if (label) label.textContent = "🚙 Araç veya Teslimat Yöntemi Seçin";

  const preview = document.getElementById("selected-vehicle-preview");
  if (preview) preview.classList.add("hidden");
  
  const itemSummary = order.items
    .map((i) => `${i.fulfilled_quantity} ${i.unit || "adet"} ${i.product_name}`)
    .join(", ");
  document.getElementById("shipping-materials").value = itemSummary;

  document.getElementById("shipping-modal").classList.remove("hidden");
}

function closeShippingModal() {
  document.getElementById("shipping-modal").classList.add("hidden");
  state.shippingOrderId = null;
}

function openVehicleSelectionModal() {
  const grid = document.getElementById("vehicle-selection-grid");
  if (!grid) return;

  grid.innerHTML = `
    <!-- Müşteri Kendisi Alacak Kartı -->
    <div onclick="selectVehicle('SELF')" 
         class="cursor-pointer border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 bg-slate-50 dark:bg-slate-900/40 hover:bg-indigo-50/10 transition-all select-none min-h-[140px]">
      <div class="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl font-bold">
        👤
      </div>
      <span class="font-extrabold text-xs text-slate-700 dark:text-slate-300">Müşteri Kendisi Alacak</span>
    </div>
    
    <!-- Araç Kartları -->
    ${(state.vehicles || []).map(v => {
      const imgUrl = v.photo || "https://images.unsplash.com/photo-1516576885502-d463b15e729a?auto=format&fit=crop&q=80&w=200";
      return `
        <div onclick="selectVehicle('${v.plate}')" 
             class="cursor-pointer border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-2 flex flex-col items-center justify-between text-center gap-2 bg-slate-50 dark:bg-slate-900/40 hover:bg-indigo-50/10 transition-all select-none min-h-[140px]">
          <img src="${imgUrl}" class="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
          <span class="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase">${v.plate}</span>
        </div>
      `;
    }).join("")}
  `;

  document.getElementById("vehicle-selection-modal").classList.remove("hidden");
}

function closeVehicleSelectionModal() {
  document.getElementById("vehicle-selection-modal").classList.add("hidden");
}

function selectVehicle(value) {
  const select = document.getElementById("shipping-vehicle-select");
  if (select) {
    select.value = value;
    handleShippingVehicleChange();
  }
  closeVehicleSelectionModal();
}

function handleShippingVehicleChange() {
  const select = document.getElementById("shipping-vehicle-select");
  const value = select.value;
  
  const preview = document.getElementById("selected-vehicle-preview");
  const previewImg = document.getElementById("preview-vehicle-img");
  const previewPlate = document.getElementById("preview-vehicle-plate");
  const btnText = document.getElementById("btn-confirm-shipping-text");
  const label = document.getElementById("selected-vehicle-label");
  
  if (value === "SELF") {
    if (label) label.textContent = "👤 Müşteri Kendisi Alacak (Araçsız)";
    if (preview) preview.classList.add("hidden");
    if (btnText) btnText.textContent = "✅ Doğrudan Teslim Et";
  } else if (value) {
    const vehicle = state.vehicles.find(v => v.plate === value);
    if (label) label.textContent = `🚙 Seçilen Araç: ${value}`;
    if (vehicle) {
      if (previewImg) previewImg.src = vehicle.photo || "https://images.unsplash.com/photo-1516576885502-d463b15e729a?auto=format&fit=crop&q=80&w=200";
      if (previewPlate) previewPlate.textContent = vehicle.plate;
      if (preview) preview.classList.remove("hidden");
    } else {
      if (preview) preview.classList.add("hidden");
    }
    if (btnText) btnText.textContent = "🚀 Yola Çıkar";
  } else {
    if (label) label.textContent = "🚙 Araç veya Teslimat Yöntemi Seçin";
    if (preview) preview.classList.add("hidden");
    if (btnText) btnText.textContent = "🚀 Yola Çıkar";
  }
}

async function confirmShipping() {
  const orderId = state.shippingOrderId;
  if (!orderId) return;
  
  const select = document.getElementById("shipping-vehicle-select");
  const selectedValue = select.value;
  const materials = document.getElementById("shipping-materials").value.trim();
  
  if (!selectedValue) {
    showToast("Lütfen bir araç veya teslimat yöntemi seçin!", "error");
    return;
  }
  
  const shippedTime = new Date().toISOString();
  
  if (selectedValue === "SELF") {
    const voiceMsg = "Sipariş teslim edildi.";
    
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({
            status: 'Teslim Edildi',
            delivered_at: shippedTime,
            shipped_at: shippedTime,
            vehicle_plate: 'Müşteri Kendisi Teslim Aldı',
            carried_material: materials
          })
          .eq('id', orderId);
        if (error) throw error;
        
        showToast("✅ Müşteri siparişi kendisi teslim aldı!", "success");
        speakText(voiceMsg);
        closeShippingModal();
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Doğrudan teslimat hatası:", err);
        showToast("Bulutta teslimat kaydedilemedi!", "error");
      }
    } else {
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        order.status = "Teslim Edildi";
        order.delivered_at = shippedTime;
        order.shipped_at = shippedTime;
        order.vehicle_plate = "Müşteri Kendisi Teslim Aldı";
        order.carried_material = materials;
        
        saveState();
        broadcastUpdate(voiceMsg);
        speakText(voiceMsg);
        closeShippingModal();
        renderShippingOrders();
        showToast("✅ Müşteri siparişi kendisi teslim aldı!", "success");
      }
    }
  } else {
    // Normal Araçla Sevkiyat
    const voiceMsg = "Sipariş yola çıktı.";
    
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({
            status: 'Yolda',
            shipped_at: shippedTime,
            vehicle_plate: selectedValue,
            carried_material: materials,
            shipped_by: state.activeUser
          })
          .eq('id', orderId);
        if (error) throw error;
        
        showToast("🚀 Sevkiyat süreci başladı, araç yola çıktı!", "success");
        speakText(voiceMsg);
        closeShippingModal();
        if (typeof checkAndSyncLocationTracking === "function") {
          checkAndSyncLocationTracking();
        } else {
          initDriverLocationTracking(orderId);
        }
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Sevkiyat başlatma hatası:", err);
        showToast("Bulutta sevkiyat başlatılamadı!", "error");
      }
    } else {
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        order.status = "Yolda";
        order.shipped_at = shippedTime;
        order.vehicle_plate = selectedValue;
        order.carried_material = materials;
        order.shipped_by = state.activeUser;
        
        saveState();
        broadcastUpdate(voiceMsg);
        speakText(voiceMsg);
        closeShippingModal();
        if (typeof checkAndSyncLocationTracking === "function") {
          checkAndSyncLocationTracking();
        } else {
          initDriverLocationTracking(orderId);
        }
        renderShippingOrders();
        showToast("🚀 Sevkiyat süreci başladı, araç yola çıktı!", "success");
      }
    }
  }
}

async function deliverOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;
  
  const confirmed = await showCustomConfirm(
    "Teslimatı Onayla?",
    "Malın teslim edildiğini onaylıyor musunuz? Sayaç durdurulacak ve geçmişe kaydedilecek."
  );
  
  if (!confirmed) return;
  
  clearDriverLocationTracking(); // Konum takibini sonlandır!
  
  const deliveredTime = new Date().toISOString();
  const voiceMsg = "Sipariş teslim edildi.";
  
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .update({
          status: 'Teslim Edildi',
          delivered_at: deliveredTime
        })
        .eq('id', orderId);
      if (error) throw error;
      
      showToast("✅ Sipariş teslim edildi ve geçmişe kaydedildi!", "success");
      speakText(voiceMsg);
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Teslimat kaydetme hatası:", err);
      showToast("Bulutta teslimat kaydedilemedi!", "error");
    }
  } else {
    order.status = "Teslim Edildi";
    order.delivered_at = deliveredTime;
    
    saveState();
    broadcastUpdate(voiceMsg);
    speakText(voiceMsg);
    renderShippingOrders();
    showToast("✅ Sipariş teslim edildi ve geçmişe kaydedildi!", "success");
  }
}

// Her saniye yoldaki siparişlerin sayaçlarını güncelle
setInterval(() => {
  const timers = document.querySelectorAll('.shipping-timer');
  timers.forEach(el => {
    const start = el.getAttribute('data-start');
    if (start) {
      el.textContent = getLiveTimerText(start);
    }
  });
}, 1000);

// =============================================
// AYG B2B EKLENTİSİ SİPARİŞ ENTEGRASYONU
// =============================================

function openB2BExtensionForOrder() {
  let extensionUrl = '';
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    extensionUrl = chrome.runtime.getURL('dashboard/dashboard.html?mode=ayg_order');
  } else {
    const extensionId = 'glmobnjhdneghlameimhfaehjlphjgla';
    extensionUrl = `chrome-extension://${extensionId}/dashboard/dashboard.html?mode=ayg_order`;
  }
  const localUrl = '../b2b_karsilastirma/dashboard/dashboard.html?mode=ayg_order';

  // 1. Öncelikli olarak Chrome Eklentisi URL'sini aç (chrome-extension:// modülü ve CORS güvenlik izinlerini sağlar)
  let newWin = null;
  try {
    newWin = window.open(extensionUrl, 'ayg_b2b_dashboard', 'width=1400,height=900,resizable=yes,scrollbars=yes');
  } catch(e) {}

  // 2. Eklenti adresi açılamazsa yerel dosya yolunu yedek olarak dene
  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    newWin = window.open(localUrl, 'ayg_b2b_dashboard', 'width=1400,height=900,resizable=yes,scrollbars=yes');
  }

  if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
    showToast("⚠️ Pop-up engelleyici pencereyi engelledi. Lütfen tarayıcınızda açılır pencerelere izin verin.", "warning");
  } else {
    showToast("🔍 AYG B2B Chrome Eklentisi açılıyor... Seçtiğiniz ürünler siparişe aktarılacaktır.", "info");
  }
}

function detectSmartUnit(name, defaultUnit = 'adet') {
  const validUnits = ['adet', 'kilo', 'çuval', 'm³', 'kutu', 'paket', 'metre', 'litre'];
  const normalizedDefault = (defaultUnit || 'adet').toString().toLowerCase().trim();
  if (validUnits.includes(normalizedDefault)) {
    return normalizedDefault;
  }

  const text = (name || '').toLowerCase();
  if (text.includes(' metre') || text.includes(' mt') || text.includes(' m.')) return 'metre';
  if (text.includes(' kg') || text.includes(' kilo') || text.includes('kg.')) return 'kilo';
  if (text.includes(' cuval') || text.includes(' çuval')) return 'çuval';
  if (text.includes(' kutu')) return 'kutu';
  if (text.includes(' paket') || text.includes(' pkt')) return 'paket';
  if (text.includes(' m3') || text.includes(' metreküp') || text.includes(' m³')) return 'm³';
  if (text.includes(' litre') || text.includes(' lt')) return 'litre';

  return 'adet';
}

function importProductsFromB2BExtension(items) {
  if (!Array.isArray(items) || items.length === 0) return;

  // Sipariş Oluştur ekranında değilsek geçiş yap
  if (typeof switchPage === 'function' && state.currentPage !== 'create') {
    switchPage('create');
  }

  let addedCount = 0;

  items.forEach(item => {
    const rawName = item.name || item.product_name || item.title || '';
    if (!rawName.trim()) return;

    const qty = parseInt(item.qty || item.requested_quantity || item.quantity) || 1;
    const unit = detectSmartUnit(rawName, item.unit || item.birim || 'adet');

    // Sipariş formundaki ürün satırlarını kontrol et
    const itemDivs = document.querySelectorAll('[id^="item-"]');
    let targetId = null;

    if (itemDivs.length === 1) {
      const firstDivId = itemDivs[0].id;
      const firstNameInp = document.getElementById(`${firstDivId}-name`);
      if (firstNameInp && !firstNameInp.value.trim()) {
        targetId = firstDivId;
      }
    }

    if (targetId) {
      const nameInp = document.getElementById(`${targetId}-name`);
      const qtyInp = document.getElementById(`${targetId}-qty`);
      const unitSel = document.getElementById(`${targetId}-unit`);

      if (nameInp) { nameInp.value = rawName; nameInp.title = rawName; }
      if (qtyInp) { qtyInp.value = qty; }
      if (unitSel) { unitSel.value = unit; }
    } else {
      addOrderItem(rawName, qty, unit);
    }

    addedCount++;
  });

  if (addedCount > 0) {
    if (typeof saveAdminOrderDraft === 'function') saveAdminOrderDraft();
    showToast(`📦 AYG B2B'den ${addedCount} ürün sipariş listesine eklendi!`, "success");
  }
}

function initB2BExtensionIntegration() {
  // 1. BroadcastChannel dinleyicisi
  try {
    const bc = new BroadcastChannel("ayg_b2b_cart");
    bc.onmessage = (e) => {
      if (e.data && e.data.type === "ADD_ORDER_ITEM" && e.data.item) {
        importProductsFromB2BExtension([e.data.item]);
      } else if (e.data && e.data.type === "IMPORT_B2B_CART" && Array.isArray(e.data.items)) {
        importProductsFromB2BExtension(e.data.items);
      }
    };
  } catch (err) {}

  // 2. window postMessage dinleyicisi
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "ADD_ORDER_ITEM" && e.data.item) {
      importProductsFromB2BExtension([e.data.item]);
    } else if (e.data && e.data.type === "IMPORT_B2B_CART" && Array.isArray(e.data.items)) {
      importProductsFromB2BExtension(e.data.items);
    }
  });

  // 3. localStorage storage event dinleyicisi
  window.addEventListener("storage", (e) => {
    if (e.key === "ayg_pending_order_items" && e.newValue) {
      try {
        const items = JSON.parse(e.newValue);
        if (Array.isArray(items) && items.length > 0) {
          importProductsFromB2BExtension(items);
          localStorage.removeItem("ayg_pending_order_items");
        }
      } catch (err) {}
    }
  });

  // 4. Sayfa açıldığında bekleyen öğe kontrolü
  try {
    const pending = localStorage.getItem("ayg_pending_order_items");
    if (pending) {
      const items = JSON.parse(pending);
      if (Array.isArray(items) && items.length > 0) {
        importProductsFromB2BExtension(items);
        localStorage.removeItem("ayg_pending_order_items");
      }
    }
  } catch (err) {}
}

// Otomatik entegrasyon başlatma
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initB2BExtensionIntegration);
} else {
  initB2BExtensionIntegration();
}







