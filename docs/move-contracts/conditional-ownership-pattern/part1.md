# 基础篇

在实际的区块链应用开发中，我们经常需要**根据业务逻辑动态决定对象的所有权流向**。比如游戏道具合成可能失败、拍卖可能流拍、条件转账可能不满足要求等。这些场景都需要用到**条件性所有权管理模式**。

本文是条件性所有权管理系列的第一篇，通过一个**游戏道具合成系统**的实战案例，掌握条件性所有权的基础概念和核心用法。

## 为什么需要条件性管理？

在前面学习的两种模式中：

- **借用模式**：不转移所有权，适合读取和修改
- **所有权转移模式**：确定性转移，适合明确的资产转移

但现实业务中，我们经常遇到这样的场景：

```javascript
// 传统编程的条件处理
function craftItem(materials, recipe) {
    if (checkSuccess(recipe.successRate)) {
        // 成功：消耗材料，返回新道具
        return createNewItem(recipe)
    }
    else {
        // 失败：可能返还材料，或者扣除部分材料
        return null
    }
}
```

在 Move 中，这种条件性处理必须**确保所有分支都正确处理对象**，否则会出现编译错误。

## 第一步：定义游戏道具结构

```move
module game::item_crafting {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use sui::event;

    /// 游戏道具
    public struct GameItem has key, store {
        id: UID,
        name: String,
        item_type: u8,      // 道具类型：1=武器, 2=防具, 3=材料
        level: u8,          // 等级
        rarity: u8,         // 稀有度：1=普通, 2=稀有, 3=史诗, 4=传说
        owner: address,
    }

    /// 合成配方
    public struct CraftingRecipe has key, store {
        id: UID,
        result_name: String,
        result_type: u8,
        result_level: u8,
        result_rarity: u8,
        success_rate: u8,   // 成功率 (0-100)
    }

    /// 创建游戏道具
    public fun create_item(
        name: vector<u8>,
        item_type: u8,
        level: u8,
        rarity: u8,
        owner: address,
        ctx: &mut TxContext
    ): GameItem {
        GameItem {
            id: object::new(ctx),
            name: string::utf8(name),
            item_type,
            level,
            rarity,
            owner,
        }
    }

    /// 错误码定义
    const ENotOwner: u64 = 1;
    const EConditionNotMet: u64 = 2;
    const EInsufficientMaterials: u64 = 3;
}
```

## 第二步：新手最常犯的错误

### 错误1：条件分支中遗漏对象处理

这是新手最容易踩的坑：

```move
// 错误示例：没有处理所有分支
public fun bad_craft_item(
    material1: GameItem,
    material2: GameItem,
    success: bool,
    ctx: &mut TxContext
) {
    if (success) {
        // 成功：销毁材料，创建新道具
        let GameItem { id: id1, name: _, item_type: _, level: _, rarity: _, owner: _ } = material1;
        let GameItem { id: id2, name: _, item_type: _, level: _, rarity: _, owner: _ } = material2;
        object::delete(id1);
        object::delete(id2);

        let new_item = create_item(b"Sword", 1, 1, 2, tx_context::sender(ctx), ctx);
        transfer::public_transfer(new_item, tx_context::sender(ctx));
    };
    // 编译错误：如果 success 为 false，material1 和 material2 没有被处理！
    // Move 要求所有资源必须在所有分支中都被明确处理
}
```

**错误信息**：

```
error: local 'material1' is not used
error: local 'material2' is not used
```

**问题分析**：

- Move 的资源安全机制要求所有 `has key` 的对象必须被明确处理
- 对象必须在**所有条件分支**中都被转移、返回或销毁
- 不能有任何分支"遗忘"处理对象

### 错误2：部分解构对象后无法转移

```move
// 错误示例：部分解构后想转移
public fun bad_partial_access(
    item: GameItem,
    recipient: address
) {
    let name = item.name;  // 取出了 name 字段

    // 编译错误：item 已经不完整，无法转移
    // transfer::public_transfer(item, recipient);
}
```

**问题分析**：

- 一旦部分字段被 move 出来，对象就不完整了
- 不完整的对象无法再被转移或使用
- 如果需要读取信息，应该使用借用 `&item.name`

## 第三步：正确的条件性所有权管理

### 模式1：所有分支都处理对象

最基础也是最重要的原则：**确保对象在所有条件分支中都有明确的归属**。

```move
/// 道具合成（带成功率，失败销毁材料）
public fun craft_item_destroy_on_fail(
    material1: GameItem,
    material2: GameItem,
    recipe: &CraftingRecipe,
    random_value: u8,  // 简化：实际应使用链上随机数
    ctx: &mut TxContext
): Option<GameItem> {
    let sender = tx_context::sender(ctx);

    // 验证材料所有权
    assert!(material1.owner == sender, ENotOwner);
    assert!(material2.owner == sender, ENotOwner);

    // 判断是否成功
    let success = random_value < recipe.success_rate;

    if (success) {
        // 成功分支：销毁材料，创建新道具
        let GameItem { id: id1, name: _, item_type: _, level: _, rarity: _, owner: _ } = material1;
        let GameItem { id: id2, name: _, item_type: _, level: _, rarity: _, owner: _ } = material2;
        object::delete(id1);
        object::delete(id2);

        // 创建合成结果
        let new_item = GameItem {
            id: object::new(ctx),
            name: string::utf8(string::bytes(&recipe.result_name)),
            item_type: recipe.result_type,
            level: recipe.result_level,
            rarity: recipe.result_rarity,
            owner: sender,
        };

        event::emit(CraftingSuccessEvent {
            crafter: sender,
            item_name: string::utf8(string::bytes(&recipe.result_name)),
            rarity: recipe.result_rarity,
        });

        option::some(new_item)
    } else {
        // 失败分支：销毁材料（代表合成失败的惩罚）
        let GameItem { id: id1, name: _, item_type: _, level: _, rarity: _, owner: _ } = material1;
        let GameItem { id: id2, name: _, item_type: _, level: _, rarity: _, owner: _ } = material2;
        object::delete(id1);
        object::delete(id2);

        event::emit(CraftingFailureEvent {
            crafter: sender,
        });

        option::none()
    }
    // 关键：两个分支都完整处理了 material1 和 material2
}

/// 合成成功事件
public struct CraftingSuccessEvent has copy, drop {
    crafter: address,
    item_name: String,
    rarity: u8,
}

/// 合成失败事件
public struct CraftingFailureEvent has copy, drop {
    crafter: address,
}
```

### 模式2：失败时返还材料（更友好的设计）

上面的例子失败时会销毁材料，对玩家来说太严苛。更友好的设计是失败时返还材料：

```move
/// 道具合成（失败返还材料）
public fun craft_item_with_refund(
    material1: GameItem,
    material2: GameItem,
    recipe: &CraftingRecipe,
    random_value: u8,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);

    assert!(material1.owner == sender, ENotOwner);
    assert!(material2.owner == sender, ENotOwner);

    let success = random_value < recipe.success_rate;

    if (success) {
        // 成功分支：销毁材料，创建并转移新道具
        let GameItem { id: id1, name: _, item_type: _, level: _, rarity: _, owner: _ } = material1;
        let GameItem { id: id2, name: _, item_type: _, level: _, rarity: _, owner: _ } = material2;
        object::delete(id1);
        object::delete(id2);

        let new_item = GameItem {
            id: object::new(ctx),
            name: string::utf8(string::bytes(&recipe.result_name)),
            item_type: recipe.result_type,
            level: recipe.result_level,
            rarity: recipe.result_rarity,
            owner: sender,
        };

        transfer::public_transfer(new_item, sender);

        event::emit(CraftingSuccessEvent {
            crafter: sender,
            item_name: string::utf8(string::bytes(&recipe.result_name)),
            rarity: recipe.result_rarity,
        });
    } else {
        // 失败分支：返还材料给玩家
        transfer::public_transfer(material1, sender);
        transfer::public_transfer(material2, sender);

        event::emit(CraftingFailureEvent {
            crafter: sender,
        });
    }
    // 关键：两个分支都处理了材料，只是处理方式不同
}
```

**对比分析**：

- **模式1**：失败销毁材料，风险高但奖励可能更大（游戏平衡性设计）
- **模式2**：失败返还材料，更友好但可能降低道具稀缺性

选择哪种模式取决于游戏设计的经济模型。

## 第四步：`Option<T>` 类型深度解析

`Option<T>` 是条件性所有权管理的核心工具。它表示"可能有值，也可能没有值"。

### Option 的基本概念

```move
use std::option::{Self, Option};

// Option<T> 有两种状态：
// - Some(T)：包含一个 T 类型的值
// - None：不包含任何值

/// 演示 Option 的创建
public fun create_option_examples(
    item: GameItem,
    should_keep: bool,
): Option<GameItem> {
    if (should_keep) {
        // 包装成 Some
        option::some(item)
    } else {
        // 销毁对象，返回 None
        let GameItem { id, name: _, item_type: _, level: _, rarity: _, owner: _ } = item;
        object::delete(id);
        option::none()
    }
}
```

### Option 的核心操作

```move
/// 检查 Option 是否有值
public fun check_option(opt: &Option<GameItem>): bool {
    option::is_some(opt)  // 返回 true 或 false
}

/// 安全地提取 Option 中的值
public fun extract_option_safe(
    opt_item: Option<GameItem>,
    recipient: address,
) {
    if (option::is_some(&opt_item)) {
        // Option 包含值，提取它
        let mut temp = opt_item;
        let item = option::extract(&mut temp);
        transfer::public_transfer(item, recipient);

        // 销毁空的 Option（提取后变成 None）
        option::destroy_none(temp);
    } else {
        // Option 是 None，直接销毁
        option::destroy_none(opt_item);
    }
}

/// 错误示例：忘记销毁 Option
public fun bad_extract_option(
    opt_item: Option<GameItem>,
    recipient: address,
) {
    if (option::is_some(&opt_item)) {
        let mut temp = opt_item;
        let item = option::extract(&mut temp);
        transfer::public_transfer(item, recipient);
        // 编译错误：temp 没有被销毁
    }
}
```

**Option 使用规则**：

1. **检查后提取**：先用 `is_some` 检查，再用 `extract` 提取
2. **提取后销毁**：提取后的空 Option 必须用 `destroy_none` 销毁
3. **None 也要销毁**：即使是 None，也必须显式销毁

## 第五步：使用 Option 处理道具升级

道具升级是另一个典型的条件性场景：成功则等级提升，失败可能道具被销毁。

```move
/// 道具升级（返回 Option 表示成功或失败）
public fun upgrade_item(
    item: GameItem,
    random_value: u8,
    ctx: &TxContext
): Option<GameItem> {
    let sender = tx_context::sender(ctx);
    assert!(item.owner == sender, ENotOwner);

    // 升级成功率随等级降低
    let success_rate = if (item.level < 5) {
        80  // 低等级：80% 成功率
    } else if (item.level < 10) {
        50  // 中等级：50% 成功率
    } else {
        20  // 高等级：20% 成功率
    };

    let success = random_value < success_rate;

    if (success) {
        // 成功：升级道具
        let GameItem { id, name, item_type, level, rarity, owner } = item;

        let upgraded_item = GameItem {
            id,
            name,
            item_type,
            level: level + 1,  // 等级+1
            rarity,
            owner,
        };

        event::emit(UpgradeSuccessEvent {
            owner: sender,
            item_name: name,
            old_level: level,
            new_level: level + 1,
        });

        option::some(upgraded_item)
    } else {
        // 失败：道具被销毁
        let GameItem { id, name, item_type: _, level, rarity: _, owner: _ } = item;
        object::delete(id);

        event::emit(UpgradeFailureEvent {
            owner: sender,
            item_name: name,
            lost_level: level,
        });

        option::none()
    }
}

/// 升级成功事件
public struct UpgradeSuccessEvent has copy, drop {
    owner: address,
    item_name: String,
    old_level: u8,
    new_level: u8,
}

/// 升级失败事件
public struct UpgradeFailureEvent has copy, drop {
    owner: address,
    item_name: String,
    lost_level: u8,
}
```

### 使用升级功能

```move
/// 演示如何使用 upgrade_item
public fun demo_upgrade_workflow(
    item: GameItem,
    random_value: u8,
    ctx: &TxContext
) {
    let sender = tx_context::sender(ctx);

    // 尝试升级
    let result = upgrade_item(item, random_value, ctx);

    // 处理结果
    if (option::is_some(&result)) {
        // 升级成功，转移升级后的道具给玩家
        let mut temp = result;
        let upgraded_item = option::extract(&mut temp);
        transfer::public_transfer(upgraded_item, sender);
        option::destroy_none(temp);
    } else {
        // 升级失败，道具已被销毁
        option::destroy_none(result);
        // 可以在这里给玩家一些安慰奖
    }
}
```

## 第六步：实战测试场景

让我们创建完整的测试用例来验证条件性所有权管理：

```move
#[test_only]
module game::item_crafting_tests {
    use game::item_crafting::{Self, GameItem, CraftingRecipe};
    use sui::test_scenario::{Self as ts};
    use std::option;
    use sui::transfer;
    use std::string;
    use sui::object;

    const PLAYER: address = @0xA;

    #[test]
    fun test_crafting_success() {
        let mut scenario = ts::begin(PLAYER);

        // 创建材料和配方
        ts::next_tx(&mut scenario, PLAYER);
        {
            let ctx = ts::ctx(&mut scenario);

            // 创建两个材料
            let material1 = item_crafting::create_item(b"Iron", 3, 1, 1, PLAYER, ctx);
            let material2 = item_crafting::create_item(b"Wood", 3, 1, 1, PLAYER, ctx);

            transfer::public_transfer(material1, PLAYER);
            transfer::public_transfer(material2, PLAYER);

            // 创建配方
            let recipe = CraftingRecipe {
                id: object::new(ctx),
                result_name: string::utf8(b"Iron Sword"),
                result_type: 1,
                result_level: 1,
                result_rarity: 2,
                success_rate: 100,  // 100% 成功率用于测试
            };
            transfer::public_share_object(recipe);
        };

        // 执行合成
        ts::next_tx(&mut scenario, PLAYER);
        {
            let material1 = ts::take_from_sender<GameItem>(&scenario);
            let material2 = ts::take_from_sender<GameItem>(&scenario);
            let recipe = ts::take_shared<CraftingRecipe>(&scenario);

            let result = item_crafting::craft_item_destroy_on_fail(
                material1,
                material2,
                &recipe,
                50,  // random_value < success_rate (100)
                ts::ctx(&mut scenario)
            );

            // 验证成功
            assert!(option::is_some(&result), 0);

            // 处理结果
            if (option::is_some(&result)) {
                let mut temp = result;
                let item = option::extract(&mut temp);
                transfer::public_transfer(item, PLAYER);
                option::destroy_none(temp);
            } else {
                option::destroy_none(result);
            };

            ts::return_shared(recipe);
        };

        // 验证玩家收到新道具
        ts::next_tx(&mut scenario, PLAYER);
        {
            let item = ts::take_from_sender<GameItem>(&scenario);
            assert!(item_crafting::get_level(&item) == 1, 1);
            assert!(item_crafting::get_rarity(&item) == 2, 2);
            ts::return_to_sender(&scenario, item);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_crafting_failure_with_refund() {
        let mut scenario = ts::begin(PLAYER);

        ts::next_tx(&mut scenario, PLAYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let material1 = item_crafting::create_item(b"Iron", 3, 1, 1, PLAYER, ctx);
            let material2 = item_crafting::create_item(b"Wood", 3, 1, 1, PLAYER, ctx);

            transfer::public_transfer(material1, PLAYER);
            transfer::public_transfer(material2, PLAYER);

            let recipe = CraftingRecipe {
                id: object::new(ctx),
                result_name: string::utf8(b"Iron Sword"),
                result_type: 1,
                result_level: 1,
                result_rarity: 2,
                success_rate: 50,  // 50% 成功率
            };
            transfer::public_share_object(recipe);
        };

        // 执行合成（失败）
        ts::next_tx(&mut scenario, PLAYER);
        {
            let material1 = ts::take_from_sender<GameItem>(&scenario);
            let material2 = ts::take_from_sender<GameItem>(&scenario);
            let recipe = ts::take_shared<CraftingRecipe>(&scenario);

            // 使用大于成功率的随机数，确保失败
            item_crafting::craft_item_with_refund(
                material1,
                material2,
                &recipe,
                80,  // random_value > success_rate (50)
                ts::ctx(&mut scenario)
            );

            ts::return_shared(recipe);
        };

        // 验证材料被返还
        ts::next_tx(&mut scenario, PLAYER);
        {
            let material1 = ts::take_from_sender<GameItem>(&scenario);
            let material2 = ts::take_from_sender<GameItem>(&scenario);

            // 验证材料被正确返还
            assert!(item_crafting::get_type(&material1) == 3, 0);
            assert!(item_crafting::get_type(&material2) == 3, 1);

            ts::return_to_sender(&scenario, material1);
            ts::return_to_sender(&scenario, material2);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_upgrade_success() {
        let mut scenario = ts::begin(PLAYER);

        ts::next_tx(&mut scenario, PLAYER);
        {
            let ctx = ts::ctx(&mut scenario);
            let item = item_crafting::create_item(b"Sword", 1, 1, 1, PLAYER, ctx);
            transfer::public_transfer(item, PLAYER);
        };

        ts::next_tx(&mut scenario, PLAYER);
        {
            let item = ts::take_from_sender<GameItem>(&scenario);

            // 升级（成功）
            let result = item_crafting::upgrade_item(
                item,
                50,  // 对于 level 1，成功率是 80%
                ts::ctx(&mut scenario)
            );

            assert!(option::is_some(&result), 0);

            if (option::is_some(&result)) {
                let mut temp = result;
                let upgraded = option::extract(&mut temp);
                assert!(item_crafting::get_level(&upgraded) == 2, 1);
                transfer::public_transfer(upgraded, PLAYER);
                option::destroy_none(temp);
            } else {
                option::destroy_none(result);
            };
        };

        ts::end(scenario);
    }
}
```

## 第七步：辅助函数（让测试代码可用）

```move
module game::item_crafting {
    // ... 前面的代码 ...

    /// 获取道具等级
    public fun get_level(item: &GameItem): u8 {
        item.level
    }

    /// 获取道具稀有度
    public fun get_rarity(item: &GameItem): u8 {
        item.rarity
    }

    /// 获取道具类型
    public fun get_type(item: &GameItem): u8 {
        item.item_type
    }

    /// 获取道具所有者
    public fun get_owner(item: &GameItem): address {
        item.owner
    }
}
```

## 实战经验总结

### **核心原则**

1. **所有分支必须处理**：每个条件分支都必须明确处理所有对象
2. **Option 表示不确定**：用 `Option<T>` 表示可能成功或失败的操作
3. **提取后必须销毁**：Option 提取后的空壳必须用 `destroy_none` 销毁

### **调试技巧**

遇到条件性所有权错误时的排查步骤：

1. **检查所有分支**：确认每个 if/else 分支都处理了对象
2. **检查 Option 销毁**：确认 Option 提取后销毁了空壳
3. **避免部分解构**：如果需要信息，先用借用读取

### **设计建议**

- **失败策略明确**：是销毁、返还还是降级？提前设计清楚
- **使用 Option 返回**：调用者可以根据 Option 判断成功或失败
- **发出事件**：成功和失败都发出事件，方便前端追踪

## 总结与展望

通过本文，我们掌握了条件性所有权管理的基础：

- **核心概念**：根据条件决定对象的去向
- **基本原则**：所有分支必须处理对象
- **Option 用法**：表示可能有值或无值的状态
- **实战应用**：游戏道具合成和升级场景

在下一篇文章中，我们将学习更复杂的条件性场景：

- 条件性赠送（礼物盒系统）
- 双方确认的道具交换
- 批量条件处理
- 常见陷阱和最佳实践

**下一步学习**：[条件性所有权管理模式（下）- 进阶篇](./conditional-ownership-pattern-part2.md) _(即将发布)_
