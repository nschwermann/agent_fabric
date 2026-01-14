'use client'

import Link from 'next/link'
import { ArrowRight, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollAnimation } from '@/components/ui/scroll-animation'

export function CtaSection() {
  return (
    <section className="py-20 lg:py-28 bg-primary/5">
      <div className="container">
        <ScrollAnimation animation="scale">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Bot className="size-8 text-primary" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold">
              Ready to Enable Agentic Payments?
            </h2>

            <p className="text-lg text-muted-foreground">
              Join the future of autonomous AI payments. Start monetizing your APIs
              or integrate with our MCP server for your AI agents.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create">
                <Button size="lg" className="gap-2 text-base px-8">
                  Create Your First API
                  <ArrowRight className="size-5" />
                </Button>
              </Link>
              <Link href="/mcp-servers">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  Browse MCP Servers
                </Button>
              </Link>
            </div>

            <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <Link href="/workflows" className="hover:text-foreground transition-colors">
                Explore Workflows
              </Link>
              <span>|</span>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">
                View Dashboard
              </Link>
              <span>|</span>
              <Link href="/dashboard/mcp" className="hover:text-foreground transition-colors">
                Configure MCP Server
              </Link>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  )
}
