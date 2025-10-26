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

## 使用方法

### 1. 基本演示模式

```bash
node object_query_demo.js
```

**输出示例**:

```
🚀 Sui 对象查询演示
================================================================================

📌 查询示例: 智能合约包
🔍 查询对象: 0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d
============================================================
📋 对象基本信息:
   对象ID: 0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d
   版本: 284825067
   数字化: 8xKjZ8r7m3qL9pX2sT5vY1wZ4cA7bD9eF2gH6iJ1kL3nO5qR8uV0xY3z

🏷️  对象类型: 0x2::package::UpgradeCap

👤 所有者信息:
   地址所有者: 0x8c0c5d7b3e9f2a1b4c6d8e0f3a5b7c9d1e2f4a6b8c0d5e7f9a2b4c6d8e0f3a5

🔄 上一笔交易: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef123456

💰 存储退款: 1520000 MIST

📦 对象内容:
{
  "fields": {
    "package": "0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d",
    "version": {
      "major": 1,
      "minor": 0,
      "patch": 0
    },
    "policy": {
      "cap": "0x9f8e7d6c5b4a3210fedcba9876543210fedcba9876543210fedcba9876543210"
    }
  },
  "type": "0x2::package::UpgradeCap"
}
```

### 2. 指定对象查询

```bash
node object_query_demo.js 0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d
```

**输出示例**:

```
🎯 单对象查询模式
🔍 查询对象: 0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d
============================================================
📋 对象基本信息:
   对象ID: 0x6b0c51f4925126d690619091b317fda87d1cd5223e82ecb0bcb6ded3baa3d91d
   版本: 284825067
   数字化: 8xKjZ8r7m3qL9pX2sT5vY1wZ4cA7bD9eF2gH6iJ1kL3nO5qR8uV0xY3z

🏷️  对象类型: 0x2::package::UpgradeCap
...
```
