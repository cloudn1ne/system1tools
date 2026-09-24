import { useCallback, useEffect, useState } from 'react'
import type { TemplateDef } from './types'
import { BUILTIN_TEMPLATES, blankTemplate } from './presets'

const STORAGE_KEY = 'system1.templates.v1'

function readStore(): TemplateDef[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed as TemplateDef[]
  } catch {
    return null
  }
}

function writeStore(list: TemplateDef[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota or private mode: keep working in memory */
  }
}

function uniqueId(base: string, list: TemplateDef[]): string {
  if (!list.some((t) => t.id === base)) return base
  let n = 2
  while (list.some((t) => t.id === `${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/** Predefined question sets, persisted to localStorage with full CRUD. */
export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateDef[]>(() => readStore() ?? BUILTIN_TEMPLATES)

  useEffect(() => {
    writeStore(templates)
  }, [templates])

  const create = useCallback((): string => {
    const t = { ...blankTemplate(templates.length + 1), id: uniqueId(`custom_${templates.length + 1}`, templates) }
    setTemplates((prev) => [...prev, t])
    return t.id
  }, [templates])

  const update = useCallback((id: string, next: TemplateDef) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...next, id } : t)))
  }, [])

  const remove = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const duplicate = useCallback(
    (id: string): string | null => {
      const src = templates.find((t) => t.id === id)
      if (!src) return null
      const copy: TemplateDef = {
        ...structuredClone(src),
        id: uniqueId(`${src.id}_copy`, templates),
        label: `${src.label} (copy)`,
        builtin: false,
      }
      setTemplates((prev) => [...prev, copy])
      return copy.id
    },
    [templates],
  )

  const restoreDefaults = useCallback(() => setTemplates(BUILTIN_TEMPLATES), [])

  /** Import: same id replaces (so an edited export round-trips), new ids are appended. */
  const merge = useCallback(
    (incoming: TemplateDef[]): { added: TemplateDef[]; updated: TemplateDef[] } => {
      const added: TemplateDef[] = []
      const updated: TemplateDef[] = []
      setTemplates((prev) => {
        let next = [...prev]
        for (const t of incoming) {
          const i = next.findIndex((x) => x.id === t.id)
          if (i >= 0) {
            updated.push(next[i])
            next[i] = { ...t, id: next[i].id }
          } else {
            const withId = { ...t, id: uniqueId(t.id, next) }
            added.push(withId)
            next = [...next, withId]
          }
        }
        return next
      })
      return { added, updated }
    },
    [],
  )

  return { templates, create, update, remove, duplicate, restoreDefaults, merge }
}
