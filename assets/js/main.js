// The local/remote server URL
//var ROBOT_SERVER = '192.168.2.1:80';
var ROBOT_SERVER = '165.227.140.64:80';

// The sumorobot object
var sumorobot;
// Disable / enable coding mode
var codingEnabled = false;
// Disable / enable live stream
var liveStreamVisible = false;

// When user sliding calibration knob
function calibrationInput(value) {
    $('#cal-val-field').val(value);
}

// When used released calibration knob
function calibrationChange(value) {
    sumorobot.send('set_line_threshold', value);
}

// Update the Python code with the given code
function updatePythonCode(code) {
    if (code) {
        codingEditor.setValue(code.replace(/;;/g, '\n'));
    }
}

// Update the Blockly blocks with the given code
function updateBlocklyCode(code) {
    if (code) {
        // Clear the blocks
        workspace.clear();
        // Convert it to XML
        var xml = Blockly.Xml.textToDom(code);
        // Resume the blocks from the XML
        Blockly.Xml.domToWorkspace(xml, workspace);
    }
}

window.addEventListener('load', function() {
    // Set the robot ID from the localstorage
    $('#robot-id').val(getLocalStorageItem('sumorobot.robotId'));

    // Key down event
    $(document).keydown(function(e) {
        // When the alt key is not pressed, don't process hotkeys
        if (e.altKey == false) return;

        // Prevent typing in textfields
        e.preventDefault();

        // Select the hotkey
        switch(e.which) {
            case 32: // space bar
                if (sumorobot.isMoving) {
                    $('.btn-stop').addClass('hover');
                    $('.btn-stop').click();
                } else {
                    $('.btn-start').addClass('hover');
                    $('.btn-start').click();
                }
                break;
            case 37: // left
                sumorobot.send('move', 'left');
                $('#info-panel-text').html('Left!');
                break;
            case 38: // up
                sumorobot.send('move', 'forward');
                $('#info-panel-text').html('Forward!');
                break;
            case 39: // right
                sumorobot.send('move', 'right');
                $('#info-panel-text').html('Right!');
                break;
            case 40: // down
                sumorobot.send('move', 'backward');
                $('#info-panel-text').html('Backward!');
                break;
            case 67: // c
                $('#panel').toggle();
                break;
            case 70: // f
                sumorobot.send('toggle_sensor_feedback');
                $('#info-panel-text').html('Toggle feedback');
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
                if (codingEnabled == false) {
                    $('#readOnlyBlocklyCode').toggle();
                } else {
                    $('#pythonConsole').toggle();
                }
                $('#info-panel-text').html('Toggle livestream');
                break;
            case 79: // o
                loopEnabled = !loopEnabled;
                $('#info-panel-text').html('Toggle loop');
                break;
            case 80: // p
                $('#blocklyDiv').toggle();
                $('#blocklyArea').toggle();
                $('#blocklyCode').toggle();
                // When live stream is not active
                if (liveStreamVisible == false) {
                    // Toggle Blockly Python code
                    $('#readOnlyBlocklyCode').toggle();
                    $('#pythonConsole').toggle();
                }
                // Toggle coding enabled
                codingEnabled = !codingEnabled;
                if (codingEnabled) {
                    // Resize the coding editor
                    codingEditor.resize();
                    // Focus, so the user can start coding
                    codingEditor.focus();
                    $('#info-panel-text').html('Python mode');
                } else {
                    $('#info-panel-text').html('Blockly mode');
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
                sumorobot.send('calibrate_line_value');
                $('#cal-panel').show();
                break;
            case 85: // u
                sumorobot.send('get_line_scope')
                if (codingEnabled) {
                    sumorobot.send('get_python_code', undefined, updatePythonCode);
                } else {
                    sumorobot.send('get_blockly_code', undefined, updateBlocklyCode);
                }
                $('#info-panel-text').html('Updated code');
                break;
            case 87: // w
                $('.btn-start').addClass('hover');
                $('.btn-start').click();
                break;
        }
        /* Hide the info text */
        $('#info-panel').show();
        $('#info-panel').fadeOut(1000, function() {
            $('#info-panel-text').html('');
        });
    });

    // Key up event
    $(document).keyup(function(e) {
        // When the alt key is not pressed, don't process hotkeys
        if (e.altKey == false) return;
        // Remove hover from buttons
        $('.btn').removeClass('hover');
        // If arrow keys were pressed
        if (e.which == 37 || e.which == 38 || e.which == 39 || e.which == 40) {
            sumorobot.send('move', 'stop');
        }
    });

    // Variable for the code processor function
    var rangeId;
    var lines = [];
    var foundTrue = false;
    var loopEnabled = true;

    // Function to process code and highlight blocks and lines
    function processCode(index) {
        // When all lines are already processed
        if (lines.length == 0) return;
        // Split into code and block ID
        var temp = lines[index].split(';;');
        var code = temp[0];
        // Default timeout for processing the next line
        var timeout = 50;
        var isCondition = /(if|elif|else)/.test(code);
        // When it is a condition line
        if (isCondition) {
            if (foundTrue) {
                // Start processing the code from the beginning again
                index = -1;
                foundTrue = false;
            } else if (/opponent/.test(code)) {
                foundTrue = (sumorobot.sensorScope['opponent'] < 40.0);
            } else if (/LEFT/.test(code)) {
                foundTrue = (Math.abs(sumorobot.sensorScope['left_line'] - sumorobot.lineScope['left_line_value']) > sumorobot.lineScope['left_line_threshold']);
            } else if (/RIGHT/.test(code)) {
                foundTrue = (Math.abs(sumorobot.sensorScope['right_line'] - sumorobot.lineScope['right_line_value']) > sumorobot.lineScope['right_line_threshold']);
            } else {
                foundTrue = true;
            }
        }
        // Some lines don't correspond to any block
        if (temp[1] && index != -1 && ((!isCondition && foundTrue) || isCondition || !/if/.test(lines[0]))) {
            // When sleep function, we get the timeout value from the function
            if (/\d/.test(code)) {
                timeout = parseInt(code.replace(/[a-z\.()]/g, ''));
            }
            if (rangeId) {
                readOnlyCodingEditor.session.removeMarker(rangeId);
            }
            var range = new Range(index, 0, index, 1);
            rangeId = readOnlyCodingEditor.session.addMarker(range, "highlight", "fullLine");
            // Block ID should always be 20 symbols long
            var blockId = temp[1].substring(0, 20);
            // Highlight the block
            workspace.highlightBlock(blockId);
        }
        // Set an timeout for processing the next line
        index = (index + 1) % lines.length
        // If the loop is disabled
        if (!loopEnabled && index == 0) {
            // Stop the SumoRobot after timeout
            setTimeout(function() { $('.btn-stop').click() }, timeout);
            // Return to avoid starting another loop
            return;
        }
        setTimeout(function() { processCode(index) }, timeout);
    }

    // Start button listener
    $('.btn-start').click(function() {
        // When we are in Python coding mode
        if (codingEnabled) {
            // Get the Python code
            parsedCode = codingEditor.getValue();
        // Otherwise when we are in Blockly mode
        } else {
            // Get the code from the blocks, filter out block IDs
            parsedCode = Blockly.Python.workspaceToCode(workspace).replace(/;;.{20}/g, '');
            // Parsde blocks to text
            var xml = Blockly.Xml.workspaceToDom(workspace);
            var temp = Blockly.Xml.domToText(xml).replace(/"/g, "'");
            // Send to save the Blockly code
            sumorobot.send('set_blockly_code', temp);
        }
        // Escape the qoutes, replace new lines and send the code
        sumorobot.send('set_python_code', parsedCode.replace(/"/g, '\\"').replace(/\n/g, ';;'));
        // Split into lines of code and filter empty lines
        lines = Blockly.Python.workspaceToCode(workspace).split('\n').filter(Boolean);
        // Process the code starting from the first line
        processCode(0);
        /* Show and hide the info text */
        $('#info-panel-text').html('Start!');
        $('#info-panel').show();
        $('#info-panel').fadeOut(1000, function() {
            $('#info-panel-text').html('');
        });
    });

    // Stop button listener
    $('.btn-stop').click(function() {
        sumorobot.send('move', 'stop');
        // Stop highlighting blocks and lines
        lines = [];
        workspace.highlightBlock('');
        if (rangeId) {
            readOnlyCodingEditor.session.removeMarker(rangeId);
        }
        /* Show and hide the info text */
        $('#info-panel-text').html('Stop!');
        $('#info-panel').show();
        $('#info-panel').fadeOut(1000, function() {
            $('#info-panel-text').html('');
        });
    });

    // Enter (return) keypress listener on robot ID field
    $('#robot-id').keypress(function(e) {
        if (e.which == 13) {
            // Simulate robot GO button click
            $('.btn-robot-go').click();
        }
    });

    // Robot GO button listener
    $('.btn-robot-go').click(function() {
        // Get and validate the selected robot ID
        var robotId = $('#robot-id').val().trim();
        if (robotId === '' || robotId.length < 1) {
            $('#robot-id, #robot-label').addClass('has-error');
            return;
        } else {
            $('#robot-id, #robot-label').removeClass('has-error');
        }
        // Update robot ID in local storage
        setLocalStorageItem('sumorobot.robotId', robotId);
        // When a connection was already opened
        if (sumorobot) {
            // Close the connection
            sumorobot.close();
        }
        // Connect to the selected robots WebSocket
        sumorobot = new Sumorobot(`ws://${ROBOT_SERVER}/p2p/browser/sumo-${robotId}/`, robotId);
        // Hide the configuration panel
        $('#panel').hide();
    });
});
