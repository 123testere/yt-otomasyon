import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../../..');
export const QUEUE_DIR = path.join(ROOT, 'queue');
export const DONE_DIR = path.join(ROOT, 'done');
export const FAILED_DIR = path.join(ROOT, 'failed');
export const CONFIG_DIR = path.join(ROOT, 'config');
export const MUSIC_DIR = path.join(ROOT, 'assets', 'music');
export const SECRETS_DIR = path.join(ROOT, 'secrets');
export const PY_DIR = path.resolve(import.meta.dirname, '../../py');
