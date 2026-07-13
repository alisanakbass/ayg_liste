const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// VAPID Şifreleme Anahtarları
const PUBLIC_VAPID_KEY = "BBgNO2NXgx6kTb2YFoR-cimPL0PwaO7GB5xDpc7xIgFeSjrRmejFC6aHsUUPgSmbIxCBLLmVVPfCJLlrEMNpjl8";
const PRIVATE_VAPID_KEY = "KdSGexXdyrE7nowfN_y3qYrwgR6MMXLhYJ2s__rsRt0";

webpush.setVapidDetails(
  "mailto:info@ayg.com",
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

// Supabase Bağlantı Bilgileri (state.js'ten alındı)
const SUPABASE_URL = "https://fnwikxmspdxamsostbnb.supabase.co";
const SUPABASE_KEY = "sb_publishable_tlsSFNjL-zfH-KUWShqIkQ_H5G97Hvd";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
  // CORS Ayarları
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    
    // Supabase Webhook payload yapısında yeni kayıt record içindedir
    const newOrder = payload.record;
    if (!newOrder) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: "Sipariş verisi bulunamadı." }) 
      };
    }

    let companyName = "Müşteri";
    if (newOrder.customer_address) {
      if (newOrder.customer_address.includes(" [Adres:")) {
        companyName = newOrder.customer_address.split(" [Adres:")[0];
      } else {
        companyName = newOrder.customer_address.substring(0, 30);
      }
    }
    
    const creator = newOrder.created_by || "Müşteri";
    let bodyText = `${companyName} yeni bir sipariş oluşturdu.`;
    if (creator !== "Müşteri") {
      bodyText = `Personel (${creator}) yeni bir sipariş oluşturdu: ${companyName}`;
    }

    const notificationPayload = JSON.stringify({
      title: "🔔 Yeni AYG Siparişi!",
      body: bodyText
    });

    // push_subscriptions tablosundan tüm aktif cihaz aboneliklerini çek
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription");

    if (error) throw error;

    console.log(`${subscriptions.length} cihaza bildirim gönderiliyor...`);

    const pushPromises = subscriptions.map((sub) => {
      return webpush.sendNotification(sub.subscription, notificationPayload)
        .catch(async (err) => {
          console.warn("Hatalı veya eski abonelik temizleniyor:", err);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("subscription", sub.subscription);
          }
        });
    });

    await Promise.all(pushPromises);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: subscriptions.length })
    };

  } catch (error) {
    console.error("Hata:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
