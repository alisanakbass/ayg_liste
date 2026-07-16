// =============================================
// CANLI HARİTA VE GPS KONUM TAKİBİ FONKSİYONLARI
// =============================================

function initShippingMap() {
  if (state.isMapCollapsed) return;

  const mapContainer = document.getElementById("shipping-map");
  if (!mapContainer) return;

  if (!state.mapInstance) {
    state.mapInstance = L.map('shipping-map').setView([39.9334, 32.8597], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap katkıda bulunanlar'
    }).addTo(state.mapInstance);
  }

  setTimeout(() => {
    state.mapInstance.invalidateSize();
    updateShippingMap();
  }, 200);
}

function toggleShippingMapCollapse() {
  state.isMapCollapsed = !state.isMapCollapsed;

  const wrapper = document.getElementById("shipping-map-wrapper");
  const btnText = document.getElementById("toggle-map-text");
  const icon = document.getElementById("toggle-map-icon");

  if (state.isMapCollapsed) {
    wrapper.classList.add("hidden");
    if (btnText) btnText.textContent = "Haritayı Göster";
    if (icon) icon.classList.remove("rotate-180");
    
    if (state.mapInstance) {
      state.mapInstance.remove();
      state.mapInstance = null;
      state.mapMarkers = {};
    }
  } else {
    wrapper.classList.remove("hidden");
    if (btnText) btnText.textContent = "Haritayı Gizle";
    if (icon) icon.classList.add("rotate-180");
    initShippingMap();
  }
}

function updateShippingMap() {
  if (!state.mapInstance || state.isMapCollapsed) return;

  const yoldaOrders = state.orders.filter(o => o.status === "Yolda" && o.latitude && o.longitude);

  Object.keys(state.mapMarkers).forEach(orderId => {
    const stillExists = yoldaOrders.some(o => o.id === orderId);
    if (!stillExists) {
      state.mapInstance.removeLayer(state.mapMarkers[orderId]);
      delete state.mapMarkers[orderId];
    }
  });

  if (yoldaOrders.length === 0) {
    state.mapInstance.setView([39.9334, 32.8597], 6);
    return;
  }

  const markerBounds = [];

  yoldaOrders.forEach(o => {
    const lat = parseFloat(o.latitude);
    const lng = parseFloat(o.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const coords = [lat, lng];
    markerBounds.push(coords);

    const popupContent = `
      <div class="p-2 space-y-1 text-xs text-slate-800 dark:text-slate-200">
        <p class="font-extrabold text-indigo-600 dark:text-indigo-400">🚛 Sevkiyat Yolda</p>
        <p><b>Plaka:</b> ${o.vehicle_plate || '—'}</p>
        <p><b>Adres:</b> ${o.customer_address}</p>
        <p><b>Sürücü:</b> ${o.picked_by || '—'}</p>
        <p><b>Süre:</b> ${getLiveTimerText(o.shipped_at)}</p>
      </div>
    `;

    const carIcon = L.divIcon({
      html: `<div class="bg-purple-600 text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center w-8 h-8 transition-transform hover:scale-110"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M13 16h6m-6 0H6m13 0a2 2 0 002-2v-4a1 1 0 00-1-1h-6v7" /></svg></div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (state.mapMarkers[o.id]) {
      state.mapMarkers[o.id].setLatLng(coords);
      state.mapMarkers[o.id].getPopup().setContent(popupContent);
    } else {
      const marker = L.marker(coords, { icon: carIcon })
        .addTo(state.mapInstance)
        .bindPopup(popupContent);
      state.mapMarkers[o.id] = marker;
    }
  });

  if (markerBounds.length > 0) {
    const bounds = L.latLngBounds(markerBounds);
    state.mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLockInstance = await navigator.wakeLock.request('screen');
      console.log("Wake Lock aktif: Ekran açık tutuluyor.");
    }
  } catch (err) {
    console.warn("Wake Lock aktif edilemedi:", err.message);
  }
}

function releaseWakeLock() {
  if (state.wakeLockInstance) {
    state.wakeLockInstance.release()
      .then(() => {
        state.wakeLockInstance = null;
        console.log("Wake Lock devre dışı bırakıldı.");
      });
  }
}

function initDriverLocationTracking(orderId) {
  clearDriverLocationTracking();

  if (!navigator.geolocation) {
    showToast("Cihazınız konum takibini desteklemiyor!", "error");
    return;
  }

  requestWakeLock();

  // watchPosition ile anlık ve kararlı GPS takibi başlat
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      updateOrderLocation(orderId, position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      console.error("GPS Konum Takip Hatası:", error);
    },
    { 
      enableHighAccuracy: true, 
      timeout: 15000, 
      maximumAge: 0 
    }
  );

  state.activeGeolocationWatch = { orderId, watchId };
  console.log(`Canlı konum takibi (watchPosition) başlatıldı. Sipariş ID: ${orderId}`);
}

function clearDriverLocationTracking() {
  if (state.activeGeolocationWatch) {
    if (state.activeGeolocationWatch.watchId) {
      navigator.geolocation.clearWatch(state.activeGeolocationWatch.watchId);
    }
    console.log(`Konum takibi durduruldu. Sipariş ID: ${state.activeGeolocationWatch.orderId}`);
    state.activeGeolocationWatch = null;
  }
  releaseWakeLock();
}

async function updateOrderLocation(orderId, lat, lng) {
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('orders')
        .update({ latitude: lat, longitude: lng })
        .eq('id', orderId);
      if (error) throw error;
      
      console.log(`Konum bulutta güncellendi: ${lat}, ${lng}`);
    } catch (err) {
      console.error("Konum bulutta güncellenemedi:", err);
    }
  } else {
    const order = state.orders.find(o => o.id === orderId);
    if (order) {
      order.latitude = lat;
      order.longitude = lng;
      saveState();
      console.log(`Konum yerelde güncellendi: ${lat}, ${lng}`);
    }
  }

  const localOrder = state.orders.find(o => o.id === orderId);
  if (localOrder) {
    localOrder.latitude = lat;
    localOrder.longitude = lng;
  }

  if (state.currentTab === "shipping") {
    updateShippingMap();
  }
}

// =============================================
// ADRES / KONUM SEÇİCİ (PICKER) METOTLARI
// =============================================

function openAddressPickerMap() {
  document.getElementById("address-picker-modal").classList.remove("hidden");
  document.getElementById("address-search-input").value = "";
  
  const lat = state.pickerLat || 41.0082; // Varsayılan İstanbul
  const lng = state.pickerLng || 28.9784;
  const zoom = state.pickerLat ? 16 : 12; // Koordinat varsa yakınlaş
  
  if (!state.pickerMapInstance) {
    state.pickerMapInstance = L.map('picker-map').setView([lat, lng], zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap katkıda bulunanlar'
    }).addTo(state.pickerMapInstance);

    state.pickerMapInstance.on('click', (e) => {
      setPickerMarker(e.latlng.lat, e.latlng.lng);
    });
  } else {
    state.pickerMapInstance.setView([lat, lng], zoom);
  }

  if (state.pickerLat && state.pickerLng) {
    setPickerMarker(state.pickerLat, state.pickerLng);
  } else if (state.pickerMarker) {
    state.pickerMapInstance.removeLayer(state.pickerMarker);
    state.pickerMarker = null;
  }

  setTimeout(() => {
    state.pickerMapInstance.invalidateSize();
  }, 200);
}

function setPickerMarker(lat, lng) {
  state.pickerLat = lat;
  state.pickerLng = lng;
  
  const coords = [lat, lng];
  
  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  if (state.pickerMarker) {
    state.pickerMarker.setLatLng(coords);
  } else {
    state.pickerMarker = L.marker(coords, { icon: redIcon, draggable: true })
      .addTo(state.pickerMapInstance);
    
    state.pickerMarker.on('dragend', (event) => {
      const marker = event.target;
      const position = marker.getLatLng();
      state.pickerLat = position.lat;
      state.pickerLng = position.lng;
    });
  }
}

function closeAddressPickerMap() {
  document.getElementById("address-picker-modal").classList.add("hidden");
  if (state.pickerMapInstance) {
    state.pickerMapInstance.remove();
    state.pickerMapInstance = null;
    state.pickerMarker = null;
  }
}

async function searchAddressOnMap() {
  const query = document.getElementById("address-search-input").value.trim();
  if (!query) return;
  
  showToast("Adres aranıyor...", "warning");
  
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=tr`);
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        state.pickerMapInstance.setView([lat, lng], 14);
        setPickerMarker(lat, lng);
        showToast("Adres bulundu ve işaretlendi!", "success");
      } else {
        showToast("Adres bulunamadı!", "error");
      }
    }
  } catch (err) {
    console.error("Adres arama hatası:", err);
    showToast("Adres aranırken hata oluştu!", "error");
  }
}

async function confirmAddressPickerLocation() {
  if (!state.pickerLat || !state.pickerLng) {
    showToast("Lütfen haritadan bir konum işaretleyin!", "error");
    return;
  }
  
  showToast("Adres bilgisi çözümleniyor...", "warning");
  
  const textAddress = await reverseGeocode(state.pickerLat, state.pickerLng);
  if (textAddress) {
    document.getElementById("order-address").value = textAddress;
    showToast("Konum ve adres başarıyla seçildi!", "success");
  } else {
    document.getElementById("order-address").value = `Koordinat: ${state.pickerLat.toFixed(5)}, ${state.pickerLng.toFixed(5)}`;
    showToast("Konum seçildi (Metin çözümlenemedi).", "success");
  }
  
  closeAddressPickerMap();
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=tr`);
    if (res.ok) {
      const data = await res.json();
      return data.display_name || "";
    }
  } catch (e) {
    console.error("Geocoding hatası:", e);
  }
  return "";
}

// Adres değiştiğinde otomatik link/koordinat tespiti yapar
async function parseAndLookupAddress() {
  const addressText = document.getElementById("order-address").value.trim();
  const openLinkBtn = document.getElementById("btn-open-address-link");
  
  if (!addressText) {
    if (openLinkBtn) openLinkBtn.classList.add("hidden");
    return;
  }

  const isLink = addressText.startsWith("http://") || addressText.startsWith("https://") || addressText.includes("maps.apple") || addressText.includes("apple.com") || addressText.includes("yandex.") || addressText.includes("goo.gl");

  if (openLinkBtn) {
    if (isLink) {
      openLinkBtn.classList.remove("hidden");
    } else {
      openLinkBtn.classList.add("hidden");
    }
  }

  const latLng = extractLatLng(addressText);
  if (latLng) {
    state.pickerLat = latLng.lat;
    state.pickerLng = latLng.lng;
    showToast(`📍 Konum otomatik algılandı: ${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`, "success");
    
    // Koordinatı düz metin adresine çevir (Ters Coğrafi Kodlama)
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}&accept-language=tr`);
      const data = await response.json();
      if (data && data.display_name) {
        document.getElementById("order-address").value = data.display_name;
      }
    } catch (e) {
      console.warn("Ters adres çözümleme başarısız:", e);
    }
  } else if (isLink) {
    showToast("ℹ️ Harita kısa linki algılandı. Yol tarifi için doğrudan bu link kullanılacaktır.", "success");
  }
}

// Regex ile Google, Yandex, Apple Maps linki veya koordinat çifti ayıklar
function extractLatLng(text) {
  // Google Maps
  const googleMapsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const googleMapsQueryRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  
  // Apple Maps
  const appleMapsRegex = /[?&]s?ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
  
  // Yandex Maps (Yandex ll parametresinde önce boylam/lng, sonra enlem/lat verir)
  const yandexMapsRegex = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const yandexTextRegex = /[?&]text=(-?\d+\.\d+),(-?\d+\.\d+)/;

  // Doğrudan Koordinat
  const coordRegex = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/;
  const coordRegexSpace = /^(-?\d+\.\d+)\s+(-?\d+\.\d+)$/;

  // Google Maps Kontrolü
  let match = text.match(googleMapsRegex) || text.match(googleMapsQueryRegex);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // Apple Maps Kontrolü
  if (text.includes("apple.com")) {
    match = text.match(appleMapsRegex);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Yandex Maps Kontrolü (ll parametresi için ters okuma: [2] lat, [1] lng)
  if (text.includes("yandex.com") || text.includes("yandex.ru") || text.includes("yandex.com.tr")) {
    match = text.match(yandexMapsRegex);
    if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
    
    match = text.match(yandexTextRegex);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Doğrudan koordinat kontrolü
  match = text.match(coordRegex) || text.match(coordRegexSpace);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  return null;
}

// Adres metnini sadeleştirir (Kat, No, posta kodu gibi Nominatim'i şaşırtan kısımları temizler)
function simplifyAddress(addr) {
  let clean = addr;
  // Posta kodlarını kaldır (5 haneli rakamlar)
  clean = clean.replace(/\b\d{5}\b/g, "");
  // Kat:5, Kat 5, No:117, Daire:3, D:4, K:2, No.12 vb. temizle
  clean = clean.replace(/(kat|daire|apt|apartmanı|apartman|blok|no|nolu|d:|k:)\s*[:.]?\s*\d+/gi, "");
  // Tek başına kalan kelimeleri temizle
  clean = clean.replace(/\b(kat|daire|no|apt|apartman|blok)\b/gi, "");
  // Virgül, tire ve eğik çizgileri boşluğa çevir
  clean = clean.replace(/[,.\-\/]/g, " ");
  // Fazla boşlukları temizle
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

// Metinsel adresi haritada aratıp koordinatını bulur (Kademeli Fallback Arama ile)
async function lookupAddressGeocode() {
  const addressText = document.getElementById("order-address").value.trim();
  if (!addressText) {
    showToast("Lütfen önce bir adres metni yazın!", "warning");
    return;
  }

  const isLink = addressText.startsWith("http://") || addressText.startsWith("https://") || addressText.includes("maps.apple") || addressText.includes("apple.com") || addressText.includes("yandex.") || addressText.includes("goo.gl");
  if (isLink) {
    showToast("🔗 Harita linkleri doğrudan kaydedilebilir, haritada aranmasına gerek yoktur.", "info");
    return;
  }

  showToast("Adres haritada aranıyor...", "info");

  try {
    // 1. Aşama: Orijinal adresi tam olarak dene
    let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressText)}&accept-language=tr&limit=1`);
    let data = await response.json();
    
    // 2. Aşama: Bulunamadıysa adresi sadeleştirip tekrar dene
    if (!data || data.length === 0) {
      const simplified = simplifyAddress(addressText);
      if (simplified && simplified !== addressText) {
        console.log("Adres sadeleştirilerek yeniden aranıyor:", simplified);
        response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplified)}&accept-language=tr&limit=1`);
        data = await response.json();
      }
    }

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      
      state.pickerLat = lat;
      state.pickerLng = lng;
      
      showToast(`📍 Adres başarıyla çözüldü ve haritada işaretlendi!`, "success");
      
      // Eğer Leaflet haritası bellekte yüklüyse ve marker tanımlıysa oraya da odaklanması sağlanabilir
      if (window.addressPickerMap && window.addressPickerMarker) {
        const latlng = [lat, lng];
        window.addressPickerMarker.setLatLng(latlng);
        window.addressPickerMap.setView(latlng, 16);
      }
    } else {
      showToast("Adres haritada bulunamadı. Lütfen apartman/kat/no girmeden sadece sokak, mahalle ve ilçe yazıp tekrar deneyin.", "warning");
    }
  } catch (e) {
    console.error("Adres arama hatası:", e);
    showToast("Adres aranırken bir hata oluştu!", "error");
  }
}

// Yapıştırılan harita bağlantısını yeni sekmede açar
function openDirectAddressLink() {
  const addressText = document.getElementById("order-address").value.trim();
  if (addressText.startsWith("http://") || addressText.startsWith("https://") || addressText.includes("maps.apple") || addressText.includes("apple.com") || addressText.includes("yandex.") || addressText.includes("goo.gl")) {
    window.open(addressText, "_blank");
  } else {
    showToast("Adres alanında geçerli bir harita linki bulunamadı!", "warning");
  }
}
