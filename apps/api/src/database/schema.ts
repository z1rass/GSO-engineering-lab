import { sql } from 'drizzle-orm';
import { bigint, boolean, timestamp, check, date, integer, pgEnum, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

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
  blocked: boolean('blocked').notNull().default(false), blockReason: text('block_reason').notNull().default(''),
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

export const ideas = pgTable('ideas', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  hidden: boolean('hidden').notNull().default(false),
  title: text('title').notNull(), description: text('description').notNull(),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityType = pgEnum('activity_type', ['PROJECT', 'EVENT']);
export const moderationActions = pgTable('moderation_actions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  targetType: text('target_type').notNull(), targetId: text('target_id').notNull(),
  action: text('action').notNull(), reason: text('reason').notNull(),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const contacts = pgTable('contacts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(), company: text('company').notNull().default(''),
  professionalRole: text('professional_role').notNull().default(''),
  topics: text('topics').array().notNull().default(sql`'{}'::text[]`),
  notes: text('notes').notNull().default(''), contactMethod: text('contact_method').notNull().default(''),
  source: text('source').notNull().default(''),
  addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityStatus = pgEnum('activity_status', ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export const activities = pgTable('activities', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(), type: activityType('type').notNull(),
  title: text('title').notNull(), description: text('description').notNull(),
  hidden: boolean('hidden').notNull().default(false),
  ownerId: text('owner_id').notNull().references(() => user.id),
  ideaId: integer('idea_id').references(() => ideas.id, { onDelete: 'set null' }),
  status: activityStatus('status').notNull().default('PLANNING'),
  materials: text('materials').notNull().default(''), privateInstructions: text('private_instructions').notNull().default(''), discordUrl: text('discord_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const projectDetails = pgTable('project_details', {
  activityId: integer('activity_id').primaryKey().references(() => activities.id, { onDelete: 'cascade' }),
  goal: text('goal').notNull(), techStack: text('tech_stack').array().notNull().default(sql`'{}'::text[]`),
  repositoryUrl: text('repository_url'), documentationUrl: text('documentation_url'),
});

export const activitySeasons = pgTable('activity_seasons', {
  activityId: integer('activity_id').notNull().references(()=>activities.id,{onDelete:'cascade'}),
  seasonId: integer('season_id').notNull().references(()=>seasons.id,{onDelete:'cascade'}),
}, table=>[primaryKey({columns:[table.activityId,table.seasonId]})]);

export const eventCategory = pgEnum('event_category', ['TALK', 'WORKSHOP', 'BUILD_NIGHT', 'STUDY_SESSION', 'HACKATHON', 'SOCIAL', 'OTHER']);
export const eventDetails = pgTable('event_details', {
  activityId: integer('activity_id').primaryKey().references(() => activities.id, { onDelete: 'cascade' }),
  category: eventCategory('category').notNull(),
  schoolRoomRequired: boolean('school_room_required').notNull().default(false),
  plannedDate: date('planned_date'), endDate: date('end_date'), startTime: text('start_time'), endTime: text('end_time'),
  generalLocation: text('general_location').notNull().default(''), exactRoom: text('exact_room').notNull().default(''), repositoryUrl: text('repository_url'),
});

export const ideaInterests = pgTable('idea_interests', {
  ideaId: integer('idea_id').notNull().references(() => ideas.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [primaryKey({ columns: [table.ideaId, table.userId] })]);
export const activityInterests = pgTable('activity_interests', {
  activityId: integer('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, table => [primaryKey({ columns: [table.activityId, table.userId] })]);

export const projectMemberships = pgTable('project_memberships', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer('project_id').notNull().references(() => projectDetails.activityId, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
}, table => [uniqueIndex('one_current_project_membership').on(table.projectId, table.userId).where(sql`${table.leftAt} IS NULL`)]);

export const roomRequestStatus = pgEnum('room_request_status', ['PENDING','ALTERNATIVE','CONFIRMED']);
export const roomRequests = pgTable('room_requests', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  activityId: integer('activity_id').notNull().unique().references(() => activities.id, { onDelete: 'cascade' }),
  note: text('note').notNull(), status: roomRequestStatus('status').notNull().default('PENDING'),
  date: date('date'), endDate: date('end_date'), startTime: text('start_time'), endTime: text('end_time'), room: text('room'), message: text('message'),
  createdAt: timestamp('created_at', {withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', {withTimezone:true}).notNull().defaultNow(),
});

export const eventGoing = pgTable('event_going', {
  eventId: integer('event_id').notNull().references(() => eventDetails.activityId, {onDelete:'cascade'}),
  userId: text('user_id').notNull().references(() => user.id, {onDelete:'cascade'}),
}, table => [primaryKey({columns:[table.eventId,table.userId]})]);

export const taskStatus = pgEnum('task_status',['OPEN','IN_PROGRESS','DONE','CANCELLED']);
export const tasks = pgTable('tasks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  activityId: integer('activity_id').notNull().references(() => activities.id,{onDelete:'cascade'}),
  title: text('title').notNull(), description: text('description').notNull().default(''), dueDate: date('due_date'),
  status: taskStatus('status').notNull().default('OPEN'),
  ownerId: text('owner_id').references(() => user.id),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});

export const ownershipTransferStatus = pgEnum('ownership_transfer_status',['PENDING','ACCEPTED','CANCELLED']);
export const ownershipTransfers = pgTable('ownership_transfers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  activityId: integer('activity_id').notNull().references(()=>activities.id,{onDelete:'cascade'}),
  fromOwnerId: text('from_owner_id').notNull().references(()=>user.id),
  recipientId: text('recipient_id').notNull().references(()=>user.id),
  status: ownershipTransferStatus('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at',{withTimezone:true}),
}, table=>[uniqueIndex('one_pending_ownership_transfer').on(table.activityId).where(sql`${table.status} = 'PENDING'`)]);
