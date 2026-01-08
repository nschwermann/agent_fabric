"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpServerTools = exports.mcpServers = exports.oauthAccessTokens = exports.oauthAuthCodes = exports.oauthClients = exports.sessionKeys = exports.requestLogs = exports.apiProxies = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    walletAddress: (0, pg_core_1.varchar)('wallet_address', { length: 42 }).notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.apiProxies = (0, pg_core_1.pgTable)('api_proxies', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).unique(), // Optional custom slug for friendly URLs
    // API Details
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    targetUrl: (0, pg_core_1.text)('target_url').notNull(),
    // Security
    encryptedHeaders: (0, pg_core_1.jsonb)('encrypted_headers'), // { iv, ciphertext, tag }
    // Pricing
    paymentAddress: (0, pg_core_1.varchar)('payment_address', { length: 42 }).notNull(), // Wallet to receive payments
    pricePerRequest: (0, pg_core_1.bigint)('price_per_request', { mode: 'number' }).notNull(), // USDC smallest unit (6 decimals)
    // Visibility
    isPublic: (0, pg_core_1.boolean)('is_public').default(false).notNull(),
    // Classification
    category: (0, pg_core_1.varchar)('category', { length: 50 }),
    tags: (0, pg_core_1.jsonb)('tags').$type().default([]),
    // Request Configuration
    httpMethod: (0, pg_core_1.varchar)('http_method', { length: 10 }).default('GET').notNull(),
    requestBodyTemplate: (0, pg_core_1.text)('request_body_template'),
    queryParamsTemplate: (0, pg_core_1.text)('query_params_template'),
    variablesSchema: (0, pg_core_1.jsonb)('variables_schema').$type().default([]),
    exampleResponse: (0, pg_core_1.text)('example_response'),
    contentType: (0, pg_core_1.varchar)('content_type', { length: 100 }).default('application/json'),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.requestLogs = (0, pg_core_1.pgTable)('request_logs', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    proxyId: (0, pg_core_1.uuid)('proxy_id').references(() => exports.apiProxies.id, { onDelete: 'cascade' }).notNull(),
    requesterWallet: (0, pg_core_1.varchar)('requester_wallet', { length: 42 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull(), // 'success', 'payment_failed', 'proxy_error'
    timestamp: (0, pg_core_1.timestamp)('timestamp', { withTimezone: true }).defaultNow().notNull(),
});
/**
 * Session keys for ERC-7702 smart account delegated signing
 *
 * Stores encrypted session key private keys that the server can use
 * to sign x402 payments on behalf of the user.
 */
exports.sessionKeys = (0, pg_core_1.pgTable)('session_keys', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    // Session identification (from on-chain grantSession event)
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 66 }).notNull().unique(), // bytes32 as hex (0x + 64 chars)
    sessionKeyAddress: (0, pg_core_1.varchar)('session_key_address', { length: 42 }).notNull(), // The session key's address
    // Encrypted private key (using RSA+AES hybrid encryption)
    encryptedPrivateKey: (0, pg_core_1.jsonb)('encrypted_private_key').$type().notNull(),
    // === NEW: Scoped permissions ===
    /**
     * Scopes define what this session can do
     * Contains both execute scopes (budget enforceable) and eip712 scopes (not enforceable)
     */
    scopes: (0, pg_core_1.jsonb)('scopes').$type().default([]),
    /**
     * Flattened on-chain parameters derived from scopes
     * These are the values passed to grantSession and stored for quick access
     */
    onChainParams: (0, pg_core_1.jsonb)('on_chain_params').$type(),
    // === LEGACY: Kept for backwards compatibility ===
    // Session parameters (for reference/display, source of truth is on-chain)
    allowedTargets: (0, pg_core_1.jsonb)('allowed_targets').$type().notNull().default([]),
    allowedSelectors: (0, pg_core_1.jsonb)('allowed_selectors').$type().default([]),
    // Time bounds (stored for quick filtering, source of truth is on-chain)
    validAfter: (0, pg_core_1.timestamp)('valid_after', { withTimezone: true }).notNull(),
    validUntil: (0, pg_core_1.timestamp)('valid_until', { withTimezone: true }).notNull(),
    // Approved contracts for EIP-1271 signatures (149-byte signature format)
    // These are the only contracts this session key can sign EIP-712 messages for
    approvedContracts: (0, pg_core_1.jsonb)('approved_contracts').$type().default([]),
    // === OAuth binding (if created via OAuth flow) ===
    oauthClientId: (0, pg_core_1.varchar)('oauth_client_id', { length: 100 }),
    oauthGrantId: (0, pg_core_1.varchar)('oauth_grant_id', { length: 100 }),
    // Status
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    revokedAt: (0, pg_core_1.timestamp)('revoked_at', { withTimezone: true }),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
// ============================================================================
// OAuth 2.1 Tables for MCP Integration
// ============================================================================
/**
 * OAuth 2.1 clients (MCP servers that want to request sessions)
 */
exports.oauthClients = (0, pg_core_1.pgTable)('oauth_clients', {
    /** Client ID - public identifier */
    id: (0, pg_core_1.varchar)('id', { length: 100 }).primaryKey(),
    /** Hashed client secret (bcrypt or argon2) */
    secretHash: (0, pg_core_1.varchar)('secret_hash', { length: 128 }).notNull(),
    /** Human-readable name shown in consent UI */
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    /** Description of what this client does */
    description: (0, pg_core_1.text)('description'),
    /** Logo URL for consent UI */
    logoUrl: (0, pg_core_1.text)('logo_url'),
    /** Allowed redirect URIs (JSON array) */
    redirectUris: (0, pg_core_1.jsonb)('redirect_uris').$type().notNull(),
    /** Scope IDs this client is allowed to request */
    allowedScopes: (0, pg_core_1.jsonb)('allowed_scopes').$type().notNull(),
    /** Whether this client is active */
    isActive: (0, pg_core_1.boolean)('is_active').default(true).notNull(),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
/**
 * OAuth authorization codes (short-lived, one-time use)
 */
exports.oauthAuthCodes = (0, pg_core_1.pgTable)('oauth_auth_codes', {
    /** The authorization code */
    code: (0, pg_core_1.varchar)('code', { length: 128 }).primaryKey(),
    /** Client that initiated the flow */
    clientId: (0, pg_core_1.varchar)('client_id', { length: 100 }).references(() => exports.oauthClients.id).notNull(),
    /** User who approved the request */
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    /** Scopes that were requested */
    requestedScopes: (0, pg_core_1.jsonb)('requested_scopes').$type().notNull(),
    /** Scopes that were approved by the user */
    approvedScopes: (0, pg_core_1.jsonb)('approved_scopes').$type().notNull(),
    /** Full session configuration approved by user */
    sessionConfig: (0, pg_core_1.jsonb)('session_config').$type().notNull(),
    /** PKCE code challenge */
    codeChallenge: (0, pg_core_1.varchar)('code_challenge', { length: 128 }).notNull(),
    /** PKCE challenge method (always S256) */
    codeChallengeMethod: (0, pg_core_1.varchar)('code_challenge_method', { length: 10 }).default('S256').notNull(),
    /** Redirect URI for this specific request */
    redirectUri: (0, pg_core_1.text)('redirect_uri').notNull(),
    /** When this code expires (typically 10 minutes) */
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    /** When this code was used (null if not yet used) */
    usedAt: (0, pg_core_1.timestamp)('used_at', { withTimezone: true }),
}, (table) => [
    (0, pg_core_1.index)('idx_oauth_auth_codes_expiry').on(table.expiresAt),
]);
/**
 * OAuth access tokens (bound to sessions)
 */
exports.oauthAccessTokens = (0, pg_core_1.pgTable)('oauth_access_tokens', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    /** Hashed token value for storage */
    tokenHash: (0, pg_core_1.varchar)('token_hash', { length: 128 }).notNull().unique(),
    /** Client that obtained this token */
    clientId: (0, pg_core_1.varchar)('client_id', { length: 100 }).references(() => exports.oauthClients.id).notNull(),
    /** User who owns this token */
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    /** Session key this token can control */
    sessionKeyId: (0, pg_core_1.uuid)('session_key_id').references(() => exports.sessionKeys.id).notNull(),
    /** Scopes granted to this token */
    scopes: (0, pg_core_1.jsonb)('scopes').$type().notNull(),
    /** When this token expires */
    expiresAt: (0, pg_core_1.timestamp)('expires_at', { withTimezone: true }).notNull(),
    /** When this token was revoked (null if active) */
    revokedAt: (0, pg_core_1.timestamp)('revoked_at', { withTimezone: true }),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_oauth_access_tokens_session').on(table.sessionKeyId),
]);
// ============================================================================
// MCP Server Tables
// ============================================================================
/**
 * MCP Server configurations
 * Each user can have one MCP server with a unique slug
 */
exports.mcpServers = (0, pg_core_1.pgTable)('mcp_servers', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    /** Owner of this MCP server */
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull().unique(),
    /** Unique slug for routing (e.g., "acme-corp" for /mcp/acme-corp) */
    slug: (0, pg_core_1.varchar)('slug', { length: 50 }).notNull().unique(),
    /** Human-readable name shown to AI clients */
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    /** Description of what this MCP server provides */
    description: (0, pg_core_1.text)('description'),
    /** Whether this server is publicly discoverable */
    isPublic: (0, pg_core_1.boolean)('is_public').default(false).notNull(),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_mcp_servers_slug').on(table.slug),
]);
/**
 * Tools exposed by an MCP server
 * Links MCP servers to API proxies they want to expose as tools
 */
exports.mcpServerTools = (0, pg_core_1.pgTable)('mcp_server_tools', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    /** The MCP server this tool belongs to */
    mcpServerId: (0, pg_core_1.uuid)('mcp_server_id').references(() => exports.mcpServers.id, { onDelete: 'cascade' }).notNull(),
    /** The API proxy this tool wraps */
    apiProxyId: (0, pg_core_1.uuid)('api_proxy_id').references(() => exports.apiProxies.id, { onDelete: 'cascade' }).notNull(),
    /** Override tool name (defaults to proxy name if null) */
    toolName: (0, pg_core_1.varchar)('tool_name', { length: 100 }),
    /** Override tool description */
    toolDescription: (0, pg_core_1.text)('tool_description'),
    /** Short description for context efficiency (max 100 chars) */
    shortDescription: (0, pg_core_1.varchar)('short_description', { length: 100 }),
    /** Display order for tool listing */
    displayOrder: (0, pg_core_1.integer)('display_order').default(0).notNull(),
    /** Whether this tool is currently enabled */
    isEnabled: (0, pg_core_1.boolean)('is_enabled').default(true).notNull(),
    // Metadata
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_mcp_server_tools_server').on(table.mcpServerId),
    // Ensure each proxy is only added once per MCP server
    (0, pg_core_1.unique)('unique_mcp_server_proxy').on(table.mcpServerId, table.apiProxyId),
]);
//# sourceMappingURL=schema.js.map