import L from 'leaflet';

/**
 * @param {{ lat: number; lng: number }[]} points
 * @returns {L.LatLngBounds | null}
 */
export function boundsFromPoints(points) {
  if (!points.length) return null;
  const bounds = L.latLngBounds(
    points.map((p) => [p.lat, p.lng])
  );
  return bounds;
}

/**
 * @param {{ lat: number; lng: number }[]} points
 * @returns {[number, number]}
 */
export function centerFromPoints(points) {
  if (!points.length) return [39.5, -105.5];
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  const n = points.length;
  return [lat / n, lng / n];
}
