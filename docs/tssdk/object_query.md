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

### 2. 核心查询函数

```javascript
async function queryObject(objectId) {
    try {
        console.log(`🔍 查询对象: ${objectId}`)
        console.log('='.repeat(60))

        // 调用 getObject 方法查询对象
        const objectInfo = await client.getObject({
            id: objectId,
            options: {
                showType: true, // 显示对象类型
                showOwner: true, // 显示所有者信息
                showPreviousTransaction: true, // 显示上一笔交易
                showDisplay: true, // 显示显示字段
                showContent: true, // 显示内容字段
                showBcs: true, // 显示BCS数据
                showStorageRebate: true // 显示存储退款
            }
        })

        // 处理和显示查询结果...
        return objectInfo
    }
    catch (error) {
        console.error('❌ 查询对象失败:', error.message)
        return null
    }
}
```

**说明**:

- `client.getObject()` 是核心查询方法
- `options` 参数控制返回哪些信息字段
- 包含完整的错误处理机制
