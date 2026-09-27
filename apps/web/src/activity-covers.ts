type ActivityKind = 'event' | 'project' | 'idea';

const gallery = [
  { src: '/covers/event-ribbon.jpg', tone: 'teal' },
  { src: '/covers/event-chrome.jpg', tone: 'plum' },
  { src: '/covers/event-glass.jpg', tone: 'slate' },
  { src: '/covers/project-paper.jpg', tone: 'blue' },
  { src: '/covers/project-amber.jpg', tone: 'amber' },
  { src: '/covers/project-structure.jpg', tone: 'graphite' },
] as const;

const covers = {
  event: gallery,
  project: [gallery[3], gallery[4], gallery[5], gallery[0], gallery[1], gallery[2]],
  idea: [gallery[2], gallery[0], gallery[4], gallery[5], gallery[1], gallery[3]],
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
