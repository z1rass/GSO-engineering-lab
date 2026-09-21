import { sql } from 'drizzle-orm';
import { check, date, integer, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const seasonStatus = pgEnum('season_status', ['DRAFT', 'UPCOMING', 'ACTIVE', 'FINISHED', 'ARCHIVED']);

export const seasons = pgTable('seasons', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  number: integer('number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  status: seasonStatus('status').notNull().default('DRAFT'),
}, (table) => [
  uniqueIndex('one_active_season').on(table.status).where(sql`${table.status} = 'ACTIVE'`),
  check('season_dates_ordered', sql`${table.endsOn} >= ${table.startsOn}`),
  check('season_number_nonnegative', sql`${table.number} >= 0`),
]);
