// View constructor
let View = function() {};

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
    setInterval(function() { ble.sendString('<sensors>', false); }, 1000);
};

View.prototype.onDisconnected = function() {
    $('#panel').show();
    $('[id$=-panel]').hide();
    $("#battery img").attr("src", "assets/img/battery_disconnected.png");
};

View.prototype.updateBatteryIcon = function(isCharging, batteryLevel) {
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
    if (isCharging) {
        batImgSrc += "_charge.png";
    } else {
        batImgSrc += ".png";
    }
    // Update the battery icon
    $("#battery img").attr("src", batImgSrc);
};

View.prototype.setFirmwareVersion = function(value) {
    const decoder = new TextDecoder('utf-8');
    $('#sumofirmware-current').html(`You have SumoFirmware ${decoder.decode(value)}.`);
    // Compare the firmware versions
    $.getJSON('https://api.github.com/repos/robokoding/sumorobot-firmware/releases/latest', function(json) {
        if (json['tag_name'] != "v" + decoder.decode(value)) {
            $('#notification-panel').show();
        }
    });
};

View.prototype.updateSensorValues = function(values) {
    let sensorValues = {
        sonar: values[0],
        left_line: values[1],
        right_line: values[2],
        battery_level: values[4],
        is_charging: values[3]
    };
    // Show the sensor values to the user
    let temp = "";
    for (let name in sensorValues) {
        temp += name + ": " + sensorValues[name] + "<br>";
    }
    $("#pythonConsoleText").html(temp);
    // Update battery icon
    this.updateBatteryIcon(values[3], values[4]);
};
