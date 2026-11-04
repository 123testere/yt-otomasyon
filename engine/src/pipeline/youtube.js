import fs from 'node:fs';
import { google } from 'googleapis';
import { nicheOf } from '../lib/options.js';

export class QuotaError extends Error {}
export class AuthError extends Error {}

// "desktop": bilgisayardan bağlanan kanallar (connect-channel.js). "tv": uygulamadan cihaz koduyla bağlananlar.
export function oauthClient(kind = 'desktop') {
  const [id, secret] = kind === 'tv'
    ? [process.env.YT_TV_CLIENT_ID, process.env.YT_TV_CLIENT_SECRET]
    : [process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET];
  if (!id || !secret) throw new Error(`${kind === 'tv' ? 'YT_TV_CLIENT_ID / YT_TV_CLIENT_SECRET' : 'YT_CLIENT_ID / YT_CLIENT_SECRET'} tanımlı değil`);
  return new google.auth.OAuth2(id, secret);
}

// secrets/{kanal} kaydından yetkili istemci.
export function authFor(secret) {
  const auth = oauthClient(secret.client);
  auth.setCredentials({ refresh_token: secret.refreshToken });
  return auth;
}

function classify(e) {
  const reason = e?.errors?.[0]?.reason ?? e?.response?.data?.error?.errors?.[0]?.reason;
  if (['quotaExceeded', 'uploadLimitExceeded', 'rateLimitExceeded'].includes(reason)) {
    return new QuotaError(`YouTube kotası doldu (${reason})`);
  }
  if (e?.response?.data?.error === 'invalid_grant' || /invalid_grant/.test(e?.message ?? '')) {
    return new AuthError('Kanal izni geçersiz; kanalı yeniden bağlamak gerekiyor');
  }
  return e;
}

const MAX_DESCRIPTION = 4900;

// Lisans gereği kaynak gösterilmesi gereken görseller açıklamanın sonuna eklenir (YouTube sınırını aşmadan).
function withCredits(description, credits, language) {
  if (!credits?.length) return description;
  const heading = { tr: 'Müzik ve görsel kaynakları', de: 'Quellen' }[language] ?? 'Sources and credits';
  let text = `${description}\n\n${heading}:`;
  for (const line of credits) {
    if (text.length + line.length + 3 > MAX_DESCRIPTION) break;
    text += `\n• ${line}`;
  }
  return text.replace(/[<>]/g, '');
}

export async function upload({ secret, job, settings, videoPath, thumbnailPath, credits }) {
  const auth = authFor(secret);
  const yt = google.youtube({ version: 'v3', auth });

  const niche = nicheOf(settings);
  const publishAt = new Date(job.publishAt);
  const future = publishAt.getTime() - Date.now() > 5 * 60 * 1000;
  const status = {
    privacyStatus: settings.privacy,
    selfDeclaredMadeForKids: Boolean(niche.madeForKids),
    containsSyntheticMedia: Boolean(settings.aiDisclosure),
  };
  // Herkese açık + ileri tarih → YouTube'un kendi zamanlayıcısıyla yayınlanır.
  if (settings.privacy === 'public' && future) {
    status.privacyStatus = 'private';
    status.publishAt = publishAt.toISOString();
  }

  const hashtags = [settings.hashtags?.trim(), job.type === 'short' ? '#shorts' : ''].filter(Boolean).join(' ');
  const description = withCredits([job.description.trim(), hashtags].filter(Boolean).join('\n\n'), credits, settings.language);

  let videoId;
  try {
    const res = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: job.title.trim(),
          description,
          tags: job.tags,
          categoryId: niche.categoryId,
          defaultLanguage: settings.language,
          defaultAudioLanguage: settings.language,
        },
        status,
      },
      media: { body: fs.createReadStream(videoPath) },
    });
    videoId = res.data.id;
  } catch (e) {
    throw classify(e);
  }

  let thumbnailWarning = null;
  if (thumbnailPath) {
    try {
      await yt.thumbnails.set({ videoId, media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbnailPath) } });
    } catch (e) {
      // Kanal telefonla doğrulanmamışsa özel küçük resim yüklenemez; video yine de yayında kalır.
      thumbnailWarning = `Küçük resim yüklenemedi: ${e.message}`;
    }
  }
  return { videoId, url: `https://youtu.be/${videoId}`, scheduled: Boolean(status.publishAt), thumbnailWarning };
}
