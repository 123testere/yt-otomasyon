// Uygulamadaki kanal kurulum isteklerini YouTube'a uygular (senkronizasyon bekleyen istek bulunca çalıştırır).
import { db } from './lib/firebase.js';
import { applyPendingSetups } from './lib/setup.js';

await applyPendingSetups(db());
process.exit(0);
