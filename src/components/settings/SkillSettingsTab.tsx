import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AppSettings } from '../../types'
import { useStore } from '../../store'
import { importSkillFromJson, SKILL_SCHEMA } from '../../lib/skills'
import { CodeIcon, ImportIcon, TrashIcon } from '../icons'

interface SkillSettingsTabProps {
  draft: AppSettings
  onSettingsChanged: (settings: AppSettings) => void
}

const EXAMPLE_SKILL_JSON = `{
  "schema": "${SKILL_SCHEMA}",
  "id": "product-photo",
  "name": "商品图",
  "version": "1.0.0",
  "presets": [
    {
      "id": "white-bg",
      "name": "白底主图",
      "triggers": ["白底", "商品主图", "电商"],
      "autoApply": true,
      "promptMode": "append",
      "prompt": "为以下商品生成干净的白底电商主图：{商品描述}",
      "params": {
        "size": "1024x1024",
        "quality": "high",
        "output_format": "png",
        "n": 1
      }
    }
  ]
}`

export default function SkillSettingsTab({ draft, onSettingsChanged }: SkillSettingsTabProps) {
  const importSkill = useStore((s) => s.importSkill)
  const removeSkill = useStore((s) => s.removeSkill)
  const showToast = useStore((s) => s.showToast)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [jsonText, setJsonText] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)

  const refreshDraft = () => {
    onSettingsChanged(useStore.getState().settings)
  }

  const importJsonText = (text: string) => {
    const skill = importSkillFromJson(text, draft.skills)
    importSkill(skill)
    refreshDraft()
    setJsonText('')
    setImportError(null)
    showToast(`已导入 Skill「${skill.name}」`, 'success')
  }

  const handleImportJson = () => {
    try {
      if (!jsonText.trim()) throw new Error('请先粘贴 Skill JSON')
      importJsonText(jsonText)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsReadingFile(true)
    try {
      importJsonText(await file.text())
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsReadingFile(false)
    }
  }

  const confirmRemoveSkill = (id: string, name: string) => {
    setConfirmDialog({
      title: '删除 Skill',
      message: `确定要删除 Skill「${name}」吗？已导入的 API 配置不会被删除。`,
      action: () => {
        removeSkill(id)
        refreshDraft()
        showToast('Skill 已删除', 'success')
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-50/80 p-4 border border-gray-200/60 dark:bg-white/[0.02] dark:border-white/[0.05] flex items-start gap-3">
        <CodeIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        <div data-selectable-text className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          JSON Skill 用于保存可复用的提示词和参数预设。把文件放到 <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-white/[0.06]">public/skills/</code>，并在 <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-white/[0.06]">public/skills/index.json</code> 中登记后，重启开发服务或重新部署即可自动加载。
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.02] space-y-3">
        <div className="flex items-center gap-2">
          <ImportIcon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">导入 Skill JSON</h4>
        </div>

        <textarea
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value)
            setImportError(null)
          }}
          spellCheck={false}
          placeholder={EXAMPLE_SKILL_JSON}
          className="h-48 w-full resize-none rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50 custom-scrollbar"
        />

        {importError && (
          <div data-selectable-text className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500 dark:bg-red-500/10 dark:text-red-300">
            {importError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportJson}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            导入 JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadingFile}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
          >
            {isReadingFile ? '读取中...' : '选择文件'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">已安装 Skill</h4>
          <span className="text-xs text-gray-400 dark:text-gray-500">{draft.skills.length} 个</span>
        </div>

        {draft.skills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center text-sm text-gray-400 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-gray-500">
            暂无 Skill
          </div>
        ) : (
          draft.skills.map((skill) => (
            <div key={skill.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{skill.name}</h5>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                      v{skill.version}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-white/[0.08] dark:text-gray-400">
                      {skill.presets.length} 个预设
                    </span>
                  </div>
                  {skill.description && (
                    <p data-selectable-text className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {skill.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => confirmRemoveSkill(skill.id, skill.name)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  aria-label={`删除 Skill「${skill.name}」`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {skill.presets.map((preset) => (
                  <span key={preset.id} className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                    {preset.name}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
