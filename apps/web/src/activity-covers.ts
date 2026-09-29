type ActivityKind = 'event' | 'idea';

export const eventCoverGallery = [
  { src: '/covers/event-ribbon.jpg', tone: 'teal' },
  { src: '/covers/event-chrome.jpg', tone: 'plum' },
  { src: '/covers/event-glass.jpg', tone: 'slate' },
  { src: '/covers/project-paper.jpg', tone: 'blue' },
  { src: '/covers/project-amber.jpg', tone: 'amber' },
  { src: '/covers/project-structure.jpg', tone: 'graphite' },
] as const;

const covers = {
  event: eventCoverGallery,
  idea: [eventCoverGallery[2], eventCoverGallery[0], eventCoverGallery[4], eventCoverGallery[5], eventCoverGallery[1], eventCoverGallery[3]],
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
  if (!event.coverUrl) return activityCover('event', event.title);
  return eventCoverGallery.find(cover => cover.src === event.coverUrl) ?? { src: event.coverUrl, tone: 'slate' as const };
}
