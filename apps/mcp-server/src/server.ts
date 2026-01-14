import express, { Request, Response, NextFunction, Express } from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { IncomingMessage, ServerResponse } from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

import { validateBearerToken, type AuthContext } from './auth/oauth.js'
import { toolRegistry, type McpServerConfig } from './tools/registry.js'
import { createToolsForServer, type ToolContext } from './tools/proxy-tool.js'
import { createWorkflowToolsForServer } from './tools/workflow-tool.js'

/**
 * MCP Session information
 */
interface McpSession {
  transport: StreamableHTTPServerTransport
  server: McpServer
  auth: AuthContext
  slug: string
  config: McpServerConfig
}

// Session storage
const sessions = new Map<string, McpSession>()

/**
 * Create the Express app for the MCP server
 */
export function createApp(config: { nextAppUrl: string; chainId: number }): Express {
  const app = express()

  // Trust proxy headers (for ngrok, load balancers, etc.)
  app.set('trust proxy', true)

  // CORS - allow all origins for MCP clients
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id', 'mcp-protocol-version'],
    exposedHeaders: ['mcp-session-id'],
  }))

  // Parse JSON bodies
  app.use(express.json())

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  /**
   * OAuth 2.0 Authorization Server Metadata (RFC 8414)
   * MCP clients discover OAuth configuration from this endpoint
   * Global endpoint (without slug) - returns generic metadata
   */
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    const metadata = {
      issuer: config.nextAppUrl,
      authorization_endpoint: `${config.nextAppUrl}/authorize`,
      token_endpoint: `${config.nextAppUrl}/api/oauth/token`,
      registration_endpoint: `${config.nextAppUrl}/api/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['x402:payments', 'mcp:tools', 'workflow:token-approvals'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    }
    res.json(metadata)
  })

  /**
   * OAuth 2.0 Protected Resource Metadata (RFC 9470)
   * Global endpoint (without slug)
   */
  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const mcpServerUrl = `${req.protocol}://${req.get('host')}`
    const metadata = {
      resource: mcpServerUrl,
      authorization_servers: [config.nextAppUrl],
      scopes_supported: ['x402:payments', 'mcp:tools', 'workflow:token-approvals'],
      bearer_methods_supported: ['header'],
    }
    res.json(metadata)
  })

  /**
   * Slug-specific OAuth 2.0 Authorization Server Metadata (RFC 8414)
   * Includes mcp_slug in authorization endpoint for workflow scope resolution
   */
  app.get('/mcp/:slug/.well-known/oauth-authorization-server', (req, res) => {
    const slugParam = req.params.slug
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

    const metadata = {
      issuer: config.nextAppUrl,
      authorization_endpoint: `${config.nextAppUrl}/authorize?mcp_slug=${encodeURIComponent(slug)}`,
      token_endpoint: `${config.nextAppUrl}/api/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['x402:payments', 'mcp:tools', 'workflow:token-approvals'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    }
    res.json(metadata)
  })

  /**
   * Slug-specific OAuth 2.0 Protected Resource Metadata (RFC 9470)
   * Returns slug-specific resource identifier
   * Points to the slug-aware OAuth endpoint on Next.js
   */
  app.get('/mcp/:slug/.well-known/oauth-protected-resource', (req, res) => {
    const slugParam = req.params.slug
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam
    const mcpServerUrl = `${req.protocol}://${req.get('host')}`

    const metadata = {
      resource: `${mcpServerUrl}/mcp/${slug}`,
      // Point to slug-aware OAuth discovery endpoint on Next.js
      // The SDK will fetch {auth_server}/.well-known/oauth-authorization-server
      // which maps to /oauth/:slug/.well-known/oauth-authorization-server on Next.js
      authorization_servers: [`${config.nextAppUrl}/oauth/${encodeURIComponent(slug)}`],
      scopes_supported: ['x402:payments', 'mcp:tools', 'workflow:token-approvals'],
      bearer_methods_supported: ['header'],
    }
    res.json(metadata)
  })

  /**
   * Middleware to extract slug and validate auth
   */
  const mcpMiddleware = async (
    req: Request & { mcpSlug?: string; mcpAuth?: AuthContext },
    res: Response,
    next: NextFunction
  ) => {
    const slugParam = req.params.slug
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam

    if (!slug) {
      res.status(400).json({ error: 'Missing MCP server slug' })
      return
    }

    req.mcpSlug = slug

    // Check for existing session
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (sessionId) {
      const session = sessions.get(sessionId)
      if (session) {
        // Verify the session is for the correct slug
        if (session.slug !== slug) {
          res.status(403).json({ error: 'Session does not match requested slug' })
          return
        }
        req.mcpAuth = session.auth
        next()
        return
      }
    }

    // Validate OAuth token for new sessions
    const authHeader = req.headers.authorization
    const auth = await validateBearerToken(authHeader)

    if (!auth) {
      // MCP OAuth requires WWW-Authenticate header with resource_metadata URL
      // See: https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/
      // Use slug-specific resource metadata URL so client discovers slug-aware authorization endpoint
      const resourceMetadataUrl = `${req.protocol}://${req.get('host')}/mcp/${slug}/.well-known/oauth-protected-resource`
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl}"`)
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Valid OAuth token required',
        authorization_url: `${config.nextAppUrl}/authorize?mcp_slug=${encodeURIComponent(slug)}`,
      })
      return
    }

    // Validate slug binding if token is scoped to a specific slug
    if (auth.mcpSlug && auth.mcpSlug !== slug) {
      res.status(403).json({
        error: 'forbidden',
        error_description: `Token is scoped to slug "${auth.mcpSlug}", not "${slug}"`,
      })
      return
    }

    req.mcpAuth = auth
    next()
  }

  /**
   * Create an MCP server for a specific slug configuration
   */
  const createMcpServer = (serverConfig: McpServerConfig, auth: AuthContext): McpServer => {
    const server = new McpServer({
      name: `x402-mcp-${serverConfig.slug}`,
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    })

    // Create tool context
    const toolContext: ToolContext = {
      auth,
      chainId: config.chainId,
      nextAppUrl: config.nextAppUrl,
    }

    // Register proxy tools
    const proxyTools = createToolsForServer(serverConfig.tools)

    for (const tool of proxyTools) {
      // Get the schema shape for the MCP SDK
      const schemaShape = tool.inputSchema instanceof z.ZodObject
        ? (tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape
        : {}

      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: schemaShape,
        },
        async (args) => {
          const result = await tool.handler(args as Record<string, unknown>, toolContext)
          return {
            content: result.content,
            isError: result.isError,
          }
        }
      )
    }

    // Register workflow tools
    const workflowTools = createWorkflowToolsForServer(serverConfig.workflowTools, toolContext)

    for (const tool of workflowTools) {
      const schemaShape = tool.inputSchema instanceof z.ZodObject
        ? (tool.inputSchema as z.ZodObject<z.ZodRawShape>).shape
        : {}

      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: schemaShape,
        },
        async (args) => {
          const result = await tool.handler(args as Record<string, unknown>, toolContext)
          return {
            content: result.content,
            isError: result.isError,
          }
        }
      )
    }

    return server
  }

  /**
   * Handle POST requests (MCP JSON-RPC)
   */
  app.post('/mcp/:slug', mcpMiddleware, async (req: Request & { mcpSlug?: string; mcpAuth?: AuthContext }, res: Response) => {
    const slug = req.mcpSlug!
    const auth = req.mcpAuth!
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    try {
      // Check for existing session
      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!
        await session.transport.handleRequest(
          req as unknown as IncomingMessage,
          res as unknown as ServerResponse,
          req.body
        )
        return
      }

      // Load server configuration
      const serverConfig = await toolRegistry.loadToolsForSlug(slug)

      if (!serverConfig) {
        res.status(404).json({ error: 'MCP server not found' })
        return
      }

      // Create new MCP server for this session
      const mcpServer = createMcpServer(serverConfig, auth)

      // Create transport (without eventStore - resumability disabled)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, {
            transport,
            server: mcpServer,
            auth,
            slug,
            config: serverConfig,
          })
        },
      })

      // Connect transport to server
      await mcpServer.connect(transport)

      // Handle cleanup on close
      transport.onclose = () => {
        const sid = transport.sessionId
        if (sid) {
          sessions.delete(sid)
        }
      }

      // Handle the request
      await transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        req.body
      )
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  })

  /**
   * Handle GET requests (SSE streaming)
   */
  app.get('/mcp/:slug', mcpMiddleware, async (req: Request & { mcpSlug?: string; mcpAuth?: AuthContext }, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' })
      return
    }

    const session = sessions.get(sessionId)!

    try {
      await session.transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse
      )
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  })

  /**
   * Handle DELETE requests (session termination)
   */
  app.delete('/mcp/:slug', mcpMiddleware, async (req: Request & { mcpSlug?: string; mcpAuth?: AuthContext }, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: 'Invalid or missing session ID' })
      return
    }

    const session = sessions.get(sessionId)!

    try {
      await session.transport.handleRequest(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse
      )
      sessions.delete(sessionId)
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  })

  return app
}

/**
 * Get all active sessions (for debugging)
 */
export function getActiveSessions(): Map<string, McpSession> {
  return sessions
}

/**
 * Graceful shutdown - close all sessions
 */
export async function shutdown(): Promise<void> {
  for (const [, session] of sessions) {
    try {
      await session.server.close()
    } catch {
      // Ignore errors during shutdown
    }
  }

  sessions.clear()
}
