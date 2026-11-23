// Master v4: YouTube API'sinde olmayan, Studio'dan elle yapılan işler (U1 A/B testi, U7 bitiş ekranı, S4 ilgili video).
// Video en az 24 saat sonrasına zamanlanmış yüklenir; bu paket Firestore'a yazılır ve telefona bildirim gider.
// Kapak dosyaları depo sürümüne (herkese açık) konur ki telefondan indirilip Studio'ya yüklenebilsin.
import fs from 'node:fs';
import path from 'node:path';
import { run } from './util.js';

const SURUM = 'studio-kapaklar';

async function depo() {
  return process.env.GITHUB_REPOSITORY || (await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])).trim();
}

export async function kapaklariYayinla(jobId, dosyalar) {
  await run('gh', ['release', 'view', SURUM]).catch(() =>
    run('gh', ['release', 'create', SURUM, '--title', 'Studio A/B kapakları', '--notes', 'Master v4 U1: Studio "Test ve karşılaştır" için 3 kapak (otomatik).']));
  const repo = await depo();
  const urls = [];
  for (const [i, f] of dosyalar.entries()) {
    if (!f || !fs.existsSync(f)) continue;
    const ad = `${jobId}-${'ABC'[i]}.jpg`;
    const hedef = path.join(path.dirname(f), ad);
    if (hedef !== f) fs.copyFileSync(f, hedef);
    await run('gh', ['release', 'upload', SURUM, hedef, '--clobber']);
    urls.push(`https://github.com/${repo}/releases/download/${SURUM}/${ad}`);
  }
  return urls;
}

// Görev listesi (telefon bildirimi ve uygulama için)
export function studioGorevleri({ job, url, kapaklar, ilgiliUrl, yayinSaati }) {
  const g = [];
  if (job.type === 'long') {
    g.push(`U1 A/B testi: Studio → video → "Test ve karşılaştır" → 3 başlık + 3 kapak (kazananı izleme süresi belirler; test sürerken değiştirme). Başlıklar: ${(job.basliklar ?? []).map((b, i) => `${'ABC'[i]}) ${b}`).join(' | ')}`);
    if (kapaklar?.length) g.push(`Kapaklar: ${kapaklar.join(' , ')}`);
    g.push('U7 bitiş ekranı: son 5–20 sn\'ye ilgili video ya da oynatma listesi ekle (o alan boş bırakıldı).');
  } else {
    g.push(`S4 ilgili video: Studio → Shorts → "İlgili video" → ${ilgiliUrl ?? job.ilgiliVideo}`);
  }
  g.push(`Yayın: ${yayinSaati} — bu işler o saatten önce yapılmalı (${url}).`);
  return g;
}
