// Tiny sharing helpers for plain <script> pages (the Preact islands use components/ui/QR.tsx).
export function whatsappText(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
