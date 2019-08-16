// Blockly workspace
var workspace;

// Blockly WebSocket
var blockSocketSend = undefined;
var blockSocketReceive = undefined;
// Blocks XML
var blocksXML;
var messageId = 0;
var onCodeChanged;

function connectBlockSocket(callId, peerId) {
    console.log('blockly.js: connectBlockSocket ' + callId + ' : ' + peerId);
    blockSocketSend = new WebSocket('wss://sumoserver.robokoding.com:443/ws/blocks-' + peerId);
    blockSocketSend.onopen = function(evt) {
        console.log('blockly.js: blocksocketsend open');
    };
    blockSocketSend.onclose = function(evt) {
        console.log('blockly.js: blocksocketsend close');
    };
    blockSocketSend.onerror = function(err) {
        console.log('blockly.js: blocksocketsend error ' + err);
    };
    blockSocketReceive = new WebSocket('wss://sumoserver.robokoding.com:443/ws/blocks-' + callId);
    blockSocketReceive.onopen = function(evt) {
        console.log('blockly.js: blocksocketreceive open');
    };
    blockSocketReceive.onclose = function(evt) {
        console.log('blockly.js: blocksocketreceive close');
    };
    blockSocketReceive.onerror = function(err) {
        console.log('blockly.js: blocksocketreceive error ' + err);
    };
    blockSocketReceive.onmessage = function(evt) {
        //console.log('blockly.js: message ' + evt.data);
        if (codingEnabled) {
            updateJavaScriptCode(evt.data);
        } else {
            try {
                console.log('blockly.js data ' + evt.data);
                updateBlocklyCode(evt.data);
            } catch(error) {
                console.log('blockly.js data ' + evt.data);
                console.log('blockly.js: updateBlocklyCode error ' + error);
            }
        }
    };
}

window.addEventListener('load', function() {
    // To remember the control_if blockId
    var controlBlockId = '';

    // Change the if block to be more cheerful
    //Blockly.Msg.LOGIC_HUE = '#24c74f';
    //Blockly.Themes.Classic.defaultBlockStyles={logic_blocks:{colourPrimary:"100"}};

    if (page == "workshop") {
        // Remove previous and next statement from control_if block
        Blockly.defineBlocksWithJsonArray([
            {
              "type": "controls_if",
              "message0": "%{BKY_CONTROLS_IF_MSG_IF} %1",
              "args0": [
                {
                  "type": "input_value",
                  "name": "IF0",
                  "check": "Boolean"
                }
              ],
              "message1": "%{BKY_CONTROLS_IF_MSG_THEN} %1",
              "args1": [
                {
                  "type": "input_statement",
                  "name": "DO0"
                }
              ],
              "style": "logic_blocks",
              "helpUrl": "%{BKY_CONTROLS_IF_HELPURL}",
              "mutator": "controls_if_mutator",
              "extensions": ["controls_if_tooltip"]
            },
            // Create a new simple block for endless loops
            {
                type: "controls_whileTrue",
                message0: "%1",
                args0: [
                    {
                        type: "field_dropdown",
                        name: "MODE",
                        options: [
                            ["while true", "true"],
                            ["while false", "false"]
                        ]
                    }
                ],
                message1: "%{BKY_CONTROLS_REPEAT_INPUT_DO} %1",
                args1: [
                    {
                        type: "input_statement",
                        name: "DO"
                    }
                ],
                previousStatement: null,
                nextStatement: null,
                style: "loop_blocks",
                helpUrl: "%{BKY_CONTROLS_WHILEUNTIL_HELPURL}",
                extensions: ["controls_whileUntil_tooltip"]
            }
        ]);
    }

    // Make control_if mutator icon bigger
    Blockly.Icon.prototype.renderIcon = function(cursorX) {
        if (this.collapseHidden && this.block_.isCollapsed()) {
            this.iconGroup_.setAttribute('display', 'none');
            return cursorX;
        }
        this.iconGroup_.setAttribute('display', 'block');

        var SIZE = 1.7;
        var TOP_MARGIN = 2;
        var LEFT_MARGIN = 5;
        var width = this.SIZE;
        if (this.block_.RTL) {
            cursorX -= width;
        }
        this.iconGroup_.setAttribute('transform',
            'translate(' + LEFT_MARGIN + ',' + TOP_MARGIN + ') scale(' + SIZE + ')');
        this.computeIconLocation();
        if (this.block_.RTL) {
            cursorX -= Blockly.BlockSvg.SEP_SPACE_X;
        } else {
            cursorX += width + Blockly.BlockSvg.SEP_SPACE_X;
        }
        return cursorX;
    };

    // When mouse click occures on Blockly workspace
    Blockly.utils.isRightButton = function(e) {
        var target = e.target;

        // When control_if block is in use
        if (controlBlockId != '') {
            // When the user clicks anywhere outside the mutator and not on the mutator icon
            if (!$(target).is('.blocklyBubbleCanvas') && !$(target).parents().is('.blocklyBubbleCanvas')) {
                if (!$(target).is('.blocklyIconGroup') && !$(target).parents().is('.blocklyIconGroup')) {
                    // Hide the mutator
                    workspace.getBlockById(controlBlockId).mutator.setVisible(false);
                }
            }
        }
        // Disable right click on Blockly workspace
        return false;
    };

    Blockly.Blocks['sumorobot_move'] = {
        init: function() {
            var OPERATORS = [
                ['move stop', 'STOP'],
                ['move left', 'LEFT'],
                ['move right', 'RIGHT'],
                ['move forward', 'FORWARD'],
                ['move backward', 'BACKWARD']
            ];
            this.setColour('#d6382d');
            var dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'MOVE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_wait'] = {
        init: function() {
            this.setColour('#e98017');
            this.appendDummyInput()
              .appendField('wait')
                .appendField(new Blockly.FieldTextInput('1000',
                  Blockly.FieldNumber.numberValidator), 'WAIT');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_sonar'] = {
        init: function() {
            this.setColour('#0099E6');
            this.appendDummyInput().appendField('sonar');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.Blocks['sumorobot_line'] = {
        init: function() {
            var OPERATORS = [
                ['line left', 'LEFT'],
                ['line right', 'RIGHT']
            ];
            this.setColour('#E6BF00');
            var dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'LINE');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.Blocks['sumorobot_servo'] = {
        init: function() {
            var OPERATORS = [
                ['servo left', 'LEFT'],
                ['servo right', 'RIGHT']
            ];
            this.setColour('#d6382d');
            var dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'SERVO')
              .appendField(new Blockly.FieldTextInput('100',
                Blockly.FieldNumber.numberValidator), 'SPEED');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_led'] = {
        init: function() {
            var OPERATORS = [
                ['led status', 'STATUS'],
                ['led sonar', 'SONAR'],
                ['led left line', 'LEFT_LINE'],
                ['led right line', 'RIGHT_LINE']
            ];
            var OPERATORS2 = [
                ['off', 'false'],
                ['on', 'true']
            ];
            this.setColour('#be00dd');
            var dropdown = new Blockly.FieldDropdown(OPERATORS);
            var dropdown2 = new Blockly.FieldDropdown(OPERATORS2);
            this.appendDummyInput().appendField(dropdown, 'LED')
              .appendField(dropdown2, 'STATE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_sonar_distance'] = {
        init: function() {
            this.setColour('#0099E6');
            this.appendDummyInput().appendField('sonar')
              .appendField(new Blockly.FieldTextInput('40',
                Blockly.FieldNumber.numberValidator), 'DISTANCE');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.JavaScript['sumorobot_move'] = function(block) {
        var code = 'await sumorobot.move(' + block.getFieldValue('MOVE') + ', \'' + block.id + '\');' + '\n';
        return code;
    };

    Blockly.JavaScript['sumorobot_wait'] = function(block) {
        var code = 'await sumorobot.wait(' + parseFloat(block.getFieldValue('WAIT')) + ', \'' + block.id + '\');' + '\n';
        return code;
    };

    Blockly.JavaScript['sumorobot_sonar'] = function(block) {
        var code = 'await sumorobot.isSonar(\'' + block.id + '\')';
        return [code, Blockly.JavaScript.ORDER_ATOMIC];
    };

    Blockly.JavaScript['sumorobot_line'] = function(block) {
        var code = 'await sumorobot.isLine(' + block.getFieldValue('LINE') + ', \'' + block.id + '\')';
        return [code, Blockly.JavaScript.ORDER_ATOMIC];
    };

    Blockly.JavaScript['sumorobot_servo'] = function(block) {
        var code = 'await sumorobot.setServo(' + block.getFieldValue('SERVO') + ', '+
          block.getFieldValue('SPEED') + ', \'' + block.id + '\');' + '\n';
        return code;
    };

    Blockly.JavaScript['sumorobot_led'] = function(block) {
        var code = 'await sumorobot.setLed(' + block.getFieldValue('LED') + ', '+
          block.getFieldValue('STATE') + ', \'' + block.id + '\');' + '\n';
        return code;
    };

    Blockly.JavaScript['sumorobot_sonar_distance'] = function(block) {
        var code = 'await sumorobot.getSonarDistance(\'' + block.id + '\') < ' + block.getFieldValue('DISTANCE');
        return [code, Blockly.JavaScript.ORDER_ATOMIC];
    };

    Blockly.JavaScript['controls_whileTrue'] = function(block) {
        var branch = Blockly.JavaScript.statementToCode(block, 'DO');
        branch = Blockly.JavaScript.addLoopTrap(branch, block);
        return 'while (' + block.getFieldValue('MODE') + ') {\n' + branch + '}\n';
    };

    // Inject Blockly
    var blocklyArea = document.getElementById('blocklyArea');
    var blocklyDiv = document.getElementById('blocklyDiv');
    workspace = Blockly.inject(blocklyDiv, {
        media: 'assets/blockly/media/',
        scrollbars: false,
        trashcan: true,
        sounds: true,
        zoom: {
            controls: true,
            startScale: 1.2
        },
        toolbox: document.getElementById('toolbox')
    });

    // On Blockly resize
    var onresize = function(e) {
        // Compute the absolute coordinates and dimensions of blocklyArea.
        var element = blocklyArea;
        var x = 0;
        var y = 0;
        do {
            x += element.offsetLeft;
            y += element.offsetTop;
            element = element.offsetParent;
        } while (element);
        // Position blocklyDiv over blocklyArea
        blocklyDiv.style.left = x + 'px';
        blocklyDiv.style.top = y + 'px';
        blocklyDiv.style.width = blocklyArea.offsetWidth + 'px';
        blocklyDiv.style.height = blocklyArea.offsetHeight + 'px';
        // Resize the blockly svg
        Blockly.svgResize(workspace);
    };
    window.addEventListener('resize', onresize, false);
    onresize();

    // Retrieve the blocks
    var code = getLocalStorageItem('sumorobot.blockly');
    // When there is code
    if (code) {
        // Convert it to XML
        var xml = Blockly.Xml.textToDom(code);
        // Resume the blocks from the XML
        Blockly.Xml.domToWorkspace(xml, workspace);
    }
    // On Blockly code change
    onCodeChanged = function(event) {
        // When the if condition block was created
        if (page == "workshop" && event.type == Blockly.Events.CREATE &&
            event.xml.getAttributeNode('type').nodeValue == 'controls_if') {
            // Remember the control_if block id
            controlBlockId = event.blockId;
            // Get the control_if block object
            var block = workspace.getBlockById(event.blockId);
            // When the control_if block doesn't already have an else
            if (block.elseCount_ == 0) {
                // Automatically add the else statement input
                block.elseCount_ = 1;
                block.updateShape_();
            }
        // When the if condition block was removed
        } else if (event.type == Blockly.Events.DELETE &&
            event.oldXml.getAttributeNode('type').nodeValue == 'controls_if') {
            // Remove the control_if block id
            controlBlockId = '';
            // Enable the if condition block
            workspace.updateToolbox(document.getElementById('toolbox'));
        }

        // Only process change and move commands
        if (event.type != Blockly.Events.CHANGE &&
            event.type != Blockly.Events.MOVE &&
            event.type != Blockly.Events.DELETE) return;

        // Filter out block IDs
        var temp = Blockly.JavaScript.workspaceToCode(workspace).replace(/, '.{20}'\)/g, ')');
        temp = temp.replace(/\('.{20}'\)/g, '()');
        // Filter out awaits
        temp = temp.replace(/await /g, '');
        // Show the code in the ace editor
        readOnlyCodingEditor.setValue(temp);
        readOnlyCodingEditor.clearSelection();

        // Convert blocks to XML
        var xml = Blockly.Xml.workspaceToDom(workspace);
        // Compress XML to text
        blocksXML = Blockly.Xml.domToText(xml);

        // Save the code to the local storage
        localStorage.setItem('sumorobot.blockly', blocksXML);

        // When control_if block is used
        if (controlBlockId != '') {
            // Disable the if condition block
            workspace.updateToolbox(document.getElementById('toolbox_no_if'));
        }
    }

    // Add the change listener to Blockly
    workspace.addChangeListener(onCodeChanged);

    // Set a click listener on the document
    $(document).click(function(e) {
        // Get the event target
        var target = e.target;
        // When control_if block is in use
        if (controlBlockId != '') {
            // When the user clicks anywhere outside the mutator and not on the mutator icon
            if (!$(target).is('.blocklyBubbleCanvas') && !$(target).parents().is('.blocklyBubbleCanvas')) {
                if (!$(target).is('.blocklyIconGroup') && !$(target).parents().is('.blocklyIconGroup')) {
                    // Hide the mutator
                    workspace.getBlockById(controlBlockId).mutator.setVisible(false);
                }
            }
        }
    });
});
