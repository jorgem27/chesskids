import { useEffect } from 'preact/hooks';
import { burst, cheer } from '../../lib/fx';
import { missionsText } from '../../lib/voice/phrases';
import { sfx } from '../../lib/sfx';

/** One-shot welcome celebration after login (?hola=1). */
export default function Welcome({ name, missions }: { name: string; missions: number }) {
  useEffect(() => {
    const t = setTimeout(() => {
      burst(0.5, 0.3, 1);
      sfx.coin();
      if (missions > 0) cheer('welcomeMissions', { name, missions: missionsText(missions) });
      else cheer('welcomeFree', { name });
      history.replaceState(null, '', '/app');
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
