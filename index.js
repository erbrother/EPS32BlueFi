// package/blueFi/index.js
import blueFi from "./util/blueFi";
// 填写自己的设备ID
const UUIDS = ['0000FFFF-0000-1000-8000-00805F9BXXFB'];

Page({

  /**
   * 页面的初始数据
   */
  data: {
    devices: [{
      name: '默认设备',
      deviceId: 'DB953A4D-8478-9EDD-BE66-737EC1A4EA27'
    }]
  },
  bindConnectDevice(e) {
    try {
      this.stopBluetoothDevicesDiscovery()
    } catch(e) {
      console.log(e)
    }
    const deviceId = e.currentTarget.dataset.item.deviceId

    wx.navigateTo({
      url: './connectDevice/index?deviceId=' + deviceId,
    })
  },
  bindOpenBLueFl() {
    this.openBluetoothAdapter()
  },
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
  },
  // 关闭蓝牙搜索功能
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },
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

  //监听蓝牙适配器状态变化事件
  onBluetoothAdapterStateChange() {
    wx.onBluetoothAdapterStateChange(function (res) {
      console.log('adapterState changed, now is', res)
    })
  }
})