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

let orderItemCount = 0;

function initOrderForm() {
  orderItemCount = 0;
  document.getElementById("order-address").value = "";
  document.getElementById("order-urgency").value = "Normal";
  document.getElementById("order-items-list").innerHTML = "";
  
  const recipientEl = document.getElementById("order-recipient");
  if (recipientEl) recipientEl.value = "";

  document.getElementById("create-page-title").textContent = "Yeni Sipariş Oluştur";
  document.getElementById("btn-save-order").querySelector('span').textContent = "Siparişi Kaydet";
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  state.editingOrderId = null;
  
  addOrderItem();
}

function addOrderItem(name = "", qty = 1) {
  orderItemCount++;
  const id = `item-${orderItemCount}`;
  const div = document.createElement("div");
  div.className =
    "flex gap-1.5 sm:gap-2 items-center bg-slate-50 dark:bg-slate-900/60 p-1.5 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 animate-slide-in";
  div.id = id;
  div.innerHTML = `
<input type="text" placeholder="Ürün adı" 
  class="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2 sm:px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs sm:text-sm text-slate-800 dark:text-white" 
  id="${id}-name" value="${name}" />
<input type="number" placeholder="Adet" min="1"
  class="w-16 sm:w-20 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-1 sm:px-2 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs sm:text-sm text-center text-slate-800 dark:text-white font-bold" 
  id="${id}-qty" value="${qty}" />
<button onclick="removeOrderItem('${id}')" 
  class="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg active:scale-90 transition-all cursor-pointer"
  title="Ürünü Çıkar">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
</button>
`;
  document.getElementById("order-items-list").appendChild(div);
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
  }
}

async function saveOrder() {
  const address = document.getElementById("order-address").value.trim();
  const urgency = document.getElementById("order-urgency").value;
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
    if (!nameEl || !qtyEl) continue;
    const name = nameEl.value.trim();
    const qty = parseInt(qtyEl.value) || 1;
    if (name) {
      items.push({
        product_name: name,
        requested_quantity: qty,
        fulfilled_quantity: qty,
      });
    }
  }

  if (items.length === 0) {
    showToast("Lütfen geçerli en az 1 ürün adı girin!", "error");
    return;
  }

  let voiceMsg = "";
  
  if (state.editingOrderId) {
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .update({ customer_address: address, urgency, items, created_by: createdBy, recipient: recipient })
          .eq('id', state.editingOrderId);
        if (error) throw error;
        
        showToast("Sipariş başarıyla güncellendi!", "success");
        voiceMsg = "Sipariş güncellendi.";
        state.editingOrderId = null;
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
        state.orders[orderIndex].urgency = urgency;
        state.orders[orderIndex].items = items;
        state.orders[orderIndex].created_by = createdBy;
        state.orders[orderIndex].recipient = recipient;
        
        showToast("Sipariş başarıyla güncellendi!", "success");
        voiceMsg = "Sipariş güncellendi.";
        state.editingOrderId = null;
        saveState();
        broadcastUpdate(voiceMsg);
      }
    }
  } else {
    // YENI SIPARIS
    const order = {
      id: generateId(),
      customer_address: address,
      urgency,
      status: "Bekliyor",
      created_by: createdBy,
      recipient: recipient,
      created_at: new Date().toISOString(),
      picked_by: null,
      items,
    };

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('orders').insert([order]);
        if (error) throw error;
        
        showToast("✅ Sipariş kaydedildi!", "success");
        voiceMsg = "Yeni sipariş oluşturuldu.";
        await syncWithSupabase(true);
      } catch (err) {
        console.error("Sipariş ekleme hatası:", err);
        showToast("Buluta sipariş eklenemedi!", "error");
        return;
      }
    } else {
      state.orders.unshift(order);
      showToast("✅ Sipariş kaydedildi!", "success");
      voiceMsg = "Yeni sipariş oluşturuldu.";
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
  
  switchTab("create");
  
  document.getElementById("create-page-title").textContent = "Siparişi Düzenle";
  document.getElementById("btn-save-order").querySelector('span').textContent = "Değişiklikleri Kaydet";
  document.getElementById("btn-cancel-edit").classList.remove("hidden");

  document.getElementById("order-address").value = order.customer_address;
  document.getElementById("order-urgency").value = order.urgency;
  
  const recipientEl = document.getElementById("order-recipient");
  if (recipientEl) recipientEl.value = order.recipient || "";

  const list = document.getElementById("order-items-list");
  list.innerHTML = "";
  orderItemCount = 0;
  
  order.items.forEach(item => {
    addOrderItem(item.product_name, item.requested_quantity);
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
      : bekliyor.map((o) => renderBekliyorCard(o)).join("");

  hContainer.innerHTML =
    hazirlaniyor.length === 0
      ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-8 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Aranan kriterde hazırlanan sipariş yok</div>'
      : hazirlaniyor.map((o) => renderHazirlaniyorCard(o)).join("");
  
  updateStats();
}

function renderBekliyorCard(o) {
  const itemSummary =
    o.items
      .slice(0, 2)
      .map((i) => `${i.product_name} (${i.requested_quantity} adet)`)
      .join(", ") +
    (o.items.length > 2 ? ` ve +${o.items.length - 2} ürün` : "");
    
  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between relative group hover:border-indigo-500 dark:hover:border-indigo-400 transition-all duration-200 animate-slide-in">
  
  <!-- Düzenleme ve Silme Butonları -->
  <div class="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
    <button onclick="editOrder('${o.id}')" 
            class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all"
            title="Siparişi Düzenle">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
    </button>
    <button onclick="deleteOrder('${o.id}')" 
            class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all"
            title="Siparişi Sil">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
    </button>
  </div>

  <div class="mb-4">
    <div class="flex justify-between items-center mb-3">
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
      <span class="text-xs text-slate-400 dark:text-slate-500 font-medium">${formatDateRelative(o.created_at)}</span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-start gap-1">
      <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      <span class="truncate pr-16">${o.customer_address}</span>
    </p>
    <p class="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800 truncate">
      <b>Ürünler:</b> ${itemSummary}
    </p>
  </div>
  
  <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
    <div class="flex flex-col gap-0.5 text-[10px] text-slate-400 font-semibold uppercase">
      <span>👤 Temsilci: ${o.created_by || "—"}</span>
      <span class="text-indigo-600 dark:text-indigo-400 normal-case font-bold">🎯 Alıcı: ${o.recipient || "Genel"}</span>
    </div>
    <button onclick="startPicking('${o.id}')" 
      class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Hazırlamaya Başla
    </button>
  </div>
</div>
`;
}

function renderHazirlaniyorCard(o) {
  const canAccess = !o.picked_by || o.picked_by === state.activeUser;
  return `
<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium dark:shadow-premium-dark p-5 flex flex-col justify-between hover:border-indigo-500 transition-all duration-200 animate-slide-in">
  <div class="mb-4">
    <div class="flex justify-between items-center mb-3">
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[o.urgency]}">${URGENCY_ICON[o.urgency]} ${o.urgency}</span>
      <span class="text-xs text-slate-400 dark:text-slate-500 font-medium">${formatDateRelative(o.created_at)}</span>
    </div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-2 flex items-start gap-1">
      <svg class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      <span class="truncate">${o.customer_address}</span>
    </p>
    <div class="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase mb-2.5">
      <span>👤 Temsilci: ${o.created_by || "—"}</span>
      <span class="text-indigo-600 dark:text-indigo-400 normal-case font-bold">🎯 Alıcı: ${o.recipient || "Genel"}</span>
    </div>
    <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
      <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      <span>Hazırlayan: <b>${o.picked_by || "—"}</b></span>
    </p>
  </div>
  
  <div class="border-t border-slate-100 dark:border-slate-800 pt-3 flex gap-2">
    ${
      canAccess
        ? `<button onclick="openModal('${o.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Detay ve Tamamla
           </button>`
        : `<div class="flex-1 text-slate-500 bg-slate-100 dark:bg-slate-900 text-xs py-2.5 rounded-xl font-semibold text-center flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800">
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
  document.getElementById("modal-picker").textContent = `👷 Hazırlayan: ${order.picked_by}`;

  const badge = document.getElementById("modal-urgency-badge");
  badge.textContent = `${URGENCY_ICON[order.urgency]} ${order.urgency}`;
  badge.className = `px-3 py-1 rounded-full text-xs font-bold ${URGENCY_BADGE[order.urgency]}`;
  
  renderModalItems();
  document.getElementById("detail-modal").classList.remove("hidden");
}

function renderModalItems() {
  const order = state.currentModalOrder;
  if (!order) return;

  const itemsContainer = document.getElementById("modal-items");
  if (!itemsContainer) return;

  const isCompleted = order.status === "Tamamlandı";
  
  // Siparişi tamamla butonunu göster/gizle
  const completeBtn = document.getElementById("btn-complete-order");
  if (completeBtn) {
    if (isCompleted) {
      completeBtn.classList.add("hidden");
    } else {
      completeBtn.classList.remove("hidden");
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

        const disableControls = isCompleted || isChecked ? 'disabled opacity-50' : '';
        const disableInput = isCompleted || isChecked ? 'disabled' : '';
        const disableTick = isCompleted ? 'disabled opacity-50 cursor-not-allowed' : 'cursor-pointer';
        const tickAction = isCompleted ? '' : `onclick="toggleItemChecked(${item.originalIndex}, event)"`;

        return `
<div class="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors duration-200 ${rowClass}">
  <div class="flex items-center gap-3 flex-1 min-w-0">
    <!-- Tik Kutusu -->
    <button ${tickAction} ${isCompleted ? 'disabled' : ''}
      class="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all active:scale-90 ${disableTick} ${
        isChecked 
          ? "bg-emerald-600 border-emerald-600 text-white" 
          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-transparent"
      }">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
    </button>
    <div class="min-w-0 flex-1">
      <p class="font-bold text-slate-800 dark:text-slate-200 text-sm truncate ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''}">📦 ${item.product_name}</p>
      <p class="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">Talep Edilen: ${item.requested_quantity} Adet</p>
    </div>
  </div>
  <div class="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-2 sm:pt-0">
    <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Depodaki:</span>
    <div class="flex items-center gap-1.5 font-bold">
      <button onclick="adjustQty(${item.originalIndex}, -1); saveModalOrderProgress();" class="w-8 h-8 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 rounded-lg font-bold text-lg hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90 transition-all flex items-center justify-center" ${disableControls}>−</button>
      <input type="number" id="fulfilled-${item.originalIndex}" value="${item.fulfilled_quantity}" min="0" max="${item.requested_quantity}"
        class="w-14 text-center border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg py-1.5 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        onchange="validateQty(${item.originalIndex}, ${item.requested_quantity}); saveModalOrderProgress();" ${disableInput} />
      <button onclick="adjustQty(${item.originalIndex}, 1, ${item.requested_quantity}); saveModalOrderProgress();" class="w-8 h-8 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded-lg font-bold text-lg hover:bg-green-100 dark:hover:bg-green-200 active:scale-90 transition-all flex items-center justify-center" ${disableControls}>+</button>
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
        showToast("✅ Sipariş başarıyla tamamlandı!", "success");
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
      showToast("✅ Sipariş başarıyla tamamlandı!", "success");
    }

    saveState();
    broadcastUpdate(voiceMsg);
    speakText(voiceMsg);
    renderActiveOrders();
    updateStats();
  }
  
  closeModal();
}

function renderHistory() {
  const completed = state.orders.filter((o) => o.status === "Tamamlandı");
  const filtered = getFilteredOrders(completed, "history-search-input", "history-urgency-filter");

  filtered.sort(
    (a, b) =>
      new Date(b.completed_at || b.created_at) -
      new Date(a.completed_at || a.created_at),
  );

  const container = document.getElementById("list-gecmis");
  if (!container) return;
  
  container.innerHTML =
    filtered.length === 0
      ? '<div class="text-slate-400 dark:text-slate-500 text-sm text-center py-12 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">Geçmişte aranan kriterde sipariş bulunamadı</div>'
      : filtered
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

              const isAdmin = state.activeUser === "Admin";
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
      <span>T.Tarihi: ${formatDate(o.completed_at || o.created_at)}</span>
    </span>
  </div>
  
  <div>
    <p class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5 flex items-center gap-1.5">
      <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      <span>${o.customer_address}</span>
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
      <span>👤 Temsilci: <b>${o.created_by || "—"}</b></span>
      <span>🎯 Alıcı: <b>${o.recipient || "Genel"}</b></span>
      <span>👷 Hazırlayan: <b>${o.picked_by || "—"}</b></span>
    </div>
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
}

async function deleteHistoryOrder(orderId) {
  if (state.activeUser !== "Admin") {
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
  
  const bugunStr = new Date().toDateString();
  const tamamlandi = state.orders.filter(o => {
    if (o.status !== "Tamamlandı" || !o.completed_at) return false;
    return new Date(o.completed_at).toDateString() === bugunStr;
  }).length;

  const statsBekliyor = document.getElementById("stats-bekliyor");
  const statsHazirlaniyor = document.getElementById("stats-hazirlaniyor");
  const statsTamamlandi = document.getElementById("stats-tamamlandi");
  
  if (statsBekliyor) statsBekliyor.textContent = bekliyor;
  if (statsHazirlaniyor) statsHazirlaniyor.textContent = hazirlaniyor;
  if (statsTamamlandi) statsTamamlandi.textContent = tamamlandi;
  
  const countBekliyor = document.getElementById("count-bekliyor");
  const countHazirlaniyor = document.getElementById("count-hazirlaniyor");
  if (countBekliyor) countBekliyor.textContent = bekliyor;
  if (countHazirlaniyor) countHazirlaniyor.textContent = hazirlaniyor;
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
  if (state.activeUser !== "Admin") {
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
        .eq('status', 'Tamamlandı');
      if (error) throw error;

      showToast("Geçmiş siparişler başarıyla temizlendi!", "success");
      await syncWithSupabase(true);
    } catch (err) {
      console.error("Geçmişi temizleme hatası:", err);
      showToast("Buluttan geçmiş siparişler silinemedi!", "error");
    }
  } else {
    state.orders = state.orders.filter(o => o.status !== "Tamamlandı");
    saveState();
    renderHistory();
    updateStats();
    showToast("Geçmiş siparişler yerel olarak temizlendi!", "success");
  }
}
