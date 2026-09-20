import { load as parseYaml } from 'js-yaml'
import { useCallback, useSyncExternalStore } from 'react'
import type { Lang } from '../engine/configSchema'
import { rng } from '../engine/rng'
import enRaw from './en.yaml?raw'
import ptBrRaw from './pt-BR.yaml?raw'

type Dict = { [key: string]: string | string[] | Dict }

const DICTS: Record<Lang, Dict> = {
  en: parseYaml(enRaw) as Dict,
  'pt-BR': parseYaml(ptBrRaw) as Dict,
}

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  'pt-BR': 'Português (BR)',
}

let current: Lang = 'pt-BR'
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function setLanguage(lang: Lang): void {
  if (lang === current) return
  current = lang
  document.documentElement.lang = lang
  for (const listener of listeners) listener()
}

export const getLanguage = (): Lang => current

function lookup(lang: Lang, key: string): string | string[] | undefined {
  let node: unknown = DICTS[lang]
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Dict)[part]
  }
  return typeof node === 'string' || Array.isArray(node) ? node : undefined
}

const interpolate = (template: string, params?: Record<string, string | number>): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        params[name] === undefined ? match : String(params[name]),
      )
    : template

/**
 * Falls back to English, then to the key itself, so a missing translation shows
 * up as something readable on screen rather than as a blank.
 */
export function translate(
  key: string,
  params?: Record<string, string | number>,
  lang: Lang = current,
): string {
  const found = lookup(lang, key) ?? (lang === 'en' ? undefined : lookup('en', key))
  if (found === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`)
    return key
  }
  const text = Array.isArray(found) ? (found[0] ?? key) : found
  return interpolate(text, params)
}

/** Every variant of a list key, e.g. all the host's "correct" lines. */
export function translateList(key: string, lang: Lang = current): string[] {
  const found = lookup(lang, key) ?? lookup('en', key)
  if (Array.isArray(found)) return found
  return found === undefined ? [] : [found]
}

/** One random variant. This is what keeps the host from repeating itself. */
export function translateRandom(
  key: string,
  params?: Record<string, string | number>,
  lang: Lang = current,
): string {
  const variants = translateList(key, lang)
  if (variants.length === 0) return translate(key, params, lang)
  return interpolate(rng.pick(variants), params)
}

export interface I18n {
  lang: Lang
  t: (key: string, params?: Record<string, string | number>) => string
  tList: (key: string) => string[]
  tRandom: (key: string, params?: Record<string, string | number>) => string
  setLanguage: (lang: Lang) => void
}

export function useI18n(): I18n {
  const lang = useSyncExternalStore(subscribe, getLanguage, getLanguage)
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, params, lang),
    [lang],
  )
  const tList = useCallback((key: string) => translateList(key, lang), [lang])
  const tRandom = useCallback(
    (key: string, params?: Record<string, string | number>) => translateRandom(key, params, lang),
    [lang],
  )
  return { lang, t, tList, tRandom, setLanguage }
}
