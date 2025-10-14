最近在学sui的move合约，入门了move,后面看到有个move ctf的共学的活动。想着对ctf没咋接触过就尝试着入坑。


看了一下sui的官网文档，支持rust,ts,kotlin,go,py等客户端，本人对ts不是很感冒(菜就多练)。

刚开始尝试了kotlin的客户端，看着支持dsl挺好的，

结果使用发现很多bug，看了下github很久之前就有这个issue了，好像很久没维护了，遂弃坑。

后面就看到了go的客户端，然后就有个这篇文章
。本篇记录下golang的move sdk的使用，并解题move ctf

## 快速入门

首先第一步就是安装golang，这个教程就不多说了，网上有很多教程，这里就不多赘述了。

之后关键就是引入依赖 `go get github.com/block-vision/sui-go-sdk` 要求go版本 >= 1.20

然后就是简单的初始化客户端

```go
package main

import (
	"context"
	"fmt"
    "github.com/block-vision/sui-go-sdk/constant"
	"github.com/block-vision/sui-go-sdk/sui"
)

func main() {
	// configure your endpoint here or use BlockVision's free Sui RPC endpoint
	cli := sui.NewSuiClient(constant.SuiTestnetEndpoint)
}

```

然后就是简单的调用rpc接口了，比如获取sui的余额，这些可以简单参照github下面的项目文档操作即可

## 具体案例

### 1. 使用bcs序列化简单数据类型

序列化一个字符串
```go
import(
"github.com/block-vision/sui-go-sdk/mystenbcs"
)

func main() {
    marshal, err := mystenbcs.Marshal("LetsMoveCTF")
	fmt.Printf("%v\n", marshal)
	if err != nil {
		panic(err)
	}
}
```

此外还可以序列化uint8等类型，这里就不一一演示了

### 2. 使用bcs序列化结构体及自定义序列化

举个常见的例子，如果我们先获取一个对象的bcs序列化数据怎么办呢，我们都知道对象数据都有一个唯一uid标识加上自己的一些属性构成。

这时候除了对对象的其他属性进行序列化，还得对uid进行自定义序列化，uid本身就是32位的byte数组，这里代码演示下

```go

type Challenge struct {
	ID          UID
	Str         string // UTF-8 字符串
	Difficulity uint64 // u64
	TureNum     uint64 // u64
}
type UID string

func (u UID) MarshalBCS() ([]byte, error) {
	bytes := GetAddressHexBytes(string(u))
	return bytes[:], nil
}

func GetAddressHexBytes(address string) [32]byte {
	// 去除可能存在的 0x 前缀
	if len(address) >= 2 && address[:2] == "0x" {
		address = address[2:]
	}

	// 将十六进制字符串解码为字节切片
	bytes, err := hex.DecodeString(address)
	if err != nil {
		panic(err)
	}
	var result [32]byte
	copy(result[:], bytes)
	return result
}

```

### 3. sui客户端操作

首先比较重要的就是如何导入现有的账户进行操作，这个模块支持从助记词导入账户

```go
func main() { 
    signerAccount, _ := signer.NewSignertWithMnemonic("your mnemonic")
}
```

是不是很简单，此外还支持从seed导入，大家可以自行探索

然后还有个比较常用的功能就是获取链上的对象信息

```go

func main() { 
    objId := "your obj id"
    ctx := context.Background()
	cli := sui.NewSuiClient(constant.SuiTestnetEndpoint)
	object, err := cli.SuiGetObject(ctx, models.SuiGetObjectRequest{
		ObjectId: objId,
		Options: models.SuiObjectDataOptions{
			ShowType:    true,
			ShowContent: true,
			ShowBcs:     true,
			ShowDisplay: true,
		},
	})
	if err != nil {
		panic(err)
	}
	utils.PrettyPrint(object)
}

```

上面的代码获取链上对象信息并打印

## ctf题解

### 简单签到挑战

move合约代码如下:

```move
module chapter_1::check_in {
    use std::string::{Self, String};
    use std::bcs;
    use std::hash::sha3_256;
    use sui::event;

    //testnet
    //PackageID:0x335297860a807291254b20f8a0dea30d72d5e17d2e6f8058e42d5b9c72f0f0ef
    public struct FlagEvent has copy, drop {
        sender: address,
        flag: String,
        success: bool
    }

    public entry fun get_flag(
        flag: vector<u8>,
        github_id: String,
        ctx: &mut TxContext
    ) {
        let mut bcs_input = bcs::to_bytes(&string::utf8(b"LetsMoveCTF"));
        vector::append<u8>(&mut bcs_input, *github_id.as_bytes());
        let expected_hash = sha3_256(bcs_input);

        if (flag == expected_hash) {
            event::emit(FlagEvent {
                sender: tx_context::sender(ctx),
                flag: string::utf8(b"CTF{WelcomeToMoveCTF}"),
                success: true
            });
        } else {
            event::emit(FlagEvent {
                sender: tx_context::sender(ctx),
                flag: string::utf8(b"Try again!"),
                success: false
            });
        }
    }
}
```

这里获取flag的思路非常简单，LetsMoveCTF进行bcs序列化拼接上github ID 然后再进行sha3_256哈希即可解题

获取flag的代码如下:

```go
func BuildFlag(name string) []byte {
	bytes := []byte(name)
	marshal, err := mystenbcs.Marshal("LetsMoveCTF")
	fmt.Printf("%v\n", marshal)
	if err != nil {
		panic(err)
	}
	result := []byte{}
	result = append(result, marshal...)
	result = append(result, bytes...)
	fmt.Printf("Flag bytes: %v\n", result)
	digest := sha3.Sum256(result)
	return digest[:]
}
```

## 未完待续...


