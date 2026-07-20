// =============================================
// CUSTOMER PORTAL LOGIC
// =============================================

// Uygulama Durumu
const state = {
  currentStep: 1,
  urgency: "Normal",
  itemsCount: 0,
  supabaseUrl: "https://fnwikxmspdxamsostbnb.supabase.co",
  supabaseKey: "sb_publishable_tlsSFNjL-zfH-KUWShqIkQ_H5G97Hvd",
  supabaseClient: null,
  myOrderIds: [],
  
  // Harita Durumu
  mapInstance: null,
  mapMarker: null,
  selectedLat: null,
  selectedLng: null,
  tempLat: null,
  tempLng: null
};

// Sayfa Yüklendiğinde
window.addEventListener("DOMContentLoaded", () => {
  loadSettingsFromStorage();
  initSupabase();
  
  // Form verilerini localStorage'dan çek
  const hasSavedProfile = loadProfileDetails();
  
  // Taslak sipariş ürünleri varsa yükle, yoksa boş satır ekle
  const hasDraftItems = loadDraftItems();
  if (!hasDraftItems) {
    addOrderItem();
  }
  
  // Kayıtlı profil varsa sihirbazda hızlı devam etme kutusunu göster
  if (hasSavedProfile) {
    showQuickContinue();
  }

  // Son siparişlerimi getir
  loadMyOrders();
  setInterval(loadMyOrders, 20000); // 20 saniyede bir durumları güncelle
  
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
  
  // Input dinleyicileri (değiştikçe kaydetsin)
  document.getElementById("cust-company").addEventListener("input", saveProfileDetails);
  document.getElementById("cust-address").addEventListener("input", saveProfileDetails);
  document.getElementById("cust-recipient").addEventListener("input", saveProfileDetails);
  document.getElementById("cust-phone").addEventListener("input", saveProfileDetails);
});

// Profil Bilgilerini localStorage'dan Yükle
function loadProfileDetails() {
  const company = localStorage.getItem("ayg-cust-company");
  const address = localStorage.getItem("ayg-cust-address");
  const recipient = localStorage.getItem("ayg-cust-recipient");
  const phone = localStorage.getItem("ayg-cust-phone");
  
  const savedLat = localStorage.getItem("ayg-cust-lat");
  const savedLng = localStorage.getItem("ayg-cust-lng");

  if (company) document.getElementById("cust-company").value = company;
  if (address) document.getElementById("cust-address").value = address;
  if (recipient) document.getElementById("cust-recipient").value = recipient;
  if (phone) document.getElementById("cust-phone").value = phone;

  if (savedLat && savedLng) {
    state.selectedLat = parseFloat(savedLat);
    state.selectedLng = parseFloat(savedLng);
    updateCoordsBadge(true);
  }

  return !!(company && address);
}

// Profil Bilgilerini localStorage'a Kaydet
function saveProfileDetails() {
  const company = document.getElementById("cust-company").value.trim();
  const address = document.getElementById("cust-address").value.trim();
  const recipient = document.getElementById("cust-recipient").value.trim();
  const phone = document.getElementById("cust-phone").value.trim();

  localStorage.setItem("ayg-cust-company", company);
  localStorage.setItem("ayg-cust-address", address);
  localStorage.setItem("ayg-cust-recipient", recipient);
  localStorage.setItem("ayg-cust-phone", phone);
  
  if (state.selectedLat && state.selectedLng) {
    localStorage.setItem("ayg-cust-lat", state.selectedLat);
    localStorage.setItem("ayg-cust-lng", state.selectedLng);
  }
}

// Hızlı Devam Kutusunu Göster
function showQuickContinue() {
  const company = localStorage.getItem("ayg-cust-company") || "";
  const address = localStorage.getItem("ayg-cust-address") || "";
  
  const box = document.getElementById("quick-continue-box");
  const desc = document.getElementById("quick-profile-desc");
  
  desc.textContent = `${company} (${address.substring(0, 40)}...)`;
  box.classList.remove("hidden");
}

// Hızlı Geçiş: Doğrudan 3. Adıma Atla
function skipToStep3() {
  if (loadProfileDetails()) {
    goToStep(3);
    document.getElementById("quick-continue-box").classList.add("hidden");
    showToast("💾 Kayıtlı bilgileriniz başarıyla yüklendi.", "success");
  }
}

// Sihirbaz Adım Değiştirici (Wizard logic)
function goToStep(stepNum) {
  // Validasyon
  if (stepNum === 2 && state.currentStep === 1) {
    const comp = document.getElementById("cust-company").value.trim();
    if (!comp) {
      showToast("Lütfen Şirket / Müşteri Adı girin!", "warning");
      return;
    }
  }
  
  if (stepNum === 3 && state.currentStep === 2) {
    const addr = document.getElementById("cust-address").value.trim();
    const phone = document.getElementById("cust-phone").value.trim();
    if (!addr) {
      showToast("Lütfen Sevk Adresi girin!", "warning");
      return;
    }
    if (!phone) {
      showToast("Lütfen Telefon Numarası girin!", "warning");
      return;
    }
  }

  // Özet güncelle (Adım 3'e geçiyorsak)
  if (stepNum === 3) {
    const comp = document.getElementById("cust-company").value.trim();
    const addr = document.getElementById("cust-address").value.trim();
    const rec = document.getElementById("cust-recipient").value.trim();
    const phone = document.getElementById("cust-phone").value.trim();
    
    document.getElementById("summary-company").textContent = comp;
    
    let summaryAddressText = addr;
    if (state.selectedLat && state.selectedLng) summaryAddressText = "📍 Konum İşaretlendi | " + summaryAddressText;
    if (rec) summaryAddressText += " | Yetkili: " + rec;
    if (phone) summaryAddressText += " | Tel: " + phone;
    
    document.getElementById("summary-address").textContent = summaryAddressText;
  }

  // Adım Değişimi
  document.querySelectorAll(".step-panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`step-panel-${stepNum}`).classList.add("active");
  
  state.currentStep = stepNum;

  // Steppers Görsel Güncellemesi (PC)
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    const txt = document.getElementById(`step-txt-${i}`);
    if (!dot || !txt) continue;

    if (i < stepNum) {
      // Tamamlanmış adım
      dot.className = "w-8 h-8 rounded-full border-2 border-red-655 bg-white text-red-655 flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-sm";
      dot.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-red-600"></i>`;
      txt.className = "text-xs font-bold text-red-600";
    } else if (i === stepNum) {
      // Aktif adım
      dot.className = "w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all duration-300";
      dot.innerHTML = i;
      txt.className = "text-xs font-bold text-red-600";
    } else {
      // Gelecek adım
      dot.className = "w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center font-bold text-sm transition-all duration-300";
      dot.innerHTML = i;
      txt.className = "text-xs font-semibold text-slate-400";
    }
  }

  // Stepper Arasındaki Çizgi
  const line = document.getElementById("stepper-line");
  if (line) {
    if (stepNum === 1) line.style.width = "0%";
    else if (stepNum === 2) line.style.width = "50%";
    else if (stepNum === 3) line.style.width = "100%";
  }

  // Mobil Başlık ve İlerleme Çubuğu Güncellemesi
  const mobileTitle = document.getElementById("mobile-step-title");
  const mobileBar = document.getElementById("mobile-progress-bar");
  if (mobileTitle && mobileBar) {
    if (stepNum === 1) {
      mobileTitle.textContent = "1 / 3: Şirket Girişi";
      mobileBar.style.width = "33.3%";
    } else if (stepNum === 2) {
      mobileTitle.textContent = "2 / 3: Teslimat Adresi";
      mobileBar.style.width = "66.6%";
    } else if (stepNum === 3) {
      mobileTitle.textContent = "3 / 3: Ürün Girişi";
      mobileBar.style.width = "100%";
    }
  }

  // Kayıtlı profil uyarısını Adım 1 dışındayken gizle
  if (stepNum !== 1) {
    document.getElementById("quick-continue-box").classList.add("hidden");
  }

  // İkonları çiz
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Supabase Bağlantısı Kur
function initSupabase() {
  const aygState = localStorage.getItem("ayg-state");
  if (aygState) {
    try {
      const parsed = JSON.parse(aygState);
      if (parsed.supabaseUrl) state.supabaseUrl = parsed.supabaseUrl;
      if (parsed.supabaseKey) state.supabaseKey = parsed.supabaseKey;
    } catch(e) {}
  }

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");

  try {
    if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
      state.supabaseClient = supabase.createClient(state.supabaseUrl, state.supabaseKey);
      statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
      statusText.textContent = "Sisteme Bağlı";
    } else {
      throw new Error("Supabase kütüphanesi yok.");
    }
  } catch (e) {
    console.error(e);
    statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
    statusText.textContent = "Sadece WhatsApp";
    document.getElementById("btn-submit-db").disabled = true;
    document.getElementById("btn-submit-db").classList.add("opacity-50", "cursor-not-allowed");
  }
}

// localStorage'dan Son Sipariş ID'lerini Yükle
function loadSettingsFromStorage() {
  const myOrders = localStorage.getItem("ayg-my-orders");
  if (myOrders) {
    try {
      state.myOrderIds = JSON.parse(myOrders);
    } catch (e) {
      state.myOrderIds = [];
    }
  }
}

// Gönderilen Sipariş ID'sini Kaydet
function saveSentOrderId(id) {
  state.myOrderIds.unshift(id);
  if (state.myOrderIds.length > 25) state.myOrderIds.pop();
  localStorage.setItem("ayg-my-orders", JSON.stringify(state.myOrderIds));
  loadMyOrders();
}

// Taslak Ürünleri LocalStorage'a Kaydet
function saveDraftItems() {
  const rows = document.querySelectorAll('[id^="item-row-"]');
  const items = [];
  for (const row of rows) {
    const nameEl = document.getElementById(`${row.id}-name`);
    const qtyEl = document.getElementById(`${row.id}-qty`);
    const unitEl = document.getElementById(`${row.id}-unit`);
    
    if (nameEl && qtyEl) {
      const name = nameEl.value.trim();
      const qty = parseInt(qtyEl.value) || 1;
      const unit = unitEl ? unitEl.value : "adet";
      
      items.push({
        product_name: name,
        requested_quantity: qty,
        unit: unit
      });
    }
  }
  localStorage.setItem("ayg-draft-items", JSON.stringify(items));
}

// Taslak Ürünleri LocalStorage'dan Yükle
function loadDraftItems() {
  const draft = localStorage.getItem("ayg-draft-items");
  if (draft) {
    try {
      const items = JSON.parse(draft);
      if (items && items.length > 0) {
        const container = document.getElementById("order-items-container");
        container.innerHTML = "";
        state.itemsCount = 0;
        
        items.forEach(item => {
          addOrderItem(item.product_name, item.requested_quantity, item.unit);
        });
        return true;
      }
    } catch (e) {
      console.error("Taslak ürünler yüklenirken hata oluştu:", e);
    }
  }
  return false;
}

// Yeni Ürün Giriş Satırı Ekle
function addOrderItem(name = "", qty = 1, unit = "adet") {
  state.itemsCount++;
  const id = `item-row-${state.itemsCount}`;
  const container = document.getElementById("order-items-container");
  
  const div = document.createElement("div");
  div.className = "flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-slide-in relative group hover:border-slate-300 transition-colors";
  div.id = id;
  div.innerHTML = `
    <!-- Ürün Adı Girişi -->
    <div class="flex-1">
      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wide block md:hidden mb-1">Malzeme Adı</label>
      <input type="text" placeholder="Örn: 12'lik İnşaat Demiri veya Çimento" 
        class="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all focus:ring-4 focus:ring-red-500/5 font-semibold" 
        id="${id}-name" value="${name}" />
    </div>

    <div class="flex items-center justify-between gap-3">
      <!-- Birim Seçimi -->
      <div class="flex-1 md:w-28 shrink-0">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wide block md:hidden mb-1 font-semibold">Birim</label>
        <select 
          class="w-full bg-slate-50 border border-slate-200 focus:border-red-500 rounded-lg px-2 py-2 text-xs text-slate-600 font-bold focus:outline-none transition-all cursor-pointer" 
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
      </div>

      <!-- Miktar Kontrolleri -->
      <div class="shrink-0">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wide block md:hidden mb-1">Miktar</label>
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button onclick="adjustLocalQty('${id}', -1)" type="button"
            class="w-8 h-8 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-md hover:scale-95 active:scale-90 transition-all font-black text-base flex items-center justify-center cursor-pointer select-none">
            −
          </button>
          <input type="number" placeholder="Miktar" min="1"
            class="w-12 bg-transparent text-center text-sm text-slate-800 font-extrabold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
            id="${id}-qty" value="${qty}" />
          <button onclick="adjustLocalQty('${id}', 1)" type="button"
            class="w-8 h-8 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-md hover:scale-95 active:scale-90 transition-all font-black text-base flex items-center justify-center cursor-pointer select-none">
            +
          </button>
        </div>
      </div>

      <!-- Silme Butonu -->
      <div class="self-end md:self-center">
        <label class="text-[10px] font-bold text-transparent block md:hidden mb-1">Sil</label>
        <button onclick="removeLocalItem('${id}')" type="button"
          class="text-slate-400 hover:text-red-650 hover:bg-red-50 p-2 rounded-lg active:scale-90 transition-all cursor-pointer shrink-0"
          title="Ürünü Çıkar">
          <i data-lucide="trash-2" class="w-5 h-5"></i>
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);

  // Dinleyicileri bağla
  const nameInput = div.querySelector(`#${id}-name`);
  const unitSelect = div.querySelector(`#${id}-unit`);
  const qtyInput = div.querySelector(`#${id}-qty`);
  if (nameInput) nameInput.addEventListener("input", saveDraftItems);
  if (unitSelect) unitSelect.addEventListener("change", saveDraftItems);
  if (qtyInput) qtyInput.addEventListener("input", saveDraftItems);

  saveDraftItems();
  
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Miktar Değişimi
function adjustLocalQty(rowId, delta) {
  const qtyInput = document.getElementById(`${rowId}-qty`);
  if (qtyInput) {
    let val = parseInt(qtyInput.value) || 1;
    val = Math.max(1, val + delta);
    qtyInput.value = val;
    saveDraftItems();
  }
}

// Satır Çıkarma
function removeLocalItem(rowId) {
  const el = document.getElementById(rowId);
  if (el) {
    const allRows = document.querySelectorAll('[id^="item-row-"]');
    if (allRows.length <= 1) {
      showToast("En az bir ürün eklemelisiniz!", "warning");
      return;
    }
    el.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => {
      el.remove();
      saveDraftItems();
    }, 200);
  }
}

// Sipariş Listesini Onay ile Temizle
function confirmClearOrderList() {
  if (confirm("Sipariş listesindeki tüm ürünleri temizlemek istediğinize emin misiniz?")) {
    clearOrderForm();
    showToast("Sipariş listesi temizlendi.", "success");
  }
}

// Aciliyet Değiştirme
function setUrgency(urg) {
  state.urgency = urg;
  
  const btnNormal = document.getElementById("urg-normal");
  const btnAcil = document.getElementById("urg-acil");
  const btnCokAcil = document.getElementById("urg-cok-acil");
  
  [btnNormal, btnAcil, btnCokAcil].forEach(btn => {
    btn.className = "py-2.5 rounded-xl border text-xs font-bold transition-all bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300";
  });
  
  if (urg === "Normal") {
    btnNormal.className = "py-2.5 rounded-xl border text-xs font-bold transition-all bg-red-500/10 border-red-500/30 text-red-655";
  } else if (urg === "Acil") {
    btnAcil.className = "py-2.5 rounded-xl border text-xs font-bold transition-all bg-orange-500/10 border-orange-500/30 text-orange-600";
  } else if (urg === "Çok Acil") {
    btnCokAcil.className = "py-2.5 rounded-xl border text-xs font-bold transition-all bg-red-600/10 border-red-500/30 text-red-600 shadow-sm";
  }
}

// =============================================
// HARİTA YÖNETİMİ (Leaflet)
// =============================================

// Haritada Adres Ara (OSM Nominatim)
async function searchAddressOnMap() {
  const queryInput = document.getElementById("map-search-input");
  const query = queryInput.value.trim();
  
  if (!query) {
    showToast("Lütfen aranacak adresi yazın!", "warning");
    return;
  }

  showToast("Adres aranıyor...", "info");

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=tr`);
    if (!response.ok) throw new Error("Arama API hatası");
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      
      // Haritada odaklan ve marker yerleştir
      setMapMarker(lat, lng);
      
      if (state.mapInstance) {
        state.mapInstance.setView([lat, lng], 16);
      }
      
      // Alttaki önizleme adresini güncelle
      reverseGeocode(lat, lng);
      showToast("🔍 Adres bulundu ve haritada odaklandı.", "success");
    } else {
      showToast("Aradığınız adres bulunamadı. Lütfen daha belirgin yazın.", "warning");
    }
  } catch (e) {
    console.error("Adres arama hatası:", e);
    showToast("Adres aranırken bir sorun oluştu!", "error");
  }
}

// Harita Modalı Aç
function openMapModal() {
  document.getElementById("map-modal").classList.remove("hidden");
  
  // Haritayı asenkron olarak modal açıldıktan sonra ilklendirmeliyiz (div boyutları otursun diye)
  setTimeout(() => {
    initLeafletMap();
  }, 100);
}

// Harita Modalı Kapat
function closeMapModal() {
  document.getElementById("map-modal").classList.add("hidden");
}

// Leaflet Haritayı Başlat
function initLeafletMap() {
  const defaultLat = 41.0082; // İstanbul Varsayılan
  const defaultLng = 28.9784;

  const startLat = state.tempLat || state.selectedLat || defaultLat;
  const startLng = state.tempLng || state.selectedLng || defaultLng;

  if (!state.mapInstance) {
    // Harita nesnesi yoksa oluştur
    state.mapInstance = L.map("map-canvas").setView([startLat, startLng], 12);

    // OpenStreetMap Tile Katmanı Ekle
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.mapInstance);

    // Haritada tıklanan yere pin koy
    state.mapInstance.on("click", (e) => {
      setMapMarker(e.latlng.lat, e.latlng.lng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
  } else {
    // Harita zaten varsa sadece görünümü tazele (Leaflet bug'larını önlemek için)
    state.mapInstance.invalidateSize();
    state.mapInstance.setView([startLat, startLng], 13);
  }

  // Eğer önceden seçili konum varsa marker koy
  if (state.selectedLat && state.selectedLng) {
    setMapMarker(state.selectedLat, state.selectedLng);
    state.tempLat = state.selectedLat;
    state.tempLng = state.selectedLng;
  } else {
    // Konum seçilmediyse şansımızı GPS ile deneyelim
    locateUserGPS(false); // sessizce bulmayı dene toast atma
  }
}

// Haritaya Pin (Marker) Koy
function setMapMarker(lat, lng) {
  state.tempLat = lat;
  state.tempLng = lng;

  if (state.mapMarker) {
    state.mapMarker.setLatLng([lat, lng]);
  } else {
    state.mapMarker = L.marker([lat, lng], { draggable: true }).addTo(state.mapInstance);
    
    // Marker sürüklendiğinde de adresi güncelle
    state.mapMarker.on("dragend", (e) => {
      const position = e.target.getLatLng();
      setMapMarker(position.lat, position.lng);
      reverseGeocode(position.lat, position.lng);
    });
  }
  
  state.mapInstance.panTo([lat, lng]);
}

// GPS ile Kullanıcı Konumunu Al
function locateUserGPS(notify = true) {
  if (!navigator.geolocation) {
    if (notify) showToast("Tarayıcınız konum bilgisini desteklemiyor.", "error");
    return;
  }

  if (notify) showToast("Konumunuz alınıyor...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      setMapMarker(lat, lng);
      reverseGeocode(lat, lng);
      
      if (state.mapInstance) {
        state.mapInstance.setView([lat, lng], 16);
      }
      if (notify) showToast("📍 Konumunuz başarıyla haritada işaretlendi.", "success");
    },
    (error) => {
      console.error("GPS Hatası:", error);
      if (notify) showToast("GPS konumunuz alınamadı. Haritadan elle seçebilirsiniz.", "warning");
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

// Koordinattan Adres Çekme (OSM Nominatim Reverse Geocoding)
async function reverseGeocode(lat, lng) {
  const previewEl = document.getElementById("map-preview-address");
  previewEl.innerHTML = `<span class="animate-pulse">Adres sorgulanıyor...</span>`;

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });
    
    if (!response.ok) throw new Error("API hatası");
    const data = await response.json();
    
    if (data && data.display_name) {
      // Düzgün bir adres formatı oluştur
      let addr = data.display_name;
      
      // Çok uzun OSM adresini biraz sadeleştirelim
      if (data.address) {
        const a = data.address;
        const road = a.road || a.street || "";
        const suburb = a.suburb || a.neighbourhood || "";
        const town = a.town || a.city_district || "";
        const city = a.city || a.province || "";
        
        if (road || suburb) {
          addr = `${suburb ? suburb + ' Mah. ' : ''}${road ? road + ' Sk. ' : ''}${town ? town + '/' : ''}${city}`;
        }
      }

      previewEl.textContent = addr;
      previewEl.dataset.fullAddress = addr;
    } else {
      previewEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  } catch (e) {
    console.error("Adres sorgulanamadı:", e);
    previewEl.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// Harita Konumunu Onayla
function confirmMapLocation() {
  if (!state.tempLat || !state.tempLng) {
    showToast("Lütfen harita üzerinde bir yer seçin veya GPS butonuna tıklayın!", "warning");
    return;
  }

  state.selectedLat = state.tempLat;
  state.selectedLng = state.tempLng;

  // Seçilen adresi adres kutusuna yaz
  const previewEl = document.getElementById("map-preview-address");
  const detectedAddress = previewEl.dataset.fullAddress || previewEl.textContent;
  
  if (detectedAddress && !detectedAddress.startsWith("Haritada bir yer") && !detectedAddress.startsWith("Adres sorgu")) {
    document.getElementById("cust-address").value = detectedAddress;
  }

  // Değişiklikleri kaydet
  saveProfileDetails();
  updateCoordsBadge(true);
  closeMapModal();
  showToast("📍 Konumunuz başarıyla sevk adresine eklendi.", "success");
}

// Konum Rozeti Görünümünü Güncelle
function updateCoordsBadge(hasCoords) {
  const badge = document.getElementById("coords-status-badge");
  const dot = document.getElementById("coords-dot");
  const text = document.getElementById("coords-text");

  if (hasCoords && state.selectedLat && state.selectedLng) {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 border border-red-200 self-start";
    dot.className = "w-1.5 h-1.5 rounded-full bg-red-655 animate-pulse";
    text.innerHTML = `Konum Seçildi ✓ (${state.selectedLat.toFixed(4)}, ${state.selectedLng.toFixed(4)})`;
  } else {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-550 border border-slate-250 self-start";
    dot.className = "w-1.5 h-1.5 rounded-full bg-slate-400";
    text.textContent = "Haritadan konum işaretlenmedi (isteğe bağlı)";
  }
}

// Form Verilerini Topla ve Sipariş Nesnesini Oluştur
function gatherOrderData() {
  const companyName = document.getElementById("cust-company").value.trim();
  const address = document.getElementById("cust-address").value.trim();
  const recipient = document.getElementById("cust-recipient").value.trim() || "Genel";
  const phone = document.getElementById("cust-phone").value.trim();
  
  if (!companyName) {
    showToast("Lütfen Şirket / Müşteri Adı girin!", "error");
    goToStep(1);
    return null;
  }

  if (!address) {
    showToast("Lütfen Sevk Adresi girin!", "error");
    goToStep(2);
    return null;
  }

  const rows = document.querySelectorAll('[id^="item-row-"]');
  const items = [];
  for (const row of rows) {
    const nameEl = document.getElementById(`${row.id}-name`);
    const qtyEl = document.getElementById(`${row.id}-qty`);
    const unitEl = document.getElementById(`${row.id}-unit`);
    
    if (nameEl && qtyEl) {
      const name = nameEl.value.trim();
      const qty = parseInt(qtyEl.value) || 1;
      const unit = unitEl ? unitEl.value : "adet";
      
      if (name) {
        items.push({
          product_name: name,
          requested_quantity: qty,
          fulfilled_quantity: qty,
          unit: unit,
          checked: false
        });
      }
    }
  }

  if (items.length === 0) {
    showToast("Lütfen sipariş listesine en az bir malzeme adı yazın!", "error");
    return null;
  }

  // Son bilgileri localStorage'a kalıcı kaydet
  saveProfileDetails();

  // Müşteri bilgisi ve adresi birleştirilerek orders tablosundaki 'customer_address' alanına yazılır.
  let formattedAddress = `${companyName} [Adres: ${address}]`;
  if (phone) {
    formattedAddress += ` [Tel: ${phone}]`;
  }

  const noteEl = document.getElementById("cust-note");
  const note = noteEl ? noteEl.value.trim() : "";

  return {
    id: generateId(),
    customer_address: formattedAddress,
    recipient: recipient,
    urgency: state.urgency,
    note: note,
    status: "Bekliyor",
    created_by: "Müşteri",
    created_at: new Date().toISOString(),
    picked_by: null,
    items: items,
    
    // Koordinatları Supabase orders şemasına uygun şekilde ekle
    destination_lat: state.selectedLat || null,
    destination_lng: state.selectedLng || null
  };
}

// Siparişi Supabase'e Kaydet
async function submitOrderToDb() {
  const orderData = gatherOrderData();
  if (!orderData) return;

  if (!state.supabaseClient) {
    showToast("Bulut bağlantısı kurulamadı. Siparişi WhatsApp ile göndermeyi deneyin.", "error");
    return;
  }

  const btn = document.getElementById("btn-submit-db");
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="animate-pulse">Kaydediliyor...</span>`;
  btn.disabled = true;

  try {
    const { error } = await state.supabaseClient
      .from("orders")
      .insert([orderData]);

    if (error) throw error;

    // Son Sipariş ID'sini yerel hafızaya ekle
    saveSentOrderId(orderData.id);

    // Başarı modalı aç
    showSuccessModal(orderData);
    clearOrderForm();
    
    // Tekrar ilk adıma dön
    goToStep(1);
  } catch (e) {
    console.error("Supabase sipariş insert hatası:", e);
    showToast("Sipariş veritabanına kaydedilemedi!", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Siparişi WhatsApp ile Gönder
function submitOrderToWa() {
  const orderData = gatherOrderData();
  if (!orderData) return;

  const company = document.getElementById("cust-company").value.trim();
  const address = document.getElementById("cust-address").value.trim();

  let msg = `*🆕 AYG B2B YENİ SIPARIŞ TALEBI*\n`;
  msg += `-----------------------------\n`;
  msg += `🏢 *Firma/Müşteri:* ${company}\n`;
  msg += `📍 *Sevk Adresi:* ${address}\n`;
  if (orderData.destination_lat && orderData.destination_lng) {
    msg += `🗺️ *Konum Konumu (Harita):* https://www.google.com/maps/search/?api=1&query=${orderData.destination_lat},${orderData.destination_lng}\n`;
  }
  if (orderData.recipient && orderData.recipient !== "Genel") msg += `👤 *Yetkili:* ${orderData.recipient}\n`;
  msg += `🚨 *Aciliyet:* ${orderData.urgency === "Çok Acil" ? "🔴 Çok Acil" : orderData.urgency === "Acil" ? "🟠 Acil" : "🔵 Normal"}\n`;
  if (orderData.note) msg += `📝 *Not:* ${orderData.note}\n`;
  msg += `-----------------------------\n`;
  msg += `📦 *SIPARIŞ LISTESI:*\n`;
  
  orderData.items.forEach((item, idx) => {
    msg += `${idx + 1}. ${item.product_name} - *${item.requested_quantity} ${item.unit}*\n`;
  });
  msg += `-----------------------------\n`;
  msg += `⏱️ _Tarih: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR")}_`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
  
  if (state.supabaseClient) {
    state.supabaseClient.from("orders").insert([orderData]).then(({ error }) => {
      if (!error) saveSentOrderId(orderData.id);
    });
  }

  window.open(waUrl, "_blank");
  showToast("📱 WhatsApp uygulamasına yönlendiriliyorsunuz...", "success");
}

// Sipariş formunu temizle
function clearOrderForm() {
  document.getElementById("order-items-container").innerHTML = "";
  state.itemsCount = 0;
  localStorage.removeItem("ayg-draft-items");
  addOrderItem();
}

// Başarı Modalı Aç
function showSuccessModal(order) {
  const company = document.getElementById("cust-company").value.trim();
  document.getElementById("modal-cust-company").textContent = company;
  
  const urgEl = document.getElementById("modal-urgency");
  urgEl.textContent = order.urgency;
  if (order.urgency === "Çok Acil") {
    urgEl.className = "font-bold text-red-600 animate-pulse";
  } else if (order.urgency === "Acil") {
    urgEl.className = "font-bold text-orange-500";
  } else {
    urgEl.className = "font-bold text-slate-700";
  }

  document.getElementById("modal-items-count").textContent = `${order.items.length} kalem malzeme`;
  document.getElementById("success-modal").classList.remove("hidden");
}

// Başarı Modalı Kapat
function closeSuccessModal() {
  document.getElementById("success-modal").classList.add("hidden");
}

// Son Sipariş Durumlarını Çek
async function loadMyOrders() {
  if (!state.supabaseClient || state.myOrderIds.length === 0) return;

  try {
    const { data, error } = await state.supabaseClient
      .from("orders")
      .select("id, created_at, urgency, status, note, items, destination_lat, destination_lng")
      .in("id", state.myOrderIds)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const listContainer = document.getElementById("my-orders-list");
    if (!data || data.length === 0) {
      listContainer.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">Henüz sipariş vermediniz.</div>`;
      return;
    }

    listContainer.innerHTML = data.map(o => {
      const date = new Date(o.created_at).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
      
      const itemsText = o.items.map(i => `${i.product_name} (${i.requested_quantity} ${i.unit || "adet"})`).join(", ");
      
      // Status Renkleri
      let badgeStyle = "bg-slate-100 border-slate-200 text-slate-500";
      let statusLabel = o.status;
      
      if (o.status === "Bekliyor") {
        badgeStyle = "bg-slate-100 border-slate-200 text-slate-500";
        statusLabel = "Sırada ⏳";
      } else if (o.status === "Hazırlanıyor") {
        badgeStyle = "bg-amber-100 border-amber-200 text-amber-600 animate-pulse";
        statusLabel = "Hazırlanıyor 📦";
      } else if (o.status === "Tamamlandı") {
        badgeStyle = "bg-indigo-55 border-indigo-250 text-indigo-600";
        statusLabel = "Yola Çıkacak 🚛";
      } else if (o.status === "Yolda") {
        badgeStyle = "bg-blue-100 border-blue-200 text-blue-600";
        statusLabel = "Yolda 🚚";
      } else if (o.status === "Teslim Edildi") {
        badgeStyle = "bg-emerald-100 border-emerald-200 text-emerald-600";
        statusLabel = "Teslim Edildi ✅";
      }

      const isCokAcil = o.urgency === "Çok Acil";
      const urgBadge = isCokAcil ? `<span class="bg-red-100 border border-red-200 text-red-600 text-[9px] px-1 py-0.5 rounded font-black">ACİL</span>` : "";
      
      // Harita Pini Göstergesi
      const hasCoordsBadge = (o.destination_lat && o.destination_lng) 
        ? `<span class="text-xs" title="Harita konumu eklendi">📍</span>` 
        : "";

      return `
        <div class="p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 rounded-xl transition-all shadow-sm flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-slate-400 font-bold">${date}</span>
              ${hasCoordsBadge}
            </div>
            <div class="flex items-center gap-1">
              ${urgBadge}
              <span class="px-2 py-0.5 border text-[9px] font-extrabold rounded-full ${badgeStyle}">
                ${statusLabel}
              </span>
            </div>
          </div>
          <p class="text-xs text-slate-700 font-semibold line-clamp-2 leading-relaxed" title="${itemsText}">${itemsText}</p>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("Son sipariş durumları çekilemedi:", e);
  }
}

// Benzersiz ID Üretici
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Toast Bildirimi Göster
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  
  let bgClass = "bg-white border-slate-200 text-slate-700 shadow-lg";
  let icon = "ℹ️";
  
  if (type === "success") {
    bgClass = "bg-white border-emerald-200 text-emerald-600 shadow-md shadow-emerald-500/5";
    icon = "✅";
  } else if (type === "error") {
    bgClass = "bg-white border-red-200 text-red-650 shadow-md shadow-red-500/5";
    icon = "❌";
  } else if (type === "warning") {
    bgClass = "bg-white border-amber-200 text-amber-600 shadow-md shadow-amber-500/5";
    icon = "⚠️";
  }

  toast.className = `p-4 rounded-xl border text-xs font-bold flex items-center gap-2.5 shadow-premium transition-all duration-300 transform translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-y-[-10px]", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
