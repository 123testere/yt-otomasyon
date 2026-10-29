import fs from 'node:fs';
import { google } from 'googleapis';
import { nicheOf } from '../lib/options.js';

export class QuotaError extends Error {}
export class AuthError extends Error {}

export function oauthClient() {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET } = process.env;
  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) throw new Error('YT_CLIENT_ID / YT_CLIENT_SECRET tanımlı değil');
  return new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
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

export async function upload({ refreshToken, job, settings, videoPath, thumbnailPath }) {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: refreshToken });
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
  const description = [job.description.trim(), hashtags].filter(Boolean).join('\n\n');

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
