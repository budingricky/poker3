import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clearServerBaseUrl, getServerBaseUrl } from '../services/serverConfig'

export default function ModeSelect() {
  const saved = getServerBaseUrl()

  const [serverInput, setServerInput] = useState(saved || '')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-3xl font-extrabold text-green-800">Poker3</div>
          <div className="text-gray-600 mt-1">选择游玩方式</div>
        </div>
        {saved ? (
          <button
            onClick={() => {
              clearServerBaseUrl()
              setServerInput('')
            }}
            className="rounded-full bg-white/80 hover:bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200 text-gray-800 font-semibold"
          >
            断开服务器
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="text-xl font-bold mb-2">在线游玩</div>
          <div className="text-gray-600 mb-4">选择服务器后进入联机大厅。</div>
          <Link
            to="/online"
            className="inline-flex items-center justify-center w-full rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2 font-semibold"
          >
            进入
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="text-xl font-bold mb-2">离线游玩</div>
          <div className="text-gray-600 mb-4">单机练习与人机对战。</div>
          <Link
            to="/offline"
            className="inline-flex items-center justify-center w-full rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2 font-semibold"
          >
            进入
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="text-xl font-bold mb-2">局域网组队</div>
          <div className="text-gray-600 mb-4">
            进入服务器选择界面，自动发现局域网服务器并连接。
          </div>
          <Link
            to="/server-select/lan"
            className="inline-flex items-center justify-center w-full rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2 font-semibold"
          >
            进入
          </Link>
        </div>
      </div>
    </div>
  )
}
