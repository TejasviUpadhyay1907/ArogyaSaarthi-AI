const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/sqlite');
const { callAIEngine, localFallbackTriage } = require('../ai_bridge');
const { buildEnrichedTriageCard } = require('./triage_helpers');
const {
  extractPincode,
  fetchPincodeDetails,
  geocodePincode,
  fetchOverpassFacilities,
} = require('./facilities_live');

const router = Router();
const MAX_CLARIFY = 3;

// ── Live facility lookup via Overpass (pincode only) ──────────────────────
async function fetchLiveFacilities(pincode) {
  try {
    const info = await fetchPincodeDetails(pincode);
    if (!info) return { facilities: [], error: 'invalid_pincode' };
    const geo = await geocodePincode(pincode);
    if (!geo) return { facilities: [], error: 'geocode_failed' };
    const elements = await fetchOverpassFacilities(geo.lat, geo.lon);
    const facilities = elements
      .map(el => {
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (!elLat || !elLon) return null;
        const tags = el.tags || {};
        const name = tags.name || tags['name:en'] || 'Unnamed facility';
        let type = 'health';
        if (tags.amenity === 'hospital') type = 'hospital';
        else if (tags.amenity === 'clinic') type = 'clinic';
        else if (tags.amenity === 'doctors') type = 'doctor';
        else if (tags.amenity === 'pharmacy') type = 'pharmacy';
        else if (tags.healthcare) type = tags.healthcare;
        const addrParts = [tags['addr:street'], tags['addr:suburb'], tags['addr:city'] || tags['addr:town']].filter(Boolean);
        const distKm = Math.round(
          6371 * 2 * Math.atan2(
            Math.sqrt(Math.sin(((elLat - geo.lat) * Math.PI / 180) / 2) ** 2 + Math.cos(geo.lat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) * Math.sin(((elLon - geo.lon) * Math.PI / 180) / 2) ** 2),
            Math.sqrt(1 - Math.sin(((elLat - geo.lat) * Math.PI / 180) / 2) ** 2 - Math.cos(geo.lat * Math.PI / 180) * Math.cos(elLat * Math.PI / 180) * Math.sin(((elLon - geo.lon) * Math.PI / 180) / 2) ** 2)
          ) * 10
        ) / 10;
        return { id: el.id, name, type, distanceKm: distKm, address: addrParts.join(', ') || null, phone: tags.phone || null, mapLink: `https://www.google.com/maps?q=${elLat},${elLon}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
    console.log(`[Chat] Live facilities fetched from real API for pincode ${pincode}: ${facilities.length} results`);
    return { facilities, area: `${info.district}, ${info.state}` };
  } catch (err) {
    console.warn(`[Chat] Live facility lookup failed for pincode ${pincode}:`, err.message);
    return { facilities: [], error: 'lookup_failed' };
  }
}
const VALID_URGENCIES = new Set(['LOW', 'MEDIUM', 'HIGH']);

// ── Location refinement signals ───────────────────────────────────────────
const LOCATION_REFINE_KW = /\b(far|too\s*far|near|near\s*me|closer|close\s*by|distance|location|nearby|nearer|km|kilomet|pincode|area|locality|village|ward)\b/i;
const LOCATION_REFINE_KW_ML = /दूर|पास|नज़दीक|नजदीक|पिनकोड|क्षेत्र|दूरी|जगह|ठिकाण|जवळ|पिनकोड|परिसर|தூரம்|அருகில்|பகுதி|దూరం|దగ్గర|ప్రాంతం|పిన్‌కోడ్/u;

// ── Facility search keywords ──────────────────────────────────────────────
const FACILITY_KW = /\b(clinic|hospital|phc|chc|dispensary|health\s*cent(er|re)|doctor|nearest|find|where|book|appointment|facility|facilities)\b/i;
const FACILITY_KW_ML = /अस्पताल|क्लिनिक|PHC|CHC|डॉक्टर|नजदीकी|रुग्णालय|दवाखाना|மருத்துவமனை|PHC|CHC|மருத்துவர்|ఆసుపత్రి|PHC|CHC|వైద్యుడు/u;

// ── Extract location text from message ───────────────────────────────────
function extractLocation(text) {
  // Patterns: "near Pimpri", "in Pune", "at Wakad", "pincode 411017", "Kothrud area"
  const patterns = [
    /(?:near|in|at|around|from|pincode|area|locality)\s+([A-Za-z0-9\s]{2,30})/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:area|locality|ward|village|pincode)/i,
    /\b(\d{6})\b/, // 6-digit pincode
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1]?.trim() || null;
  }
  return null;
}

// ── Facility search from DB ───────────────────────────────────────────────
function searchFacilities(db, facilityType, location, language = 'en') {
  const lang = language || 'en';
  const nameCol = `name_${lang}`;
  const addrCol = `address_${lang}`;

  const typeMap = {
    HOME: [],
    PHC: ['PHC'],
    CHC: ['CHC', 'PHC'],
    DISTRICT_HOSPITAL: ['DISTRICT_HOSPITAL', 'CHC'],
    EMERGENCY: ['DISTRICT_HOSPITAL'],
  };
  const types = typeMap[facilityType] || ['PHC'];
  if (types.length === 0) return [];

  try {
    const placeholders = types.map(() => '?').join(',');
    let query = `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
                        COALESCE(${addrCol}, address_en) as address, phone, distance_km
                 FROM facilities WHERE type IN (${placeholders}) AND active=1`;
    const params = [...types];

    // If location provided, try to filter by district/address match
    if (location) {
      query += ` AND (district LIKE ? OR COALESCE(${addrCol}, address_en) LIKE ?)`;
      params.push(`%${location}%`, `%${location}%`);
    }

    query += ' ORDER BY distance_km ASC LIMIT 3';
    let rows = db.prepare(query).all(...params);

    // If location filter returned nothing, fall back to unfiltered
    if (rows.length === 0 && location) {
      rows = db.prepare(
        `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
                COALESCE(${addrCol}, address_en) as address, phone, distance_km
         FROM facilities WHERE type IN (${placeholders}) AND active=1
         ORDER BY distance_km ASC LIMIT 3`
      ).all(...types);
    }

    return rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      distanceKm: r.distance_km,
      address: r.address,
      phone: r.phone,
      district: r.district,
      hours: r.type === 'DISTRICT_HOSPITAL' ? '24 hours' : '9am – 5pm',
    }));
  } catch {
    return [];
  }
}

// ── Session memory helpers ────────────────────────────────────────────────
function saveSessionMemory(db, sid, fields) {
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), sid];
  db.prepare(`UPDATE sessions SET ${sets}, last_active = datetime('now') WHERE id = ?`).run(...vals);
}

function buildLocationAskReply(language) {
  const msgs = {
    en: 'Please share your area or pincode so I can find the nearest facility for you.',
    hi: 'कृपया अपना क्षेत्र या पिनकोड बताएं ताकि मैं आपके लिए नजदीकी सुविधा खोज सकूं।',
    mr: 'कृपया तुमचा परिसर किंवा पिनकोड सांगा जेणेकरून मी तुमच्यासाठी जवळचे केंद्र शोधू शकेन.',
    ta: 'உங்கள் பகுதி அல்லது பின்கோடை பகிரவும், நான் உங்களுக்கு அருகிலுள்ள மையத்தை கண்டுபிடிக்கிறேன்.',
    te: 'దయచేసి మీ ప్రాంతం లేదా పిన్‌కోడ్ చెప్పండి, నేను మీకు సమీప కేంద్రాన్ని కనుగొంటాను.',
  };
  return msgs[language] || msgs.en;
}

function buildFacilityReply(facilities, facilityType, location, language) {
  const intro = {
    en: `Here are the nearest ${facilityType || 'health'} facilities${location ? ` near ${location}` : ''}:`,
    hi: `यहाँ ${location ? location + ' के पास ' : ''}नजदीकी ${facilityType || 'स्वास्थ्य'} केंद्र हैं:`,
    mr: `येथे ${location ? location + ' जवळील ' : ''}जवळचे ${facilityType || 'आरोग्य'} केंद्र आहेत:`,
    ta: `${location ? location + ' அருகில் ' : ''}உள்ள ${facilityType || 'சுகாதார'} மையங்கள்:`,
    te: `${location ? location + ' సమీపంలో ' : ''}ఉన్న ${facilityType || 'ఆరోగ్య'} కేంద్రాలు:`,
  };
  if (!facilities || facilities.length === 0) {
    const noResult = {
      en: 'No facilities found nearby. Please try a different area or pincode.',
      hi: 'नजदीक कोई सुविधा नहीं मिली। कृपया कोई अन्य क्षेत्र या पिनकोड आज़माएं।',
      mr: 'जवळपास कोणतेही केंद्र सापडले नाही. कृपया वेगळा परिसर किंवा पिनकोड वापरा.',
      ta: 'அருகில் எந்த மையமும் கிடைக்கவில்லை. வேறு பகுதி அல்லது பின்கோடை முயற்சிக்கவும்.',
      te: 'సమీపంలో ఏ కేంద్రమూ కనుగొనబడలేదు. వేరే ప్రాంతం లేదా పిన్‌కోడ్ ప్రయత్నించండి.',
    };
    return noResult[language] || noResult.en;
  }
  const lines = facilities.map(f =>
    `• ${f.name}${f.distanceKm ? ` (${f.distanceKm} km)` : ''}${f.address ? ` — ${f.address}` : ''}${f.phone ? ` 📞 ${f.phone}` : ''}`
  );
  return (intro[language] || intro.en) + '\n' + lines.join('\n');
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    await handleChat(req, res);
  } catch (err) {
    console.error('[Chat] Unhandled route error:', err.message);
    // Never return 500 — always return a safe structured response
    const { localFallbackTriage } = require('../ai_bridge');
    const language = req.body?.language || 'en';
    const message = req.body?.message || req.body?.text || '';
    const fallback = localFallbackTriage(message, language);
    res.json({
      scope: fallback.scope || 'MEDICAL',
      intent: fallback.intent || 'CLARIFICATION_REQUIRED',
      reply: fallback.reply || 'Please describe your symptoms.',
      triageCard: fallback.triageCard || null,
      facilities: [],
      booking: null,
      sessionId: req.body?.sessionId || null,
      meta: { llmUsed: false, fallbackUsed: true, latencyMs: 0 },
    });
  }
});

async function handleChat(req, res) {
  const start = Date.now();
  const { sessionId, message: _msg, text: _text, language = 'en', source = 'text' } = req.body;
  const message = _msg || _text; // Accept both "message" and "text" for compatibility

  if (!message) return res.status(400).json({ error: 'message is required' });

  const db = getDb();

  // ── Ensure session ────────────────────────────────────────────────
  let sid = sessionId;
  let session = sid ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid) : null;
  if (!session) {
    sid = sid || uuidv4();
    db.prepare('INSERT OR IGNORE INTO sessions (id, language) VALUES (?, ?)').run(sid, language);
    session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  }

  // ── Read session memory ───────────────────────────────────────────
  const lastIntent            = session.last_intent || null;
  const lastUrgency           = session.last_urgency || null;
  const lastCareLevel         = session.last_care_level || null;
  const lastFacilityType      = session.last_facility_type || null;
  const lastUserLocation      = session.last_user_location || null;
  const lastKnownLocationText = session.last_known_location_text || null;
  const lastKnownPincode      = session.last_known_pincode || null;

  const latency = () => Date.now() - start;
  const reply = (obj) => res.json({ ...obj, sessionId: sid });

  // ── REFINE_LOCATION detection ─────────────────────────────────────
  // Trigger when: prior context exists AND message is about location/distance
  const hasLocationSignal = LOCATION_REFINE_KW.test(message) || LOCATION_REFINE_KW_ML.test(message);
  const hasFacilityContext = lastIntent === 'FACILITY_SEARCH' || lastIntent === 'TRIAGE_RESULT' ||
    (lastUrgency && lastCareLevel);
  const hasFacilitySignal = FACILITY_KW.test(message) || FACILITY_KW_ML.test(message);

  if (hasLocationSignal && hasFacilityContext) {
    const extractedLocation = extractLocation(message) || null;
    const newLocation = extractedLocation || lastUserLocation;
    const facilityType = lastFacilityType || lastCareLevel || 'PHC';

    if (!newLocation) {
      // No location in message and none stored — ask for it
      saveSessionMemory(db, sid, { last_intent: 'AWAITING_LOCATION' });
      return reply({
        scope: 'MEDICAL',
        intent: 'REFINE_LOCATION',
        reply: buildLocationAskReply(language),
        triageCard: null,
        facilities: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
      });
    }

    // Re-run facility search with new/updated location — pincode required for live lookup
    const pincode = extractPincode(newLocation) || extractPincode(message);
    if (!pincode) {
      // Have location text but no pincode — ask specifically for pincode
      const askPincodeMsg = {
        en: 'Please share your 6-digit pincode (e.g. 411001) so I can find real nearby facilities for you.',
        hi: 'कृपया अपना 6-अंकीय पिनकोड बताएं (जैसे 411001) ताकि मैं आपके लिए असली नजदीकी सुविधाएं खोज सकूं।',
        mr: 'कृपया तुमचा 6-अंकी पिनकोड सांगा (उदा. 411001) जेणेकरून मी तुमच्यासाठी खरे जवळचे केंद्र शोधू शकेन.',
        ta: 'உங்கள் 6-இலக்க பின்கோடை பகிரவும் (எ.கா. 411001) நான் உங்களுக்கு உண்மையான அருகிலுள்ள மையங்களை கண்டுபிடிக்கிறேன்.',
        te: 'దయచేసి మీ 6-అంకెల పిన్‌కోడ్ చెప్పండి (ఉదా. 411001) నేను మీకు నిజమైన సమీప కేంద్రాలు కనుగొంటాను.',
      };
      saveSessionMemory(db, sid, { last_intent: 'AWAITING_LOCATION', last_user_location: newLocation });
      return reply({
        scope: 'MEDICAL',
        intent: 'REFINE_LOCATION',
        reply: askPincodeMsg[language] || askPincodeMsg.en,
        triageCard: null,
        facilities: [],
        booking: null,
        nextStep: 'ASK_LOCATION',
        meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
      });
    }

    const { facilities, area } = await fetchLiveFacilities(pincode);
    const noFacMsg = {
      en: 'Could not fetch nearby facilities right now. Please visit the nearest PHC/government hospital or call 104.',
      hi: 'अभी नजदीकी सुविधाएं नहीं मिल सकीं। कृपया नजदीकी PHC/सरकारी अस्पताल जाएं या 104 पर कॉल करें।',
      mr: 'आत्ता जवळच्या सुविधा मिळू शकल्या नाहीत. कृपया जवळच्या PHC/सरकारी रुग्णालयात जा किंवा 104 वर कॉल करा.',
      ta: 'இப்போது அருகிலுள்ள வசதிகளை பெற முடியவில்லை. அருகிலுள்ள PHC/அரசு மருத்துவமனைக்கு செல்லவும் அல்லது 104 அழைக்கவும்.',
      te: 'ఇప్పుడు సమీప సౌకర్యాలు పొందలేకపోయాం. దయచేసి సమీప PHC/ప్రభుత్వ ఆసుపత్రికి వెళ్ళండి లేదా 104 కు కాల్ చేయండి.',
    };
    saveSessionMemory(db, sid, {
      last_intent: 'FACILITY_SEARCH',
      last_user_location: newLocation,
      last_facility_type: facilityType,
      last_known_pincode: pincode,
    });

    return reply({
      scope: 'MEDICAL',
      intent: 'REFINE_LOCATION',
      reply: facilities.length > 0
        ? buildFacilityReply(facilities, facilityType, area || newLocation, language)
        : (noFacMsg[language] || noFacMsg.en),
      triageCard: null,
      facilities,
      booking: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
    });
  }

  // ── AWAITING_LOCATION / ASK_LOCATION: user is replying with their location ──────
  if (lastIntent === 'AWAITING_LOCATION' || lastIntent === 'ASK_LOCATION') {
    const pincode = extractPincode(message);
    const location = extractLocation(message) || message.trim().slice(0, 60);
    const facilityType = lastFacilityType || lastCareLevel || 'PHC';

    // If pincode provided → live lookup
    if (pincode) {
      saveSessionMemory(db, sid, {
        last_intent: 'FACILITY_SEARCH',
        last_user_location: location,
        last_facility_type: facilityType,
        last_known_location_text: location,
        last_known_pincode: pincode,
      });

      const { facilities, area, error } = await fetchLiveFacilities(pincode);

      const noFacilityMsgs = {
        en: 'Could not fetch nearby facilities right now. Please visit the nearest PHC/government hospital or call 104.',
        hi: 'अभी नजदीकी सुविधाएं नहीं मिल सकीं। कृपया नजदीकी PHC/सरकारी अस्पताल जाएं या 104 पर कॉल करें।',
        mr: 'आत्ता जवळच्या सुविधा मिळू शकल्या नाहीत. कृपया जवळच्या PHC/सरकारी रुग्णालयात जा किंवा 104 वर कॉल करा.',
        ta: 'இப்போது அருகிலுள்ள வசதிகளை பெற முடியவில்லை. அருகிலுள்ள PHC/அரசு மருத்துவமனைக்கு செல்லவும் அல்லது 104 அழைக்கவும்.',
        te: 'ఇప్పుడు సమీప సౌకర్యాలు పొందలేకపోయాం. దయచేసి సమీప PHC/ప్రభుత్వ ఆసుపత్రికి వెళ్ళండి లేదా 104 కు కాల్ చేయండి.',
      };

      const replyText = facilities.length > 0
        ? buildFacilityReply(facilities, facilityType, area || location, language)
        : (noFacilityMsgs[language] || noFacilityMsgs.en);

      return reply({
        scope: 'MEDICAL',
        intent: 'LOCATION_PROVIDED',
        reply: replyText,
        triageCard: null,
        facilities,
        booking: null,
        nextStep: null,
        meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
      });
    }

    // No pincode — ask again with clearer prompt
    const askPincodeMsg = {
      en: 'Please share your 6-digit pincode (e.g. 411001) so I can find real nearby facilities for you.',
      hi: 'कृपया अपना 6-अंकीय पिनकोड बताएं (जैसे 411001) ताकि मैं आपके लिए असली नजदीकी सुविधाएं खोज सकूं।',
      mr: 'कृपया तुमचा 6-अंकी पिनकोड सांगा (उदा. 411001) जेणेकरून मी तुमच्यासाठी खरे जवळचे केंद्र शोधू शकेन.',
      ta: 'உங்கள் 6-இலக்க பின்கோடை பகிரவும் (எ.கா. 411001) நான் உங்களுக்கு உண்மையான அருகிலுள்ள மையங்களை கண்டுபிடிக்கிறேன்.',
      te: 'దయచేసి మీ 6-అంకెల పిన్‌కోడ్ చెప్పండి (ఉదా. 411001) నేను మీకు నిజమైన సమీప కేంద్రాలు కనుగొంటాను.',
    };
    saveSessionMemory(db, sid, { last_intent: 'AWAITING_LOCATION' });
    return reply({
      scope: 'MEDICAL',
      intent: 'LOCATION_PROVIDED',
      reply: askPincodeMsg[language] || askPincodeMsg.en,
      triageCard: null,
      facilities: [],
      booking: null,
      nextStep: 'ASK_LOCATION',
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
    });
  }

  // ── FACILITY_SEARCH intent: user asking for clinic/hospital ──────
  if (hasFacilitySignal && lastUrgency && lastCareLevel) {
    const pincode = extractPincode(message);
    const facilityType = lastFacilityType || lastCareLevel;

    if (!pincode) {
      // Ask for pincode specifically
      const askPincodeMsg = {
        en: 'Please share your 6-digit pincode to find real nearby facilities.',
        hi: 'कृपया अपना 6-अंकीय पिनकोड बताएं ताकि असली नजदीकी सुविधाएं मिल सकें।',
        mr: 'कृपया तुमचा 6-अंकी पिनकोड सांगा जेणेकरून खरे जवळचे केंद्र मिळतील.',
        ta: 'உண்மையான அருகிலுள்ள மையங்களை கண்டுபிடிக்க உங்கள் 6-இலக்க பின்கோடை பகிரவும்.',
        te: 'నిజమైన సమీప కేంద్రాలు కనుగొనడానికి మీ 6-అంకెల పిన్‌కోడ్ చెప్పండి.',
      };
      saveSessionMemory(db, sid, { last_intent: 'AWAITING_LOCATION' });
      return reply({
        scope: 'MEDICAL',
        intent: 'FACILITY_SEARCH',
        reply: askPincodeMsg[language] || askPincodeMsg.en,
        triageCard: null,
        facilities: [],
        booking: null,
        nextStep: 'ASK_LOCATION',
        meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
      });
    }

    saveSessionMemory(db, sid, {
      last_intent: 'FACILITY_SEARCH',
      last_facility_type: facilityType,
      last_known_pincode: pincode,
    });

    const { facilities, area, error } = await fetchLiveFacilities(pincode);
    const noFacMsg = {
      en: 'Could not fetch nearby facilities right now. Please visit the nearest PHC/government hospital or call 104.',
      hi: 'अभी नजदीकी सुविधाएं नहीं मिल सकीं। कृपया नजदीकी PHC/सरकारी अस्पताल जाएं या 104 पर कॉल करें।',
      mr: 'आत्ता जवळच्या सुविधा मिळू शकल्या नाहीत. कृपया जवळच्या PHC/सरकारी रुग्णालयात जा किंवा 104 वर कॉल करा.',
      ta: 'இப்போது அருகிலுள்ள வசதிகளை பெற முடியவில்லை. அருகிலுள்ள PHC/அரசு மருத்துவமனைக்கு செல்லவும் அல்லது 104 அழைக்கவும்.',
      te: 'ఇప్పుడు సమీప సౌకర్యాలు పొందలేకపోయాం. దయచేసి సమీప PHC/ప్రభుత్వ ఆసుపత్రికి వెళ్ళండి లేదా 104 కు కాల్ చేయండి.',
    };
    return reply({
      scope: 'MEDICAL',
      intent: 'FACILITY_SEARCH',
      reply: facilities.length > 0
        ? buildFacilityReply(facilities, facilityType, area || pincode, language)
        : (noFacMsg[language] || noFacMsg.en),
      triageCard: null,
      facilities,
      booking: null,
      meta: { llmUsed: false, fallbackUsed: false, latencyMs: latency() },
    });
  }

  // ── Full AI pipeline ──────────────────────────────────────────────
  try {
    const result = await callAIEngine(message, language, source);
    const ms = latency();

    // Non-symptom / non-medical intents
    if (result.intent === 'SMALL_TALK' || result.intent === 'CLARIFICATION_REQUIRED') {
      // If we have prior triage context and this looks like a follow-up, don't reset to greeting
      const hasContext = lastUrgency && lastCareLevel;
      if (hasContext && result.intent === 'SMALL_TALK' && result.scope !== 'NON_MEDICAL_SAFE') {
        // Treat as CLARIFICATION in context of existing triage
        saveSessionMemory(db, sid, { last_intent: 'CLARIFICATION_REQUIRED' });
      } else {
        saveSessionMemory(db, sid, { last_intent: result.intent });
      }

      return reply({
        scope: result.scope || 'MEDICAL',
        intent: result.intent,
        reply: result.reply,
        triageCard: null,
        facilities: [],
        booking: null,
        nextQuestion: null,
        meta: { llmUsed: result.meta?.llmUsed || false, fallbackUsed: result.meta?.fallbackUsed || false, latencyMs: ms },
      });
    }

    // SYMPTOMS triage flow
    let nextQuestion = null;
    const clarifyCount = session.clarify_count || 0;
    if (clarifyCount < MAX_CLARIFY && result.structured?.clarifyingQuestion) {
      nextQuestion = getClarifyingQuestion(result.structured.clarifyingQuestion, language);
      db.prepare("UPDATE sessions SET clarify_count = clarify_count + 1 WHERE id = ?").run(sid);
    }

    const urgency   = VALID_URGENCIES.has(result.urgency) ? result.urgency : 'MEDIUM';
    const careLevel = result.careLevel || 'PHC';

    // Log triage
    db.prepare(`INSERT INTO triage_logs (session_id, language, urgency, care_level, reason_codes, source, llm_used, fallback_used, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      sid, language, urgency, careLevel,
      JSON.stringify(result.reasonCodes || []), source,
      result.meta?.llmUsed ? 1 : 0,
      result.meta?.fallbackUsed ? 1 : 0,
      ms
    );

    // Save session memory
    saveSessionMemory(db, sid, {
      last_urgency:      urgency,
      last_care_level:   careLevel,
      last_intent:       'TRIAGE_RESULT',
      last_facility_type: careLevel,
      triage_count:      (session.triage_count || 0) + 1,
    });

    const shortReply = result.explanation || buildShortReply(urgency, careLevel, language, nextQuestion);
    const safeTriageCard = buildEnrichedTriageCard(urgency, careLevel, result.reasonCodes, result.structured, language);

    // Two-step gate: HIGH/MEDIUM → ask for location if not known yet
    const knownLocation = lastKnownLocationText || lastKnownPincode || lastUserLocation;
    if ((urgency === 'HIGH' || urgency === 'MEDIUM') && !knownLocation) {
      const nextQuestion2 = buildLocationAskReply(language);
      saveSessionMemory(db, sid, { last_intent: 'ASK_LOCATION' });
      return reply({
        scope: result.scope || 'MEDICAL',
        intent: 'SYMPTOMS',
        reply: shortReply,
        triageCard: safeTriageCard,
        structured: result.structured,
        facilities: [],
        booking: null,
        nextStep: 'ASK_LOCATION',
        nextQuestion: nextQuestion2,
        meta: { llmUsed: result.meta?.llmUsed || false, fallbackUsed: result.meta?.fallbackUsed || false, latencyMs: ms },
      });
    }

    // LOW urgency or location already known → ask for pincode for live lookup (never return DB facilities)
    const facilities = [];
    const needsPincodeAsk = urgency !== 'LOW';

    return reply({
      scope: result.scope || 'MEDICAL',
      intent: 'SYMPTOMS',
      reply: shortReply,
      triageCard: safeTriageCard,
      structured: result.structured,
      facilities,
      booking: null,
      nextQuestion,
      nextStep: needsPincodeAsk && !knownLocation ? 'ASK_LOCATION' : null,
      meta: { llmUsed: result.meta?.llmUsed || false, fallbackUsed: result.meta?.fallbackUsed || false, latencyMs: ms },
    });

  } catch (err) {
    console.error('[Chat] AI engine error, using fallback:', err.message);
    const fallback = localFallbackTriage(message, language);
    const ms = latency();

    if (fallback.intent === 'SMALL_TALK' || fallback.intent === 'CLARIFICATION_REQUIRED') {
      saveSessionMemory(db, sid, { last_intent: fallback.intent });
      return reply({
        scope: fallback.scope || 'MEDICAL',
        intent: fallback.intent,
        reply: fallback.reply,
        triageCard: null, facilities: [], booking: null, nextQuestion: null,
        meta: { llmUsed: false, fallbackUsed: false, latencyMs: ms },
      });
    }

    const fbUrgency   = VALID_URGENCIES.has(fallback.urgency) ? fallback.urgency : 'MEDIUM';
    const fbCareLevel = fallback.careLevel || 'PHC';

    db.prepare(`INSERT INTO triage_logs (session_id, language, urgency, care_level, reason_codes, source, llm_used, fallback_used, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`).run(
      sid, language, fbUrgency, fbCareLevel,
      JSON.stringify(fallback.reasonCodes || []), source, ms
    );

    const knownLocationFb = lastKnownLocationText || lastKnownPincode || lastUserLocation;
    const fbCard = buildEnrichedTriageCard(fbUrgency, fbCareLevel, fallback.reasonCodes, fallback.structured, language);

    saveSessionMemory(db, sid, {
      last_urgency:      fbUrgency,
      last_care_level:   fbCareLevel,
      last_intent:       fbUrgency !== 'LOW' ? 'ASK_LOCATION' : 'TRIAGE_RESULT',
      last_facility_type: fbCareLevel,
      triage_count:      (session.triage_count || 0) + 1,
    });

    return reply({
      scope: fallback.scope || 'MEDICAL',
      intent: 'SYMPTOMS',
      reply: buildShortReply(fbUrgency, fbCareLevel, language, null),
      triageCard: fbCard,
      structured: fallback.structured,
      facilities: [],
      booking: null,
      nextStep: (fbUrgency !== 'LOW' && !knownLocationFb) ? 'ASK_LOCATION' : null,
      nextQuestion: (fbUrgency !== 'LOW' && !knownLocationFb) ? buildLocationAskReply(language) : null,
      meta: { llmUsed: false, fallbackUsed: true, latencyMs: ms },
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildShortReply(urgency, careLevel, lang, nextQuestion) {
  const replies = {
    HIGH:   { en: 'Your symptoms need immediate attention. Please call 108 right away.', hi: 'आपके लक्षण गंभीर हैं। कृपया अभी 108 पर कॉल करें।', mr: 'तुमची लक्षणे गंभीर आहेत. कृपया आत्ता 108 वर कॉल करा.', ta: 'உங்கள் அறிகுறிகள் தீவிரமானவை. உடனடியாக 108 அழைக்கவும்.', te: 'మీ లక్షణాలు తీవ్రంగా ఉన్నాయి. వెంటనే 108 కు కాల్ చేయండి.' },
    MEDIUM: { en: 'Please visit a PHC within 24 hours for proper care.', hi: '24 घंटे के भीतर PHC जाएं।', mr: '24 तासांत PHC ला भेट द्या.', ta: '24 மணி நேரத்திற்குள் PHC செல்லவும்.', te: '24 గంటల్లో PHC కి వెళ్ళండి.' },
    LOW:    { en: 'Your symptoms appear mild. Rest and stay hydrated.', hi: 'लक्षण हल्के हैं। आराम करें और पानी पीते रहें।', mr: 'लक्षणे सौम्य आहेत. विश्रांती घ्या.', ta: 'அறிகுறிகள் லேசானவை. ஓய்வெடுங்கள்.', te: 'లక్షణాలు తేలికగా ఉన్నాయి. విశ్రాంతి తీసుకోండి.' },
  };
  let reply = (replies[urgency] || replies.MEDIUM)[lang] || (replies[urgency] || replies.MEDIUM).en;
  if (nextQuestion) reply += '\n\n' + nextQuestion;
  return reply;
}

function buildFallbackCard(fallback, language) {
  const timeLabels = {
    HIGH:   { en: 'NOW', hi: 'अभी', mr: 'आत्ता', ta: 'இப்போதே', te: 'ఇప్పుడే' },
    MEDIUM: { en: 'Within 24 hours', hi: '24 घंटे में', mr: '24 तासांत', ta: '24 மணி நேரத்தில்', te: '24 గంటల్లో' },
    LOW:    { en: 'Monitor at home', hi: 'घर पर देखें', mr: 'घरी पहा', ta: 'வீட்டில் கண்காணி', te: 'ఇంట్లో చూడండి' },
  };
  const urgency = fallback.urgency;
  return {
    urgency,
    careLevel: fallback.careLevel,
    timeToAct: (timeLabels[urgency] || timeLabels.MEDIUM)[language] || timeLabels[urgency]?.en,
    why: [fallback.structured?.primaryComplaint || 'unknown'],
    watchFor: ['breathing difficulty', 'chest pain', 'fainting'],
    actions: fallback.actions?.slice(0, 2) || [],
  };
}

function getClarifyingQuestion(type, lang) {
  const questions = {
    duration:   { en: 'How many days have you had these symptoms?', hi: 'ये लक्षण कितने दिनों से हैं?', mr: 'ही लक्षणे किती दिवसांपासून आहेत?', ta: 'இந்த அறிகுறிகள் எத்தனை நாட்களாக உள்ளன?', te: 'ఈ లక్షణాలు ఎన్ని రోజులుగా ఉన్నాయి?' },
    severity:   { en: 'How severe are your symptoms — mild, moderate, or severe?', hi: 'आपके लक्षण कितने गंभीर हैं — हल्के, मध्यम, या गंभीर?', mr: 'तुमची लक्षणे किती गंभीर आहेत — सौम्य, मध्यम, किंवा गंभीर?', ta: 'உங்கள் அறிகுறிகள் எவ்வளவு தீவிரமானவை — லேசான, நடுத்தர, அல்லது கடுமையான?', te: 'మీ లక్షణాలు ఎంత తీవ్రంగా ఉన్నాయి — తేలిక, మధ్యస్థం, లేదా తీవ్రం?' },
    associated: { en: 'Do you have any other symptoms like fever, cough, or body ache?', hi: 'क्या आपको और कोई लक्षण हैं जैसे बुखार, खांसी, या शरीर दर्द?', mr: 'तुम्हाला इतर काही लक्षणे आहेत का जसे ताप, खोकला, किंवा अंगदुखी?', ta: 'காய்ச்சல், இருமல், அல்லது உடல் வலி போன்ற வேறு அறிகுறிகள் உள்ளனவா?', te: 'జ్వరం, దగ్గు, లేదా శరీర నొప్పి వంటి ఇతర లక్షణాలు ఉన్నాయా?' },
  };
  return (questions[type] || questions.associated)[lang] || (questions[type] || questions.associated).en;
}

module.exports = router;

