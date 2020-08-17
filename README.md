---
title: ESP32的SDK开发之blufi一键配网微信小程序端开发
date: 2020-08-17
categories:
 - 微信小程序
tags:
 - code
---

1. [ESP32编程指南](https://docs.espressif.com/projects/esp-idf/zh_CN/latest/esp32/api-guides/blufi.html#frame-formats)  
2. [JavaScript ArrayBuffer浅析](https://www.cnblogs.com/gradolabs/p/4762134.html)

### 搜索设备

1. 打开蓝牙适配器
2. 打开蓝牙搜索功能
3. 监听寻找到新设备的事件
4. 监听蓝牙适配器状态变化事件 

``` js
page({
    // 打开蓝牙适配器
    openBluetoothAdapter() {
        const that = this
        wx.openBluetoothAdapter({
            success(res) {
                console.log('open blueFi success: ', res)
                that.onBluetoothDeviceFound()
                that.onBluetoothAdapterStateChange()
                that.startBluetoothDevicesDiscovery()
            },
            fail(error) {
                let errorRes = blueFi.fail(error)
                console.log(errorRes)
            }
        })
    },
    // 打开蓝牙搜索功能
    startBluetoothDevicesDiscovery() {
        wx.startBluetoothDevicesDiscovery({
            services: UUIDS,
            success(res) {
                console.log("打开蓝牙搜索功能成功")
            }
        })
    }
    // 监听寻找到新设备的事件
    onBluetoothDeviceFound() {
        const that = this
        wx.onBluetoothDeviceFound((res) => {
            var devices = res.devices;

            that.setData({
                devices: devices
            })
        })
    },
    // 监听蓝牙适配器状态变化事件
    onBluetoothAdapterStateChange() {
        wx.onBluetoothAdapterStateChange(function(res) {
            console.log('adapterState changed, now is', res)
        })
    }
})
```

### 连接设备

1. 跟设备建立连接
2. 获取蓝牙设备服务列表
3. 获取蓝牙设备某服务的特征值
4. 通知蓝牙设备特征值变化
5. 监听特征值变化

### 监听蓝牙设备特征值变化

通过监听特征值的变化, 对返回的buffer进行处理。

``` js
  // 监听特征值变化
  onBLECharacteristicValueChange() {
      const that = this
      wx.onBLECharacteristicValueChange((res) => {
          console.log( `characteristic ${res.characteristicId} has changed, now is ${res.value}` )
          const buffer = res.value
          const u8a = new Uint8Array(buffer)

          /** 
           * 控制帧 ‘00011111’ 从右往左数起 
           * 第1位表示是否加密 
           * 第2位表示帧 Data 域结尾是否帧含校验（例如 SHA1,MD5,CRC等）需要校验的数据域包括 sequcne + data length + 明文 data。
           * 第3位表示数据方向。0 表示手机发向 ESP32；1 表示 ESP32 发向手机。
           * 第4位表示是否要求对方回复 ack。
           * 第5位表示是否有后续的数据分片。
           * */

          const frameControl = u8a[1]
          // 序列控制域。帧发送时，无论帧的类型是什么，序列 (Sequence) 都会自动加 1，用来防止重放攻击 (Replay Attack)。每次重现连接后，序列清零。
          const sequence = u8a[2]
          // Data 域的长度，不包含 CheckSum。
          const length = u8a[3]

          let resStr = []
          for (let i = 0; i < length; i++) {
              resStr.push(u8a[4 + i])
          }

          console.log( `是否有分包` , frameControl.toString(2))
          console.log( `是否连接成功: ${Unit8ArrayToStr(resStr).includes(that.data.wifiName)}` );

      })
  }
```

### 发送设备指令

调用 `wx.writeBLECharacteristicValue` 接口与蓝牙设备进行写入操作

``` js
 sendCMD(CMD, subCMD, data) {
     // 传输数据相关
     const length = data.length;
     const ab = new ArrayBuffer(length + 6)
     const u8a = new Uint8Array(ab)

     // Type 类型域，占 1 byte。分为 Type 和 Subtype（子类型域）两部分, Type 占低 2 bit，Subtype 占高 6 bit。
     // const LSB_Type = ((subCMD & 0x3f) << 2) | (CMD & 0x03);
     // u8a[0] = CMD;
     u8a[0] = (subCMD << 2) | CMD;

     //帧控制
     u8a[1] = 0x00;
     u8a[2] = this.data.sequence++;
     u8a[3] = length

     for (let i = 0; i < length; i++) {
         u8a[4 + i] = data[i]
     }

     const {
         service,
         deviceId,
         characteristics
     } = this.data;
     const serviceId = service.uuid;
     const characteristicId = characteristics.find(item => item.properties.write === true)
     wx.writeBLECharacteristicValue({
         deviceId: deviceId,
         serviceId: serviceId,
         characteristicId: characteristicId.uuid,
         value: ab,
         success(res) {
             // console.log(res)
         },
         fail(err) {
             console.log(err)
         }
     })
 }
```

### js转unit8Array

js 字符串转unit8Array

``` js
function Unit8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                // 110x xxxx 10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx 10xx xxxx 10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

function stringToUint8Array(string) {
    let pos = 0;
    const len = string.length;
    const out = [];

    let at = 0; // output position
    let tlen = Math.max(32, len + (len >> 1) + 7); // 1.5x size
    let target = new Uint8Array((tlen >> 3) << 3); // ... but at 8 byte offset

    while (pos < len) {
        let value = string.charCodeAt(pos++);
        if (value >= 0xd800 && value <= 0xdbff) {
            // high surrogate
            if (pos < len) {
                const extra = string.charCodeAt(pos);
                if ((extra & 0xfc00) === 0xdc00) {
                    ++pos;
                    value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
                }
            }
            if (value >= 0xd800 && value <= 0xdbff) {
                continue; // drop lone surrogate
            }
        }

        // expand the buffer if we couldn't write 4 bytes
        if (at + 4 > target.length) {
            tlen += 8; // minimum extra
            tlen *= (1.0 + (pos / string.length) * 2); // take 2x the remaining
            tlen = (tlen >> 3) << 3; // 8 byte offset

            const update = new Uint8Array(tlen);
            update.set(target);
            target = update;
        }

        if ((value & 0xffffff80) === 0) { // 1-byte
            target[at++] = value; // ASCII
            continue;
        } else if ((value & 0xfffff800) === 0) { // 2-byte
            target[at++] = ((value >> 6) & 0x1f) | 0xc0;
        } else if ((value & 0xffff0000) === 0) { // 3-byte
            target[at++] = ((value >> 12) & 0x0f) | 0xe0;
            target[at++] = ((value >> 6) & 0x3f) | 0x80;
        } else if ((value & 0xffe00000) === 0) { // 4-byte
            target[at++] = ((value >> 18) & 0x07) | 0xf0;
            target[at++] = ((value >> 12) & 0x3f) | 0x80;
            target[at++] = ((value >> 6) & 0x3f) | 0x80;
        } else {
            // FIXME: do we care
            continue;
        }

        target[at++] = (value & 0x3f) | 0x80;
    }

    return target.slice(0, at);
}
```
