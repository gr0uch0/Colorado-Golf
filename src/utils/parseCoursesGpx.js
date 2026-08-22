/**
 * Parse GPX from Overpass/OSM exports: <wpt> nodes and <trk> polygon outlines.
 * Produces course records compatible with the checklist app.
 */

function parseDesc(descText) {
  if (!descText || typeof descText !== 'string') return {};
  const map = {};
  for (const line of descText.split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k) map[k] = v;
  }
  return map;
}

function extractOsmIdFromDoc(el) {
  const links = el.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const href = links[i].getAttribute('href') || '';
    const m = href.match(/\/(node|way|relation)\/(\d+)/);
    if (m) return `osm-${m[1]}-${m[2]}`;
  }
  return null;
}

function slugify(s) {
  return String(s || 'course')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'course';
}

function buildAddress(tags) {
  const parts = [];
  const street = [tags['addr:housenumber'], tags['addr:street']]
    .filter(Boolean)
    .join(' ');
  if (street) parts.push(street);
  const cityLine = [tags['addr:city'], tags['addr:state'], tags['addr:postcode']]
    .filter(Boolean)
    .join(', ');
  if (cityLine) parts.push(cityLine);
  return parts.join(' · ') || 'Address not listed';
}

function inferType(tags, name) {
  const access = (tags.access || '').toLowerCase();
  if (access === 'private' || access === 'no') return 'Private';
  if (tags.club === 'sport' && access === 'private') return 'Private';
  const n = (name || '').toLowerCase();
  if (n.includes('resort')) return 'Resort';
  if (n.includes('municipal') || n.includes('city park')) return 'Municipal';
  return 'Public';
}

function inferHoles(tags) {
  const raw = tags.holes || tags['golf:holes'] || tags['golf_holes'];
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 18;
}

function inferCity(tags) {
  return tags['addr:city'] || tags['addr:place'] || '—';
}

/**
 * Overpass GPX often sets `<name>` to an OSM ref like `way/12345678` when the
 * exporter did not get a display name. The real `name=*` tag may appear in
 * `<desc>` as `name=Foo Golf Club`. If there is still no name, OSM simply
 * has no name on that polygon yet (only `leisure=golf_course`).
 */
function resolveCourseName(rawName, tags) {
  const raw = (rawName || '').trim();
  const tagged = (tags.name || tags['official_name'] || '').trim();
  const isOsmRef = /^(way|relation|node)\/\d+$/i.test(raw);

  if (tagged && (isOsmRef || !raw)) return tagged;
  if (isOsmRef && !tagged) {
    const place = tags['addr:city'] || tags['addr:place'];
    return place ? `Golf course — ${place}` : 'Golf course (unnamed on OpenStreetMap)';
  }
  return raw || tagged || 'Unnamed course';
}

/** @param {Record<string, string>} tags */
function normalizeWebsite(tags) {
  const raw =
    tags.website ||
    tags['contact:website'] ||
    tags.url ||
    tags['website:booking'];
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return new URL(href).href;
  } catch {
    return null;
  }
}

/**
 * @param {string} xmlString
 * @returns {Array<{
 *   id: string;
 *   name: string;
 *   city: string;
 *   address: string;
 *   type: string;
 *   holes: number;
 *   lat: number;
 *   lng: number;
 *   website: string | null;
 *   played: false;
 *   playedAt: null;
 * }>}
 */
export function parseCoursesGpx(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    console.error('GPX parse error:', parseError.textContent);
    return [];
  }

  const out = [];
  const seen = new Set();

  const push = (course) => {
    if (!course.id || seen.has(course.id)) return;
    seen.add(course.id);
    out.push(course);
  };

  const wpts = doc.getElementsByTagName('wpt');
  for (let i = 0; i < wpts.length; i++) {
    const wpt = wpts[i];
    const lat = parseFloat(wpt.getAttribute('lat') || '');
    const lon = parseFloat(wpt.getAttribute('lon') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const nameEl = wpt.getElementsByTagName('name')[0];
    const descEl = wpt.getElementsByTagName('desc')[0];
    const tags = parseDesc(descEl?.textContent || '');
    const name = resolveCourseName((nameEl?.textContent || '').trim(), tags);

    let id = extractOsmIdFromDoc(wpt);
    if (!id) {
      id = `${slugify(name)}-${Math.round(lat * 1e6)}-${Math.round(lon * 1e6)}`;
    }

    push({
      id,
      name,
      city: inferCity(tags),
      address: buildAddress(tags),
      type: inferType(tags, name),
      holes: inferHoles(tags),
      website: normalizeWebsite(tags),
      lat,
      lng: lon,
      played: false,
      playedAt: null,
    });
  }

  const trks = doc.getElementsByTagName('trk');
  for (let i = 0; i < trks.length; i++) {
    const trk = trks[i];
    const nameEl = trk.getElementsByTagName('name')[0];
    const descEl = trk.getElementsByTagName('desc')[0];
    const rawName = (nameEl?.textContent || '').trim();
    const tags = parseDesc(descEl?.textContent || '');
    if (!rawName && !tags.name?.trim()) continue;

    const firstPt = trk.getElementsByTagName('trkpt')[0];
    if (!firstPt) continue;
    const lat = parseFloat(firstPt.getAttribute('lat') || '');
    const lon = parseFloat(firstPt.getAttribute('lon') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const name = resolveCourseName(rawName, tags);
    let id = extractOsmIdFromDoc(trk);
    if (!id) {
      id = `trk-${slugify(name)}-${Math.round(lat * 1e6)}-${Math.round(lon * 1e6)}`;
    }

    push({
      id,
      name,
      city: inferCity(tags),
      address: buildAddress(tags),
      type: inferType(tags, name),
      holes: inferHoles(tags),
      website: normalizeWebsite(tags),
      lat,
      lng: lon,
      played: false,
      playedAt: null,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return out;
}
