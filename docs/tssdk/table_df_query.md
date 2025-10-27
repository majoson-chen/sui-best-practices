# Sui Table DF 查询演示说明

## 概述

本演示详细展示如何在 Sui 测试网中查询包含 Table 结构的合约数据。
我们将深入讲解如何查询 `DeTaskStore` 对象以及其中的 `tbtask` Table 内容，并提供具体的查询语句和返回结果示例。

## 合约结构示范示例

### DeTaskStore 结构

```move
struct DeTaskStore has key, store {
    id: UID,                    // object id
    tbtask: table::Table<u64, TaskID>,  // nid, TaskID
}
```

### TaskID 结构

```move
struct TaskID has key, store {
    id: UID,                    // object id
    name: string::String,       // task name
    cost: u64,                 // task cost
}
```

### 前期准备

```
    deTaskStoreId: "0xcfb552a63e002d7c9a1b291d360bb1159a1caf1ff04b5967724a310ef02a34ce", // DeTaskStore 对象 ID

    packageId: "0xf4cfb002100765cca7481e74fba7a43031be37f06477b19239221dcb80f95941", // 实际的合约包 ID

    network: 'testnet' // 网络配置
```

## 查询方法详解

### 1. 查询 DeTaskStore 对象内容

#### 查询语句

```
async function queryDeTaskStore() {
    try {
        console.log('🔍 查询 DeTaskStore 对象...');

        const objectResult = await client.getObject({
            id: CONFIG.deTaskStoreId,
            options: {
                showContent: true,
                showType: true,
                showOwner: true,
                showPreviousTransaction: true
            }
        });

        if (objectResult.error) {
            throw new Error(`查询失败: ${objectResult.error}`);
        }

        const objectData = objectResult.data;
        console.log('✅ DeTaskStore 对象信息:');
        console.log('   对象ID:', objectData.objectId);
        console.log('   类型:', objectData.type);
        console.log('   所有者:', objectData.owner);

        if (objectData.content) {
            console.log('   内容详情:');
            console.log('   - UID:', objectData.content.fields.id);
            console.log('   - Table ID:', objectData.content.fields.tbtask.fields.id);
            console.log('   - Table 大小:', objectData.content.fields.tbtask.fields.size);
        }

        return objectData;
    } catch (error) {
        console.error('❌ 查询 DeTaskStore 失败:', error.message);
        throw error;
    }
}

```

#### 返回结果示例

```
🚀 开始 Sui Table 查询演示
=====================================
🔍 查询 DeTaskStore 对象...
✅ DeTaskStore 对象信息:
   对象ID: 0xcfb552a63e002d7c9a1b291d360bb1159a1caf1ff04b5967724a310ef02a34ce
   类型: 0xf4cfb002100765cca7481e74fba7a43031be37f06477b19239221dcb80f95941::tablequery::DeTaskStore
   所有者: { Shared: { initial_shared_version: 629897369 } }
   内容详情:
   - UID: {
  id: '0xcfb552a63e002d7c9a1b291d360bb1159a1caf1ff04b5967724a310ef02a34ce'
}
   - Table ID: {
  id: '0x08104eeb9bccceac7a9300cc5d2631698d0f60cd8cf491702acd3da76b27e315'
}
   - Table 大小: 1
```

### 2. 查询 Table (tbtask) 中的所有条目

#### 查询语句 我们用 getDynamicFields 方法来获取动态字段，该方法可以查询 Table 对象中的所有条目。

#### parentId 填入刚才查询到的 Table ID 字段值。

```javascript
async function queryTableEntries() {
    try {
        console.log('\n📋 查询 Table 中的条目...')

        // 获取 Table 对象的动态字段
        const dynamicFields = await client.getDynamicFields({
            parentId: '0x08104eeb9bccceac7a9300cc5d2631698d0f60cd8cf491702acd3da76b27e315'
        })

        console.log(`✅ 找到 ${dynamicFields.data.length} 个动态字段:`)

        for (let i = 0; i < dynamicFields.data.length; i++) {
            const field = dynamicFields.data[i]
            console.log(`\n   条目 ${i + 1}:`)
            console.log('   - 字段名:', field.name)
            console.log('   - 字段类型:', field.type)
            console.log('   - 对象ID:', field.objectId)

            // 获取具体的 TaskID 对象详情
            if (field.objectId) {
                const taskDetails = await client.getObject({
                    id: field.objectId,
                    options: {
                        showContent: true,
                        showType: true
                    }
                })

                if (taskDetails.data && taskDetails.data.content) {
                    console.log('   - TaskID 详情:')
                    console.log('     * UID:', taskDetails.data.content.fields.id.id)
                    console.log('     * 名称:', taskDetails.data.content.fields.value.fields.name)
                    console.log('     * 成本:', taskDetails.data.content.fields.value.fields.cost, 'MIST')
                    console.log('     * 成本(SUI):', (Number(taskDetails.data.content.fields.value.fields.cost) / 1000000000).toFixed(9), 'SUI')
                }
            }
        }

        return dynamicFields.data
    }
    catch (error) {
        console.error('❌ 查询 Table 条目失败:', error.message)
        throw error
    }
}
```

#### 返回结果示例

```
📋 查询 Table 中的条目...
✅ 找到 1 个动态字段:

   条目 1:
   - 字段名: { type: 'u64', value: '1' }
   - 字段类型: DynamicField
   - 对象ID: 0x28a47e6204df5401c79eec12d18557bdc38fac934aada45634b4d05077ef05f8
   - TaskID 详情:
     * UID: 0x28a47e6204df5401c79eec12d18557bdc38fac934aada45634b4d05077ef05f8
     * 名称: tnew1
     * 成本: 1234 MIST
     * 成本(SUI): 0.000001234 SUI

🎉 Table 查询演示完成!
```

#### 注意事项

这里的名称、成本数据是真实数据，可以从测试网获取以便于确认。
