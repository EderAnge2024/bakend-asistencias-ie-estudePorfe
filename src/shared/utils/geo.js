/**
 * geo.js - Calculo de distancia entre dos coordenadas GPS (formula Haversine)
 * Retorna la distancia en metros entre (lat1, lon1) y (lat2, lon2).
 */
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const pLat1 = Number(lat1);
  const pLon1 = Number(lon1);
  const pLat2 = Number(lat2);
  const pLon2 = Number(lon2);

  // Si alguna coordenada es invalida o nula, retornar null
  if (isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2)) {
    return null;
  }

  const R = 6371000; // Radio medio de la Tierra en metros
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(pLat2 - pLat1);
  const dLon = toRad(pLon2 - pLon1);

  // Formula de Haversine
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(pLat1)) * Math.cos(toRad(pLat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((R * c).toFixed(2));
}

module.exports = { calcularDistanciaMetros };