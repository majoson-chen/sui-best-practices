# 实战解析：Move 合约中的批量处理模式

在区块链应用中，批量处理多个对象是常见需求：批量转账、NFT 批量铸造、游戏背包管理等。如果每个操作都单独执行，gas 成本高且效率低。**批量处理模式**帮助我们高效、安全地处理大量对象。

本文通过**NFT 集合管理系统**的实战案例，掌握 Move 中的批量处理技巧。

## 为什么需要批量处理？

### 传统方式的问题

在区块链上，如果为每个操作发起一次交易：
- **Gas 成本高**：每次交易都要支付固定的基础 gas
- **效率低下**：需要等待多次交易确认
- **用户体验差**：需要多次签名授权

### 批量处理的优势

- **降低成本**：一次交易处理多个对象
- **提升效率**：原子性操作，要么全成功要么全失败
- **简化逻辑**：统一处理，避免状态不一致

## 第一步：定义 NFT 集合结构

```move
module nft_collection::batch_nft {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::vector;
    use sui::event;

    /// NFT 结构
    public struct NFT has key, store {
        id: UID,
        name: String,
        collection_id: ID,
        serial_number: u64,
        owner: address,
    }

    /// NFT 集合
    public struct NFTCollection has key, store {
        id: UID,
        name: String,
        total_supply: u64,
        creator: address,
    }

    /// 错误码
    const EEmptyBatch: u64 = 1;
    const ELengthMismatch: u64 = 2;
    const ENotOwner: u64 = 3;
    const ETooManyItems: u64 = 4;
}
```

## 第二步：新手常犯的错误

### 错误1：循环中对象未被完全处理

```move
// 错误示例：循环结束后 vector 中还有对象
public fun bad_batch_process(nfts: vector<NFT>) {
    let len = vector::length(&nfts);
    let mut i = 0;
    
    while (i < len / 2) {  // 只处理一半
        let nft = vector::pop_back(&mut nfts);
        transfer::public_transfer(nft, 0x1);
        i = i + 1;
    };
    
    // 编译错误：vector 中还有对象，不能销毁
    // vector::destroy_empty(nfts);
}
```

**问题分析**：vector 中的所有对象必须被取出并处理，只有空 vector 才能销毁。

## 第三步：批量处理的基础模式

### 模式1：批量铸造 NFT

```move
/// 批量铸造 NFT
public fun batch_mint_nfts(
    collection: &mut NFTCollection,
    names: vector<vector<u8>>,
    recipients: vector<address>,
    ctx: &mut TxContext
) {
    let count = vector::length(&names);
    
    // 验证输入
    assert!(count > 0, EEmptyBatch);
    assert!(count == vector::length(&recipients), ELengthMismatch);
    assert!(count <= 100, ETooManyItems);
    
    let mut i = 0;
    let mut names = names;
    let mut recipients = recipients;
    while (i < count) {
        let name_bytes = vector::pop_back(&mut names);
        let recipient = vector::pop_back(&mut recipients);
        
        let nft = NFT {
            id: object::new(ctx),
            name: string::utf8(name_bytes),
            collection_id: object::id(collection),
            serial_number: collection.total_supply + i,
            owner: recipient,
        };
        
        transfer::public_transfer(nft, recipient);
        i = i + 1;
    };
    
    vector::destroy_empty(names);
    vector::destroy_empty(recipients);
    
    collection.total_supply = collection.total_supply + count;
    
    event::emit(BatchMintEvent {
        collection_id: object::id(collection),
        count,
        creator: tx_context::sender(ctx),
    });
}

public struct BatchMintEvent has copy, drop {
    collection_id: ID,
    count: u64,
    creator: address,
}
```

### 模式2：批量转移 NFT

```move
/// 批量转移给单个接收者
public fun batch_transfer_to_one(
    nfts: vector<NFT>,
    recipient: address,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);
    let count = vector::length(&nfts);
    assert!(count > 0, EEmptyBatch);
    assert!(count <= 100, ETooManyItems);
    
    let mut i = 0;
    while (i < count) {
        let nft = vector::pop_back(&mut nfts);
        assert!(nft.owner == sender, ENotOwner);
        let mut nft = nft;
        nft.owner = recipient;
        transfer::public_transfer(nft, recipient);
        i = i + 1;
    };
    
    vector::destroy_empty(nfts);
    
    event::emit(BatchTransferEvent {
        from: sender,
        to: recipient,
        count,
    });
}

/// 批量转移给多个接收者
public fun batch_transfer_to_many(
    nfts: vector<NFT>,
    recipients: vector<address>,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);
    let count = vector::length(&nfts);
    
    assert!(count > 0, EEmptyBatch);
    assert!(count == vector::length(&recipients), ELengthMismatch);
    assert!(count <= 100, ETooManyItems);
    
    let mut i = 0;
    while (i < count) {
        let nft = vector::pop_back(&mut nfts);
        let recipient = *vector::borrow(&recipients, count - 1 - i);
        assert!(nft.owner == sender, ENotOwner);
        let mut nft = nft;
        nft.owner = recipient;
        transfer::public_transfer(nft, recipient);
        i = i + 1;
    };
    
    vector::destroy_empty(nfts);
}

public struct BatchTransferEvent has copy, drop {
    from: address,
    to: address,
    count: u64,
}
```

### 模式3：批量销毁

```move
/// 批量销毁 NFT
public fun batch_burn_nfts(
    nfts: vector<NFT>,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);
    let count = vector::length(&nfts);
    assert!(count > 0, EEmptyBatch);
    assert!(count <= 100, ETooManyItems);
    
    let mut i = 0;
    while (i < count) {
        let nft = vector::pop_back(&mut nfts);
        assert!(nft.owner == sender, ENotOwner);
        
        let NFT { id, name: _, collection_id: _, serial_number: _, owner: _ } = nft;
        object::delete(id);
        i = i + 1;
    };
    
    vector::destroy_empty(nfts);
    
    event::emit(BatchBurnEvent {
        owner: sender,
        count,
    });
}

public struct BatchBurnEvent has copy, drop {
    owner: address,
    count: u64,
}
```

## 第四步：高级批量处理

### 场景1：批量条件处理（筛选）

```move
/// 只转移符合条件的 NFT
public fun batch_transfer_filtered(
    nfts: vector<NFT>,
    min_serial: u64,
    max_serial: u64,
    recipient: address,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);
    let count = vector::length(&nfts);
    assert!(count <= 100, ETooManyItems);
    let mut transferred = 0;
    let mut returned = 0;
    
    while (vector::length(&nfts) > 0) {
        let nft = vector::pop_back(&mut nfts);
        assert!(nft.owner == sender, ENotOwner);
        
        if (nft.serial_number >= min_serial && nft.serial_number <= max_serial) {
            let mut nft = nft;
            nft.owner = recipient;
            transfer::public_transfer(nft, recipient);
            transferred = transferred + 1;
        } else {
            let mut nft = nft;
            nft.owner = sender;
            transfer::public_transfer(nft, sender);
            returned = returned + 1;
        }
    };
    
    vector::destroy_empty(nfts);
    
    event::emit(BatchFilteredTransferEvent {
        from: sender,
        to: recipient,
        transferred,
        returned,
    });
}

public struct BatchFilteredTransferEvent has copy, drop {
    from: address,
    to: address,
    transferred: u64,
    returned: u64,
}
```

### 场景2：分批处理大量数据

```move
/// 分批转移（处理一部分，返回剩余）
public fun batch_transfer_chunk(
    nfts: vector<NFT>,
    recipient: address,
    chunk_size: u64,
    ctx: &TxContext
): vector<NFT> {
    let sender = tx_context::sender(ctx);
    let total = vector::length(&nfts);
    let to_process = if (chunk_size < total) { chunk_size } else { total };
    assert!(chunk_size > 0, EEmptyBatch);
    assert!(to_process <= 100, ETooManyItems);
    
    let mut remaining = vector::empty<NFT>();
    let mut processed = 0;
    
    // 处理一批
    while (processed < to_process) {
        let nft = vector::pop_back(&mut nfts);
        assert!(nft.owner == sender, ENotOwner);
        let mut nft = nft;
        nft.owner = recipient;
        transfer::public_transfer(nft, recipient);
        processed = processed + 1;
    };
    
    // 保留剩余
    while (vector::length(&nfts) > 0) {
        let nft = vector::pop_back(&mut nfts);
        vector::push_back(&mut remaining, nft);
    };
    
    vector::destroy_empty(nfts);
    remaining
}
```

## 第五步：性能优化技巧

### 优化1：一次性验证

```move
/// 先验证后处理
public fun optimized_batch_transfer(
    nfts: vector<NFT>,
    recipient: address,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);
    let count = vector::length(&nfts);
    assert!(count <= 100, ETooManyItems);
    
    // 一次性验证所有权
    let mut i = 0;
    while (i < count) {
        let nft = vector::borrow(&nfts, i);
        assert!(nft.owner == sender, ENotOwner);
        i = i + 1;
    };
    
    // 批量转移
    while (vector::length(&nfts) > 0) {
        let nft = vector::pop_back(&mut nfts);
        let mut nft = nft;
        nft.owner = recipient;
        transfer::public_transfer(nft, recipient);
    };
    
    vector::destroy_empty(nfts);
}
```

### 优化2：使用引用（只读）

```move
/// 批量查询序列号
public fun batch_query_serials(nfts: &vector<NFT>): vector<u64> {
    let count = vector::length(nfts);
    let mut serials = vector::empty<u64>();
    
    let mut i = 0;
    while (i < count) {
        let nft = vector::borrow(nfts, i);
        vector::push_back(&mut serials, nft.serial_number);
        i = i + 1;
    };
    
    serials
}

/// 批量验证所有权
public fun batch_verify_ownership(
    nfts: &vector<NFT>,
    expected_owner: address
): bool {
    let count = vector::length(nfts);
    let mut i = 0;
    
    while (i < count) {
        let nft = vector::borrow(nfts, i);
        if (nft.owner != expected_owner) {
            return false;
        };
        i = i + 1;
    };
    
    true
}
```

## 实战经验总结

### **核心原则**

1. **完整处理**：vector 中所有对象必须被处理
2. **空后销毁**：只有空 vector 才能 `destroy_empty`
3. **原子操作**：批量操作要么全成功，要么全失败
4. **限制数量**：单次批量不超过 100-200 个对象

### **调试技巧**

- **检查循环完整性**：确认所有对象都被处理
- **验证 vector 清空**：确保销毁前 vector 为空
- **追踪对象流向**：转移、返回还是销毁？

### **性能优化**

- **批量验证**：一次性验证，避免重复检查
- **使用借用**：只读操作用引用
- **限制批量大小**：防止 gas 超限
- **分批处理**：大量数据分多次交易

### **最佳实践**

1. **明确数量限制**：防止单次操作过大
2. **提供筛选功能**：条件性批量处理
3. **发出批量事件**：记录统计信息
4. **支持分批操作**：大数据集分多次处理

## 总结

通过本文，我们掌握了批量处理模式：

- **基础模式**：批量铸造、转移、销毁
- **高级场景**：条件筛选、分批处理
- **性能优化**：预先验证、使用引用
- **核心原则**：完整处理、原子操作

**关键收获**：批量处理不仅降低 gas 成本，更通过原子性操作保证数据一致性，是构建高性能区块链应用的关键技术。

## 下一步学习

- [复合所有权模式](./composite-ownership-pattern.md)：组合多种模式解决复杂问题 *(即将发布)*
