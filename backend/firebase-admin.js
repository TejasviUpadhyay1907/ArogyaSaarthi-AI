/**
 * Firebase Admin SDK singleton for ArogyaSaarthi AI backend.
 * Reads service account from FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string)
 * OR from FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file).
 * Falls back to Application Default Credentials if neither is set.
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Preferred: full JSON string in env (good for Docker / CI)
    try {
      // Replace literal \n sequences in private_key that dotenv may not unescape
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(raw);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      process.exit(1);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Alternative: path to JSON file
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = admin.credential.cert(serviceAccount);
  } else {
    // Fallback: Application Default Credentials (works on GCP / Cloud Run)
    console.warn('[FirebaseAdmin] No service account configured — using Application Default Credentials');
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  console.log('[FirebaseAdmin] Initialized for project:', process.env.FIREBASE_PROJECT_ID || '(from credentials)');
}

module.exports = admin;
