// netlify/functions/search-products.js
// Bu fonksiyon Netlify kota tüketimini sıfırlamak amacıyla devre dışı bırakılmıştır.
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify([])
  };
};
