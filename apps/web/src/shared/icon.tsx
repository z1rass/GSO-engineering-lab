import type { ReactNode } from 'react';

export type IconName = 'home' | 'calendar' | 'event' | 'project' | 'idea' | 'season' | 'user' | 'plus' | 'arrow-left' | 'arrow-right' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'clock' | 'pin' | 'check' | 'compass' | 'people' | 'settings' | 'link' | 'spark' | 'list' | 'close';

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/></>,
  event: <><path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"/><path d="M12 5v2M12 10v4M12 17v2" strokeDasharray="2 2"/></>,
  project: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M9 5V3h6v2"/></>,
  idea: <><path d="M9 18h6M10 21h4M8.5 15.5C7 14.4 6 12.8 6 10.5a6 6 0 1 1 12 0c0 2.3-1 3.9-2.5 5l-.5 2.5h-6l-.5-2.5Z"/></>,
  season: <><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6c3 2 9 2 12 0M6 18c3-2 9-2 12 0"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  'arrow-left': <><path d="m12 5-7 7 7 7M5 12h14"/></>,
  'arrow-right': <><path d="m12 5 7 7-7 7M19 12H5"/></>,
  'chevron-left': <path d="m15 5-7 7 7 7"/>,
  'chevron-right': <path d="m9 5 7 7-7 7"/>,
  'chevron-down': <path d="m5 9 7 7 7-7"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1h-3"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="var(--paper)"/><circle cx="16" cy="17" r="2" fill="var(--paper)"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1-1"/></>,
  spark: <path d="m12 2 1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8L12 2Z"/>,
  list: <><path d="M9 6h12M9 12h12M9 18h12M3 6h2M3 12h2M3 18h2"/></>,
  close: <path d="M5 5 19 19M19 5 5 19"/>,
};

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
