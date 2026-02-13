import { Link } from 'react-router-dom'

export default function BackButton({ to = '/', label = '返回' }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200 text-gray-800 font-semibold"
    >
      <span className="text-lg leading-none">←</span>
      <span>{label}</span>
    </Link>
  )
}

