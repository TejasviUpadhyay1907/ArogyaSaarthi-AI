const { Router } = require('express');
const router = Router();

// GET /api/demo — sample phrases for quick judge testing
router.get('/', (req, res) => {
  res.json({
    description: 'Sample test phrases in 5 languages for quick demo testing',
    phrases: [
      { lang: 'en', text: 'I have chest pain and difficulty breathing', expected: 'HIGH/EMERGENCY' },
      { lang: 'en', text: 'I have had fever for 3 days with headache', expected: 'MEDIUM/PHC' },
      { lang: 'en', text: 'Mild cough since yesterday, no other symptoms', expected: 'LOW/HOME' },
      { lang: 'en', text: 'Severe stomach pain and vomiting since 2 days', expected: 'MEDIUM-HIGH' },
      { lang: 'en', text: 'I fainted and had a seizure', expected: 'HIGH/EMERGENCY' },
      { lang: 'hi', text: 'मेरी छाती में दर्द है और सांस लेने में तकलीफ है', expected: 'HIGH/EMERGENCY' },
      { lang: 'hi', text: '2 दिन से बुखार है और सिरदर्द भी है', expected: 'MEDIUM/PHC' },
      { lang: 'hi', text: 'हल्की खांसी है कल से, और कोई तकलीफ नहीं', expected: 'LOW/HOME' },
      { lang: 'hi', text: 'बहुत तेज पेट दर्द और उल्टी हो रही है', expected: 'MEDIUM-HIGH' },
      { lang: 'hi', text: 'बेहोश हो गया था और दौरा पड़ा', expected: 'HIGH/EMERGENCY' },
      { lang: 'mr', text: 'छातीत दुखतेय आणि श्वास घेण्यास त्रास होतोय', expected: 'HIGH/EMERGENCY' },
      { lang: 'mr', text: '3 दिवसांपासून ताप आहे आणि डोकेदुखी', expected: 'MEDIUM/PHC' },
      { lang: 'mr', text: 'थोडा खोकला आहे कालपासून', expected: 'LOW/HOME' },
      { lang: 'ta', text: 'நெஞ்சு வலி மற்றும் மூச்சு திணறல் உள்ளது', expected: 'HIGH/EMERGENCY' },
      { lang: 'ta', text: '2 நாட்களாக காய்ச்சல் மற்றும் தலைவலி', expected: 'MEDIUM/PHC' },
      { lang: 'ta', text: 'லேசான இருமல் நேற்றிலிருந்து', expected: 'LOW/HOME' },
      { lang: 'te', text: 'ఛాతీ నొప్పి మరియు ఊపిరి ఆడటం కష్టం', expected: 'HIGH/EMERGENCY' },
      { lang: 'te', text: '2 రోజులుగా జ్వరం మరియు తలనొప్పి', expected: 'MEDIUM/PHC' },
      { lang: 'te', text: 'కొంచెం దగ్గు నిన్న నుండి', expected: 'LOW/HOME' },
      { lang: 'en', text: 'Snake bite on my leg', expected: 'HIGH/EMERGENCY' },
    ],
  });
});

module.exports = router;
