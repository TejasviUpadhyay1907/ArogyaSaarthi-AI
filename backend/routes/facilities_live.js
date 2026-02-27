/**
 * GET /api/facilities/nearby?pincode=411001
 *
 * Pipeline:
 *  1. Validate 6-digit pincode via India Post API
 *  2. Geocode pincode → lat/lon via Nominatim (OSM)
 *  3. Fetch nearby health facilities via Overpass API (8 km radius)
 *  4. Haversine sort, return top 5
 *
 * 10-minute in-memory cache per pincode to respect rate limits.
 */

const { Router } = require('express');
const router = Router();

// ── In-memory cache ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // pincode → { ts, data }

function getCached(pin) {
  const entry = cache.get(pin);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(pin); return null; }
  return entry.data;
}
function setCache(pin, data) {
  cache.set(pin, { ts: Date.now(), data });
}

// ── Utility: extract first 6-digit pincode from a string ──────────────────
function extractPincode(text) {
  const m = String(text).match(/\b[1-9][0-9]{5}\b/);
  return m ? m[0] : null;
}

// ── Utility: Haversine distance in km ─────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Step 1: Validate pincode via India Post API ────────────────────────────
async function fetchPincodeDetails(pin) {
  const url = `https://api.postalpincode.in/pincode/${pin}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ArogyaSaarthi/1.0 (health navigator)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`India Post API error: ${res.status}`);
  const json = await res.json();
  // Response: [{ Status, Message, PostOffice: [...] }]
  if (!Array.isArray(json) || json[0]?.Status !== 'Success') return null;
  const po = json[0].PostOffice?.[0];
  return po
    ? { district: po.District, state: po.State, region: po.Region, country: po.Country }
    : null;
}

// ── Step 2: Geocode pincode → lat/lon via Nominatim ───────────────────────
async function geocodePincode(pin) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${pin},India&limit=1&countrycodes=in`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ArogyaSaarthi/1.0 (health navigator; contact: admin@arogyasaarthi.in)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const json = await res.json();
  if (!json.length) return null;
  return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon), displayName: json[0].display_name };
}

// ── Step 3: Fetch nearby health facilities via Overpass ───────────────────
async function fetchOverpassFacilities(lat, lon, radiusM = 8000) {
  const query = `
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:${radiusM},${lat},${lon});
  way["amenity"="hospital"](around:${radiusM},${lat},${lon});
  node["amenity"="clinic"](around:${radiusM},${lat},${lon});
  way["amenity"="clinic"](around:${radiusM},${lat},${lon});
  node["healthcare"](around:${radiusM},${lat},${lon});
  way["healthcare"](around:${radiusM},${lat},${lon});
  node["amenity"="doctors"](around:${radiusM},${lat},${lon});
  node["amenity"="pharmacy"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ArogyaSaarthi/1.0 (health navigator)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = await res.json();
  return json.elements || [];
}

// ── Step 4: Normalise + sort Overpass elements ────────────────────────────
function normaliseElements(elements, originLat, originLon) {
  return elements
    .map(el => {
      // ways have a `center` object; nodes have lat/lon directly
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) return null;

      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['name:hi'] || 'Unnamed facility';

      // Determine type label
      let type = 'health';
      if (tags.amenity === 'hospital') type = 'hospital';
      else if (tags.amenity === 'clinic') type = 'clinic';
      else if (tags.amenity === 'doctors') type = 'doctor';
      else if (tags.amenity === 'pharmacy') type = 'pharmacy';
      else if (tags.healthcare) type = tags.healthcare;

      // Build address from available tags
      const addrParts = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:suburb'],
        tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
        tags['addr:state'],
      ].filter(Boolean);
      const address = addrParts.length ? addrParts.join(', ') : null;

      const distKm = haversineDistance(originLat, originLon, elLat, elLon);

      return {
        id: el.id,
        name,
        type,
        distanceKm: Math.round(distKm * 10) / 10,
        address,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        openingHours: tags.opening_hours || null,
        emergency: tags.emergency === 'yes' ? true : undefined,
        lat: elLat,
        lon: elLon,
        mapLink: `https://www.google.com/maps?q=${elLat},${elLon}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);
}

// ── Route handler ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const rawPin = req.query.pincode || req.query.q || '';
  const pincode = extractPincode(rawPin);

  if (!pincode) {
    return res.status(400).json({
      error: 'Please enter a valid 6-digit Indian pincode.',
      facilities: [],
    });
  }

  // Cache hit
  const cached = getCached(pincode);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    // 1. Validate pincode
    const pincodeInfo = await fetchPincodeDetails(pincode);
    if (!pincodeInfo) {
      return res.status(400).json({
        error: 'Please enter a valid 6-digit Indian pincode.',
        facilities: [],
      });
    }

    // 2. Geocode
    const geo = await geocodePincode(pincode);
    if (!geo) {
      return res.status(422).json({
        error: 'Could not locate this pincode on the map. Try a nearby major area.',
        facilities: [],
      });
    }

    // 3. Overpass
    const elements = await fetchOverpassFacilities(geo.lat, geo.lon);

    // 4. Normalise
    const facilities = normaliseElements(elements, geo.lat, geo.lon);

    const result = {
      pincode,
      area: pincodeInfo.district
        ? `${pincodeInfo.district}, ${pincodeInfo.state}`
        : geo.displayName,
      lat: geo.lat,
      lon: geo.lon,
      facilities,
      count: facilities.length,
      message:
        facilities.length === 0
          ? 'No nearby facilities found in map data. Try a nearby major area or call 104.'
          : null,
    };

    setCache(pincode, result);
    return res.json(result);
  } catch (err) {
    console.error('[facilities/nearby]', err.message);
    return res.status(502).json({
      error: 'Could not fetch facility data right now. Please try again or call 104.',
      facilities: [],
    });
  }
});

// Export utilities for testing
module.exports = router;
module.exports.extractPincode = extractPincode;
module.exports.haversineDistance = haversineDistance;
module.exports.fetchPincodeDetails = fetchPincodeDetails;
module.exports.geocodePincode = geocodePincode;
module.exports.fetchOverpassFacilities = fetchOverpassFacilities;
