# 实战解析：Move 合约中的条件性所有权管理模式（下）- 进阶篇

在上篇中，我们学习了条件性所有权管理的基础概念和 Option<T> 的基本用法。本文将深入探讨更复杂的业务场景：条件性赠送、双方交换和批量处理。

**前置阅读**：[条件性所有权管理模式（上）- 基础篇](./conditional-ownership-pattern-part1.md)

## 场景一：条件性赠送（礼物盒系统）

游戏中的新手礼包往往有等级限制："达到10级才能打开"。我们来实现一个完整的礼物盒系统。

```move
module game::gift_system {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::option::{Self, Option};
    use sui::event;
    use game::item_crafting::GameItem;

    /// 礼物盒结构
    public struct GiftBox has key, store {
        id: UID,
        item: Option<GameItem>,      // 包含的道具
        required_level: u8,           // 需要的等级
        expiry_epoch: u64,            // 过期时间
        sender: address,              // 赠送者
        recipient: address,           // 接收者
    }

    /// 打开礼物盒（多重条件检查）
    public fun open_gift_box(
        gift_box: GiftBox,
        player_level: u8,
        ctx: &TxContext
    ): Option<GameItem> {
        let sender = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        let GiftBox { 
            id, item, required_level, expiry_epoch,
            sender: gift_sender, recipient 
        } = gift_box;
        
        // 验证接收者
        assert!(sender == recipient, ENotRecipient);
        
        // 判断条件
        let is_expired = current_epoch > expiry_epoch;
        let level_sufficient = player_level >= required_level;
        
        if (is_expired) {
            // 过期：退回赠送者
            if (option::is_some(&item)) {
                let mut temp = item;
                let returned = option::extract(&mut temp);
                transfer::public_transfer(returned, gift_sender);
                option::destroy_none(temp);
            } else {
                option::destroy_none(item);
            };
            object::delete(id);
            option::none()
        } else if (!level_sufficient) {
            // 等级不足：原样返回
            let returned_box = GiftBox {
                id, item, required_level, expiry_epoch,
                sender: gift_sender, recipient,
            };
            transfer::public_transfer(returned_box, recipient);
            option::none()
        } else {
            // 成功打开
            object::delete(id);
            item
        }
    }

    const ENotRecipient: u64 = 1;
}
```

**关键点**：三个不同分支对应三种结果：退回、返还、成功。每个分支都正确处理了 `item` 和 `id`。

## 场景二：双方确认的道具交换

玩家之间交换道具需要双方同意，支持单向赠送和双向交换。

```move
module game::trade_system {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::option::{Self, Option};
    use game::item_crafting::GameItem;

    /// 交换提议
    public struct TradeProposal has key, store {
        id: UID,
        proposer: address,
        proposer_item: Option<GameItem>,
        target: address,
        is_gift: bool,  // 是否是单向赠送
    }

    /// 接受赠送（单向）
    public fun accept_gift(proposal: TradeProposal, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        let TradeProposal { 
            id, proposer, proposer_item, target, is_gift 
        } = proposal;
        
        assert!(sender == target, ENotTarget);
        assert!(is_gift, ENotGift);
        
        // 转移道具
        if (option::is_some(&proposer_item)) {
            let mut temp = proposer_item;
            let item = option::extract(&mut temp);
            transfer::public_transfer(item, target);
            option::destroy_none(temp);
        } else {
            option::destroy_none(proposer_item);
        };
        
        object::delete(id);
    }

    /// 接受交换（双向）
    public fun accept_exchange(
        proposal: TradeProposal,
        target_item: GameItem,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let TradeProposal { 
            id, proposer, proposer_item, target, is_gift 
        } = proposal;
        
        assert!(sender == target, ENotTarget);
        assert!(!is_gift, EIsGift);
        
        // 原子性交换
        if (option::is_some(&proposer_item)) {
            let mut temp = proposer_item;
            let item1 = option::extract(&mut temp);
            transfer::public_transfer(item1, target);
            transfer::public_transfer(target_item, proposer);
            option::destroy_none(temp);
        } else {
            transfer::public_transfer(target_item, proposer);
            option::destroy_none(proposer_item);
        };
        
        object::delete(id);
    }

    /// 取消交换
    public fun cancel_trade(proposal: TradeProposal, ctx: &TxContext) {
        let sender = tx_context::sender(ctx);
        let TradeProposal { 
            id, proposer, proposer_item, target: _, is_gift: _ 
        } = proposal;
        
        assert!(sender == proposer, ENotProposer);
        
        // 返还道具
        if (option::is_some(&proposer_item)) {
            let mut temp = proposer_item;
            let item = option::extract(&mut temp);
            transfer::public_transfer(item, proposer);
            option::destroy_none(temp);
        } else {
            option::destroy_none(proposer_item);
        };
        
        object::delete(id);
    }

    const ENotTarget: u64 = 1;
    const ENotProposer: u64 = 2;
    const ENotGift: u64 = 3;
    const EIsGift: u64 = 4;
}
```

**关键设计**：
- 单向赠送：只转移提议者的道具
- 双向交换：原子性交换双方道具
- 取消机制：安全返还道具

## 场景三：批量条件处理

批量操作中，部分可能成功，部分可能失败，需要分别处理。

```move
module game::batch_operations {
    use std::vector;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use game::item_crafting::{GameItem, CraftingRecipe};

    /// 批量合成结果
    public struct BatchCraftResult has drop {
        success_count: u64,
        failed_count: u64,
    }

    /// 批量合成（部分成功）
    public fun batch_craft_items(
        materials: vector<GameItem>,
        recipe: &CraftingRecipe,
        random_values: vector<u8>,
        ctx: &mut TxContext
    ): BatchCraftResult {
        let sender = tx_context::sender(ctx);
        let material_count = vector::length(&materials);
        
        assert!(material_count % 2 == 0, EInvalidCount);
        assert!(vector::length(&random_values) == material_count / 2, EInvalidCount);
        
        let mut success_count = 0;
        let mut failed_count = 0;
        let mut i = 0;
        
        while (i < material_count / 2) {
            let mat1 = vector::pop_back(&mut materials);
            let mat2 = vector::pop_back(&mut materials);
            let random = *vector::borrow(&random_values, i);
            
            let success = random < get_success_rate(recipe);
            
            if (success) {
                // 成功：销毁材料，创建新道具
                destroy_item(mat1);
                destroy_item(mat2);
                let new_item = create_from_recipe(recipe, sender, ctx);
                transfer::public_transfer(new_item, sender);
                success_count = success_count + 1;
            } else {
                // 失败：返还材料
                transfer::public_transfer(mat1, sender);
                transfer::public_transfer(mat2, sender);
                failed_count = failed_count + 1;
            };
            
            i = i + 1;
        };
        
        vector::destroy_empty(materials);
        
        BatchCraftResult { success_count, failed_count }
    }

    const EInvalidCount: u64 = 1;
}
```

**关键技巧**：在循环中，成功和失败分支都必须完整处理对象。

## 常见陷阱与解决方案

### 陷阱1：嵌套条件遗漏分支

```move
// 错误：内层 if 没有 else
public fun bad_nested(item: GameItem, c1: bool, c2: bool, ctx: &TxContext) {
    if (c1) {
        if (c2) {
            transfer::public_transfer(item, tx_context::sender(ctx));
        }
        // 错误：c1=true但c2=false时，item未处理
    } else {
        destroy_item(item);
    }
}

// 正确：所有路径都处理
public fun good_nested(item: GameItem, c1: bool, c2: bool, ctx: &TxContext) {
    if (c1) {
        if (c2) {
            transfer::public_transfer(item, tx_context::sender(ctx));
        } else {
            destroy_item(item);  // 补充else分支
        }
    } else {
        destroy_item(item);
    }
}
```

### 陷阱2：Option 在循环中忘记销毁

```move
// 错误：循环中的 Option 未销毁
public fun bad_loop(items: vector<GameItem>, ctx: &TxContext) {
    let mut i = 0;
    while (i < vector::length(&items)) {
        let item = vector::pop_back(&mut items);
        let opt = process_item(item);  // 返回 Option<GameItem>
        // 错误：opt 没有被处理
        i = i + 1;
    };
    vector::destroy_empty(items);
}

// 正确：每次循环都处理 Option
public fun good_loop(items: vector<GameItem>, ctx: &TxContext): vector<GameItem> {
    let mut result = vector::empty<GameItem>();
    let mut i = 0;
    while (i < vector::length(&items)) {
        let item = vector::pop_back(&mut items);
        let opt = process_item(item);
        
        if (option::is_some(&opt)) {
            let mut temp = opt;
            let processed = option::extract(&mut temp);
            vector::push_back(&mut result, processed);
            option::destroy_none(temp);
        } else {
            option::destroy_none(opt);
        };
        
        i = i + 1;
    };
    vector::destroy_empty(items);
    result
}
```

### 陷阱3：提前 return 导致资源泄露

```move
// 错误：return 前未处理对象
public fun bad_early_return(item: GameItem, check: bool): bool {
    if (!check) {
        return false  // 错误：item 未处理
    };
    transfer::public_transfer(item, @0x1);
    true
}

// 正确：先处理对象再 return
public fun good_early_return(item: GameItem, check: bool): bool {
    if (!check) {
        transfer::public_transfer(item, @0x1);
        return false
    };
    transfer::public_transfer(item, @0x1);
    true
}
```

## 最佳实践总结

### **设计原则**

1. **所有分支必须处理**：每个 if/else 都要处理对象
2. **Option 提取后销毁**：extract 后必须 destroy_none
3. **原子性操作**：相关操作在同一交易中完成
4. **明确失败策略**：提前设计失败时的处理方式

### **调试检查清单**

- [ ] 每个条件分支都处理了对象？
- [ ] Option 提取后销毁了空壳？
- [ ] 循环中的对象都被处理？
- [ ] 没有提前 return 导致泄露？
- [ ] 嵌套条件的所有路径都覆盖？

### **代码模板**

```move
// 推荐的条件处理模板
public fun conditional_template(
    object: SomeObject,
    condition: bool,
    ctx: &TxContext
) {
    // 1. 验证权限
    assert!(check_permission(&object, ctx), ENotAuthorized);
    
    // 2. 根据条件处理
    if (condition) {
        // 成功分支
        handle_success(object, ctx);
    } else {
        // 失败分支
        handle_failure(object, ctx);
    }
    // 3. 确保所有分支都处理了对象
}
```

## 总结

通过本文，我们掌握了条件性所有权管理的高级应用：

- **复杂场景**：礼物盒、交换系统、批量处理
- **多重条件**：时间、等级、权限等多维度判断
- **Option 进阶**：在复杂业务中灵活运用
- **常见陷阱**：嵌套条件、循环处理、提前返回

**关键收获**：条件性所有权管理的核心是确保对象在所有可能的执行路径中都被正确处理，这是 Move 安全性的基石。

## 下一步学习

接下来可以学习：
- [批量处理模式](./batch-processing-pattern.md)：高效处理大量对象
- [复合所有权模式](./composite-ownership-pattern.md)：组合多种模式解决复杂问题
