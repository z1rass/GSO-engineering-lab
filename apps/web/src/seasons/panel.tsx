import { Link } from 'react-router-dom';
import { z } from 'zod';
import type { Language } from '../i18n';
import { useResource } from '../shared/use-resource';

const schema = z.object({ seasons: z.array(z.object({ id: z.number(), number: z.number(), title: z.string(), status: z.string() })) });
export function ActivitySeasons({ id, language }: { id: number; language: Language }) {
  const resource = useResource(`/api/activities/${id}/seasons`, schema);
  if (!resource.data?.seasons.length) return null;
  return <section className="activity-seasons" aria-label={language === 'de' ? 'Seasons' : 'Seasons'}><div className="season-history">{resource.data.seasons.map(season => <Link className="season-badge" key={season.id} to={`/seasons/${season.id}`}>Season {season.number}</Link>)}</div></section>;
}
