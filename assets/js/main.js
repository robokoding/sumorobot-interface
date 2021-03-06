// The view object
let view = new View();
// The BLE object
let ble = new BLE();
// Disable / enable coding mode
let codingEnabled = false;
// Disable / enable live stream
let liveStreamVisible = false;
// PeerJs for peer to peer audio / video
let peerjsInitalized = false;
// To remember last pressed button
let lastPressedStart = false;

// Update the Python code with the given code
function updatePythonCode(code) {
    if (code) {
        codingEditor.setValue(code);
        codingEditor.session.selection.clearSelection();
    }
}

// Update the Blockly blocks with the given code
function updateBlocklyCode(code) {
    if (code) {
        // Clear the blocks
        workspace.clear();
        // Convert it to XML
        let xml = Blockly.Xml.textToDom(code);
        // Resume the blocks from the XML
        Blockly.Xml.domToWorkspace(xml, workspace);
    }
}

// Handle peer.js call
function handleCall(call) {
    call.on('stream', function (remoteStream) {
        console.log('set thier');
        $('#call').hide();
        $('#their-video').show();
        $('#their-video').prop('srcObject', remoteStream);
    });
}

// To calibrate servomotor thresholds (the PWM duty values differ)
function setServoSpeed(servo, speed) {
    ble.sendString(`<pwm>${servo},${speed}`, false);
}

// To update line and sonar sensing threshold values
function updateThreshold(threshold, value) {
    ble.sendString(`sumorobot.config['${threshold}'] = ${value}`);
}

// Updates SumoConfig (on SumoRobot) with the values from the Calibration panel
function updateConfiguration() {
    // Get the (new) config values form the form
    let sumorobotName = $('#field-name-cal').val();
    let leftServoMinStart = $('#field-left-servo-min-start-cal').val();
    let leftServoMinStop = $('#field-left-servo-min-stop-cal').val();
    let leftServoMaxStart = $('#field-left-servo-max-start-cal').val();
    let leftServoMaxStop = $('#field-left-servo-max-stop-cal').val();
    let rightServoMinStart = $('#field-right-servo-min-start-cal').val();
    let rightServoMinStop = $('#field-right-servo-min-stop-cal').val();
    let rightServoMaxStart = $('#field-right-servo-max-start-cal').val();
    let rightServoMaxStop = $('#field-right-servo-max-stop-cal').val();

    // Prepare the SumoRobot code to update the config
    let code = 'sumorobot.move(STOP)\n' +
    `sumorobot.config['sumorobot_name'] = "${sumorobotName}"\n` +
    `sumorobot.config['left_servo_calib'] = [${leftServoMinStart}, ${leftServoMinStop}, ${leftServoMaxStart}, ${leftServoMaxStop}]\n` +
    `sumorobot.config['right_servo_calib'] = [${rightServoMinStart}, ${rightServoMinStop}, ${rightServoMaxStart}, ${rightServoMaxStop}]\n` +
    'sumorobot.calibrate_line_values()\n' +
    'sumorobot.update_config_file()';

    // Send the new config
    ble.sendString(code);
}

// When the HTML content has been loaded
window.addEventListener('load', function() {
    // Key down event
    $(window).keydown(function(e) {
        // When the alt key is not pressed, don't process hotkeys
        if (e.altKey == false) return;

        // Select the hotkey
        switch(e.which) {
            case 32: // space bar
                if (lastPressedStart) {
                    $('.btn-stop').addClass('hover');
                    $('.btn-stop').click();
                } else {
                    $('.btn-start').addClass('hover');
                    $('.btn-start').click();
                }
                break;
            case 37: // left
                ble.sendString('<left>', false);
                view.showInfoText('Left!');
                break;
            case 38: // up
                ble.sendString('<forward>', false);
                view.showInfoText('Forward!');
                break;
            case 39: // right
                ble.sendString('<right>', false);
                view.showInfoText('Right!');
                break;
            case 40: // down
                ble.sendString('<backward>', false);
                view.showInfoText('Backward!');
                break;
            case 67: // c
                $('#panel').toggle();
                break;
            case 70: // f
                // Enable / Disable the sensor feedback
                ble.sendString('sumorobot.sensor_feedback = not sumorobot.sensor_feedback');
                view.showInfoText('Toggle feedback');
                break;
            case 73: // i
                if (peerjsInitalized == false) {
                    peerjsInitalized = true;
                    try {
                        let callId = Math.floor(Math.random() * 1000);
                        $('#call-id').html('ID: ' + callId);
                        let peer = new Peer(callId, { debug: 2 });
                        navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(function(stream) {
                                let video = document.getElementById('my-video');
                                video.srcObject = stream;
                                peer.on('call', function (call) {
                                    console.log(call.peer);
                                    //connectBlockSocket(callId, call.peer);
                                    call.answer(stream); // Answer the call with an A/V stream.
                                    handleCall(call);
                                });
                                $('#call').on('click', function () {
                                    $(this).button('loading');
                                    let peerId = prompt('Enter ID');
                                    //connectBlockSocket(callId, peerId);
                                    let call = peer.call(peerId, stream);
                                    handleCall(call);
                                });
                            }).catch(function(error) {
                                console.log('navigator.getUserMedia error: ', error);
                            }
                        );
                    } catch(err) {
                        console.log('main.js: error using PeerJS ' + err);
                    }
                }
                if (liveStreamVisible) {
                    $('#stream').hide();
                } else if (codingEnabled) {
                    $('#pythonConsole').toggle();
                } else {
                    $('#readOnlyBlocklyCode').toggle();
                }
                $('#peer-call-panel').toggle();
                break;
            case 76: // l
                // Load the Mixer stream when it is not yet loaded
                if ($('#stream').is(':empty')) {
                    $('#stream').html('<iframe src="https://mixer.com/embed/player/14551694"></iframe>');
                }
                $('#stream').toggle();
                // Toggle live stream visibility
                liveStreamVisible = !liveStreamVisible;
                // If not in coding mode
                if ($('#peer-call-panel').is(':visible')) {
                    $('#peer-call-panel').hide();
                } else if (codingEnabled) {
                    $('#pythonConsole').toggle();
                } else {
                    $('#readOnlyBlocklyCode').toggle();
                }
                view.showInfoText('Toggle livestream');
                break;
            case 79: // o
                // Implement something
                break;
            case 80: // p
                $('#blocklyDiv').toggle();
                $('#blocklyArea').toggle();
                $('#blocklyCode').toggle();
                // When live stream is not active
                if (liveStreamVisible == false) {
                    // Toggle Blockly Python code
                    if ($('#peer-call-panel').is(':visible') == false) {
                        $('#pythonConsole').toggle();
                        $('#readOnlyBlocklyCode').toggle();
                    }
                }
                // Toggle coding enabled
                codingEnabled = !codingEnabled;
                if (codingEnabled) {
                    // Resize the coding editor
                    codingEditor.resize();
                    // Focus, so the user can start coding
                    codingEditor.focus();
                    view.showInfoText('Python mode');
                } else {
                    view.showInfoText('Blockly mode');
                }
                break;
            case 82: // r
                // Implement something
                break;
            case 83: // s
                $('.btn-stop').addClass('hover');
                $('.btn-stop').click();
                break;
            case 84: // t
                $('#cal-panel').toggle();
                break;
            case 229: // in mac in Python mode
                // TODO: delete the ¨ character
            case 85: // u
                //sumorobot.send('get_threshold_scope');
                if (codingEnabled) {
                    if (blockSocketSend !== undefined && blockSocketSend.readyState == 1) {
                        // Send Python code to the peer
                        blockSocketSend.send(codingEditor.getValue());
                    }
                } else {
                    if (blockSocketSend !== undefined && blockSocketSend.readyState == 1) {
                        // Convert blocks to XML
                        let xml = Blockly.Xml.workspaceToDom(workspace);
                        // Compress XML to text
                        let blocksXML = Blockly.Xml.domToText(xml);
                        // Send block to the peer
                        blockSocketSend.send(blocksXML);
                    }
                }
                view.showInfoText('Updated code');
                break;
            case 87: // w
                $('.btn-start').addClass('hover');
                $('.btn-start').click();
                break;
        }
    });

    // Key up event
    $(window).keyup(function(e) {
        // When the alt key is not pressed, don't process hotkeys
        if (e.altKey == false) return;
        // Remove hover from buttons
        $('.btn').removeClass('hover');
        // If arrow keys were pressed
        if (e.which == 37 || e.which == 38 || e.which == 39 || e.which == 40) {
            ble.sendString('<stop>', false);
        }
    });

    // Start button listener
    $('.btn-start').click(async function() {
        lastPressedStart = true;
        if (codingEnabled) {
            code = codingEditor.getValue();
        } else {
            code = Blockly.Python.workspaceToCode(workspace);
        }
        // Add termination to the loops
        code = code.replace(/while/g, 'while not sumorobot.terminate and');
        // Send the code to the SumoRobot
        await ble.sendString(code);
        // Show info to the user
        view.showInfoText('Start!');
    });

    // Stop button listener
    $('.btn-stop').click(async function() {
        lastPressedStart = false;
        // Stop the robot and code execution
        await ble.sendString('<stop>', false);
        // Show info to the user
        view.showInfoText('Stop!');
    });

    // Robot GO button listener
    $('.btn-robot-go').click(function() {
        // Show the user the bluetooth pairing / connecting window
        ble.connect();
    });

    // Control panel Update Firmware button
    $('.btn-robot-update').click(function() {
        $('#notification-panel').show();
    });

    firmwareUpdateInit();
});
