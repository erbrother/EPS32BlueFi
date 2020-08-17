// package/blueFi/connectDevice/index.js
import { Unit8ArrayToStr, stringToUint8Array } from '../util/blueFi'
Page({
  /**
   * 页面的初始数据
   * 连接蓝牙设备
   */
  data: {
    /**蓝牙设备相关信息 */
    deviceId: '',
    service: '',
    characteristics: [],

    /** wifi相关信息 */
    wifiName: 'Qc',
    password: '32218180',

    /** 发送的帧序列 */
    sequence: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 初始化设备Id
    this.initDeviceId(options)
    this.initBlueFi()

  },
  openBluetoothAdapter() {
    const that = this
    wx.openBluetoothAdapter({
      success(res) {
        wx.hideLoading()
        that.getCharacteristics()
      },
      fail(err) {
        wx.hideLoading()
        wx.showToast({
          title: '打开失败',
          icon: 'none'
        })
      }
    })
  },
  onWifiName(e) {
    const { value } = e.detail

    this.data.wifiName = value
  },
  onPassword(e) {
    const { value } = e.detail

    this.data.password = value
  },
  // 获取设备特征值
  async getCharacteristics() {
    const that = this
    wx.showLoading({
      title: '连接设备中',
      mask: true
    })
    try {
      // 跟设备建立连接
      let res = await that.createBLEConnection()
      // 获取蓝牙设备服务列表
      let services = await that.getBLEDeviceServices()

      //获取isPrimary为true的设备
      let service = that._getService(services.services)
      that.data.service = service

      //获取特征值
      let characteristics = await that.getBLEDeviceCharacteristics()
      that.data.characteristics = characteristics.characteristics

      // 通知蓝牙设备特征值变化
      await that.notifyBLECharacteristicValueChange();

      // 监听特征值变化
      that.onBLECharacteristicValueChange();
      wx.hideLoading()
    } catch (e) {
      console.log(`async getCharacteristics error:`, e)
      wx.hideLoading()

    }

  },
  // 连接蓝牙设备
  createBLEConnection() {
    const that = this
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId: that.data.deviceId,
        timeout: 10000, //ms
        success(res) {
          resolve(res)
        },
        fail(err) {
          reject(err)
        }
      })
    })
  },
  // 获取设备蓝牙服务
  getBLEDeviceServices() {
    const that = this
    const deviceId = that.data.deviceId //设备Id

    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId: deviceId,
        success(res) {
          resolve(res)
        },
        fail(err) {
          reject(err)
        }
      })
    })

  },
  _getService(services) {
    if (!services.length) return
    let len = services.length;
    for (let i = 0; i < len; i++) {
      if (services[i].isPrimary) {
        return services[i]
      }
    }
  },
  // 获取设备的特征值
  getBLEDeviceCharacteristics() {
    const { deviceId, service } = this.data
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId: service.uuid,
        success(res) {
          resolve(res)
        },
        fail(error) {
          reject(error)
        }
      })
    })
  },
  // 通知蓝牙设备特征值变化
  notifyBLECharacteristicValueChange() {
    const { deviceId, service, characteristics } = this.data
    const characteristic = characteristics.find((item) => {
      return item.properties.notify == true
    })
    console.log(this.data)
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        characteristicId: characteristic.uuid,
        deviceId: deviceId,
        serviceId: service.uuid,
        state: true,
        success(res) {
          resolve(res)
        },
        fail(err) {
          reject(err)
        }
      })
    })

  },
  // 监听特征值变化
  onBLECharacteristicValueChange() {
    const that = this
    wx.onBLECharacteristicValueChange((res) => {
      console.log(`characteristic ${res.characteristicId} has changed, now is ${res.value}`)
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

      console.log(`是否有分包`, frameControl.toString(2))
      console.log(`是否连接成功: ${Unit8ArrayToStr(resStr).includes(that.data.wifiName)}`);

    })
  },
  onSubmit() {
    this._sendWifiName()
    this._sendWifiPwd()
    this._sendConnectCMD()
  },
  // 发送设备指令
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

    const { service, deviceId, characteristics } = this.data;
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
  },
  // 发送wifi名称
  _sendWifiName() {
    const that = this
    const wifiName = that.data.wifiName
    const payload = stringToUint8Array(wifiName)
    that.sendCMD(0x01, 0x02, payload)
  },
  // 发送password
  _sendWifiPwd() {
    const that = this
    const password = that.data.password
    let payload = stringToUint8Array(password)
    that.sendCMD(0x01, 0x03, payload)
  },
  // 发送连接指令
  _sendConnectCMD() {
    this.sendCMD(0x00, 0x03, '')
  },
  // 判断是否连接成功
  _isConnected() {
    this.sendCMD(0x00, 0x05, '')
  },

  initDeviceId(options) {
    if (!options.deviceId) return
    this.data.deviceId = options.deviceId
  },
  initBlueFi() {
    const that = this
    wx.getBluetoothAdapterState({
      success(res) {
        that.getCharacteristics()
      },
      fail(err) {
        wx.showLoading({
          title: '打开蓝牙适配器中',
        })
        that.openBluetoothAdapter()
      }
    })
  }
})