const BLE_MTU = 20;
const BLE_DEVICE_INFORMATION_SERVICE_UUID = 0x180a;
const BLE_NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NUS_CHARACTERISTICS_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_NUS_CHARACTERISTICS_TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

let BLE = function() {
    this.name = "";
    this.device = null;
    this.server = null;
    this.connected = false;
    this.nusService = null;
    this.nusRxCharacteristic = null;
};

BLE.prototype.connect = function() {
    if (!navigator.bluetooth) {
        alert('WebBluetooth API is not available.\r\n' +
            'Please make sure the Web Bluetooth flag is enabled.');
        return;
    }
    console.log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice({
        optionalServices: [
            BLE_NUS_SERVICE_UUID,
            BLE_DEVICE_INFORMATION_SERVICE_UUID
        ],
        acceptAllDevices: true
    })
    .then(device => {
        this.device = device;
        this.name = device.name;
        console.log('Found ' + device.name);
        console.log('Connecting to GATT Server...');
        this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
        return device.gatt.connect();
    })
    .then(server => {
        this.server = server;
        console.log('Locate NUS service');
        return server.getPrimaryService(BLE_NUS_SERVICE_UUID);
    })
    .then(service => {
        console.log('Found NUS service: ' + service.uuid);
        this.nusService = service;
        console.log('Locate device info service');
        return this.server.getPrimaryService('device_information');
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
        view.setFirmwareVersion(value);
        console.log('Locate NUS RX characteristic');
        return this.nusService.getCharacteristic(BLE_NUS_CHARACTERISTICS_RX_UUID);
    })
    .then(characteristic => {
        console.log('Found NUS RX characteristic');
        this.nusRxCharacteristic = characteristic;
        console.log('Locate NUS TX characteristic');
        return this.nusService.getCharacteristic(BLE_NUS_CHARACTERISTICS_TX_UUID);
    })
    .then(characteristic => {
        console.log('Found NUS TX characteristic');
        console.log('Enable notifications');
        characteristic.startNotifications();
        console.log('Notifications started');
        characteristic.addEventListener('characteristicvaluechanged', this.handleNusTxNotifications);
        this.connected = true;
        view.onConnected();
        console.log('\r\n' + this.device.name + ' Connected.');
    })
    .catch(error => {
        alert('BLE error: ' + error);
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
    });
};

BLE.prototype.disconnect = function() {
    if (!this.device) {
        console.log('No Bluetooth Device connected...');
        return;
    }
    console.log('Disconnecting from Bluetooth Device...');
    if (this.device.gatt.connected) {
        this.device.gatt.disconnect();
        this.connected = false;
        console.log('Bluetooth Device connected: ' + this.device.gatt.connected);
    } else {
        console.log('> Bluetooth Device is already disconnected');
    }
};

BLE.prototype.onDisconnected = function() {
    this.connected = false;
    view.onDisconnected();
    console.log('BLE Disconnected: ' + this.name);
};

BLE.prototype.handleNusTxNotifications = function(event) {
    let data = event.target.value;
    let valueString = '';
    for (let i = 0; i < data.byteLength; i++) {
        valueString += String.fromCharCode(data.getUint8(i));
    }
    try {
        let values = valueString.split(',').map(Number);
        view.updateSensorValues(values);
    } catch(err) {
        console.log('BLE error parsing sensor values: ' + err.message);
    }
};

BLE.prototype.sendString = async function(message, term = true) {
    if (this.device && this.device.gatt.connected && this.nusRxCharacteristic) {
        console.log('Sending rx: ' + message);
        let begin = new Uint8Array([60, 99, 111, 100, 101, 62]);
        let end = new Uint8Array([60, 99, 111, 100, 101, 47, 62]);
        let valueArray = new Uint8Array(message.length)
        for (let i = 0; i < message.length; i++) {
            let val = message[i].charCodeAt(0);
            valueArray[i] = val;
        }
        // TODO: fix race condition, too fast data transmission
        // NetworkError: GATT operation already in progress.
        //bleSendNextChunk(valueArray);
        if (term) {
            await this.nusRxCharacteristic.writeValue(begin).catch(error => {
                console.log('RX characteristics error: ' + error);
            });
        }
        for (let i = 0;; i += BLE_MTU) {
            let chunk = valueArray.slice(i, i + BLE_MTU);
            await this.nusRxCharacteristic.writeValue(chunk).catch(error => {
                console.log('RX characteristics error: ' + error);
            });
            // When we sent all the bytes
            if (chunk.length != BLE_MTU) {
                break;
            }
        }
        if (term) {
            await this.nusRxCharacteristic.writeValue(end).catch(error => {
                console.log('RX characteristics error: ' + error);
            });
        }
    } else {
        console.log('Not connected to a BLE device');
    }
};
