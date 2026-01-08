import 'dotenv/config'
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcrypt'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { oauthClients } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Seed the platform OAuth client for MCP server authentication.
 * Run with: pnpm db:seed-oauth-client
 */
async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const client = postgres(connectionString, { prepare: false })
  const db = drizzle(client)

  const clientId = 'x402-mcp-platform'

  // Check if client already exists
  const existing = await db.select()
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId))
    .limit(1)

  if (existing.length > 0) {
    console.log(`OAuth client "${clientId}" already exists.`)
    console.log('To regenerate, delete it first and run this script again.')
    await client.end()
    process.exit(0)
  }

  // Generate a secure client secret
  const clientSecret = randomBytes(32).toString('base64url')
  const secretHash = await bcrypt.hash(clientSecret, 12)

  // Get MCP server URL from env or default
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3001'
  const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Insert the platform OAuth client
  await db.insert(oauthClients).values({
    id: clientId,
    secretHash,
    name: 'X402 MCP Platform',
    description: 'Platform-level OAuth client for MCP server authentication',
    logoUrl: `${nextAppUrl}/logo.svg`,
    redirectUris: [
      `${mcpServerUrl}/mcp/callback`,
      'http://localhost:3001/mcp/callback',
    ],
    allowedScopes: ['x402:payments', 'mcp:tools'],
    isActive: true,
  })

  console.log('Platform OAuth client created successfully!\n')
  console.log('=' .repeat(80))
  console.log('Add these to your .env.local file (for MCP server):\n')
  console.log(`MCP_OAUTH_CLIENT_ID="${clientId}"`)
  console.log(`MCP_OAUTH_CLIENT_SECRET="${clientSecret}"`)
  console.log('=' .repeat(80))
  console.log('\nIMPORTANT: Keep the client secret secure and never commit it to version control.')

  await client.end()
}

main().catch((error) => {
  console.error('Error seeding OAuth client:', error)
  process.exit(1)
})
