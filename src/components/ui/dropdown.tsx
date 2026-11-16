"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Radix Select forbids an empty item value, so an empty <option value=""> travels under this key.
const EMPTY = "__empty__"
const encode = (value: string) => (value === "" ? EMPTY : value)
const decode = (value: string) => (value === EMPTY ? "" : value)

type Option = { value: string; label: React.ReactNode; disabled?: boolean }

/** Collect <option> children (also through fragments, arrays and conditionals) so a native select can be swapped 1:1. */
function collect(children: React.ReactNode, into: Option[] = []): Option[] {
  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean }
    if (child.type === React.Fragment) collect(props.children, into)
    else if (child.type === "option") into.push({ value: String(props.value ?? props.children ?? ""), label: props.children, disabled: props.disabled })
  })
  return into
}

type DropdownProps = {
  value: string | number
  onChange: (event: { target: { value: string } }) => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  "aria-label"?: string
}

/**
 * App-styled replacement for a native <select>: same props (value, onChange(e.target.value), <option> children),
 * but the list is drawn by the app instead of the operating system.
 */
export function Dropdown({ value, onChange, children, className, disabled, required, id, name, ...rest }: DropdownProps) {
  const options = collect(children)
  const current = encode(String(value))
  return (
    <Select value={current} onValueChange={next => onChange({ target: { value: decode(next) } })} disabled={disabled} required={required} name={name}>
      <SelectTrigger id={id} aria-label={rest["aria-label"]} className={cn("min-h-11 w-full min-w-32 rounded-lg border bg-background px-3 text-sm", className)}>
        <SelectValue>{options.find(option => encode(option.value) === current)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="max-h-72 min-w-(--radix-select-trigger-width)">
        {options.map(option => (
          <SelectItem key={option.value} value={encode(option.value)} disabled={option.disabled} className="min-h-10 text-sm">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
