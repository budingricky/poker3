import React, { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import OfflineGameTable from '../components/OfflineGameTable'
import { PRESET_NAMES } from '../offline/names'
import { OfflineEngine, pickAiNames, type Difficulty } from '../offline/engine'
import { verifyDeepseekApiKey } from '../offline/deepseek'

type AiMode = 'local' | 'deepseek'

const difficultyLabels: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

export default function Offline() {
  const [name, setName] = useState(() => localStorage.getItem('playerName') || '我')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [seed, setSeed] = useState(0)
  const [engine, setEngine] = useState<OfflineEngine | null>(null)
  const [aiMode, setAiMode] = useState<AiMode>('local')
  const [deepseekApiKey, setDeepseekApiKey] = useState(() => localStorage.getItem('deepseekApiKey') || '')
  const [checkingKey, setCheckingKey] = useState(false)

  useEffect(() => {
    if (aiMode !== 'deepseek') return
    localStorage.setItem('deepseekApiKey', deepseekApiKey)
  }, [aiMode, deepseekApiKey])

  const aiNames = useMemo(() => {
    const picked = pickAiNames({ preset: PRESET_NAMES, exclude: name.trim() || '我', count: 3 })
    return [picked[0] || 'AI1', picked[1] || 'AI2', picked[2] || 'AI3'] as [string, string, string]
  }, [name, seed])

  if (engine) {
    return (
      <OfflineGameTable
        engine={engine}
        aiMode={aiMode}
        deepseekApiKey={aiMode === 'deepseek' ? deepseekApiKey : ''}
        onExit={() => {
          setEngine(null)
        }}
      />
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-500">离线模式</div>
          <h1 className="text-2xl font-extrabold mt-1">准备开始</h1>
          <div className="text-gray-600 mt-1">输入昵称并选择难度，随后开始游戏。</div>
        </div>
        <BackButton to="/" label="返回主页" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="font-bold text-lg mb-3">你的信息</div>
          <label className="block text-sm text-gray-600 mb-1">昵称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={12}
            className="w-full rounded-xl border px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="请输入昵称"
          />

          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">难度</div>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={[
                    'rounded-xl border px-3 py-2 font-bold',
                    difficulty === d ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-gray-50',
                  ].join(' ')}
                >
                  {difficultyLabels[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm text-gray-600 mb-2">对手 AI</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAiMode('local')}
                className={[
                  'rounded-xl border px-3 py-2 font-bold',
                  aiMode === 'local' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-gray-50',
                ].join(' ')}
              >
                本地算法
              </button>
              <button
                onClick={() => setAiMode('deepseek')}
                className={[
                  'rounded-xl border px-3 py-2 font-bold',
                  aiMode === 'deepseek' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-gray-50',
                ].join(' ')}
              >
                DeepSeek-V3.2
              </button>
            </div>
            {aiMode === 'deepseek' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">DeepSeek API Key</label>
                <input
                  value={deepseekApiKey}
                  onChange={e => setDeepseekApiKey(e.target.value)}
                  type="password"
                  className="w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="将保存在本机浏览器 localStorage"
                />
                <div className="text-xs text-gray-500 mt-2">
                  注意：localStorage 与打包后的前端代码都不能保护密钥，任何能打开页面的人都能在开发者工具中看到。
                </div>
                <div className="mt-2">
                  <button
                    onClick={() => {
                      localStorage.removeItem('deepseekApiKey')
                      setDeepseekApiKey('')
                    }}
                    className="rounded-lg bg-white hover:bg-gray-50 border px-3 py-1.5 text-sm font-semibold"
                  >
                    清除 Key
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={() => setSeed(x => x + 1)}
              className="rounded-xl bg-white hover:bg-gray-50 border px-4 py-2 font-semibold"
            >
              换一组对手
            </button>
            <button
              onClick={async () => {
                const finalName = (name || '我').trim() || '我'
                localStorage.setItem('playerName', finalName)
                if (aiMode === 'deepseek') {
                  const key = deepseekApiKey.trim()
                  if (!key) {
                    alert('请先填写 DeepSeek API Key')
                    return
                  }
                  setCheckingKey(true)
                  try {
                    await verifyDeepseekApiKey({ apiKey: key })
                  } catch (e) {
                    alert(e instanceof Error ? e.message : String(e))
                    return
                  } finally {
                    setCheckingKey(false)
                  }
                }
                const e = new OfflineEngine({ humanName: finalName, otherNames: aiNames, difficulty })
                e.startGame()
                setEngine(e)
              }}
              disabled={(aiMode === 'deepseek' && deepseekApiKey.trim().length === 0) || checkingKey}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 font-extrabold"
            >
              {checkingKey ? '校验中…' : '开始游戏'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="font-bold text-lg mb-3">座位预览</div>
          <div className="grid grid-cols-2 gap-3">
            {[name.trim() || '我', ...aiNames].map((n, idx) => (
              <div key={`${idx}-${n}`} className="rounded-2xl border bg-gray-50 p-4 text-center">
                <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center font-extrabold text-gray-700">
                  {n[0]?.toUpperCase() || 'P'}
                </div>
                <div className="font-semibold">{n}</div>
                {idx === 0 ? <div className="text-xs text-green-600 mt-1">（你）</div> : null}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-3">对手名称来自预设列表，随机且不重复。</div>
        </div>
      </div>
    </div>
  )
}
