# 实战解析：Move 合约中的借用模式

很多开发者刚开始在 Sui 上开发 Move 项目时，最头疼的是各种所有权错误。编译器总提示 'value was moved'，但当时并不理解原因。

下面通过一个**数字资产钱包**的完整实战案例，深入浅出掌握 Move 中的借用模式。

## 实战场景：数字资产钱包

假设我们要开发一个简单的数字资产钱包，用户可以：

- 查看钱包余额和信息
- 向其他地址转账
- 查询交易历史

这个场景会遇到一个典型问题：**我想查看钱包信息，但不想失去钱包所有权**。

## 第一步：定义钱包结构

```move
module wallet::digital_wallet {
    use sui::object::{Self, UID};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::{Self, String};

    /// 数字钱包结构
    public struct Wallet has key, store {
        id: UID,
        owner: address,
        name: String,
        balance: Balance<SUI>,
        transaction_count: u64,
    }

    /// 创建新钱包
    public fun create_wallet(name: vector<u8>, ctx: &mut TxContext): Wallet {
        Wallet {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            name: string::utf8(name),
            balance: balance::zero<SUI>(),
            transaction_count: 0,
        }
    }
}
```

## 第二步：新手常犯的错误

现在我想添加一个查看钱包信息的功能。作为新手，我最开始这样写：

```move
// 新手常见错误：会转移所有权
public fun get_wallet_info(wallet: Wallet): (String, u64, u64) {
    let name = wallet.name;
    let balance_value = balance::value(&wallet.balance);
    let tx_count = wallet.transaction_count;

    // 想把钱包还给用户，但是...
    // transfer::public_transfer(wallet, wallet.owner); // wallet 已部分被 move

    (name, balance_value, tx_count)
}
```

**问题分析**：

- `wallet.name` 会把 `name` 字段从 `wallet` 中 move 出来
- 一旦任何字段被 move，整个 `wallet` 就不完整了
- 不完整的对象无法再被使用或转移

## 第三步：借用模式解决方案

正确的做法是使用**借用**，只读取数据而不获取所有权：

```move
/// 查看钱包信息（只读）
public fun get_wallet_info(wallet: &Wallet): (&String, u64, u64) {
    (
        &wallet.name,                             // 借用访问：返回 &String
        balance::value(&wallet.balance),          // 借用访问
        wallet.transaction_count                  // 借用访问
    )
}

/// 检查钱包是否属于指定用户
public fun is_owner(wallet: &Wallet, user: address): bool {
    wallet.owner == user
}

/// 获取钱包余额
public fun get_balance(wallet: &Wallet): u64 {
    balance::value(&wallet.balance)
}
```

## 第四步：实际使用场景

现在我们可以在不丢失钱包所有权的前提下，多次查询钱包信息：

```move
/// 完整的钱包操作示例
public fun wallet_operations_demo(wallet: Wallet, ctx: &mut TxContext) {
    let mut wallet = wallet;
    // 1. 查看钱包信息（借用，不转移所有权）
    let (_, balance_val, _) = get_wallet_info(&wallet);

    // 2. 检查余额是否足够（使用返回值）
    let has_enough = balance_val > 1000;

    // 3. 验证所有权（借用）
    let is_valid_owner = is_owner(&wallet, tx_context::sender(ctx));

    // 4. 如果条件满足，进行更新（可变借用）
    if (has_enough && is_valid_owner) {
        // 这里我们可以安全地修改钱包
        update_transaction_count(&mut wallet);
    };

    // 5. 最后，钱包仍然完整，可以转移给用户
    transfer::public_transfer(wallet, tx_context::sender(ctx));
}

/// 更新交易计数（可变借用）
public fun update_transaction_count(wallet: &mut Wallet) {
    wallet.transaction_count = wallet.transaction_count + 1;
}
```

## 第五步：深入理解借用模式

### 借用的三种类型

在我们的钱包示例中，你会看到三种不同的借用方式：

#### 1. **不可变借用** (`&T`)

```move
/// 只读访问，不能修改数据
public fun get_wallet_info(wallet: &Wallet): (&String, u64, u64) {
    // 可以读取所有字段
    (&wallet.name, balance::value(&wallet.balance), wallet.transaction_count)
}
```

#### 2. **可变借用** (`&mut T`)

```move
/// 可以修改数据，但不转移所有权
public fun update_transaction_count(wallet: &mut Wallet) {
    wallet.transaction_count = wallet.transaction_count + 1;  // 修改字段
}
```

#### 3. **嵌套借用**

```move
/// 对嵌套字段进行借用
public fun get_balance(wallet: &Wallet): u64 {
    balance::value(&wallet.balance)  // 对 wallet.balance 进行借用
}
```

## 第六步：借用规则深度解析

### 借用规则详解

通过钱包示例，我发现了几个关键的借用规则：

#### **规则1：同一时间只能有一个可变借用**

```move
// 错误：同时存在多个可变借用
public fun bad_multiple_mut_borrow(wallet: &mut Wallet) {
    let balance_ref = &mut wallet.balance;
    let count_ref = &mut wallet.transaction_count;  // 编译错误
    // 不能同时对同一个对象的不同字段进行可变借用
}

// 正确：分开进行可变借用
public fun good_sequential_borrow(wallet: &mut Wallet) {
    // 先修改一个字段
    wallet.transaction_count = wallet.transaction_count + 1;
    // 再修改另一个字段（前一个借用已经结束）
    // 注意：balance 通常不能直接修改，这里仅为示例
}
```

#### **规则2：可变借用期间不能有不可变借用**

```move
// 错误：可变借用和不可变借用冲突
public fun bad_mixed_borrow(wallet: &mut Wallet) {
    let count_ref = &wallet.transaction_count;      // 不可变借用
    wallet.transaction_count = 10;                  // 可变借用冲突
    // 使用 count_ref...
}

// 正确：先完成不可变借用，再进行可变借用
public fun good_mixed_borrow(wallet: &mut Wallet) {
    let old_count = wallet.transaction_count;       // 读取值（借用立即结束）
    wallet.transaction_count = old_count + 1;       // 现在可以可变借用
}
```

#### **规则3：借用的生命周期**

```move
// 借用的生命周期示例
public fun borrow_lifetime_demo(wallet: &mut Wallet): u64 {
    // 借用开始
    let balance_value = balance::value(&wallet.balance);

    // 在这个范围内，wallet.balance 被借用
    // 不能对 wallet.balance 进行修改

    // 借用在这里结束（balance_value 不再被使用）
    wallet.transaction_count = wallet.transaction_count + 1;  // 可以修改其他字段

    balance_value  // 返回之前读取的值
}
```

## 第七步：实战测试场景

让我们创建一个完整的测试场景来验证我们的借用模式：

```move
#[test_only]
module wallet::digital_wallet_tests {
    use wallet::digital_wallet::{Self, Wallet};
    use sui::test_scenario;
    use sui::transfer;
    use std::string;

    #[test]
    fun test_borrowing_patterns() {
        let mut scenario = test_scenario::begin(@0x1);

        // 创建钱包
        let wallet = digital_wallet::create_wallet(b"Test Wallet", test_scenario::ctx(&mut scenario));

        // 测试1：多次不可变借用（应该成功）
        let (_, balance1, count1) = digital_wallet::get_wallet_info(&wallet);
        let (_, balance2, count2) = digital_wallet::get_wallet_info(&wallet);
        assert!(balance1 == balance2, 0);
        assert!(count1 == count2, 1);

        // 测试2：可变借用修改数据
        digital_wallet::update_transaction_count(&mut wallet);
        let (_, _, new_count) = digital_wallet::get_wallet_info(&wallet);
        assert!(new_count == count1 + 1, 2);

        // 测试3：借用后仍可转移所有权
        transfer::public_transfer(wallet, @0x1);

        test_scenario::end(scenario);
    }
}
```

## 实战经验总结

### **调试技巧**

当遇到借用错误时，我的调试步骤：

1. **确认借用类型**：是需要读取(`&`)还是修改(`&mut`)?
2. **检查借用冲突**：是否有多个可变借用或混合借用？
3. **确认生命周期**：借用是否在使用完后及时结束？

### **性能优化**

- **优先使用借用**：避免不必要的数据复制
- **最小化借用范围**：让借用尽早结束
- **批量操作**：减少重复的借用检查

### **最佳实践**

1. **先读后写**：先完成所有读取操作，最后进行修改
2. **函数设计**：查询函数用不可变借用，修改函数用可变借用
3. **错误处理**：借用失败时提供清晰的错误信息

## 总结

通过这个数字钱包的实战案例，我们深入理解了 Move 中的借用模式：

- **概念理解**：借用让我们在不转移所有权的情况下访问数据
- **实际应用**：查询、验证、修改等场景都需要借用
- **规则掌握**：理解借用的限制和生命周期
- **调试技巧**：快速定位和解决借用相关的编译错误

**关键收获**：借用模式不是限制，而是 Move 语言帮助我们写出更安全、更高效代码的工具。掌握借用模式，是 Move 编程的核心能力之一。