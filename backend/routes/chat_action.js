/**
 * POST /api/chat/action
 * Executes a card button action and returns the updated payload.
 * All data comes from deterministic tools + SQLite — never invented by Gemini.
 */
const { Router } = require('express');
const { getDb } = require('../db/sqlite');

const router = Router();

const VALID_LANGS = new Set(['en', 'hi', 'mr', 'ta', 'te']);

// ── i18n labels ────────────────────────────────────────────────────────────
const L = {
  noFacilities: {
    en: 'No facilities found nearby. Please try a different area or pincode.',
    hi: 'नजदीक कोई सुविधा नहीं मिली। कृपया कोई अन्य क्षेत्र या पिनकोड आज़माएं।',
    mr: 'जवळपास कोणतेही केंद्र सापडले नाही. कृपया वेगळा परिसर किंवा पिनकोड वापरा.',
    ta: 'அருகில் எந்த மையமும் கிடைக்கவில்லை. வேறு பகுதி அல்லது பின்கோடை முயற்சிக்கவும்.',
    te: 'సమీపంలో ఏ కేంద్రమూ కనుగొనబడలేదు. వేరే ప్రాంతం లేదా పిన్‌కోడ్ ప్రయత్నించండి.',
  },
  askLocation: {
    en: 'Please share your area or pincode so I can find the nearest facility for you.',
    hi: 'कृपया अपना क्षेत्र या पिनकोड बताएं ताकि मैं आपके लिए नजदीकी सुविधा खोज सकूं।',
    mr: 'कृपया तुमचा परिसर किंवा पिनकोड सांगा जेणेकरून मी तुमच्यासाठी जवळचे केंद्र शोधू शकेन.',
    ta: 'உங்கள் பகுதி அல்லது பின்கோடை பகிரவும், நான் உங்களுக்கு அருகிலுள்ள மையத்தை கண்டுபிடிக்கிறேன்.',
    te: 'దయచేసి మీ ప్రాంతం లేదా పిన్‌కోడ్ చెప్పండి, నేను మీకు సమీప కేంద్రాన్ని కనుగొంటాను.',
  },
  emergency: {
    en: '🚨 This is a medical emergency. Call 108 immediately or go to the nearest emergency room. Do not wait.',
    hi: '🚨 यह चिकित्सा आपातकाल है। तुरंत 108 पर कॉल करें या नजदीकी आपातकालीन कक्ष जाएं। देरी न करें।',
    mr: '🚨 हे वैद्यकीय आणीबाणी आहे. लगेच 108 वर कॉल करा किंवा जवळच्या आणीबाणी कक्षात जा. उशीर करू नका.',
    ta: '🚨 இது மருத்துவ அவசரநிலை. உடனடியாக 108 அழைக்கவும் அல்லது அருகிலுள்ள அவசர அறைக்கு செல்லவும்.',
    te: '🚨 ఇది వైద్య అత్యవసర పరిస్థితి. వెంటనే 108 కు కాల్ చేయండి లేదా సమీప అత్యవసర విభాగానికి వెళ్ళండి.',
  },
  homeTips: {
    en: [
      '💧 Drink plenty of water and stay hydrated.',
      '🛏️ Rest as much as possible.',
      '🌡️ Monitor your temperature every 4–6 hours.',
      '🍲 Eat light, easily digestible food.',
      '🚫 Avoid self-medication — no antibiotics without a doctor.',
      '📞 If symptoms worsen or persist beyond 48 hours, visit your nearest PHC.',
    ],
    hi: [
      '💧 खूब पानी पिएं और हाइड्रेटेड रहें।',
      '🛏️ जितना हो सके आराम करें।',
      '🌡️ हर 4–6 घंटे में तापमान जांचें।',
      '🍲 हल्का, आसानी से पचने वाला खाना खाएं।',
      '🚫 खुद दवाई न लें — डॉक्टर के बिना एंटीबायोटिक नहीं।',
      '📞 अगर लक्षण बिगड़ें या 48 घंटे से ज़्यादा रहें, तो नजदीकी PHC जाएं।',
    ],
    mr: [
      '💧 भरपूर पाणी प्या आणि हायड्रेटेड राहा.',
      '🛏️ शक्य तितकी विश्रांती घ्या.',
      '🌡️ दर 4–6 तासांनी तापमान तपासा.',
      '🍲 हलके, सहज पचणारे अन्न खा.',
      '🚫 स्वतः औषध घेऊ नका — डॉक्टरांशिवाय प्रतिजैविक नाही.',
      '📞 लक्षणे बिघडल्यास किंवा 48 तासांपेक्षा जास्त राहिल्यास जवळच्या PHC ला जा.',
    ],
    ta: [
      '💧 நிறைய தண்ணீர் குடிங்கள்.',
      '🛏️ முடிந்தவரை ஓய்வெடுங்கள்.',
      '🌡️ ஒவ்வொரு 4–6 மணி நேரத்திற்கும் வெப்பநிலை சரிபாருங்கள்.',
      '🍲 எளிதில் செரிக்கக்கூடிய உணவு சாப்பிடுங்கள்.',
      '🚫 சுய மருத்துவம் வேண்டாம் — மருத்துவர் இல்லாமல் நுண்ணுயிர் எதிர்ப்பிகள் வேண்டாம்.',
      '📞 அறிகுறிகள் மோசமானால் அல்லது 48 மணி நேரத்திற்கு மேல் நீடித்தால் PHC செல்லுங்கள்.',
    ],
    te: [
      '💧 చాలా నీళ్ళు తాగండి.',
      '🛏️ వీలైనంత విశ్రాంతి తీసుకోండి.',
      '🌡️ ప్రతి 4–6 గంటలకు ఉష్ణోగ్రత తనిఖీ చేయండి.',
      '🍲 తేలికగా జీర్ణమయ్యే ఆహారం తినండి.',
      '🚫 స్వయంగా మందులు వాడకండి — డాక్టర్ లేకుండా యాంటీబయాటిక్స్ వద్దు.',
      '📞 లక్షణాలు మరింత తీవ్రమైతే లేదా 48 గంటలకు మించి కొనసాగితే సమీప PHC కి వెళ్ళండి.',
    ],
  },
  bookConfirm: {
    en: '✅ Appointment confirmed!',
    hi: '✅ अपॉइंटमेंट की पुष्टि हो गई!',
    mr: '✅ अपॉइंटमेंट निश्चित झाली!',
    ta: '✅ சந்திப்பு உறுதிப்படுத்தப்பட்டது!',
    te: '✅ అపాయింట్‌మెంట్ నిర్ధారించబడింది!',
  },
  slotUnavailable: {
    en: 'This slot is no longer available. Please choose another.',
    hi: 'यह स्लॉट अब उपलब्ध नहीं है। कृपया दूसरा चुनें।',
    mr: 'हा स्लॉट आता उपलब्ध नाही. कृपया दुसरा निवडा.',
    ta: 'இந்த நேர இடம் இனி கிடைக்கவில்லை. வேறொன்றை தேர்ந்தெடுங்கள்.',
    te: 'ఈ స్లాట్ ఇకపై అందుబాటులో లేదు. దయచేసి మరొకటి ఎంచుకోండి.',
  },
  noDoctors: {
    en: 'No doctors found for this facility type.',
    hi: 'इस सुविधा प्रकार के लिए कोई डॉक्टर नहीं मिला।',
    mr: 'या सुविधा प्रकारासाठी कोणताही डॉक्टर सापडला नाही.',
    ta: 'இந்த வசதி வகைக்கு மருத்துவர்கள் கிடைக்கவில்லை.',
    te: 'ఈ సౌకర్య రకానికి వైద్యులు కనుగొనబడలేదు.',
  },
  noSlots: {
    en: 'No available slots found for this doctor. Please try another date.',
    hi: 'इस डॉक्टर के लिए कोई उपलब्ध स्लॉट नहीं मिला। कृपया दूसरी तारीख आज़माएं।',
    mr: 'या डॉक्टरसाठी कोणताही उपलब्ध स्लॉट सापडला नाही. कृपया दुसरी तारीख वापरा.',
    ta: 'இந்த மருத்துவருக்கு கிடைக்கக்கூடிய நேர இடங்கள் இல்லை. வேறு தேதி முயற்சிக்கவும்.',
    te: 'ఈ వైద్యుడికి అందుబాటులో ఉన్న స్లాట్‌లు కనుగొనబడలేదు. దయచేసి మరొక తేదీ ప్రయత్నించండి.',
  },
  facilitiesFound: {
    en: '📍 Here are the nearest facilities:',
    hi: '📍 यहाँ नजदीकी सुविधाएं हैं:',
    mr: '📍 येथे जवळची केंद्रे आहेत:',
    ta: '📍 இங்கே அருகிலுள்ள மையங்கள் உள்ளன:',
    te: '📍 ఇక్కడ సమీప కేంద్రాలు ఉన్నాయి:',
  },
  doctorsFound: {
    en: '👨‍⚕️ Here are available doctors:',
    hi: '👨‍⚕️ यहाँ उपलब्ध डॉक्टर हैं:',
    mr: '👨‍⚕️ येथे उपलब्ध डॉक्टर आहेत:',
    ta: '👨‍⚕️ இங்கே கிடைக்கும் மருத்துவர்கள் உள்ளனர்:',
    te: '👨‍⚕️ ఇక్కడ అందుబాటులో ఉన్న వైద్యులు ఉన్నారు:',
  },
  slotsFound: {
    en: '🗓️ Here are available slots:',
    hi: '🗓️ यहाँ उपलब्ध स्लॉट हैं:',
    mr: '🗓️ येथे उपलब्ध स्लॉट आहेत:',
    ta: '🗓️ இங்கே கிடைக்கும் நேரங்கள் உள்ளன:',
    te: '🗓️ ఇక్కడ అందుబాటులో ఉన్న స్లాట్‌లు ఉన్నాయి:',
  },
  chooseDoctorBook: {
    en: '👨‍⚕️ Choose a doctor to book an appointment:',
    hi: '👨‍⚕️ अपॉइंटमेंट बुक करने के लिए डॉक्टर चुनें:',
    mr: '👨‍⚕️ भेट बुक करण्यासाठी डॉक्टर निवडा:',
    ta: '👨‍⚕️ சந்திப்பு பதிவு செய்ய மருத்துவரை தேர்ந்தெடுங்கள்:',
    te: '👨‍⚕️ అపాయింట్‌మెంట్ బుక్ చేయడానికి వైద్యుడిని ఎంచుకోండి:',
  },
};

function t(key, lang) {
  const l = VALID_LANGS.has(lang) ? lang : 'en';
  const val = L[key];
  if (!val) return key;
  return val[l] || val.en;
}

// ── DB helpers ─────────────────────────────────────────────────────────────
function getFacilitiesFromDB(db, careLevel, location, language) {
  const lang = VALID_LANGS.has(language) ? language : 'en';
  const nameCol = `name_${lang}`;
  const addrCol = `address_${lang}`;
  const typeMap = {
    HOME: [], PHC: ['PHC'], CHC: ['CHC', 'PHC'],
    DISTRICT_HOSPITAL: ['DISTRICT_HOSPITAL', 'CHC'], EMERGENCY: ['DISTRICT_HOSPITAL'],
  };
  const types = typeMap[careLevel] || ['PHC'];
  if (types.length === 0) return [];

  try {
    const ph = types.map(() => '?').join(',');
    let q = `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
                    COALESCE(${addrCol}, address_en) as address, phone, distance_km
             FROM facilities WHERE type IN (${ph}) AND active=1`;
    const params = [...types];
    if (location) {
      q += ` AND (district LIKE ? OR COALESCE(${addrCol}, address_en) LIKE ?)`;
      params.push(`%${location}%`, `%${location}%`);
    }
    q += ' ORDER BY distance_km ASC LIMIT 3';
    let rows = db.prepare(q).all(...params);
    if (rows.length === 0 && location) {
      rows = db.prepare(
        `SELECT id, COALESCE(${nameCol}, name_en) as name, type, district,
                COALESCE(${addrCol}, address_en) as address, phone, distance_km
         FROM facilities WHERE type IN (${ph}) AND active=1 ORDER BY distance_km ASC LIMIT 3`
      ).all(...types);
    }
    return rows.map(r => ({
      id: r.id, type: r.type, name: r.name, distanceKm: r.distance_km,
      address: r.address, phone: r.phone, district: r.district,
      hours: r.type === 'DISTRICT_HOSPITAL' ? '24 hours' : '9am – 5pm',
    }));
  } catch { return []; }
}

function getDoctorsFromDB(db, facilityType, language) {
  const lang = VALID_LANGS.has(language) ? language : 'en';
  try {
    const rows = db.prepare(
      `SELECT * FROM doctors WHERE active=1 AND facility_type=? ORDER BY rating DESC LIMIT 5`
    ).all(facilityType || 'PHC');
    return rows.map(r => ({
      id: r.id,
      name: r[`name_${lang}`] || r.name_en,
      specialization: r[`specialization_${lang}`] || r.specialization_en,
      facilityType: r.facility_type,
      rating: r.rating,
      experienceYears: r.experience_years,
    }));
  } catch { return []; }
}

function getSlotsFromDB(db, doctorId, date) {
  try {
    let q = 'SELECT * FROM slots WHERE doctor_id=? AND is_available=1';
    const params = [doctorId];
    if (date) { q += ' AND slot_date=?'; params.push(date); }
    q += ' ORDER BY slot_date, slot_time LIMIT 12';
    return db.prepare(q).all(...params);
  } catch { return []; }
}

function saveSessionMemory(db, sid, fields) {
  if (!sid) return;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(fields), sid];
  try {
    db.prepare(`UPDATE sessions SET ${sets}, last_active = datetime('now') WHERE id = ?`).run(...vals);
  } catch { /* ignore */ }
}

// POST /api/chat/action
router.post('/', (req, res) => {
  const { sessionId, actionId, payload = {}, language = 'en' } = req.body;
  const lang = VALID_LANGS.has(language) ? language : 'en';

  if (!actionId) return res.status(400).json({ error: 'actionId is required' });

  const db = getDb();
  const session = sessionId ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) : null;

  const careLevel  = payload.careLevel  || session?.last_care_level  || 'PHC';
  const location   = payload.locationText || payload.pincode || session?.last_known_location_text || session?.last_user_location || null;
  const facilityType = payload.facilityType || careLevel;

  switch (actionId) {

    case 'CALL_108': {
      return res.json({
        actionId,
        intent: 'EMERGENCY',
        reply: t('emergency', lang),
        emergency: { number: '108', message: t('emergency', lang) },
        facilities: [],
        doctors: [],
        slots: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'ASK_LOCATION': {
      if (sessionId) saveSessionMemory(db, sessionId, { last_intent: 'ASK_LOCATION' });
      return res.json({
        actionId,
        intent: 'ASK_LOCATION',
        reply: t('askLocation', lang),
        nextStep: 'ASK_LOCATION',
        facilities: [],
        doctors: [],
        slots: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'FIND_FACILITY': {
      if (!location) {
        if (sessionId) saveSessionMemory(db, sessionId, { last_intent: 'ASK_LOCATION' });
        return res.json({
          actionId,
          intent: 'ASK_LOCATION',
          reply: t('askLocation', lang),
          nextStep: 'ASK_LOCATION',
          facilities: [],
          doctors: [],
          slots: [],
          booking: null,
          meta: { llmUsed: false, fallbackUsed: false },
        });
      }
      const facilities = getFacilitiesFromDB(db, careLevel, location, lang);
      if (sessionId) saveSessionMemory(db, sessionId, {
        last_intent: 'FACILITY_SEARCH',
        last_facility_type: careLevel,
        last_user_location: location,
        last_facility_results: JSON.stringify(facilities.map(f => f.id)),
      });
      const reply = facilities.length > 0
        ? t('facilitiesFound', lang)
        : t('noFacilities', lang);
      return res.json({
        actionId,
        intent: 'FACILITY_SEARCH',
        reply,
        facilities,
        doctors: [],
        slots: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'SHOW_DOCTORS': {
      const doctors = getDoctorsFromDB(db, facilityType, lang);
      const reply = doctors.length > 0
        ? t('doctorsFound', lang)
        : t('noDoctors', lang);
      if (sessionId && doctors.length > 0) {
        saveSessionMemory(db, sessionId, { last_intent: 'SHOW_DOCTORS', last_facility_type: facilityType });
      }
      return res.json({
        actionId,
        intent: 'SHOW_DOCTORS',
        reply,
        facilities: [],
        doctors,
        slots: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'SHOW_SLOTS': {
      const doctorId = payload.doctorId || session?.last_doctor_id;
      if (!doctorId) {
        return res.status(400).json({ error: 'doctorId is required for SHOW_SLOTS' });
      }
      const date = payload.date || null;
      const slots = getSlotsFromDB(db, doctorId, date);
      const reply = slots.length > 0
        ? t('slotsFound', lang)
        : t('noSlots', lang);
      if (sessionId) saveSessionMemory(db, sessionId, { last_intent: 'SHOW_SLOTS', last_doctor_id: doctorId });
      return res.json({
        actionId,
        intent: 'SHOW_SLOTS',
        reply,
        facilities: [],
        doctors: [],
        slots,
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'BOOK_APPOINTMENT': {
      const doctorId = payload.doctorId || session?.last_doctor_id;
      const slotId   = payload.slotId;
      if (!doctorId || !slotId) {
        // No slot chosen yet — show doctors first
        const doctors = getDoctorsFromDB(db, facilityType, lang);
        return res.json({
          actionId,
          intent: 'SHOW_DOCTORS',
          reply: doctors.length > 0 ? t('chooseDoctorBook', lang) : t('noDoctors', lang),
          facilities: [],
          doctors,
          slots: [],
          booking: null,
          meta: { llmUsed: false, fallbackUsed: false },
        });
      }

      const slot = db.prepare('SELECT * FROM slots WHERE id=? AND is_available=1').get(slotId);
      if (!slot) {
        return res.status(409).json({ error: t('slotUnavailable', lang) });
      }
      const doctor = db.prepare('SELECT * FROM doctors WHERE id=?').get(doctorId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const txn = db.transaction(() => {
        db.prepare('UPDATE slots SET is_available=0 WHERE id=?').run(slotId);
        return db.prepare(
          'INSERT INTO appointments (session_id, doctor_id, slot_id, patient_alias, reason, language) VALUES (?,?,?,?,?,?)'
        ).run(sessionId || null, doctorId, slotId, 'USER', payload.reason || '', lang).lastInsertRowid;
      });
      const appointmentId = txn();

      if (sessionId) saveSessionMemory(db, sessionId, { last_intent: 'BOOK_APPOINTMENT' });

      const booking = {
        appointmentId,
        status: 'CONFIRMED',
        doctor: { id: doctor.id, name: doctor[`name_${lang}`] || doctor.name_en, specialization: doctor[`specialization_${lang}`] || doctor.specialization_en },
        slot: { id: slot.id, date: slot.slot_date, time: slot.slot_time },
      };

      return res.json({
        actionId,
        intent: 'BOOK_APPOINTMENT',
        reply: t('bookConfirm', lang),
        facilities: [],
        doctors: [],
        slots: [],
        booking,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    case 'HOME_TIPS': {
      const tips = t('homeTips', lang);
      return res.json({
        actionId,
        intent: 'HOME_TIPS',
        reply: Array.isArray(tips) ? tips.join('\n') : tips,
        homeTips: Array.isArray(tips) ? tips : [tips],
        facilities: [],
        doctors: [],
        slots: [],
        booking: null,
        meta: { llmUsed: false, fallbackUsed: false },
      });
    }

    default:
      return res.status(400).json({ error: `Unknown actionId: ${actionId}` });
  }
});

module.exports = router;
