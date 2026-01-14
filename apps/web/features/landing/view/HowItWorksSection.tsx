'use client'

import {
  Send,
  CreditCard,
  CheckCircle,
  ArrowDown
} from 'lucide-react'
import { ScrollAnimation } from '@/components/ui/scroll-animation'

const steps = [
  {
    number: '01',
    icon: Send,
    title: 'API Request',
    description: 'Your AI agent makes a request to a paid API endpoint.',
  },
  {
    number: '02',
    icon: CreditCard,
    title: 'HTTP 402 Response',
    description: 'Server returns payment requirements including price and payment address.',
  },
  {
    number: '03',
    icon: CheckCircle,
    title: 'Automatic Payment',
    description: 'Session key signs USDC transfer. Request retries with payment proof.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container">
        <ScrollAnimation animation="fade-up">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">
              How x402 Payments Work
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A simple three-step flow that enables autonomous, secure payments
              without constant user intervention.
            </p>
          </div>
        </ScrollAnimation>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2 hidden lg:block" />

            <div className="space-y-8 lg:space-y-0">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isLast = index === steps.length - 1
                const isEven = index % 2 === 1

                return (
                  <ScrollAnimation
                    key={step.number}
                    animation={isEven ? 'slide-right' : 'slide-left'}
                    delay={index * 150}
                    className="relative"
                  >
                    <div className={`flex flex-col lg:flex-row items-center gap-6 lg:gap-12 ${
                      isEven ? 'lg:flex-row-reverse' : ''
                    }`}>
                      {/* Content */}
                      <div className={`flex-1 text-center lg:text-left ${
                        isEven ? 'lg:text-right' : ''
                      }`}>
                        <span className="text-primary font-mono text-sm mb-2 block">
                          Step {step.number}
                        </span>
                        <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>

                      {/* Icon */}
                      <div className="relative z-10 flex-shrink-0">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background">
                          <Icon className="size-7 text-primary" />
                        </div>
                      </div>

                      {/* Spacer for alternating layout */}
                      <div className="flex-1 hidden lg:block" />
                    </div>

                    {/* Arrow between steps */}
                    {!isLast && (
                      <div className="flex justify-center py-4 lg:hidden">
                        <ArrowDown className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </ScrollAnimation>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
