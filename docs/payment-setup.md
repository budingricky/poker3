# 支付功能配置指南

本文档详细说明如何为 Poker3 游戏配置微信支付和支付宝支付功能。

## 一、概述

Poker3 内购系统采用标准的网页支付流程：
1. 客户端创建订单，选择支付方式（微信/支付宝）。
2. 服务器生成支付参数，返回支付链接或二维码。
3. 用户跳转到支付页面完成支付。
4. 支付平台异步回调服务器，服务器更新订单状态。
5. 客户端轮询订单状态，支付成功后发放商品。

## 二、微信支付配置

### 2.1 申请商户号
1. 访问 [微信支付商户平台](https://pay.weixin.qq.com) 注册企业账号。
2. 完成实名认证，获取以下关键信息：
   - **商户号 (mch_id)**：10位数字
   - **API密钥 (api_key)**：32位字符串，在「账户中心」-「API安全」设置
   - **AppID**：若使用公众号支付，需有已认证的服务号（需企业资质）

### 2.2 配置支付产品
推荐使用 **Native支付**（二维码支付）或 **JSAPI支付**（微信内浏览器）：
- **Native支付**：用户扫描二维码支付，适合PC和移动端。
- **JSAPI支付**：需要在微信浏览器内，需配置授权域名。

### 2.3 服务器端集成
#### 安装依赖
```bash
npm install wechatpay-node-v3
```

#### 示例代码（服务端）
在 `server/app/api/routes/shop.ts` 中实现：

```typescript
import { WechatPay } from 'wechatpay-node-v3'
const pay = new WechatPay({
  appid: '你的AppID',
  mchid: '商户号',
  publicKey: fs.readFileSync('apiclient_cert.pem'), // 公钥
  privateKey: fs.readFileSync('apiclient_key.pem'), // 私钥
})

// 创建订单
app.post('/api/shop/order', async (ctx) => {
  const { productId, paymentMethod } = ctx.request.body
  const order = await pay.native({
    description: 'Poker3游戏币',
    out_trade_no: '订单号',
    amount: { total: 100 }, // 单位分
    notify_url: 'https://你的域名.com/api/shop/wechat/notify'
  })
  ctx.body = {
    success: true,
    data: {
      orderId: order.out_trade_no,
      paymentUrl: order.code_url, // 二维码地址
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(order.code_url)}`
    }
  }
})
```

#### 支付回调
配置 `notify_url` 并实现回调接口，验证签名并更新订单状态。

### 2.4 客户端集成
1. 获取 `paymentUrl` 后，可在新窗口打开或显示二维码。
2. 使用 `setInterval` 轮询订单状态接口 `/api/shop/order/:orderId`。

## 三、支付宝配置

### 3.1 申请开放平台账号
1. 访问 [支付宝开放平台](https://open.alipay.com) 注册企业账号。
2. 创建「网页&移动应用」，获取：
   - **APP_ID**
   - **应用私钥** (app_private_key)
   - **支付宝公钥** (alipay_public_key)

### 3.2 签约支付产品
在「功能列表」中添加「电脑网站支付」或「手机网站支付」。

### 3.3 服务器端集成
#### 安装依赖
```bash
npm install alipay-sdk
```

#### 示例代码
```typescript
import AlipaySdk from 'alipay-sdk'
const alipay = new AlipaySdk({
  appId: 'APP_ID',
  privateKey: '应用私钥',
  alipayPublicKey: '支付宝公钥',
})

app.post('/api/shop/order', async (ctx) => {
  const result = await alipay.pageExec('alipay.trade.page.pay', {
    method: 'POST',
    bizContent: {
      out_trade_no: '订单号',
      total_amount: '1.00', // 单位元
      subject: 'Poker3游戏币',
      product_code: 'FAST_INSTANT_TRADE_PAY'
    },
    return_url: 'https://你的域名.com/shop/success',
    notify_url: 'https://你的域名.com/api/shop/alipay/notify'
  })
  ctx.body = {
    success: true,
    data: { paymentUrl: result }
  }
})
```

### 3.4 客户端集成
将返回的 `paymentUrl` 直接跳转，或使用 iframe 嵌入。

## 四、安全注意事项

1. **金额校验**：服务端必须校验商品价格，防止篡改。
2. **签名验证**：所有回调必须验证签名，确保来自支付平台。
3. **防重放**：使用订单号幂等性处理，避免重复发货。
4. **HTTPS**：生产环境必须使用 HTTPS，确保通信安全。
5. **日志记录**：记录所有支付请求和回调，便于排查问题。

## 五、测试与上线

### 5.1 沙箱测试
- **微信支付沙箱**：提供测试账号和模拟支付。
- **支付宝沙箱**：可模拟完整支付流程。

### 5.2 上线检查清单
- [ ] 商户号已通过实名认证
- [ ] 支付产品已签约
- [ ] 回调域名已配置（微信需ICP备案）
- [ ] 服务器时间已同步（避免签名错误）
- [ ] 订单状态轮询机制已实现
- [ ] 支付成功后的商品发放逻辑已测试

## 六、常见问题

### Q1：微信支付提示“当前页面的URL未注册”
A：需在微信商户平台「开发配置」中设置「支付授权目录」。

### Q2：支付宝回调接收不到
A：检查 `notify_url` 是否公网可访问，且支付宝允许向该域名发送通知。

### Q3：跨域问题
A：确保服务端设置正确的 CORS 头，或通过代理请求支付接口。

### Q4：金额单位混淆
A：微信支付单位为**分**，支付宝单位为**元**，转换时需注意。

## 七、扩展功能建议

1. **虚拟货币系统**：引入游戏币，支付后充值游戏币，再消费。
2. **优惠券/折扣**：支持促销活动。
3. **支付记录查询**：用户可查看历史订单。
4. **退款流程**：支持部分或全额退款。

---

如有疑问，请参考官方文档：
- [微信支付文档](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [支付宝文档](https://opendocs.alipay.com/open/270/105899)

**注意**：本指南仅提供技术集成思路，实际接入需遵守各平台规则及法律法规。