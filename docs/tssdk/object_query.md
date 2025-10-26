# Sui 对象查询演示说明

## 代码结构

### 1. 导入和初始化

```javascript
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client')

// 连接到 Sui 测试网
const client = new SuiClient({
    url: getFullnodeUrl('testnet'),
})
```

**说明**:

- 导入 Sui TypeScript SDK 的核心组件
- 创建连接到 Sui 测试网的客户端实例
- `getFullnodeUrl('testnet')` 自动获取测试网节点地址
