type ActivityKind = 'event' | 'idea';

export const eventCoverGallery = [
  { src: '/covers/event-ribbon.jpg', tone: 'teal' },
  { src: '/covers/event-chrome.jpg', tone: 'plum' },
  { src: '/covers/event-glass.jpg', tone: 'slate' },
  { src: '/covers/project-paper.jpg', tone: 'blue' },
  { src: '/covers/project-amber.jpg', tone: 'amber' },
  { src: '/covers/project-structure.jpg', tone: 'graphite' },
  { src: '/covers/cover-robotics.webp', tone: 'blue' },
  { src: '/covers/cover-circuit-riso.webp', tone: 'red' },
  { src: '/covers/cover-glass-loop.webp', tone: 'teal' },
  { src: '/covers/cover-ideas-paper.webp', tone: 'amber' },
] as const;

export type CoverTone = (typeof eventCoverGallery)[number]['tone'] | 'red';

export function uploadedCoverTone(image: HTMLImageElement): CoverTone {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 40;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 'graphite';
  try {
    context.drawImage(image, 0, 0, 40, 40);
    const pixels = context.getImageData(0, 0, 40, 40).data;
    const tones = ['red', 'amber', 'teal', 'slate', 'plum'] as const;
    const weights = new Array<number>(tones.length).fill(0);
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index]!; const green = pixels[index + 1]!; const blue = pixels[index + 2]!;
      const max = Math.max(red, green, blue); const min = Math.min(red, green, blue);
      const chroma = max - min;
      if (pixels[index + 3]! < 128 || max < 50 || chroma < 35 || chroma / max < .2) continue;
      const hue = (60 * (max === red ? (green - blue) / chroma : max === green ? (blue - red) / chroma + 2 : (red - green) / chroma + 4) + 360) % 360;
      const bucket = hue < 20 || hue >= 345 ? 0 : hue < 70 ? 1 : hue < 170 ? 2 : hue < 260 ? 3 : 4;
      weights[bucket]! += chroma * pixels[index + 3]! / 255;
    }
    const strongest = Math.max(...weights);
    return strongest ? tones[weights.indexOf(strongest)]! : 'graphite';
  } catch {
    return 'graphite';
  }
}

const covers = {
  event: eventCoverGallery,
  idea: [eventCoverGallery[9], eventCoverGallery[7], eventCoverGallery[2], eventCoverGallery[0], eventCoverGallery[4], eventCoverGallery[5], eventCoverGallery[8], eventCoverGallery[1], eventCoverGallery[3]],
} as const;

// A stable, locally chosen cover avoids flicker and needs no stored media or upload.
export function activityCover(kind: ActivityKind, title: string) {
  const key = title.trim().toLowerCase() || kind;
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const options = covers[kind];
  const mixed = Math.imul(hash ^ key.length, 0x9e3779b1);
  return options[(mixed >>> 0) % options.length]!;
}

export function eventCover(event: { title: string; coverUrl?: string | null }) {
  if (!event.coverUrl) return { ...activityCover('event', event.title), custom: false };
  const preset = eventCoverGallery.find(cover => cover.src === event.coverUrl);
  return preset ? { ...preset, custom: false } : { src: event.coverUrl, tone: 'graphite' as const, custom: true };
}
