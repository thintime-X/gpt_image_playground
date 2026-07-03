import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import {
  applySkillPreset,
  findAutoSkillPreset,
  importSkillFromJson,
  mergeImportedSkills,
  normalizeSkillPresetParams,
  stripAutoSkillPresetPrompts,
} from './skills'
import { DEFAULT_SETTINGS, mergeImportedSettings } from './apiProfiles'

describe('skill import', () => {
  it('imports a JSON skill with prompt and params presets', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      version: '1.0.0',
      presets: [{
        id: 'white-bg',
        name: '白底主图',
        triggers: ['白底', '商品主图'],
        autoApply: true,
        prompt: '生成白底商品图',
        params: {
          size: '1024x1024',
          quality: 'high',
          output_format: 'png',
          n: 2,
        },
      }],
    }))

    expect(skill).toMatchObject({
      id: 'product-photo',
      name: '商品图',
      version: '1.0.0',
      presets: [{
        id: 'white-bg',
        triggers: ['白底', '商品主图'],
        autoApply: true,
        prompt: '生成白底商品图',
        params: {
          size: '1024x1024',
          quality: 'high',
          output_format: 'png',
          n: 2,
        },
      }],
    })
  })

  it('rejects JSON without valid presets', () => {
    expect(() => importSkillFromJson('{"name":"空 Skill","presets":[]}')).toThrow('没有找到有效的技能预设')
  })
})

describe('skill auto apply', () => {
  it('matches preset triggers for the current mode', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      presets: [{
        id: 'white-bg',
        name: '白底主图',
        mode: 'gallery',
        triggers: ['白底', '商品主图'],
        prompt: '生成白底商品图',
      }],
    }))

    const match = findAutoSkillPreset([skill], '请生成一个白底商品主图', 'gallery')

    expect(match?.skill.id).toBe('product-photo')
    expect(match?.preset.id).toBe('white-bg')
  })

  it('does not auto match a trigger when autoApply is false', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      presets: [{
        id: 'white-bg',
        name: '白底主图',
        triggers: ['白底'],
        autoApply: false,
        prompt: '生成白底商品图',
      }],
    }))

    expect(findAutoSkillPreset([skill], '请生成白底商品图', 'gallery')).toBeNull()
  })

  it('uses skill and preset names only when autoApply is true without triggers', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      presets: [{
        id: 'white-bg',
        name: '白底主图',
        autoApply: true,
        prompt: '生成白底商品图',
      }],
    }))

    expect(findAutoSkillPreset([skill], '商品图：一瓶香水', 'gallery')?.preset.id).toBe('white-bg')
  })
})

describe('skill params', () => {
  it('keeps only supported task params', () => {
    expect(normalizeSkillPresetParams({
      size: '1200x900',
      quality: 'best',
      output_format: 'webp',
      output_compression: 120,
      moderation: 'low',
      n: 20,
      transparent_output: true,
      ignored: 'value',
    })).toEqual({
      size: '1200x896',
      output_format: 'webp',
      output_compression: 100,
      moderation: 'low',
      n: 10,
      transparent_output: true,
    })
  })
})

describe('skill merge', () => {
  it('updates existing skills by id', () => {
    const current = [importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      version: '1.0.0',
      presets: [{ id: 'old', name: '旧预设', prompt: '旧' }],
    }))]
    const imported = [importSkillFromJson(JSON.stringify({
      id: 'product-photo',
      name: '商品图',
      version: '1.1.0',
      presets: [{ id: 'new', name: '新预设', prompt: '新' }],
    }))]

    const merged = mergeImportedSkills(current, imported)

    expect(merged).toHaveLength(1)
    expect(merged[0].version).toBe('1.1.0')
    expect(merged[0].presets[0].id).toBe('new')
  })

  it('merges skills without adding default API profiles', () => {
    const current = mergeImportedSettings(DEFAULT_SETTINGS, {
      profiles: [{
        id: 'customized-openai',
        name: '自定义配置',
        provider: 'openai',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'gpt-image-2',
        timeout: 600,
        apiMode: 'images',
        codexCli: false,
        apiProxy: false,
      }],
    })
    const merged = mergeImportedSettings(current, {
      skills: [importSkillFromJson(JSON.stringify({
        id: 'product-photo',
        name: '商品图',
        presets: [{ id: 'white-bg', name: '白底主图', prompt: '白底' }],
      }))],
    })

    expect(merged.profiles).toHaveLength(1)
    expect(merged.profiles[0].id).toBe('customized-openai')
    expect(merged.skills).toHaveLength(1)
  })
})

describe('skill apply', () => {
  it('applies prompt and params to the current input', () => {
    const result = applySkillPreset({
      id: 'white-bg',
      name: '白底主图',
      mode: 'all',
      prompt: '生成白底商品图',
      promptMode: 'append',
      params: { quality: 'high', n: 3 },
    }, '原始提示词', DEFAULT_PARAMS)

    expect(result.prompt).toBe('原始提示词\n\n生成白底商品图')
    expect(result.params).toMatchObject({ quality: 'high', n: 3 })
  })

  it('does not append the same prompt twice', () => {
    const result = applySkillPreset({
      id: 'white-bg',
      name: '白底主图',
      mode: 'all',
      prompt: '生成白底商品图',
      promptMode: 'append',
      params: { quality: 'high' },
    }, '原始提示词\n\n生成白底商品图', DEFAULT_PARAMS)

    expect(result.prompt).toBe('原始提示词\n\n生成白底商品图')
    expect(result.params).toMatchObject({ quality: 'high' })
  })
})

describe('skill prompt cleanup', () => {
  it('strips prepended auto skill prompts from old agent history', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'visual-baseline',
      name: '视觉基准',
      presets: [{
        id: 'ask-baseline',
        name: '询问基准',
        mode: 'agent',
        triggers: ['UI'],
        promptMode: 'prepend',
        prompt: '先确认色调和尺寸。',
      }],
    }))

    expect(stripAutoSkillPresetPrompts(
      [skill],
      '先确认色调和尺寸。\n\n生成一个移动端登录页UI',
      'agent',
    )).toBe('生成一个移动端登录页UI')
  })

  it('strips appended auto skill prompts from old agent history', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'visual-baseline',
      name: '视觉基准',
      presets: [{
        id: 'ask-baseline',
        name: '询问基准',
        mode: 'agent',
        triggers: ['UI'],
        promptMode: 'append',
        prompt: '先确认色调和尺寸。',
      }],
    }))

    expect(stripAutoSkillPresetPrompts(
      [skill],
      '生成一个移动端登录页UI\n\n先确认色调和尺寸。',
      'agent',
    )).toBe('生成一个移动端登录页UI')
  })

  it('keeps manual-only skill prompts in history', () => {
    const skill = importSkillFromJson(JSON.stringify({
      id: 'manual-only',
      name: '手动预设',
      presets: [{
        id: 'manual',
        name: '手动',
        mode: 'agent',
        promptMode: 'prepend',
        prompt: '手动加入的规则。',
      }],
    }))

    expect(stripAutoSkillPresetPrompts(
      [skill],
      '手动加入的规则。\n\n生成一个移动端登录页UI',
      'agent',
    )).toBe('手动加入的规则。\n\n生成一个移动端登录页UI')
  })
})
