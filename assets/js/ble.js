const BLE_MTU = 20;
const BLE_BATTERY_SERVICE_UUID = 0x180f;
const BLE_DEVICE_INFORMATION_SERVICE_UUID = 0x180a;
const BLE_NUS_SERVICE_UUID  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NUS_CHARACTERISTICS_RX_UUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NUS_CHARACTERISTICS_TX_UUID   = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

var bleDevice;
var bleServer;
var bleNusService;
var bleNusRxCharacteristic;

var bleConnected = false;

function bleConnect() {
    if (!navigator.bluetooth) {
        console.log('WebBluetooth API is not available.\r\n' +
            'Please make sure the Web Bluetooth flag is enabled.');
        return;
    }
    console.log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice({
        optionalServices: [
            BLE_NUS_SERVICE_UUID,
            BLE_BATTERY_SERVICE_UUID,
            BLE_DEVICE_INFORMATION_SERVICE_UUID
        ],
        acceptAllDevices: true
    })
    .then(device => {
        bleDevice = device;
        console.log('Found ' + device.name);
        console.log('Connecting to GATT Server...');
        bleDevice.addEventListener('gattserverdisconnected', bleOnDisconnected);
        sumorobot.onConnected();
        return device.gatt.connect();
    })
    .then(server => {
        bleServer = server;
        console.log('Locate NUS service');
        return server.getPrimaryService(BLE_NUS_SERVICE_UUID);
    })
    .then(service => {
        console.log('Found NUS service: ' + service.uuid);
        bleNusService = service;
        /*console.log('Locate battery service');
        return bleServer.getPrimaryService('battery_service');
    })
    .then(service => {
        console.log('Found battery service: ' + service.uuid);
        console.log('Locate battery level characteristic');
        return service.getCharacteristic('battery_level');
    })
    .then(function (characteristic) {
        characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', bleHandleBatteryLevelNotifications);
        console.log('Read battery level value');
        return characteristic.readValue();
    })
    .then(function (value) {
        // Send the battery level
        sumorobot.updateBatterLevel(value);*/
        console.log('Locate device info service');
        return bleServer.getPrimaryService('device_information');
    })
    .then(service => {
        console.log('Found device information service: ' + service.uuid);
        return service.getCharacteristic('firmware_revision_string');
    })
    .then(characteristic => {
        console.log('Read firmware revision string');
        return characteristic.readValue();
    })
    .then(value => {
        sumorobot.setFirmwareVersion(value);
        console.log('Locate NUS RX characteristic');
        return bleNusService.getCharacteristic(BLE_NUS_CHARACTERISTICS_RX_UUID);
    })
    .then(characteristic => {
        console.log('Found NUS RX characteristic');
        bleNusRxCharacteristic = characteristic;
        console.log('Locate NUS TX characteristic');
        return bleNusService.getCharacteristic(BLE_NUS_CHARACTERISTICS_TX_UUID);
    })
    .then(characteristic => {
        console.log('Found NUS TX characteristic');
        console.log('Enable notifications');
        characteristic.startNotifications();
        console.log('Notifications started');
        characteristic.addEventListener('characteristicvaluechanged', bleHandleNusTxNotifications);
        bleConnected = true;
        console.log('\r\n' + bleDevice.name + ' Connected.');
    })
    .catch(error => {
        console.log('' + error);
        if (bleDevice && bleDevice.gatt.connected) {
            bleDevice.gatt.disconnect();
        }
    });
}

function bleDisconnect() {
    if (!bleDevice) {
        console.log('No Bluetooth Device connected...');
        return;
    }
    console.log('Disconnecting from Bluetooth Device...');
    if (bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        bleConnected = false;
        console.log('Bluetooth Device connected: ' + bleDevice.gatt.connected);
    } else {
        console.log('> Bluetooth Device is already disconnected');
    }
}

function bleOnDisconnected() {
    bleConnected = false;
    sumorobot.onDisconnected();
    console.log('\r\n' + bleDevice.name + ' Disconnected.');
}

function bleHandleBatteryLevelNotifications(event) {
    let value = event.target.value;
    sumorobot.updateBatterLevel(value);
    //console.log('battery_level: ' + value.getUint8(0));
}

function bleHandleNusTxNotifications(event) {
    let value = event.target.value;
    sumorobot.updateSensorValues(value);
    //console.log('sonar: ' + value.getUint8(0));
    //console.log('left_line1: ' + (value.getUint8(1) << 8 | value.getUint8(2)));
    //console.log('left_line2: ' + (value.getUint8(3) << 8 | value.getUint8(4)));
    //console.log('charging: ' + value.getUint8(5));
}

function bleSendString(message) {
    if (bleDevice && bleDevice.gatt.connected && bleNusRxCharacteristic) {
        console.log("send: " + message);
        let val_arr = new Uint8Array(message.length)
        for (let i = 0; i < message.length; i++) {
            let val = message[i].charCodeAt(0);
            val_arr[i] = val;
        }
        // TODO: fix race condition, too fast data transmission
        // NetworkError: GATT operation already in progress.
        //bleSendNextChunk(val_arr);
        bleNusRxCharacteristic.writeValue(val_arr).catch(function(error) {
            console.log('ble.js error: ' + error);
        });
    } else {
        console.log('Not connected to a device yet.');
    }
}

function bleSendNextChunk(a) {
    let chunk = a.slice(0, BLE_MTU);
    bleNusRxCharacteristic.writeValue(chunk).then(async function() {
        if (a.length > BLE_MTU) {
            bleSendNextChunk(a.slice(BLE_MTU));
        }
    });
}
