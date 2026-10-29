import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import { SECRETS_DIR } from './paths.js';

let initialized = false;

// GitHub Actions'ta FIREBASE_SERVICE_ACCOUNT (JSON metni), bilgisayarda secrets/service-account.json kullanılır.
function credentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const file = path.join(SECRETS_DIR, 'service-account.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw new Error('Firebase servis hesabı bulunamadı: FIREBASE_SERVICE_ACCOUNT ortam değişkeni veya secrets/service-account.json gerekli.');
}

function init() {
  if (initialized) return;
  admin.initializeApp({ credential: admin.credential.cert(credentials()) });
  initialized = true;
}

export function db() {
  init();
  return admin.firestore();
}

export function auth() {
  init();
  return admin.auth();
}

export const FieldValue = admin.firestore.FieldValue;
