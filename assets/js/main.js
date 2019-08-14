// The sumorobot object
var sumorobot= new Sumorobot();
// Disable / enable coding mode
var codingEnabled = false;
// Disable / enable live stream
var liveStreamVisible = false;
// PeerJs for peer to peer audio / video
var peerjsInitalized = false;

// Update the Python code with the given code
function updatePythonCode(code) {
    if (code) {
        codingEditor.setValue(code.replace(/::/g, '\n'));
        codingEditor.session.selection.clearSelection();
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

// Handle peer.js call
function handleCall(call) {
    call.on('stream', function (remoteStream) {
        console.log('set thier');
        $('#call').hide();
        $('#their-video').show();
        $('#their-video').prop('srcObject', remoteStream);
    });
}

window.addEventListener('load', function() {
    // Key down event
    $(window).keydown(function(e) {
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
                sumorobot.move('left');
                $('#info-panel-text').html('Left!');
                break;
            case 38: // up
                sumorobot.move('forward');
                $('#info-panel-text').html('Forward!');
                break;
            case 39: // right
                sumorobot.move('right');
                $('#info-panel-text').html('Right!');
                break;
            case 40: // down
                sumorobot.move('backward');
                $('#info-panel-text').html('Backward!');
                break;
            case 67: // c
                $('#panel').toggle();
                break;
            case 70: // f
                sumorobot.send('ledf');
                $('#info-panel-text').html('Toggle feedback');
                break;
            case 73: // i
                if (peerjsInitalized == false) {
                    peerjsInitalized = true;
                    try {
                        var callId = Math.floor(Math.random() * 1000);
                        $('#call-id').html('ID: ' + callId);
                        var peer = new Peer(callId, { debug: 2 });
                        navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(function(stream) {
                                var video = document.getElementById('my-video');
                                video.srcObject = stream;
                                peer.on('call', function (call) {
                                    console.log(call.peer);
                                    connectBlockSocket(callId, call.peer);
                                    call.answer(stream); // Answer the call with an A/V stream.
                                    handleCall(call);
                                });
                                $('#call').on('click', function () {
                                    $(this).button('loading');
                                    var peerId = prompt('Enter ID');
                                    connectBlockSocket(callId, peerId);
                                    var call = peer.call(peerId, stream);
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
                $('#info-panel-text').html('Toggle livestream');
                break;
            case 79: // o
                sumorobot.loop = !sumorobot.loop;
                $('#info-panel-text').html('Toggle loop');
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
                    $('#info-panel-text').html('JavaScript mode');
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
                $('#cal-panel').show();
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
                        var xml = Blockly.Xml.workspaceToDom(workspace);
                        // Compress XML to text
                        blocksXML = Blockly.Xml.domToText(xml);
                        // Send block to the peer
                        blockSocketSend.send(blocksXML);
                    }
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
    $(window).keyup(function(e) {
        // When the alt key is not pressed, don't process hotkeys
        if (e.altKey == false) return;
        // Remove hover from buttons
        $('.btn').removeClass('hover');
        // If arrow keys were pressed
        if (e.which == 37 || e.which == 38 || e.which == 39 || e.which == 40) {
            sumorobot.move('stop');
        }
    });

    // Start button listener
    $('.btn-start').click(function() {
        sumorobot.terminate = false;
        var code;
        if (codingEnabled) {
            code = codingEditor.getValue();
            code = code.replace(/await /g, '');
            code = code.replace(/sumorobot./g, 'await sumorobot.');
        } else {
            code = Blockly.JavaScript.workspaceToCode(workspace);
            code += 'workspace.highlightBlock(\'\');';
        }
        // Make a code termination possible when using endless loops
        code = code.replace(/while \(true\)/g, 'while (!sumorobot.terminate)');
        // Log code
        console.log(code);
        try {
            // Try to execute SumoRobot code asyncronously
            eval('async function demo() {' + code + 'await wait(100);sumorobot.send(\'stop\');} demo();');
        } catch(error) {
            console.error(error);
        }
        /* Show and hide the info text */
        $('#info-panel-text').html('Start!');
        $('#info-panel').show();
        $('#info-panel').fadeOut(1000, function() {
            $('#info-panel-text').html('');
        });
    });

    // Stop button listener
    $('.btn-stop').click(function() {
        // Terminate the code execution
        sumorobot.terminate = true;
        // Show and hide the info text
        $('#info-panel-text').html('Stop!');
        $('#info-panel').show();
        $('#info-panel').fadeOut(1000, function() {
            $('#info-panel-text').html('');
        });
    });

    // Robot GO button listener
    $('.btn-robot-go').click(function() {
        // Connect the bluetooth
        bleConnect();
    });
});
