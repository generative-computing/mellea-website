'use client';

import { useEffect } from 'react';
import { assetUrl } from '@/lib/assetUrl';

export default function LandingScripts() {
  useEffect(() => {
    const src = assetUrl('/js/main.js');
    // Inject the module once; on later mounts it's already loaded, so just
    // signal a fresh mount (drives setup/teardown in main.js).
    if (!document.querySelector('script[data-mellea-main]')) {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      s.dataset.melleaMain = '';
      document.body.appendChild(s);
    } else {
      window.dispatchEvent(new Event('mellea:landing-mount'));
    }
    return () => {
      window.dispatchEvent(new Event('mellea:landing-unmount'));
    };
  }, []);

  return null;
}
