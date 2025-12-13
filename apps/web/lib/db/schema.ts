import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, jsonb } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const apiProxies = pgTable('api_proxies', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // API Details
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  targetUrl: text('target_url').notNull(),

  // Security
  encryptedHeaders: jsonb('encrypted_headers'), // { iv, ciphertext, tag }

  // Pricing
  pricePerRequest: bigint('price_per_request', { mode: 'number' }).notNull(), // USDC smallest unit (6 decimals)

  // Visibility
  isPublic: boolean('is_public').default(false).notNull(),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const requestLogs = pgTable('request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  proxyId: uuid('proxy_id').references(() => apiProxies.id, { onDelete: 'cascade' }).notNull(),
  requesterWallet: varchar('requester_wallet', { length: 42 }),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'payment_failed', 'proxy_error'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

// Type exports for use in application code
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type ApiProxy = typeof apiProxies.$inferSelect
export type NewApiProxy = typeof apiProxies.$inferInsert

export type RequestLog = typeof requestLogs.$inferSelect
export type NewRequestLog = typeof requestLogs.$inferInsert
