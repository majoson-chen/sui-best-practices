const { bcs } = require('@mysten/bcs');

// 定义一些示例数据结构
function demonstrateBCS() {
    console.log('=== Sui BCS 操作演示 ===\n');

    // 1. 序列化基本数据类型
    console.log('1. 基本数据类型序列化:');
    
    // 序列化 u64
    const number = 42n;
    const u64Type = bcs.u64();
    const serializedNumber = u64Type.serialize(number).toBytes();
    console.log(`数字 ${number} 序列化后:`, Array.from(serializedNumber));
    
    // 反序列化 u64
    const deserializedNumber = u64Type.parse(serializedNumber);
    console.log(`反序列化结果: ${deserializedNumber}\n`);

    // 2. 序列化字符串
    console.log('2. 字符串序列化:');
    const text = 'Hello Sui!';
    const stringType = bcs.string();
    const serializedString = stringType.serialize(text).toBytes();
    console.log(`字符串 "${text}" 序列化后:`, Array.from(serializedString));
    
    const deserializedString = stringType.parse(serializedString);
    console.log(`反序列化结果: "${deserializedString}"\n`);

    // 3. 序列化地址（使用字节数组表示）
    console.log('3. 地址序列化:');
    const addressBytes = new Uint8Array(32).fill(0); // 32字节的零地址
    const addressType = bcs.bytes(32);
    const serializedAddress = addressType.serialize(addressBytes).toBytes();
    console.log('地址序列化后:', Array.from(serializedAddress));
    
    const deserializedAddress = addressType.parse(serializedAddress);
    console.log('反序列化结果:', Array.from(deserializedAddress));
    console.log('地址字符串:', '0x' + Array.from(deserializedAddress).map(b => b.toString(16).padStart(2, '0')).join('') + '\n');

    // 4. 序列化向量
    console.log('4. 向量序列化:');
    const vector = [1n, 2n, 3n, 4n, 5n];
    const vectorType = bcs.vector(bcs.u64());
    const serializedVector = vectorType.serialize(vector).toBytes();
    console.log(`向量 [${vector}] 序列化后:`, Array.from(serializedVector));
    
    const deserializedVector = vectorType.parse(serializedVector);
    console.log(`反序列化结果: [${deserializedVector}]\n`);

    // 5. 序列化复杂结构
    console.log('5. 复杂结构序列化:');
    
    // 定义一个自定义结构
    const Coin = bcs.struct('Coin', {
        value: bcs.u64(),
        coinType: bcs.string()
    });

    const coin = {
        value: 1000000n,
        coinType: '0x2::sui::SUI'
    };
    
    const serializedCoin = Coin.serialize(coin).toBytes();
    console.log('Coin 结构序列化后:', Array.from(serializedCoin));
    
    const deserializedCoin = Coin.parse(serializedCoin);
    console.log('反序列化结果:', deserializedCoin);
    console.log('Coin 值:', deserializedCoin.value);
    console.log('Coin 类型:', deserializedCoin.coinType);

    // 6. 序列化交易相关数据
    console.log('\n6. 交易数据序列化示例:');
    
    // 定义一个简单的交易结构
    const SimpleTransaction = bcs.struct('SimpleTransaction', {
        sender: bcs.bytes(32),
        recipient: bcs.bytes(32),
        amount: bcs.u64(),
        gas: bcs.u64()
    });

    const senderBytes = new Uint8Array(32);
    senderBytes[31] = 1; // 设置最后一个字节为1
    const recipientBytes = new Uint8Array(32);
    recipientBytes[31] = 2; // 设置最后一个字节为2

    const transaction = {
        sender: senderBytes,
        recipient: recipientBytes,
        amount: 1000000000n,
        gas: 1000000n
    };

    const serializedTx = SimpleTransaction.serialize(transaction).toBytes();
    console.log('交易数据序列化后:', Array.from(serializedTx));
    
    const deserializedTx = SimpleTransaction.parse(serializedTx);
    console.log('反序列化交易数据:', {
        sender: '0x' + Array.from(deserializedTx.sender).map(b => b.toString(16).padStart(2, '0')).join(''),
        recipient: '0x' + Array.from(deserializedTx.recipient).map(b => b.toString(16).padStart(2, '0')).join(''),
        amount: deserializedTx.amount,
        gas: deserializedTx.gas
    });

    // 7. 演示枚举类型
    console.log('\n7. 枚举类型序列化:');
    
    const Status = bcs.enum('Status', {
        Active: null,
        Inactive: bcs.string(),
        Pending: bcs.u64()
    });

    // 序列化不同的枚举值
    const activeStatus = { Active: true };
    const serializedActive = Status.serialize(activeStatus).toBytes();
    console.log('Active 状态序列化后:', Array.from(serializedActive));

    const inactiveStatus = { Inactive: 'Maintenance' };
    const serializedInactive = Status.serialize(inactiveStatus).toBytes();
    console.log('Inactive 状态序列化后:', Array.from(serializedInactive));

    const pendingStatus = { Pending: 12345n };
    const serializedPending = Status.serialize(pendingStatus).toBytes();
    console.log('Pending 状态序列化后:', Array.from(serializedPending));

    // 反序列化
    const deserializedActive = Status.parse(serializedActive);
    console.log('反序列化 Active:', deserializedActive);

    const deserializedInactive = Status.parse(serializedInactive);
    console.log('反序列化 Inactive:', deserializedInactive);

    const deserializedPending = Status.parse(serializedPending);
    console.log('反序列化 Pending:', deserializedPending);

    console.log('\n=== BCS 演示完成 ===');
}

// 运行演示
try {
    demonstrateBCS();
} catch (error) {
    console.error('演示过程中出现错误:', error);
}
