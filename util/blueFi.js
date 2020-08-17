let blueFi = {}
const IOS_STATUS = {
    0: "未知",
    1: "重置中",
    2: "不支持",
    3: "未授权",
    4: "未开启"
}
const ERROR_CODE = 10001
/**
 * return @params code: 0失败 1成功
 * @params msg: IOS
 */
blueFi.fail = function (error) {
    // 获取设备信息
    let phoneInfo = wx.getSystemInfoSync();
    let res = {};
    //如果设备类型为IOS
    if (phoneInfo.system.split(' ')[0] === 'iOS') {
        // 返回结果
        if (error.errCode === ERROR_CODE) {
            res = {
                code: 0,
                device: 'iOS',
                state: error.state,
                errMsg: IOS_STATUS[error.state]
            }

        }
    } else {
        res = {
            code: 0,
            device: 'android',
        }
    }

    return res;
}
blueFi.Unit8ArrayToStr = function (array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
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
blueFi.stringToUint8Array = function (string) {
    let pos = 0;
    const len = string.length;
    const out = [];

    let at = 0;  // output position
    let tlen = Math.max(32, len + (len >> 1) + 7);  // 1.5x size
    let target = new Uint8Array((tlen >> 3) << 3);  // ... but at 8 byte offset

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
                continue;  // drop lone surrogate
            }
        }

        // expand the buffer if we couldn't write 4 bytes
        if (at + 4 > target.length) {
            tlen += 8;  // minimum extra
            tlen *= (1.0 + (pos / string.length) * 2);  // take 2x the remaining
            tlen = (tlen >> 3) << 3;  // 8 byte offset

            const update = new Uint8Array(tlen);
            update.set(target);
            target = update;
        }

        if ((value & 0xffffff80) === 0) {  // 1-byte
            target[at++] = value;  // ASCII
            continue;
        } else if ((value & 0xfffff800) === 0) {  // 2-byte
            target[at++] = ((value >> 6) & 0x1f) | 0xc0;
        } else if ((value & 0xffff0000) === 0) {  // 3-byte
            target[at++] = ((value >> 12) & 0x0f) | 0xe0;
            target[at++] = ((value >> 6) & 0x3f) | 0x80;
        } else if ((value & 0xffe00000) === 0) {  // 4-byte
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
module.exports = blueFi