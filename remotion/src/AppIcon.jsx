// Uygulama ikonu: kırmızı yuvarlak "oynat" düğmesi ve etrafında altın otomasyon döngüsü oku.
// variant: full (zeminli ikon), foreground (Android uyarlanabilir ikon ön katmanı, şeffaf),
// background (sadece zemin), mono (tek renk siluet), splash (açılış ekranı, şeffaf).
import { AbsoluteFill } from 'remotion';

const RED = '#FF5A5F';
const GOLD = '#FFD23F';

function Symbol({ mono }) {
  const red = mono ? '#fff' : RED;
  const gold = mono ? '#fff' : GOLD;
  const tri = mono ? '#000' : '#fff';
  return (
    <svg viewBox="0 0 1000 1000" width="100%" height="100%">
      <defs>
        <linearGradient id="r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mono ? '#fff' : '#FF7A7E'} />
          <stop offset="1" stopColor={red} />
        </linearGradient>
      </defs>
      {/* Döngü oku: üç çeyrek yay ve ok başı */}
      <path d="M 500 120 A 380 380 0 1 1 131 590" fill="none" stroke={gold} strokeWidth="64" strokeLinecap="round" />
      <path d="M 70 560 L 131 690 L 230 590 Z" fill={gold} stroke={gold} strokeWidth="24" strokeLinejoin="round" />
      <circle cx="500" cy="500" r="265" fill="url(#r)" />
      <path d="M 435 385 L 625 500 L 435 615 Z" fill={tri} stroke={tri} strokeWidth="36" strokeLinejoin="round" />
    </svg>
  );
}

export function AppIcon({ variant = 'full' }) {
  const bg = 'radial-gradient(circle at 50% 35%, #2A3044 0%, #0E1015 75%)';
  if (variant === 'background') return <AbsoluteFill style={{ background: bg }} />;
  // Android ön katmanında güvenli alan ortadaki ~%66; sembol buna sığacak şekilde küçültülür.
  const scale = { full: 0.82, foreground: 0.6, mono: 0.6, splash: 0.9 }[variant] ?? 0.82;
  return (
    <AbsoluteFill style={{ background: variant === 'full' ? bg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: `${scale * 100}%`, height: `${scale * 100}%` }}>
        <Symbol mono={variant === 'mono'} />
      </div>
    </AbsoluteFill>
  );
}
