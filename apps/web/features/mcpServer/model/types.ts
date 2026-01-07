export interface McpServer {
  id: string
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  createdAt: string
}

export interface McpServerTool {
  id: string
  toolName: string | null
  shortDescription: string | null
  isEnabled: boolean
  apiProxy: {
    id: string
    name: string
    description: string | null
    pricePerRequest: number
    category: string | null
  }
}

export interface AvailableProxy {
  id: string
  slug: string | null
  name: string
  description: string | null
  pricePerRequest: number
  category: string | null
  tags: string[] | null
  isPublic: boolean
  isOwn: boolean
  createdAt: string
}

export interface McpServerFormData {
  slug: string
  name: string
  description: string
  isPublic: boolean
}

export interface McpServerData {
  server: McpServer | null
  tools: McpServerTool[]
  availableProxies: AvailableProxy[]
  categories: string[]
}
