import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, jsonb, index, integer, unique } from 'drizzle-orm/pg-core'
import type { VariableDefinition } from '@/features/proxy/model/variables'
import type { HybridEncryptedData } from '@/lib/crypto/encryption'
import type { SerializedSessionScope, OnChainParams } from '@/lib/sessionKeys/types'

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

/**
 * Session keys for ERC-7702 smart account delegated signing
 *
 * Stores encrypted session key private keys that the server can use
 * to sign x402 payments on behalf of the user.
 */
export const sessionKeys = pgTable('session_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // Session identification (from on-chain grantSession event)
  sessionId: varchar('session_id', { length: 66 }).notNull().unique(), // bytes32 as hex (0x + 64 chars)
  sessionKeyAddress: varchar('session_key_address', { length: 42 }).notNull(), // The session key's address

  // Encrypted private key (using RSA+AES hybrid encryption)
  encryptedPrivateKey: jsonb('encrypted_private_key').$type<HybridEncryptedData>().notNull(),

  // === NEW: Scoped permissions ===
  /**
   * Scopes define what this session can do
   * Contains both execute scopes (budget enforceable) and eip712 scopes (not enforceable)
   */
  scopes: jsonb('scopes').$type<SerializedSessionScope[]>().default([]),

  /**
   * Flattened on-chain parameters derived from scopes
   * These are the values passed to grantSession and stored for quick access
   */
  onChainParams: jsonb('on_chain_params').$type<OnChainParams>(),

  // === LEGACY: Kept for backwards compatibility ===
  // Session parameters (for reference/display, source of truth is on-chain)
  allowedTargets: jsonb('allowed_targets').$type<string[]>().notNull().default([]),
  allowedSelectors: jsonb('allowed_selectors').$type<string[]>().default([]),

  // Time bounds (stored for quick filtering, source of truth is on-chain)
  validAfter: timestamp('valid_after', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),

  // Approved contracts for EIP-1271 signatures (149-byte signature format)
  // These are the only contracts this session key can sign EIP-712 messages for
  approvedContracts: jsonb('approved_contracts').$type<{
    address: string // Contract address
    name?: string // Optional display name (e.g., "USDC.e", "Seaport")
  }[]>().default([]),

  // === OAuth binding (if created via OAuth flow) ===
  oauthClientId: varchar('oauth_client_id', { length: 100 }),
  oauthGrantId: varchar('oauth_grant_id', { length: 100 }),

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================================
// OAuth 2.1 Tables for MCP Integration
// ============================================================================

/**
 * OAuth 2.1 clients (MCP servers that want to request sessions)
 */
export const oauthClients = pgTable('oauth_clients', {
  /** Client ID - public identifier */
  id: varchar('id', { length: 100 }).primaryKey(),

  /** Hashed client secret (bcrypt or argon2) */
  secretHash: varchar('secret_hash', { length: 128 }).notNull(),

  /** Human-readable name shown in consent UI */
  name: varchar('name', { length: 100 }).notNull(),

  /** Description of what this client does */
  description: text('description'),

  /** Logo URL for consent UI */
  logoUrl: text('logo_url'),

  /** Allowed redirect URIs (JSON array) */
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),

  /** Scope IDs this client is allowed to request */
  allowedScopes: jsonb('allowed_scopes').$type<string[]>().notNull(),

  /** Whether this client is active */
  isActive: boolean('is_active').default(true).notNull(),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * OAuth authorization codes (short-lived, one-time use)
 */
export const oauthAuthCodes = pgTable('oauth_auth_codes', {
  /** The authorization code */
  code: varchar('code', { length: 128 }).primaryKey(),

  /** Client that initiated the flow */
  clientId: varchar('client_id', { length: 100 }).references(() => oauthClients.id).notNull(),

  /** User who approved the request */
  userId: uuid('user_id').references(() => users.id).notNull(),

  /** Scopes that were requested */
  requestedScopes: jsonb('requested_scopes').$type<string[]>().notNull(),

  /** Scopes that were approved by the user */
  approvedScopes: jsonb('approved_scopes').$type<string[]>().notNull(),

  /** Full session configuration approved by user */
  sessionConfig: jsonb('session_config').$type<{
    validAfter: number
    validUntil: number
    scopes: SerializedSessionScope[]
    sessionId: string // Links to the actual session key
  }>().notNull(),

  /** PKCE code challenge */
  codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),

  /** PKCE challenge method (always S256) */
  codeChallengeMethod: varchar('code_challenge_method', { length: 10 }).default('S256').notNull(),

  /** Redirect URI for this specific request */
  redirectUri: text('redirect_uri').notNull(),

  /** When this code expires (typically 10 minutes) */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /** When this code was used (null if not yet used) */
  usedAt: timestamp('used_at', { withTimezone: true }),
}, (table) => [
  index('idx_oauth_auth_codes_expiry').on(table.expiresAt),
])

/**
 * OAuth access tokens (bound to sessions)
 */
export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** Hashed token value for storage */
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),

  /** Client that obtained this token */
  clientId: varchar('client_id', { length: 100 }).references(() => oauthClients.id).notNull(),

  /** User who owns this token */
  userId: uuid('user_id').references(() => users.id).notNull(),

  /** Session key this token can control */
  sessionKeyId: uuid('session_key_id').references(() => sessionKeys.id).notNull(),

  /** Scopes granted to this token */
  scopes: jsonb('scopes').$type<string[]>().notNull(),

  /** When this token expires */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /** When this token was revoked (null if active) */
  revokedAt: timestamp('revoked_at', { withTimezone: true }),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_oauth_access_tokens_session').on(table.sessionKeyId),
])

// ============================================================================
// MCP Server Tables
// ============================================================================

/**
 * MCP Server configurations
 * Each user can have one MCP server with a unique slug
 */
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** Owner of this MCP server */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),

  /** Unique slug for routing (e.g., "acme-corp" for /mcp/acme-corp) */
  slug: varchar('slug', { length: 50 }).notNull().unique(),

  /** Human-readable name shown to AI clients */
  name: varchar('name', { length: 100 }).notNull(),

  /** Description of what this MCP server provides */
  description: text('description'),

  /** Whether this server is publicly discoverable */
  isPublic: boolean('is_public').default(false).notNull(),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_mcp_servers_slug').on(table.slug),
])

/**
 * Tools exposed by an MCP server
 * Links MCP servers to API proxies they want to expose as tools
 */
export const mcpServerTools = pgTable('mcp_server_tools', {
  id: uuid('id').defaultRandom().primaryKey(),

  /** The MCP server this tool belongs to */
  mcpServerId: uuid('mcp_server_id').references(() => mcpServers.id, { onDelete: 'cascade' }).notNull(),

  /** The API proxy this tool wraps */
  apiProxyId: uuid('api_proxy_id').references(() => apiProxies.id, { onDelete: 'cascade' }).notNull(),

  /** Override tool name (defaults to proxy name if null) */
  toolName: varchar('tool_name', { length: 100 }),

  /** Override tool description */
  toolDescription: text('tool_description'),

  /** Short description for context efficiency (max 100 chars) */
  shortDescription: varchar('short_description', { length: 100 }),

  /** Display order for tool listing */
  displayOrder: integer('display_order').default(0).notNull(),

  /** Whether this tool is currently enabled */
  isEnabled: boolean('is_enabled').default(true).notNull(),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_mcp_server_tools_server').on(table.mcpServerId),
  // Ensure each proxy is only added once per MCP server
  unique('unique_mcp_server_proxy').on(table.mcpServerId, table.apiProxyId),
])

// Type exports for use in application code
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type ApiProxy = typeof apiProxies.$inferSelect
export type NewApiProxy = typeof apiProxies.$inferInsert

export type RequestLog = typeof requestLogs.$inferSelect
export type NewRequestLog = typeof requestLogs.$inferInsert

export type SessionKey = typeof sessionKeys.$inferSelect
export type NewSessionKey = typeof sessionKeys.$inferInsert

export type OAuthClient = typeof oauthClients.$inferSelect
export type NewOAuthClient = typeof oauthClients.$inferInsert

export type OAuthAuthCode = typeof oauthAuthCodes.$inferSelect
export type NewOAuthAuthCode = typeof oauthAuthCodes.$inferInsert

export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect
export type NewOAuthAccessToken = typeof oauthAccessTokens.$inferInsert

export type McpServer = typeof mcpServers.$inferSelect
export type NewMcpServer = typeof mcpServers.$inferInsert

export type McpServerTool = typeof mcpServerTools.$inferSelect
export type NewMcpServerTool = typeof mcpServerTools.$inferInsert
