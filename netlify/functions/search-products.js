// netlify/functions/search-products.js

exports.handler = async (event, context) => {
  const q = event.queryStringParameters.q || "";
  
  // CORS başlıkları
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  };

  // Sorgu çok kısaysa boş liste dön (gereksiz yükü önlemek için)
  if (q.trim().length < 3) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([])
    };
  }

  const products = [];

  // Eşzamanlı (Promise.allSettled) olarak her iki siteden arama yapalım
  const fetchPromises = [
    // 1. Nalburdayım Arama
    (async () => {
      try {
        const url = `https://www.nalburdayim.com/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(5000) // 5 sn timeout
        });
        if (res.status === 200) {
          const html = await res.text();
          const regex = /item_name\s*:\s*['"](.*?)['"]/gi;
          let match;
          while ((match = regex.exec(html)) !== null) {
            const name = match[1].trim();
            if (name.length > 2 && !name.includes("{")) { // JS kodu kaçmasını önle
              products.push(name);
            }
          }
        }
      } catch (err) {
        console.error("Nalburdayim fetch error:", err.message);
      }
    })(),

    // 2. İnşaat Malzemeleri Burada Arama
    (async () => {
      try {
        // Keşfettiğimiz URL yönlendirme formatı: /arama/kelime
        const url = `https://www.insaatmalzemeleriburada.com/arama/${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(5000) // 5 sn timeout
        });
        if (res.status === 200) {
          const html = await res.text();
          const startIndex = html.indexOf('class="showcase-container');
          if (startIndex !== -1) {
            const showcaseHtml = html.substring(startIndex);
            const regex = /<a[^>]*href=["']\/urun\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let match;
            while ((match = regex.exec(showcaseHtml)) !== null) {
              const rawText = match[2].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
              // E-ticaret şablonundaki sol tarafta kalan "> " gibi fazla karakterleri temizle
              const cleanedText = rawText.replace(/^[\s>"\']*/, '').trim();
              if (cleanedText.length > 2) {
                products.push(cleanedText);
              }
            }
          }
        }
      } catch (err) {
        console.error("InsaatMalzemeleri fetch error:", err.message);
      }
    })()
  ];

  await Promise.allSettled(fetchPromises);

  // Ürün isimlerini tekilleştir, boşlukları temizle ve en fazla 20 sonuca sınırlayarak dön
  const uniqueProducts = Array.from(new Set(products))
    .map(p => p.trim())
    .filter(p => p.length > 2 && p.length < 120) // Çok uzun hatalı eşleşmeleri eliyoruz
    .slice(0, 20);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(uniqueProducts)
  };
};
