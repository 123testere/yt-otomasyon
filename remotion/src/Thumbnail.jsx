import { AbsoluteFill, Img, staticFile } from 'remotion';
import { display } from './fonts.js';

// Kanıtlanmış kapak düzeni: solda 2-4 kelimelik dev yazı, sağda yüz, yüksek kontrast, koyu geçiş.
// Anton harfleri yaklaşık 0,48 em genişliğinde; en uzun satır alanı dolduracak kadar büyütülür.
function fitSize(text, available, lineCount) {
  const longest = Math.max(...text.split('\n').map((l) => l.length), 4);
  const byWidth = available / (longest * 0.48);
  const byHeight = 600 / lineCount;
  return Math.floor(Math.max(100, Math.min(260, byWidth, byHeight)));
}

function wrap(text, maxChars = 9, maxLines = 3) {
  const lines = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines).join('\n');
}

export function Thumbnail({ background, text, badge, lang, accent }) {
  const content = wrap(text.toLocaleUpperCase(lang));
  const lines = content.split('\n');
  const available = 1280 - 56 - (badge ? 470 : 56);
  return (
    <AbsoluteFill style={{ backgroundColor: '#111' }}>
      {background ? (
        <Img src={staticFile(background)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05)', filter: 'saturate(1.25) contrast(1.1)' }} />
      ) : null}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 75%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 56, paddingRight: badge ? 470 : 56 }}>
        <div style={{ width: 120, height: 14, backgroundColor: accent, marginBottom: 22, borderRadius: 7 }} />
        <div style={{
          fontFamily: display, fontSize: fitSize(content, available, lines.length), lineHeight: 1.0, color: '#fff',
          WebkitTextStroke: '9px #000', paintOrder: 'stroke fill', textShadow: '0 10px 30px rgba(0,0,0,0.8)',
        }}>
          {lines.map((line, i) => {
            // Son satır vurgu kutusunda: en vurucu kelime tek bakışta okunur.
            const last = i === lines.length - 1 && lines.length > 1;
            return (
              <div key={i} style={last ? {
                display: 'inline-block', color: '#111', backgroundColor: accent, WebkitTextStroke: '0',
                padding: '0 18px 6px', marginTop: 10, borderRadius: 12, transform: 'rotate(-2deg)', textShadow: 'none',
              } : { color: '#fff' }}>{line}</div>
            );
          })}
        </div>
      </AbsoluteFill>
      {badge ? (
        <Img src={staticFile(badge)} style={{
          position: 'absolute', right: 40, top: 130, width: 440, height: 440,
          filter: `drop-shadow(0 0 30px ${accent}aa) drop-shadow(0 16px 30px rgba(0,0,0,0.7))`,
        }} />
      ) : null}
    </AbsoluteFill>
  );
}
