import type { SkillDefinition } from '../types'
import { importSkillFromJson } from './skills'

function getSkillUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  if (!value || typeof value !== 'object') return []

  const skills = (value as Record<string, unknown>).skills
  if (!Array.isArray(skills)) return []
  return skills
    .map((item) => typeof item === 'string'
      ? item
      : item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string'
      ? String((item as Record<string, unknown>).url)
      : '',
    )
    .filter((item) => Boolean(item.trim()))
}

function resolveSkillUrl(url: string, manifestUrl: string) {
  const resolved = new URL(url, manifestUrl)
  if (resolved.origin !== window.location.origin && resolved.protocol !== 'https:') {
    throw new Error('仅支持同源或 HTTPS Skill URL')
  }
  return resolved.toString()
}

export async function loadSkillsFromManifest(): Promise<SkillDefinition[]> {
  const manifestUrl = new URL('skills/index.json', new URL(import.meta.env.BASE_URL, window.location.href)).toString()
  const response = await fetch(manifestUrl, { cache: 'no-store' })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`读取 Skill 索引失败：${response.status}`)

  const manifest = await response.json()
  const urls = getSkillUrls(manifest)
  const skills: SkillDefinition[] = []
  for (const url of urls) {
    try {
      const skillUrl = resolveSkillUrl(url, manifestUrl)
      const skillResponse = await fetch(skillUrl, { cache: 'no-store' })
      if (!skillResponse.ok) throw new Error(`HTTP ${skillResponse.status}`)
      skills.push(importSkillFromJson(await skillResponse.text(), skills))
    } catch (err) {
      console.warn('Failed to load skill:', url, err)
    }
  }

  return skills
}
