import QRCode from 'qrcode';
import { useEffect, useState } from 'preact/hooks';

export function QR({ text, size = 180, class: cls = '' }: { text: string; size?: number; class?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: '#1e1b4b', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(''));
  }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt="Código QR" class={cls} /> : <div style={{ width: size, height: size }} class={`animate-pulse rounded-xl bg-slate-100 ${cls}`} />;
}

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
