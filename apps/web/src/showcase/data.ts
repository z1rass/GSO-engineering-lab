import { z } from 'zod';

export const eventSchema = z.object({
  id: z.number().int(), title: z.string(), description: z.string(),
  category: z.enum(['TALK', 'WORKSHOP', 'BUILD_NIGHT', 'STUDY_SESSION', 'HACKATHON', 'SOCIAL', 'OTHER']),
  plannedDate: z.string().nullable(), endDate: z.string().nullable(), startTime: z.string().nullable(), endTime: z.string().nullable(),
  generalLocation: z.string(), placeType: z.enum(['SCHOOL', 'ONLINE', 'OTHER']),
  status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  coverUrl: z.string().nullable(),
  ideaId: z.number().nullable(), materials: z.string(),
});
export const ideaSchema = z.object({
  id: z.number().int(), title: z.string(), description: z.string(),
  voteCount: z.number().int().nonnegative(), voted: z.boolean(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const eventsSchema = z.object({ events: z.array(eventSchema) });
export const ideasSchema = z.object({ ideas: z.array(ideaSchema) });
export const eventDetailSchema = z.object({ event: eventSchema });
export const ideaDetailSchema = z.object({ idea: ideaSchema });
export type Event = z.infer<typeof eventSchema>;
export type Idea = z.infer<typeof ideaSchema>;

export function eventDate(value: string, language: 'de' | 'en', options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { timeZone: 'UTC', ...options }).format(new Date(`${value}T12:00:00Z`));
}
export function ideaDate(value: string, language: 'de' | 'en') {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value));
}
export function eventIsPast(event: Event) {
  if (event.status === 'COMPLETED' || event.status === 'CANCELLED') return true;
  const lastDate = event.endDate ?? event.plannedDate;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: 'year' | 'month' | 'day') => parts.find(value => value.type === type)?.value ?? '';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return Boolean(lastDate && lastDate < today);
}
