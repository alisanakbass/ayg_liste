// =========================================================================
// SUPABASE EDGE FUNCTION - WEB PUSH NOTIFICATION TETİKLEYİCİSİ (Deno)
// =========================================================================
// Bu kod Supabase Edge Functions üzerinde veya bir Node.js/Deno sunucusunda
// veritabanı webhook tetikleyicisi (Database Webhook) olarak çalışır.
//
// Tetiklenme Koşulu: 'orders' tablosuna yeni veri girildiğinde (INSERT)
// =========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

// VAPID Şifreleme Anahtarları (npx web-push generate-vapid-keys ile üretildi)
const PUBLIC_VAPID_KEY = "BBgNO2NXgx6kTb2YFoR-cimPL0PwaO7GB5xDpc7xIgFeSjrRmejFC6aHsUUPgSmbIxCBLLmVVPfCJLlrEMNpjl8";
const PRIVATE_VAPID_KEY = "KdSGexXdyrE7nowfN_y3qYrwgR6MMXLhYJ2s__rsRt0";

// Google/Apple Servislerine kendini doğrulatacak mail adresi
webPush.setVapidDetails(
  "mailto:info@ayg.com",
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

serve(async (req) => {
  try {
    const payload = await req.json();
    
    // Webhook verisinden yeni sipariş kaydını al
    const newOrder = payload.record; 
    if (!newOrder) {
      return new Response(JSON.stringify({ error: "Sipariş verisi bulunamadı." }), { status: 400 });
    }

    // Sipariş veren firmanın adını al
    const companyName = newOrder.customer_address.split(" [Adres:")[0] || "Müşteri";
    
    // Bildirim içeriğini hazırla
    const notificationPayload = JSON.stringify({
      title: "🔔 Yeni AYG Siparişi!",
      body: `${companyName} yeni bir sipariş oluşturdu.`
    });

    // Supabase bağlantısını kur (Edge Function ortam değişkenlerinden)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Veritabanındaki tüm aktif cihaz aboneliklerini (token'ları) çek
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("subscription");

    if (error) throw error;

    console.log(`${subscriptions.length} cihaz aboneliğine bildirim gönderiliyor...`);

    // Her cihaza push bildirimini sırayla gönder
    const pushPromises = subscriptions.map((sub) => {
      return webPush.sendNotification(sub.subscription, notificationPayload)
        .then(() => console.log("Bildirim gönderildi."))
        .catch(async (err) => {
          console.warn("Hatalı veya süresi geçmiş abonelik, siliniyor:", err);
          // Eğer abonelik süresi geçmişse (410 Gone / 404 Not Found), veritabanından temizle
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("subscription", sub.subscription);
          }
        });
    });

    await Promise.all(pushPromises);

    return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
