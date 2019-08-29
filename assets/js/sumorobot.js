// Moving direction constants
const STOP = 'stop';
const LEFT = 'left';
const RIGHT = 'right';
const FORWARD = 'forward';
const BACKWARD = 'backward';

// LED constants
const SONAR = 's';
const STATUS = 'c';
const LEFT_LINE = 'l';
const RIGHT_LINE = 'r';

// Sensor value update frequency for the user
// X * 50 milliseconds (X = 10 every half second)
const SENSOR_VALUE_UPDATE_FREQ = 0;

// Sumorobot constructor
var Sumorobot = function() {
    // Remember last moving direction
    this.lastDirection = '';
    // If SumoRobot is moving
    this.isMoving = false;
    // Code termination
    this.terminate = false;
    // To remember the update frequency
    this.sensorValueUpdateFreq = SENSOR_VALUE_UPDATE_FREQ;
    // SumoFirmware version
    this.firmwareVersion = '';
    // Sensor data
    this.sensorValues = {
        sonar: 99,
        leftLine: 0,
        rightLine: 0,
        batteryLevel: 0,
        isBatterCharging: false
    };
    this.sensorConstants = {
        sonarThreshold: 40,
        leftLineValueField: 0,
        rightLineValueField: 0,
        leftLineThreshold: 1000,
        rightLineThreshold: 1000
    };
};

Sumorobot.prototype.onConnected = function() {
    $('#panel').hide();
};

Sumorobot.prototype.onDisconnected = function() {
    $('#panel').show();
    $("#battery img").attr("src", "assets/img/battery_disconnected.png");
};

Sumorobot.prototype.updateBatteryIcon = function() {
    var batImgSrc = "assets/img/battery_";
    // Check battery level and set image accordignly
    if (this.sensorValues.batteryLevel > 80) {
        batImgSrc += "full";
    } else if (this.sensorValues.batteryLevel > 40) {
        batImgSrc += "half";
    } else {
        batImgSrc += "empty";
    }
    // Check if battery is charging and set icon accordingly
    if (this.sensorValues.isBatterCharging) {
        batImgSrc += "_charge.png";
    } else {
        batImgSrc += ".png";
    }
    // Update the battery icon
    $("#battery img").attr("src", batImgSrc);
};

Sumorobot.prototype.setFirmwareVersion = function(value) {
    const decoder = new TextDecoder('utf-8');
    this.firmwareVersion = decoder.decode(value);
    $.getJSON('https://api.github.com/repos/robokoding/sumorobot-firmware/releases/latest', function(json) {
        if (json['tag_name'] != "v" + sumorobot.firmwareVersion) {
            $('#notification-panel').show();
        }
    });
};

Sumorobot.prototype.updateBatterLevel = function(value) {
    this.sensorValues.batteryLevel = value.getUint8(0);
    this.updateBatteryIcon();
};

Sumorobot.prototype.updateSensorValues = function(values) {
    this.sensorValues.sonar = values.getUint8(0);
    this.sensorValues.leftLine = (values.getUint8(1) << 8 | values.getUint8(2));
    this.sensorValues.rightLine = (values.getUint8(3) << 8 | values.getUint8(4));
    this.sensorValues.isBatterCharging = values.getUint8(5) == 1 ? true : false;
    this.sensorValues.batteryLevel = values.getUint8(6);
    // When reached sensor value update frequency
    if (this.sensorValueUpdateFreq-- == 0) {
        // Show the sensor values to the user
        var temp = "";
        for (var name in this.sensorValues) {
            temp += name + ": " + this.sensorValues[name] + "<br>";
        }
        $("#javascriptConsoleText").html(temp);
        // Update battery icon
        this.updateBatteryIcon();
        // Reset update frequency
        this.sensorValueUpdateFreq = SENSOR_VALUE_UPDATE_FREQ;
    }
};

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

Sumorobot.prototype.wait = async function(ms) {
    if (sumorobot.terminate) return;
    await wait(ms);
};
/*
Sumorobot.prototype.wait = async function(ms, blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(ms);
};
*/
Sumorobot.prototype.move = async function(direction) {
    //console.log('move : ' + direction);
    if (sumorobot.terminate) return;
    await wait(5);
    await bleSendString(direction);
};
/*
Sumorobot.prototype.move = async function(direction, blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    this.send(direction);
    await wait(75);
};
*/
Sumorobot.prototype.isSonar = async function() {
    if (sumorobot.terminate) return;
    await wait(5);
    return (this.sensorValues.sonar < this.sensorConstants.sonarThreshold);
};
/*
Sumorobot.prototype.isSonar = async function(blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(75);
    return (this.sensorValues.sonar < this.sensorConstants.sonarThreshold);
};
*/
Sumorobot.prototype.getSonarDistance = async function() {
    if (sumorobot.terminate) return;
    await wait(5);
    return this.sensorValues.sonar;
};
/*
Sumorobot.prototype.getSonarDistance = async function(blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(75);
    return this.sensorValues.sonar;
};
*/
Sumorobot.prototype.isLine = async function(line) {
    if (sumorobot.terminate) return;
    await wait(5);
    if (line == LEFT) {
        var temp = Math.abs(this.sensorValues.leftLine - this.sensorConstants.leftLineValueField);
        return (temp > this.sensorConstants.leftLineThreshold);
    } else if (line == RIGHT) {
        var temp = Math.abs(this.sensorValues.rightLine - this.sensorConstants.rightLineValueField);
        return (temp > this.sensorConstants.rightLineThreshold);
    }
};
/*
Sumorobot.prototype.isLine = async function(line, blockId) {
    console.log("block");
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(75);
    if (line == LEFT) {
        var temp = Math.abs(this.sensorValues.leftLine - this.sensorConstants.leftLineValueField);
        return (temp > this.sensorConstants.leftLineThreshold);
    } else if (line == RIGHT) {
        var temp = Math.abs(this.sensorValues.rightLine - this.sensorConstants.rightLineValueField);
        return (temp > this.sensorConstants.rightLineThreshold);
    }
};*/

Sumorobot.prototype.setServo = async function(servo, speed) {
    if (sumorobot.terminate) return;
    await wait(5);
    await sumorobot.send('servos' + (servo == LEFT ? 'l' : 'r') + speed);
};
/*
Sumorobot.prototype.setServo = async function(servo, speed, blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(75);
    sumorobot.send('servos' + (servo == LEFT ? 'l' : 'r') + speed);
};
*/
Sumorobot.prototype.setLed = async function(led, value) {
    if (sumorobot.terminate) return;
    await wait(5);
    await sumorobot.send('led' + led + (value ? '1' : '0'));
};
/*
Sumorobot.prototype.setLed = async function(led, value, blockId) {
    if (sumorobot.terminate) return;
    workspace.highlightBlock(blockId);
    await wait(75);
    sumorobot.send('led' + led + (value ? '1' : '0'));
};
*/
Sumorobot.prototype.getBatteryLevel = async function() {
    if (sumorobot.terminate) return;
    await wait(5);
    sumorobot.sensorValues.batteryLevel;
};

Sumorobot.prototype.isBatteryCharging = async function() {
    if (sumorobot.terminate) return;
    await wait(5);
    sumorobot.sensorValues.isBatterCharging;
};

// Function to send WebSocket data
Sumorobot.prototype.send = async function(cmd) {
    if (cmd == 'forward' || cmd == 'backward' || cmd == 'left' ||
        cmd == 'right' || cmd == 'search' || cmd.includes('servos')) {
        this.isMoving = true;
        // When already moving in this direction
        if (this.lastDirection == cmd) return;
        this.lastDirection = cmd;
    } else if (cmd == 'stop') {
        this.isMoving = false;
        // When already moving in this direction
        if (this.lastDirection == cmd) return;
        this.lastDirection = cmd;
    } else if (cmd.includes('line')) {
        var temp = parseInt(cmd.substr(5, cmd.length - 5));
        console.log(temp);
        sumorobot.sensorConstants.leftLineThreshold = temp;
        sumorobot.sensorConstants.rightLineThreshold = temp;
        sumorobot.sensorConstants.leftLineValueField = sumorobot.sensorValues.leftLine;
        sumorobot.sensorConstants.rightLineValueField = sumorobot.sensorValues.rightLine;
    } else if (cmd.includes('sonar')) {
        sumorobot.sensorConstants.sonarThreshold = parseInt(cmd.substr(5, cmd.length - 5));
    }
    // Send the command to the SumoRobot
    await bleSendString(cmd);
};