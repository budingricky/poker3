import React, { useEffect, useState } from 'react'
import { api } from '../services/api'
import BackButton from '../components/BackButton'
import { Product } from '../types'

const mockProducts: Product[] = [
  { id: 'coin_100', name: '100游戏币', description: '可用于购买头像、主题等', price: 600, currency: 'CNY', type: 'coin', icon: '💰' },
  { id: 'coin_500', name: '500游戏币', description: '超值礼包', price: 3000, currency: 'CNY', type: 'coin', icon: '💎' },
  { id: 'coin_1000', name: '1000游戏币', description: '豪华礼包，额外赠送100币', price: 5000, currency: 'CNY', type: 'coin', icon: '🎁' },
  { id: 'avatar_1', name: '炫酷头像', description: '专属稀有头像', price: 1500, currency: 'CNY', type: 'avatar', icon: '👑' },
  { id: 'theme_dark', name: '暗黑主题', description: '深色界面主题', price: 2000, currency: 'CNY', type: 'theme', icon: '🎨' },
  { id: 'vip_30', name: 'VIP月卡', description: '30天VIP特权', price: 3000, currency: 'CNY', type: 'vip', icon: '⭐' },
]

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<'wechat' | 'alipay'>('wechat')
  const [orderStatus, setOrderStatus] = useState<string | null>(null)

  const loadProducts = async () => {
    // 使用模拟API加载产品数据
    try {
      const res = await api.getProducts()
      if (res.success) setProducts(res.data)
    } catch {
      // 如果API调用失败，使用本地模拟数据作为后备
      setProducts(mockProducts)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handlePurchase = async (product: Product) => {
    if (loading) return
    setLoading(true)
    setOrderStatus(`正在创建 ${product.name} 订单...`)
    try {
      // 调用模拟API创建订单
      const res = await api.createOrder(product.id, selectedPayment)
      if (!res.success) throw new Error('创建订单失败')
      const orderId = res.data.orderId
      setOrderStatus(`订单 ${orderId} 已创建。正在跳转到支付页面...`)
      // 实际项目中可跳转到 paymentUrl 或显示二维码
      // window.open(res.data.paymentUrl, '_blank')
      // 模拟支付成功回调
      setTimeout(() => {
        setOrderStatus(`支付成功！您已获得 ${product.name}。`)
        setLoading(false)
      }, 2000)
    } catch (e) {
      setOrderStatus('支付失败，请重试')
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => `¥${(cents / 100).toFixed(2)}`

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">游戏商店</h1>
          <div className="text-sm text-gray-500">购买游戏币、头像、主题等</div>
        </div>
        <BackButton to="/lan" label="返回大厅" />
      </div>

      {orderStatus && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
          {orderStatus}
        </div>
      )}

      <div className="mb-8">
        <div className="text-lg font-bold mb-2">选择支付方式</div>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="payment"
              checked={selectedPayment === 'wechat'}
              onChange={() => setSelectedPayment('wechat')}
              className="mr-2"
            />
            <span className="flex items-center">
              <span className="text-green-600 text-xl mr-1">💳</span> 微信支付
            </span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="payment"
              checked={selectedPayment === 'alipay'}
              onChange={() => setSelectedPayment('alipay')}
              className="mr-2"
            />
            <span className="flex items-center">
              <span className="text-blue-600 text-xl mr-1">💰</span> 支付宝
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="bg-white rounded-2xl shadow border overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-3xl mb-2">{product.icon}</div>
                  <div className="font-bold text-lg">{product.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{product.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-700">{formatPrice(product.price)}</div>
                  <div className="text-xs text-gray-500">人民币</div>
                </div>
              </div>
              <button
                onClick={() => handlePurchase(product)}
                disabled={loading}
                className="mt-4 w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '处理中...' : `用${selectedPayment === 'wechat' ? '微信' : '支付宝'}购买`}
              </button>
              {product.type === 'coin' && (
                <div className="text-xs text-gray-500 mt-2 text-center">即时到账</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-xl border">
        <div className="font-bold mb-2">支付说明</div>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• 本商店为模拟支付，实际接入请参考配置文档。</li>
          <li>• 微信支付需申请商户号并配置JSAPI支付。</li>
          <li>• 支付宝需申请网页支付接口并配置公钥。</li>
          <li>• 支付成功后，商品将自动添加到您的账户。</li>
          <li>• 如有问题，请联系客服。</li>
        </ul>
      </div>
    </div>
  )
}