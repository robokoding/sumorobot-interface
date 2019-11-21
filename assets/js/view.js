// Sensor value update frequency for the user
// X * 50 milliseconds (X = 10 every half second)
const SENSOR_VALUE_UPDATE_FREQ = 0;

// Sumorobot constructor
let View = function() {
    // To remember the update frequency
    this.sensorValueUpdateFreq = SENSOR_VALUE_UPDATE_FREQ;
};

View.prototype.showInfoText = function(text) {
    // Show and hide the info text
    $('#info-panel-text').html(text);
    $('#info-panel').show();
    $('#info-panel').fadeOut(1000, function() {
        $('#info-panel-text').html('');
    });
};

View.prototype.onConnected = function() {
    $('#panel').hide();
    //setInterval(function() { ble.sendString('sensors'); }, 1000);
};

View.prototype.onDisconnected = function() {
    $('#panel').show();
    $("#battery img").attr("src", "assets/img/battery_disconnected.png");
};

View.prototype.updateBatteryIcon = function(batteryCharging, batteryLevel) {
    let batImgSrc = "assets/img/battery_";
    // Check battery level and set image accordignly
    if (batteryLevel > 80) {
        batImgSrc += "full";
    } else if (batteryLevel > 40) {
        batImgSrc += "half";
    } else {
        batImgSrc += "empty";
    }
    // Check if battery is charging and set icon accordingly
    if (batteryCharging) {
        batImgSrc += "_charge.png";
    } else {
        batImgSrc += ".png";
    }
    // Update the battery icon
    $("#battery img").attr("src", batImgSrc);
};

View.prototype.setFirmwareVersion = function(value) {
    const decoder = new TextDecoder('utf-8');
    // Compare the firmware versions
    $.getJSON('https://api.github.com/repos/robokoding/sumorobot-firmware/releases/latest', function(json) {
        if (json['tag_name'] != "v" + decoder.decode(value)) {
            $('#notification-panel').show();
        }
    });
};

View.prototype.updateBatteryLevel = function(value) {
    this.sensorValues.batteryLevel = value;
    this.updateBatteryIcon();
};

View.prototype.updateSensorValues = function(values) {
    let sensorValues = {
        sonar: values[2],
        left_line: values[0],
        right_line: values[1],
        battery_level: values[4],
        is_batter_charging: values[3]
    };
    // When reached sensor value update frequency
    if (this.sensorValueUpdateFreq-- == 0) {
        // Show the sensor values to the user
        let temp = "";
        for (let name in sensorValues) {
            temp += name + ": " + sensorValues[name] + "<br>";
        }
        $("#pythonConsoleText").html(temp);
        // Update battery icon
        this.updateBatteryIcon(values[3], values[4]);
        // Reset update frequency
        this.sensorValueUpdateFreq = SENSOR_VALUE_UPDATE_FREQ;
    }
};
