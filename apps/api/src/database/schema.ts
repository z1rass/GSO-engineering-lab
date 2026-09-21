import { sql } from 'drizzle-orm';
import { bigint, boolean, timestamp, check, date, integer, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

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

export const globalRole = pgEnum('global_role', ['MEMBER', 'OPS']);

export const user = pgTable('users', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false), image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow(),
  role: globalRole('role').notNull().default('MEMBER'),
  affiliation: text('affiliation').notNull().default('MEMBER'),
  education: text('education'), year: integer('year'), interests: text('interests').array(),
});
export const session = pgTable('sessions', {
  id: text('id').primaryKey(), token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').notNull(), updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'),
});
export const account = pgTable('accounts', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'), refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'), password: text('password'), createdAt: timestamp('created_at').notNull(), updatedAt: timestamp('updated_at').notNull(),
});
export const verification = pgTable('verifications', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').notNull(), updatedAt: timestamp('updated_at').notNull(),
});
export const rateLimit = pgTable('rate_limits', {
  id: text('id').primaryKey(), key: text('key').notNull().unique(), count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const roleChanges = pgTable('role_changes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  targetId: text('target_id').references(() => user.id, { onDelete: 'set null' }),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  previousRole: globalRole('previous_role').notNull(), newRole: globalRole('new_role').notNull(),
  source: text('source').notNull(), operator: text('operator'), confirmedBy: text('confirmed_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
