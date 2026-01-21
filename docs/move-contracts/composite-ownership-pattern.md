# Move 合约中的复合所有权模式

在真实的区块链项目中，很少有业务逻辑只用到单一的所有权模式。大多数情况下，我们需要**组合多种模式**来实现复杂的功能。复合所有权模式就是将借用、转移、条件性管理和批量处理等模式灵活组合，构建强大而安全的系统。

本文通过一个**去中心化 NFT 拍卖系统**的完整实战案例，掌握如何在复杂场景中综合运用所有权管理模式。

## 为什么需要复合模式？

回顾我们学过的四种基础模式：

1. **借用模式**：读取和修改，不转移所有权
2. **所有权转移模式**：彻底转移对象控制权
3. **条件性所有权管理**：根据条件决定对象去向
4. **批量处理模式**：高效处理多个对象

在 NFT 拍卖系统中，这些模式都会用到：

- 查询拍卖信息 → 借用
- 出价时锁定资金 → 转移
- 拍卖结束根据结果分配 → 条件性管理
- 批量处理多个拍卖 → 批量处理

## 第一步：定义拍卖系统结构

```move
module auction::nft_auction {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::option::{Self, Option};
    use std::vector;
    use sui::event;

    /// 拍卖的 NFT
    public struct AuctionNFT has key, store {
        id: UID,
        name: vector<u8>,
        description: vector<u8>,
        creator: address,
    }

    /// 拍卖记录
    public struct Auction has key, store {
        id: UID,
        nft: Option<AuctionNFT>,        // 拍卖的 NFT
        seller: address,                 // 卖家
        starting_price: u64,             // 起拍价
        current_bid: u64,                // 当前出价
        highest_bidder: Option<address>, // 最高出价者
        bid_deposit: Balance<SUI>,       // 出价保证金
        end_time: u64,                   // 结束时间
        is_active: bool,                 // 是否活跃
    }

    /// 拍卖市场（管理多个拍卖）
    public struct AuctionMarket has key {
        id: UID,
        active_auctions: vector<ID>,     // 活跃拍卖列表
        total_auctions: u64,
        platform_fee_rate: u64,          // 平台费率（基点，如 250 = 2.5%）
        platform_balance: Balance<SUI>,  // 平台收益
    }

    /// 错误码
    const ENotSeller: u64 = 1;
    const EAuctionEnded: u64 = 2;
    const EAuctionActive: u64 = 3;
    const EBidTooLow: u64 = 4;
    const ENotHighestBidder: u64 = 5;
    const ENoNFT: u64 = 6;
}
```

## 第二步：创建拍卖（组合模式1）

创建拍卖需要**转移 NFT** + **借用市场状态**：

```move
/// 创建拍卖
/// - 转移模式：NFT 所有权转移到拍卖合约
/// - 借用模式：市场只需可变借用，不转移所有权
public fun create_auction(
    market: &mut AuctionMarket,
    nft: AuctionNFT,
    starting_price: u64,
    duration: u64,
    ctx: &mut TxContext
) {
    let seller = tx_context::sender(ctx);
    let end_time = tx_context::epoch(ctx) + duration;

    // 创建拍卖记录
    let auction = Auction {
        id: object::new(ctx),
        nft: option::some(nft),          // 转移：NFT 所有权给拍卖
        seller,
        starting_price,
        current_bid: starting_price,
        highest_bidder: option::none(),
        bid_deposit: balance::zero<SUI>(),
        end_time,
        is_active: true,
    };

    let auction_id = object::id(&auction);

    // 借用：更新市场状态
    vector::push_back(&mut market.active_auctions, auction_id);
    market.total_auctions = market.total_auctions + 1;

    // 转移拍卖对象
    transfer::public_share_object(auction);

    event::emit(AuctionCreatedEvent {
        auction_id,
        seller,
        starting_price,
        end_time,
    });
}

public struct AuctionCreatedEvent has copy, drop {
    auction_id: ID,
    seller: address,
    starting_price: u64,
    end_time: u64,
}
```

## 第三步：出价（组合模式2）

出价需要**借用拍卖状态** + **转移资金** + **条件判断**：

```move
/// 出价
/// - 借用模式：检查和更新拍卖状态
/// - 转移模式：转移出价资金
/// - 条件性管理：根据出价高低决定资金去向
public fun place_bid(
    auction: &mut Auction,
    bid_coin: Coin<SUI>,
    ctx: &mut TxContext
) {
    let bidder = tx_context::sender(ctx);
    let bid_amount = coin::value(&bid_coin);

    // 借用：检查拍卖状态
    assert!(auction.is_active, EAuctionEnded);
    assert!(tx_context::epoch(ctx) < auction.end_time, EAuctionEnded);
    assert!(bid_amount > auction.current_bid, EBidTooLow);

    // 条件性管理：处理前一个出价者的保证金
    if (option::is_some(&auction.highest_bidder)) {
        // 有前一个出价者，退还其保证金
        let previous_bidder = *option::borrow(&auction.highest_bidder);
        let refund_amount = balance::value(&auction.bid_deposit);
        let refund = coin::take(&mut auction.bid_deposit, refund_amount, ctx);
        transfer::public_transfer(refund, previous_bidder);
    };

    // 转移：存入新的出价
    let bid_balance = coin::into_balance(bid_coin);
    balance::join(&mut auction.bid_deposit, bid_balance);

    // 借用：更新拍卖状态
    auction.current_bid = bid_amount;
    if (option::is_some(&auction.highest_bidder)) {
        *option::borrow_mut(&mut auction.highest_bidder) = bidder;
    } else {
        option::fill(&mut auction.highest_bidder, bidder);
    };

    event::emit(BidPlacedEvent {
        auction_id: object::id(auction),
        bidder,
        bid_amount,
    });
}

public struct BidPlacedEvent has copy, drop {
    auction_id: ID,
    bidder: address,
    bid_amount: u64,
}
```

## 第四步：结束拍卖（组合模式3）

结束拍卖是最复杂的操作，综合运用所有模式：

```move
/// 结束拍卖
/// - 借用模式：检查市场状态
/// - 条件性管理：根据是否有出价决定 NFT 和资金去向
/// - 转移模式：分配 NFT 和资金
public fun finalize_auction(
    market: &mut AuctionMarket,
    auction: &mut Auction,
    ctx: &mut TxContext
) {
    let current_time = tx_context::epoch(ctx);

    // 借用：验证时间和状态
    assert!(current_time >= auction.end_time, EAuctionActive);
    assert!(auction.is_active, EAuctionEnded);

    auction.is_active = false;

    // 条件性管理：根据是否有出价决定处理方式
    if (option::is_some(&auction.highest_bidder)) {
        // 有出价：成功的拍卖
        let winner = *option::borrow(&auction.highest_bidder);
        let final_price = auction.current_bid;

        // 计算平台费用
        let platform_fee = (final_price * market.platform_fee_rate) / 10000;
        let seller_amount = final_price - platform_fee;

        // 转移：提取保证金并分配
        let total_balance = balance::value(&auction.bid_deposit);

        // 平台费用
        let fee_balance = balance::split(&mut auction.bid_deposit, platform_fee);
        balance::join(&mut market.platform_balance, fee_balance);

        // 卖家收益
        let seller_coin = coin::take(&mut auction.bid_deposit, seller_amount, ctx);
        transfer::public_transfer(seller_coin, auction.seller);

        // 转移：NFT 给赢家
        if (option::is_some(&auction.nft)) {
            let mut temp = option::none<AuctionNFT>();
            option::swap(&mut auction.nft, &mut temp);
            let nft = option::extract(&mut temp);
            transfer::public_transfer(nft, winner);
            option::destroy_none(temp);
        };

        event::emit(AuctionFinalizedEvent {
            auction_id: object::id(auction),
            winner,
            final_price,
            platform_fee,
        });
    } else {
        // 无出价：流拍
        // 转移：退还 NFT 给卖家
        if (option::is_some(&auction.nft)) {
            let mut temp = option::none<AuctionNFT>();
            option::swap(&mut auction.nft, &mut temp);
            let nft = option::extract(&mut temp);
            transfer::public_transfer(nft, auction.seller);
            option::destroy_none(temp);
        };

        event::emit(AuctionCancelledEvent {
            auction_id: object::id(auction),
            seller: auction.seller,
        });
    }
}

public struct AuctionFinalizedEvent has copy, drop {
    auction_id: ID,
    winner: address,
    final_price: u64,
    platform_fee: u64,
}

public struct AuctionCancelledEvent has copy, drop {
    auction_id: ID,
    seller: address,
}
```

## 第五步：批量操作（组合模式4）

批量结束多个拍卖，组合**批量处理** + **条件判断**：

```move
/// 批量结束已到期的拍卖
/// - 批量处理：处理多个拍卖
/// - 借用模式：检查每个拍卖状态
/// - 条件性管理：只处理到期的拍卖
public fun batch_finalize_auctions(
    market: &mut AuctionMarket,
    auction_ids: vector<ID>,
    ctx: &mut TxContext
): BatchFinalizeResult {
    let current_time = tx_context::epoch(ctx);
    let total_count = vector::length(&auction_ids);

    let mut finalized = 0;
    let mut skipped = 0;
    let mut i = 0;

    while (i < total_count) {
        let auction_id = *vector::borrow(&auction_ids, i);

        // 注意：这里简化了，实际需要获取 Auction 对象
        // 在真实场景中，可能需要传入 vector<&mut Auction>

        // 条件性处理（伪代码示例）
        // if (should_finalize) {
        //     finalize_single_auction(market, auction, ctx);
        //     finalized = finalized + 1;
        // } else {
        //     skipped = skipped + 1;
        // };

        i = i + 1;
    };

    BatchFinalizeResult {
        total_count,
        finalized,
        skipped,
    }
}

public struct BatchFinalizeResult has drop {
    total_count: u64,
    finalized: u64,
    skipped: u64,
}
```

## 第六步：紧急取消（组合模式5）

卖家紧急取消拍卖，组合**权限验证** + **条件判断** + **资金退还**：

```move
/// 卖家紧急取消拍卖（仅在无出价时）
/// - 借用模式：验证权限和状态
/// - 条件性管理：根据出价情况决定是否允许取消
/// - 转移模式：退还 NFT
public fun cancel_auction(
    market: &mut AuctionMarket,
    auction: &mut Auction,
    ctx: &mut TxContext
) {
    let sender = tx_context::sender(ctx);

    // 借用：验证权限
    assert!(sender == auction.seller, ENotSeller);
    assert!(auction.is_active, EAuctionEnded);

    // 条件性管理：只能在无出价时取消
    if (option::is_some(&auction.highest_bidder)) {
        // 有出价，不能取消，只能等待拍卖结束
        abort EAuctionActive
    };

    auction.is_active = false;

    // 转移：退还 NFT
    if (option::is_some(&auction.nft)) {
        let mut temp = option::none<AuctionNFT>();
        option::swap(&mut auction.nft, &mut temp);
        let nft = option::extract(&mut temp);
        transfer::public_transfer(nft, auction.seller);
        option::destroy_none(temp);
    };

    event::emit(AuctionCancelledEvent {
        auction_id: object::id(auction),
        seller: auction.seller,
    });
}
```

## 第七步：查询功能（纯借用模式）

提供多种查询接口，只使用借用：

```move
/// 查询拍卖信息（纯借用）
public fun get_auction_info(auction: &Auction): (u64, u64, bool) {
    (auction.current_bid, auction.end_time, auction.is_active)
}

/// 检查是否为最高出价者
public fun is_highest_bidder(auction: &Auction, user: address): bool {
    if (option::is_some(&auction.highest_bidder)) {
        *option::borrow(&auction.highest_bidder) == user
    } else {
        false
    }
}

/// 获取市场统计
public fun get_market_stats(market: &AuctionMarket): (u64, u64, u64) {
    (
        market.total_auctions,
        vector::length(&market.active_auctions),
        balance::value(&market.platform_balance)
    )
}

/// 批量查询拍卖状态
public fun batch_query_auctions(auctions: &vector<Auction>): vector<bool> {
    let count = vector::length(auctions);
    let mut results = vector::empty<bool>();

    let mut i = 0;
    while (i < count) {
        let auction = vector::borrow(auctions, i);
        vector::push_back(&mut results, auction.is_active);
        i = i + 1;
    };

    results
}
```

## 第八步：复合模式的设计原则

### 原则1：模式选择决策树

```move
/// 决策流程示例：处理拍卖结束
///
/// 1. 借用检查状态
///    ├─ 是否到期？
///    │  ├─ 否 → abort
///    │  └─ 是 → 继续
///    │
/// 2. 条件性判断
///    ├─ 有出价？
///    │  ├─ 是 → 成功拍卖流程
///    │  │      ├─ 转移 NFT 给赢家
///    │  │      ├─ 分配资金给卖家
///    │  │      └─ 扣除平台费用
///    │  │
///    │  └─ 否 → 流拍流程
///    │         └─ 转移 NFT 退还卖家
///    │
/// 3. 更新状态（借用）
///    └─ 标记为非活跃
```

### 原则2：资源流向清晰化

```move
/// 资源追踪示例
public fun track_resource_flow_example(
    auction: &mut Auction,
    payment: Coin<SUI>,
) {
    // 阶段1：资源输入
    // - auction: 借用
    // - payment: 转移（所有权进入函数）

    let payment_balance = coin::into_balance(payment);
    // payment 已被消耗，转换为 balance

    // 阶段2：资源处理
    balance::join(&mut auction.bid_deposit, payment_balance);
    // payment_balance 已被消耗，合并到 auction

    // 阶段3：资源输出
    // - auction: 返还借用
    // - payment: 已完全转移，不再存在
}
```

### 原则3：错误处理的原子性

```move
/// 确保操作的原子性
public fun atomic_operation_example(
    auction: &mut Auction,
    nft: AuctionNFT,
    payment: Coin<SUI>,
) {
    // 先做所有验证（只使用借用）
    assert!(auction.is_active, EAuctionEnded);
    assert!(coin::value(&payment) >= auction.starting_price, EBidTooLow);

    // 验证通过后才执行转移操作
    // 确保要么全部成功，要么全部失败
    let payment_balance = coin::into_balance(payment);
    balance::join(&mut auction.bid_deposit, payment_balance);
    option::fill(&mut auction.nft, nft);
}
```

## 第九步：性能优化策略

### 策略1：减少不必要的对象创建

```move
/// 优化前：创建临时对象
public fun unoptimized_refund(
    auction: &mut Auction,
    recipient: address,
    ctx: &mut TxContext
) {
    let amount = balance::value(&auction.bid_deposit);
    let coin = coin::take(&mut auction.bid_deposit, amount, ctx);
    transfer::public_transfer(coin, recipient);
}

/// 优化后：直接操作（如果可能）
public fun optimized_refund(
    auction: &mut Auction,
    recipient: address,
    ctx: &mut TxContext
) {
    let amount = balance::value(&auction.bid_deposit);
    if (amount > 0) {
        let coin = coin::take(&mut auction.bid_deposit, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
```

### 策略2：批量操作合并验证

```move
/// 批量验证后统一处理
public fun batch_operation_optimized(
    auctions: vector<&mut Auction>,
    ctx: &TxContext
) {
    let count = vector::length(&auctions);
    let current_time = tx_context::epoch(ctx);

    // 第一遍：只验证（借用）
    let mut i = 0;
    while (i < count) {
        let auction = vector::borrow(&auctions, i);
        assert!(current_time >= auction.end_time, EAuctionActive);
        i = i + 1;
    };

    // 第二遍：执行操作
    // ...
}
```

## 实战经验总结

### **模式组合决策**

| 场景     | 主要模式    | 辅助模式 | 原因                   |
| -------- | ----------- | -------- | ---------------------- |
| 创建拍卖 | 转移        | 借用     | NFT 转移，市场状态更新 |
| 出价     | 转移 + 条件 | 借用     | 资金转移，条件退款     |
| 结束拍卖 | 条件 + 转移 | 借用     | 根据结果分配资源       |
| 批量查询 | 借用        | -        | 只读操作               |
| 批量结束 | 批量 + 条件 | 转移     | 多个拍卖条件处理       |

### **设计检查清单**

设计复合模式时的检查项：

- [ ] 每个对象的流向都明确？
- [ ] 所有条件分支都处理了资源？
- [ ] 验证逻辑在资源操作之前？
- [ ] 批量操作有数量限制？
- [ ] 错误处理保证原子性？
- [ ] 事件记录了关键操作？

### **常见陷阱**

1. **分支遗漏**：条件判断后某个分支忘记处理对象
2. **顺序错误**：先转移对象再验证条件（应该反过来）
3. **状态不一致**：部分操作成功但未更新相关状态
4. **资源泄露**：Option 提取后忘记销毁空壳

## 总结

通过 NFT 拍卖系统的完整实现，我们掌握了复合所有权模式：

- **模式组合**：灵活运用借用、转移、条件、批量四种模式
- **设计原则**：清晰的资源流向、原子性操作、错误处理
- **性能优化**：减少临时对象、批量验证、合理使用借用
- **实战技巧**：决策树、资源追踪、检查清单

**关键收获**：复合所有权模式的核心是理解每种基础模式的特点，然后根据业务需求灵活组合。通过清晰的设计和严格的验证，可以构建安全、高效的复杂系统。

## 系列回顾

至此，我们完成了 Move 所有权管理模式的完整学习：

1. **借用模式**：不转移所有权的访问和修改
2. **所有权转移模式**：彻底转移对象控制权
3. **条件性所有权管理**：根据条件决定对象去向
4. **批量处理模式**：高效处理多个对象
5. **复合所有权模式**：综合运用所有模式

掌握这五种模式，你就具备了在 Move 中构建任何复杂系统的能力。继续实践，在真实项目中磨练技能！
