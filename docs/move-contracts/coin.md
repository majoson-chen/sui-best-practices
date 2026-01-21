# Sui 测试网测试币管理

- 每次领取Sui测试网的测试sui很有局限性，所以需要自己管理测试币。
- Sui测试币的领取地址：https://faucet.sui.io/
- 但是建议大家还是自己生成测试币，这样可以更方便的进行测试。
- 比如自己发行USDC、USDT等测试币，可以直接在测试网上进行交易。
- 方便很多模拟操作，sui测试币只作为发布合约、调用合约的gas费用即可。

# 首先合约部分

```move
    /// 定义测试 USDC 代币 - one-time witness
    public struct TEST_COIN has drop {}

    /// 初始化函数，创建 USDC 的 TreasuryCap
    fun init(witness: TEST_COIN, ctx: &mut TxContext) {
        // 使用新的 API 创建货币
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            6, // 小数位数
            b"TEST USDC", // 名称
            b"Test USDC Coin", // 描述
            b"USDC", // 符号
            option::some(url::new_unsafe(ascii::string(b"https://example.com/usdc.png"))), // 图标 URL
            ctx
        );

        // 将 TreasuryCap 转移给部署者
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));

        // 将元数据转移给部署者
        transfer::public_transfer(metadata, tx_context::sender(ctx));
    }

```

这里的自己发行的测试币管理权限在部署者手里，部署者可以随时增发、和销毁测试币。

# 铸造测试币

```move
    /// 铸造测试币
    public entry fun mint_usdc(
        treasury_cap: &mut TreasuryCap<TEST_COIN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// 销毁测试 USDC
    public entry fun burn_usdc(treasury_cap: &mut TreasuryCap<TEST_COIN>, coin: Coin<TEST_COIN>) {
        coin::burn(treasury_cap, coin);
    }

    /// 转账测试 USDC
    public entry fun transfer_usdc(coin: Coin<TEST_COIN>, recipient: address, _ctx: &mut TxContext) {
        transfer::public_transfer(coin, recipient);
    }

```

# 测试练习

可以自己做一个前端，或者使用sui的cli工具进行测试。
![前端测试](https://youke1.picui.cn/s1/2025/11/26/6926d02a72723.png)

# 做一些基本的实践操作，加深印象

# 思考

如何让其他用户可以方便领取测试币，而不是通过管理员铸币然后转账的方式？
