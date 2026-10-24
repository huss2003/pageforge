import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../cn'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap ' +
  'transition-[background-color,color,border-color,transform] duration-150 ease-(--ease-out) ' +
  'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-strong',
  secondary: 'border border-fg/80 text-fg hover:border-fg hover:bg-fg hover:text-surface',
  quiet:
    'px-0! text-fg underline decoration-line decoration-1 underline-offset-[0.3em] hover:decoration-fg',
}

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg') {
  return cn(base, variants[variant], sizes[size])
}

export interface ButtonLinkProps extends ComponentPropsWithoutRef<'a'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * A link styled as an action. Primary is route magenta and appears once per
 * screen; secondary is an ink outline; quiet is an underlined text link.
 * Labels name what happens. No arrow glyphs.
 */
export function ButtonLink({
  variant = 'primary',
  size = 'lg',
  className,
  ...props
}: ButtonLinkProps) {
  return <a className={cn(buttonClass(variant, size), className)} {...props} />
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'primary',
  size = 'lg',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />
}
