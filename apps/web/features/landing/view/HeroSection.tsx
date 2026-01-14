'use client'

import Link from 'next/link'
import { ArrowRight, Bot, Key, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useParallax } from '@/hooks/useScrollAnimation'

export function HeroSection() {
  const scrollY = useParallax()

  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background gradient effect with parallax */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl"
          style={{ transform: `translate(-50%, calc(-50% + ${scrollY * 0.3}px))` }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl"
          style={{ transform: `translate(0, ${scrollY * 0.2}px)` }}
        />
      </div>

      <div className="container">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <Bot className="size-4" />
            <span>AI Agent Payments on Cronos</span>
          </div>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-in"
            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
          >
            Let Your AI Agents
            <span className="text-primary block mt-2">Pay for APIs Automatically</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in"
            style={{ animationDelay: '400ms', animationFillMode: 'both' }}
          >
            Agent402 enables autonomous payments with scoped session keys.
            AI agents can pay for APIs without requiring user approval for every transaction.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: '600ms', animationFillMode: 'both' }}
          >
            <Link href="/explore">
              <Button size="lg" className="gap-2 text-base px-8">
                Browse APIs
                <ArrowRight className="size-5" />
              </Button>
            </Link>
            <Link href="/create">
              <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                Create API
              </Button>
            </Link>
          </div>

          {/* Secondary CTA */}
          <div
            className="pt-4 animate-fade-in"
            style={{ animationDelay: '800ms', animationFillMode: 'both' }}
          >
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? Go to Dashboard
            </Link>
          </div>
        </div>

        {/* Hero visual - animated icons with parallax */}
        <div
          className="mt-16 flex items-center justify-center gap-8 opacity-60 dark:opacity-80"
          style={{ transform: `translateY(${scrollY * -0.15}px)` }}
        >
          <div className="animate-pulse">
            <Key className="size-8 text-primary dark:text-primary/90" />
          </div>
          <div className="animate-pulse" style={{ animationDelay: '150ms' }}>
            <Zap className="size-10 text-primary dark:text-primary/90" />
          </div>
          <div className="animate-pulse" style={{ animationDelay: '300ms' }}>
            <Bot className="size-8 text-primary dark:text-primary/90" />
          </div>
        </div>
      </div>
    </section>
  )
}
