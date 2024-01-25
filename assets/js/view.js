// View constructor
let View = function() {};

View.prototype.initLanguage = function() {
    // Default language
    let language = "en";

    if (getLocalStorageItem("language"))
        language = getLocalStorageItem("language");
    else
        setLocalStorageItem("language", "en");

    // Language radio button listener
    $('input[type="radio"][name="language"]').click(function() {
        setLocalStorageItem("language", $(this).val());
        location.reload();
    });

    // Load the right language
    var head = document.getElementsByTagName('head')[0];
    var js = document.createElement("script");
    js.type = "text/javascript";
    js.src = "assets/blockly/msg/js/" + language + ".js";

    head.appendChild(js);
};

View.prototype.updateUI = function() {
    let language = getLocalStorageItem("language");

    $('input[type="radio"][name="language"][value="' + language + '"]').attr('checked', true);
    //$('#start-title').html(Blockly.Msg["SUMOROBOT_START"]);
    //$('#start-description').html(Blockly.Msg["SUMOROBOT_CODING"]);
    //$('#update-title').html(Blockly.Msg["SUMOROBOT_UPDATE"]);
    //$('#version-text').html(Blockly.Msg["SUMOROBOT_VERSION"]);
    //$('#update-sumofirmware-title').html(Blockly.Msg["SUMOROBOT_UPDATE_TITLE"]);
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
    $('#btn-save-code').removeClass('disabled');
    $('#btn-sumo-config').removeClass('disabled');
    $('#btn-sumo-controlpanel').removeClass('disabled');
    $('.btn-start').removeClass('disabled');
    $('.btn-stop').removeClass('disabled');
};

View.prototype.onDisconnected = function() {
    $('#panel').show();
    $('[id$=-panel]').hide();
    $("#battery img").attr("src", "assets/img/battery_disconnected.png");
    $('#btn-save-code').addClass('disabled');
    $('#btn-sumo-config').addClass('disabled');
    $('#btn-sumo-controlpanel').addClass('disabled');
    $('.btn-start').addClass('disabled');
    $('.btn-stop').addClass('disabled');
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
    //$('#sumofirmware-current').html(`You have SumoFirmware ${decoder.decode(value)}.`);
    // Compare the firmware versions
    $.getJSON('https://api.github.com/repos/robokoding/sumorobot-firmware/releases/latest', function(json) {
        let html = "";

        if (value != null)
            html += Blockly.Msg["SUMOROBOT_UPDATE_TEXT_1"].replace("%1", decoder.decode(value));

        html += Blockly.Msg["SUMOROBOT_UPDATE_TEXT_2"];
        html = html.replace("%1", json['tag_name'].replace("v", ""));
        html = html.replace("%2", '<a href="https://www.robokoding.com/kits/sumorobot/sumomanager/">SumoManager</a>');
        html = html.replaceAll(". ", ".<br>");
        $('#sumofirmware-title').html(html);

        if (value != null && json['tag_name'] != "v" + decoder.decode(value)) {
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

View.prototype.updateConfigValues = function(values) {
    var sumorobotName = values[0].replace("SumoRobot[", "").replace("]", "");

    $('#field-name-cal').val(sumorobotName);
    $('#field-sonar-cal').val(values[6]);
    $('#field-left-line-cal').val(values[4]);
    $('#field-right-line-cal').val(values[5]);
}
