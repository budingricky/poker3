import BackButton from '../components/BackButton'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <BackButton to="/" label="返回" />
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-gray-600 mb-6">该模式即将上线。</p>
    </div>
  )
}
