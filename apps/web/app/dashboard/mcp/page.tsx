'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wallet, Server, Plus, Trash2, Copy, Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUser } from '@/context/user'
import { useAppKit } from '@reown/appkit/react'

interface McpServer {
  id: string
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  createdAt: string
}

interface McpServerTool {
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

interface AvailableProxy {
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

export default function McpServerPage() {
  const router = useRouter()
  const { session, isLoading: authLoading } = useUser()
  const { open } = useAppKit()

  const [server, setServer] = useState<McpServer | null>(null)
  const [tools, setTools] = useState<McpServerTool[]>([])
  const [availableProxies, setAvailableProxies] = useState<AvailableProxy[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Form state for creating/editing server
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    isPublic: false,
  })

  // Helper to show messages
  const showError = (msg: string) => {
    setError(msg)
    setSuccess(null)
    setTimeout(() => setError(null), 5000)
  }
  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  const isAuthenticated = session?.isAuthenticated

  // Fetch MCP server data
  useEffect(() => {
    if (!isAuthenticated) return

    async function fetchData() {
      try {
        // Fetch MCP server
        const serverRes = await fetch('/api/mcp-server')
        if (serverRes.ok) {
          const data = await serverRes.json()
          if (data.server) {
            setServer(data.server)
            setTools(data.tools || [])
            setFormData({
              slug: data.server.slug,
              name: data.server.name,
              description: data.server.description || '',
              isPublic: data.server.isPublic,
            })
          }
        }

        // Fetch available proxies from the new endpoint
        const proxiesRes = await fetch('/api/proxies/available')
        if (proxiesRes.ok) {
          const data = await proxiesRes.json()
          setAvailableProxies(data.proxies || [])
          setCategories(data.categories || [])
        }
      } catch (err) {
        console.error('Failed to fetch MCP data:', err)
        showError('Failed to load MCP server data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated])

  // Filter proxies based on search and category
  const filteredProxies = useMemo(() => {
    let filtered = availableProxies

    // Filter out already added tools
    filtered = filtered.filter(p => !tools.some(t => t.apiProxy.id === p.id))

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description?.toLowerCase().includes(query))
      )
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    return filtered
  }, [availableProxies, tools, searchQuery, selectedCategory])

  // Create or update server
  const handleSave = async () => {
    if (!formData.slug || !formData.name) {
      showError('Slug and name are required')
      return
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      showError('Slug must be lowercase letters, numbers, and hyphens only')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/mcp-server', {
        method: server ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save')
      }

      const data = await res.json()
      setServer(data.server)
      showSuccess(server ? 'MCP server updated' : 'MCP server created')
    } catch (err) {
      console.error('Failed to save:', err)
      showError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  // Add tool to server
  const handleAddTool = async (proxyId: string) => {
    if (!server) return

    try {
      const res = await fetch('/api/mcp-server/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyId }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add tool')
      }

      const data = await res.json()
      setTools([...tools, data.tool])
      showSuccess('Tool added')
    } catch (err) {
      console.error('Failed to add tool:', err)
      showError(err instanceof Error ? err.message : 'Failed to add tool')
    }
  }

  // Remove tool from server
  const handleRemoveTool = async (toolId: string) => {
    try {
      const res = await fetch(`/api/mcp-server/tools/${toolId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to remove tool')
      }

      setTools(tools.filter(t => t.id !== toolId))
      showSuccess('Tool removed')
    } catch (err) {
      console.error('Failed to remove tool:', err)
      showError('Failed to remove tool')
    }
  }

  // Copy connection URL
  const handleCopyUrl = () => {
    if (!server) return
    // MCP is proxied through the web app, so use the same origin
    const url = `${window.location.origin}/mcp/${server.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showSuccess('URL copied to clipboard')
  }

  // Format price
  const formatPrice = (price: number) => {
    return `$${(price / 1_000_000).toFixed(4)}`
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container py-8 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <Wallet className="size-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>Connect Your Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to manage your MCP server.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button onClick={() => open()} size="lg" className="gap-2">
              <Wallet className="size-4" />
              Connect Wallet
            </Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-8 max-w-4xl">
      {/* Messages */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-600 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Server className="size-8" />
        <div>
          <h1 className="text-3xl font-bold">MCP Server</h1>
          <p className="text-muted-foreground mt-1">
            Configure your Model Context Protocol server for AI agent integration
          </p>
        </div>
      </div>

      {/* Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Server Configuration</CardTitle>
          <CardDescription>
            Set up your MCP server endpoint and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/mcp/</span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  placeholder="my-server"
                  disabled={!!server}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {server ? 'Slug cannot be changed after creation' : 'Lowercase letters, numbers, and hyphens'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My MCP Server"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what your MCP server provides..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public Server</Label>
              <p className="text-xs text-muted-foreground">
                Allow anyone with an account to connect
              </p>
            </div>
            <Button
              type="button"
              variant={formData.isPublic ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormData({ ...formData, isPublic: !formData.isPublic })}
            >
              {formData.isPublic ? 'Public' : 'Private'}
            </Button>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : server ? (
              'Update Server'
            ) : (
              'Create Server'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Connection Info */}
      {server && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Info</CardTitle>
            <CardDescription>
              Use these details to connect AI agents to your MCP server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>MCP Endpoint</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/mcp/${server.slug}` : `/mcp/${server.slug}`}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>To connect, the AI agent needs:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>OAuth access token (obtained via your app's OAuth flow)</li>
                <li>MCP SDK client configured for SSE transport</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tools Management */}
      {server && (
        <Card>
          <CardHeader>
            <CardTitle>Available Tools ({tools.length})</CardTitle>
            <CardDescription>
              Select which APIs to expose as tools in your MCP server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current tools */}
            {tools.length > 0 && (
              <div className="space-y-2">
                <Label>Enabled Tools</Label>
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{tool.apiProxy.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {formatPrice(tool.apiProxy.pricePerRequest)} per request
                          </span>
                          {tool.apiProxy.category && (
                            <Badge variant="secondary" className="text-xs">
                              {tool.apiProxy.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTool(tool.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and filter */}
            <div className="space-y-2">
              <Label>Add Tools from Marketplace</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search APIs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Available tools list */}
            {filteredProxies.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredProxies.map((proxy) => (
                  <div
                    key={proxy.id}
                    className="flex items-center justify-between p-3 border rounded-lg border-dashed hover:border-solid hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{proxy.name}</p>
                        {proxy.isOwn && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Your API
                          </Badge>
                        )}
                      </div>
                      {proxy.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {proxy.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {formatPrice(proxy.pricePerRequest)} per request
                        </span>
                        {proxy.category && (
                          <Badge variant="secondary" className="text-xs">
                            {proxy.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 ml-2"
                      onClick={() => handleAddTool(proxy.id)}
                    >
                      <Plus className="size-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : availableProxies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No APIs available in the marketplace yet.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/create')}
                >
                  Create the First API
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No APIs match your search criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
