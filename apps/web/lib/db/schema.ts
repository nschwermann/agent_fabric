import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, jsonb } from 'drizzle-orm/pg-core'
import type { VariableDefinition } from '@/features/proxy/model/variables'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const apiProxies = pgTable('api_proxies', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(), // Optional custom slug for friendly URLs

  // API Details
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  targetUrl: text('target_url').notNull(),

  // Security
  encryptedHeaders: jsonb('encrypted_headers'), // { iv, ciphertext, tag }

  // Pricing
  paymentAddress: varchar('payment_address', { length: 42 }).notNull(), // Wallet to receive payments
  pricePerRequest: bigint('price_per_request', { mode: 'number' }).notNull(), // USDC smallest unit (6 decimals)

  // Visibility
  isPublic: boolean('is_public').default(false).notNull(),

  // Classification
  category: varchar('category', { length: 50 }),
  tags: jsonb('tags').$type<string[]>().default([]),

  // Request Configuration
  httpMethod: varchar('http_method', { length: 10 }).default('GET').notNull(),
  requestBodyTemplate: text('request_body_template'),
  queryParamsTemplate: text('query_params_template'),
  variablesSchema: jsonb('variables_schema').$type<VariableDefinition[]>().default([]),
  exampleResponse: text('example_response'),
  contentType: varchar('content_type', { length: 100 }).default('application/json'),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const requestLogs = pgTable('request_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  proxyId: uuid('proxy_id').references(() => apiProxies.id, { onDelete: 'cascade' }).notNull(),
  requesterWallet: varchar('requester_wallet', { length: 42 }),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'payment_failed', 'proxy_error'
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
})

// Type exports for use in application code
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type ApiProxy = typeof apiProxies.$inferSelect
export type NewApiProxy = typeof apiProxies.$inferInsert

export type RequestLog = typeof requestLogs.$inferSelect
export type NewRequestLog = typeof requestLogs.$inferInsert
