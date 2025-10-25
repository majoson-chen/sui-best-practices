# Sui BCS 操作演示

这个项目演示了如何使用 Sui 的 BCS（Binary Canonical Serialization）库进行数据序列化和反序列化操作。

## 安装依赖

```bash
npm install
```

## 运行演示

```bash
node bcs_demo.js
```

## 演示内容

这个演示包含了以下 BCS 操作示例：

### 1. 基本数据类型序列化
- 演示如何序列化和反序列化 `u64` 类型数据
- 展示序列化后的字节数组格式

### 2. 字符串序列化
- 演示字符串的 BCS 编码和解码过程

### 3. 地址序列化
- 演示 Sui 地址的序列化操作
- 地址格式：32 字节的十六进制字符串

### 4. 向量序列化
- 演示数组（向量）类型的序列化
- 使用 `vector<u64>` 作为示例

### 5. 复杂结构序列化
- 定义和序列化自定义结构体 `Coin`
- 包含多个字段的数据结构处理

### 6. 交易数据序列化
- 模拟简单交易数据的序列化
- 包含发送方、接收方、金额和 Gas 费用

## BCS 简介

BCS（Binary Canonical Serialization）是 Sui 区块链使用的序列化格式，具有以下特点：

- **确定性**：相同的数据总是产生相同的序列化结果
- **高效性**：紧凑的二进制格式，节省存储空间
- **跨语言**：支持多种编程语言的实现
- **类型安全**：强类型的序列化系统

## 代码结构

```javascript
const { bcs } = require('@mysten/bcs');

// 创建数据类型
const u64Type = bcs.u64();

// 序列化数据
const serialized = u64Type.serialize(42n).toBytes();

// 反序列化数据
const deserialized = u64Type.parse(serialized);
```

## 支持的数据类型

- 基本类型：`u8`, `u16`, `u32`, `u64`, `u128`, `u256`, `bool`
- 字符串：`string`
- 地址：`address`
- 向量：`vector<T>`
- 结构体：通过 `registerStructType` 注册
- 可选类型：`Option<T>`

## 注意事项

1. 数字类型使用 BigInt 格式（如 `42n`）
2. 地址必须是 32 字节的十六进制字符串
3. 自定义结构体需要先注册才能使用
4. 序列化和反序列化使用相同的类型定义

## 相关资源

- [Sui 官方文档](https://docs.sui.io/)
- [BCS SDK 参考](https://sdk.mystenlabs.com/typescript/bcs)
- [BCS 规范](https://github.com/diem/bcs)
- [@mysten/sui npm 包](https://www.npmjs.com/package/@mysten/sui)
