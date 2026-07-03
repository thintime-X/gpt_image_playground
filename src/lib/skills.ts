import type { AppMode, SkillDefinition, SkillPreset, SkillPromptMode, SkillPresetMode, TaskParams } from '../types'
import { DEFAULT_PARAMS } from '../types'
import { normalizeImageSize } from './size'

export const SKILL_SCHEMA = 'gpt-image-playground.skill.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[^\r\n]*\r?\n([\s\S]*?)\r?\n```$/)
  return match ? match[1].trim() : trimmed
}

function createSkillId(name: string, usedIds: Set<string>): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill'
  let id = slug
  let index = 2
  while (usedIds.has(id)) {
    id = `${slug}-${index}`
    index += 1
  }
  usedIds.add(id)
  return id
}

function createPresetId(name: string, usedIds: Set<string>): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preset'
  let id = slug
  let index = 2
  while (usedIds.has(id)) {
    id = `${slug}-${index}`
    index += 1
  }
  usedIds.add(id)
  return id
}

function normalizePresetMode(value: unknown): SkillPresetMode {
  return value === 'gallery' || value === 'agent' ? value : 'all'
}

function normalizeTriggers(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const triggers = value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map((item) => item.trim())
    .filter((item, idx, list) => list.indexOf(item) === idx)
  return triggers.length ? triggers : undefined
}

function normalizePromptMode(value: unknown): SkillPromptMode {
  if (value === 'append' || value === 'prepend') return value
  return 'replace'
}

function normalizeOutputFormat(value: unknown): TaskParams['output_format'] | undefined {
  return value === 'jpeg' || value === 'webp' || value === 'png' ? value : undefined
}

function normalizeQuality(value: unknown): TaskParams['quality'] | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'auto' ? value : undefined
}

function normalizeModeration(value: unknown): TaskParams['moderation'] | undefined {
  return value === 'low' || value === 'auto' ? value : undefined
}

function normalizeOutputCompression(value: unknown): number | null | undefined {
  if (value === null) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return undefined
  return Math.min(100, Math.max(0, Math.trunc(numeric)))
}

export function normalizeSkillPresetParams(value: unknown): Partial<TaskParams> | undefined {
  if (!isRecord(value)) return undefined

  const params: Partial<TaskParams> = {}
  if (typeof value.size === 'string' && value.size.trim()) {
    params.size = value.size.trim() === 'auto'
      ? DEFAULT_PARAMS.size
      : normalizeImageSize(value.size)
  }

  const quality = normalizeQuality(value.quality)
  if (quality) params.quality = quality

  const outputFormat = normalizeOutputFormat(value.output_format)
  if (outputFormat) params.output_format = outputFormat

  const outputCompression = normalizeOutputCompression(value.output_compression)
  if (outputCompression !== undefined) params.output_compression = outputCompression

  const moderation = normalizeModeration(value.moderation)
  if (moderation) params.moderation = moderation

  const n = typeof value.n === 'number' ? value.n : Number(value.n)
  if (Number.isFinite(n)) params.n = Math.min(10, Math.max(1, Math.trunc(n)))

  if (typeof value.transparent_output === 'boolean') params.transparent_output = value.transparent_output

  return Object.keys(params).length ? params : undefined
}

export function normalizeSkillPreset(input: unknown, usedIds = new Set<string>()): SkillPreset | null {
  if (!isRecord(input)) return null

  const rawName = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : '未命名预设'
  const id = typeof input.id === 'string' && input.id.trim() && !usedIds.has(input.id.trim())
    ? input.id.trim()
    : createPresetId(rawName, usedIds)
  usedIds.add(id)

  const prompt = typeof input.prompt === 'string' && input.prompt.trim() ? input.prompt.trim() : undefined
  const params = normalizeSkillPresetParams(input.params)
  if (!prompt && !params && typeof input.profileId !== 'string') return null

  return {
    id,
    name: rawName,
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    mode: normalizePresetMode(input.mode),
    triggers: normalizeTriggers(input.triggers),
    autoApply: typeof input.autoApply === 'boolean' ? input.autoApply : undefined,
    prompt,
    promptMode: normalizePromptMode(input.promptMode),
    params,
    profileId: typeof input.profileId === 'string' && input.profileId.trim() ? input.profileId.trim() : undefined,
  }
}

export function normalizeSkill(input: unknown, usedIds = new Set<string>()): SkillDefinition | null {
  if (!isRecord(input)) return null

  const rawName = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : '未命名技能'
  const id = typeof input.id === 'string' && input.id.trim() && !usedIds.has(input.id.trim())
    ? input.id.trim()
    : createSkillId(rawName, usedIds)
  usedIds.add(id)

  const presetIds = new Set<string>()
  const presets = Array.isArray(input.presets)
    ? input.presets
      .map((preset) => normalizeSkillPreset(preset, presetIds))
      .filter((preset): preset is SkillPreset => Boolean(preset))
    : []
  if (presets.length === 0) return null

  return {
    schema: typeof input.schema === 'string' && input.schema.trim() ? input.schema.trim() : SKILL_SCHEMA,
    id,
    name: rawName,
    version: typeof input.version === 'string' && input.version.trim() ? input.version.trim() : '1.0.0',
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    customProviders: Array.isArray(input.customProviders) ? input.customProviders as SkillDefinition['customProviders'] : undefined,
    profiles: Array.isArray(input.profiles) ? input.profiles as SkillDefinition['profiles'] : undefined,
    presets,
  }
}

export function normalizeSkills(input: unknown): SkillDefinition[] {
  const usedIds = new Set<string>()
  const list = Array.isArray(input) ? input : []
  return list
    .map((item) => normalizeSkill(item, usedIds))
    .filter((item): item is SkillDefinition => Boolean(item))
}

export function importSkillFromJson(jsonText: string, existingSkills: SkillDefinition[] = []): SkillDefinition {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(jsonText))
  } catch {
    throw new Error('JSON 格式无效')
  }

  const skill = normalizeSkill(parsed)
  if (!skill) throw new Error('没有找到有效的技能预设')
  return skill
}

export function mergeImportedSkills(currentSkills: SkillDefinition[], importedSkills: SkillDefinition[]): SkillDefinition[] {
  const merged = [...currentSkills]
  for (const skill of importedSkills) {
    const idx = merged.findIndex((item) => item.id === skill.id)
    if (idx >= 0) {
      merged[idx] = skill
    } else {
      merged.push(skill)
    }
  }
  return normalizeSkills(merged)
}

export function getSkillPresetsForMode(skills: SkillDefinition[], mode: AppMode) {
  return skills.flatMap((skill) =>
    skill.presets
      .filter((preset) => preset.mode === 'all' || preset.mode === mode)
      .map((preset) => ({ skill, preset })),
  )
}

function canAutoApplyPreset(preset: SkillPreset) {
  const triggers = preset.triggers ?? []
  return triggers.length > 0 ? preset.autoApply !== false : preset.autoApply === true
}

function includesText(text: string, value: string) {
  return Boolean(value.trim()) && text.includes(value.trim().toLocaleLowerCase())
}

export function findAutoSkillPreset(skills: SkillDefinition[], prompt: string, mode: AppMode) {
  const text = prompt.trim().toLocaleLowerCase()
  if (!text) return null

  for (const item of getSkillPresetsForMode(skills, mode)) {
    const triggers = item.preset.triggers ?? []
    if (triggers.length > 0) {
      if (!canAutoApplyPreset(item.preset)) continue
      if (triggers.some((trigger) => includesText(text, trigger))) return item
      continue
    }

    if (canAutoApplyPreset(item.preset)) {
      const fallbackTriggers = [item.skill.name, item.preset.name, item.skill.id, item.preset.id]
      if (fallbackTriggers.some((trigger) => includesText(text, trigger))) return item
    }
  }

  return null
}

function stripPresetPrompt(prompt: string, presetPrompt: string) {
  const text = prompt.trim()
  const chunk = presetPrompt.trim()
  if (!text || !chunk) return prompt
  if (text === chunk) return ''
  if (text.startsWith(`${chunk}\n\n`)) return text.slice(chunk.length).trimStart()
  if (text.endsWith(`\n\n${chunk}`)) return text.slice(0, -chunk.length).trimEnd()
  return prompt
}

export function stripAutoSkillPresetPrompts(skills: SkillDefinition[], prompt: string, mode: AppMode) {
  let next = prompt
  for (const item of getSkillPresetsForMode(skills, mode)) {
    if (!item.preset.prompt || !canAutoApplyPreset(item.preset)) continue
    next = stripPresetPrompt(next, item.preset.prompt)
  }
  return next
}

export function applySkillPreset(
  preset: SkillPreset,
  currentPrompt: string,
  currentParams: TaskParams,
): { prompt: string; params: TaskParams } {
  const presetPrompt = preset.prompt?.trim()
  const nextPrompt = !presetPrompt
    ? currentPrompt
    : currentPrompt.includes(presetPrompt)
    ? currentPrompt
    : preset.promptMode === 'append'
    ? currentPrompt.trim() ? `${currentPrompt.trimEnd()}\n\n${presetPrompt}` : presetPrompt
    : preset.promptMode === 'prepend'
    ? currentPrompt.trim() ? `${presetPrompt}\n\n${currentPrompt.trimStart()}` : presetPrompt
    : presetPrompt

  return {
    prompt: nextPrompt,
    params: {
      ...currentParams,
      ...(preset.params ?? {}),
    },
  }
}
