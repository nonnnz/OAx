"use client"

import type React from "react"

import { cn } from "../lib/utils"

interface MenuOption {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface MenuSelectorProps {
  options: MenuOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function MenuSelector({
  options,
  value,
  onChange,
  className,
}: MenuSelectorProps) {
  return (
    <div className={cn("flex w-full overflow-x-auto pb-2", className)}>
      <div className="flex space-x-8 px-4">
        {options.map((option) => {
          const Icon = option.icon
          return (
            <div
              className="flex flex-col items-center gap-2 text-center"
              key={option.id}
            >
              <button
                key={option.id}
                onClick={() => onChange(option.id)}
                className={cn(
                  "flex h-16 w-16 flex-col items-center justify-center rounded-md border transition-colors",
                  value === option.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {Icon && <Icon className="h-8 w-8" />}
              </button>
              <span className="text-sm font-medium">{option.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
