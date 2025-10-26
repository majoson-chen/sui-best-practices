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

### 3. 演示函数

```javascript
async function demonstrateObjectQueries() {
    console.log('🚀 Sui 对象查询演示')
    console.log('='.repeat(80))

    // 示例对象ID列表（包含不同类型的对象）
    const exampleObjects = [
        {
            id: '0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d',
            description: '智能合约包'
        },
        {
            id: '0x0000000000000000000000000000000000000000000000000000000000000006',
            description: '系统对象（时钟）'
        }
    ]

    for (const example of exampleObjects) {
        console.log(`\n📌 查询示例: ${example.description}`)
        await queryObject(example.id)
        console.log(`\n${'='.repeat(80)}`)
    }
}
```

**说明**:

- 提供预配置的示例对象进行演示
- 包含不同类型的对象（智能合约包、系统对象）
- 循环查询每个示例对象
