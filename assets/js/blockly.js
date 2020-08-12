// Blockly workspace
let workspace;

// Blockly WebSocket
let blockSocketSend = undefined;
let blockSocketReceive = undefined;

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
            updatePythonCode(evt.data);
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
    let ifBlockId = '';
    let whileBlockId = '';

    // Change the if block to be more cheerful
    //Blockly.Msg.LOGIC_HUE = '#24C74F';
    //Blockly.Themes.Classic.defaultBlockStyles={logic_blocks:{colourPrimary:"100"}};

    // Create a new simple block for endless loops
    Blockly.defineBlocksWithJsonArray([
        {
            type: "controls_whileTrue",
            message0: "repeat forever %1",
            args0: [
                {
                    type: "input_dummy"
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
            helpUrl: "%{BKY_CONTROLS_WHILEUNTIL_HELPURL}"
        }
    ]);

    if (page == "workshops") {
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

        let SIZE = 1.7;
        let TOP_MARGIN = 2;
        let LEFT_MARGIN = 5;
        let width = this.SIZE;
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
        let target = e.target;

        // When control_if block is in use
        if (ifBlockId != '') {
            // When the user clicks anywhere outside the mutator and not on the mutator icon
            if (!$(target).is('.blocklyBubbleCanvas') && !$(target).parents().is('.blocklyBubbleCanvas')) {
                if (!$(target).is('.blocklyIconGroup') && !$(target).parents().is('.blocklyIconGroup')) {
                    // Hide the mutator
                    workspace.getBlockById(ifBlockId).mutator.setVisible(false);
                }
            }
        }
        // Disable right click on Blockly workspace
        return false;
    };

    Blockly.Blocks['sumorobot_move'] = {
        init: function() {
            let OPERATORS = [
                ['move stop', 'STOP'],
                ['move left', 'LEFT'],
                ['move right', 'RIGHT'],
                ['move forward', 'FORWARD'],
                ['move backward', 'BACKWARD']
            ];
            this.setColour('#D6382D');
            let dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'DIRECTION');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_sleep'] = {
        init: function() {
            this.setColour('#E98017');
            this.appendDummyInput()
              .appendField('sleep')
                .appendField(new Blockly.FieldTextInput('1000',
                  Blockly.FieldNumber.numberValidator), 'TIME');
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
            let OPERATORS = [
                ['line left', 'LEFT'],
                ['line right', 'RIGHT']
            ];
            this.setColour('#E6BF00');
            let dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'LINE');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.Blocks['sumorobot_servo'] = {
        init: function() {
            let OPERATORS = [
                ['servo left', 'LEFT'],
                ['servo right', 'RIGHT']
            ];
            this.setColour('#D6382D');
            let dropdown = new Blockly.FieldDropdown(OPERATORS);
            this.appendDummyInput().appendField(dropdown, 'SERVO')
              .appendField(new Blockly.FieldTextInput('100',
                Blockly.FieldNumber.numberValidator), 'SPEED');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_led'] = {
        init: function() {
            let OPERATORS = [
                ['led status', 'STATUS'],
                ['led sonar', 'SONAR'],
                ['led left line', 'LEFT_LINE'],
                ['led right line', 'RIGHT_LINE']
            ];
            let OPERATORS2 = [
                ['off', 'False'],
                ['on', 'True']
            ];
            this.setColour('#BE00DD');
            let dropdown = new Blockly.FieldDropdown(OPERATORS);
            let dropdown2 = new Blockly.FieldDropdown(OPERATORS2);
            this.appendDummyInput().appendField(dropdown, 'LED')
              .appendField(dropdown2, 'VALUE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_sonar_value'] = {
        init: function() {
            this.setColour('#0099E6');
            this.appendDummyInput().appendField('sonar')
              .appendField(new Blockly.FieldTextInput('40',
                Blockly.FieldNumber.numberValidator), 'THRESHOLD');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.Python['sumorobot_move'] = function(block) {
        let direction = block.getFieldValue('DIRECTION');
        let code = 'sumorobot.move(' + direction + ')\n';
        return code;
    };

    Blockly.Python['sumorobot_sleep'] = function(block) {
        let sleep = parseFloat(block.getFieldValue('TIME'));
        let code = 'sumorobot.sleep(' + sleep + ')\n';
        return code;
    };

    Blockly.Python['sumorobot_sonar'] = function(block) {
        let code = 'sumorobot.is_sonar()';
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    Blockly.Python['sumorobot_line'] = function(block) {
        let line = block.getFieldValue('LINE');
        let code = 'sumorobot.is_line(' + line + ')';
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    Blockly.Python['sumorobot_servo'] = function(block) {
        let speed = block.getFieldValue('SPEED');
        let servo = block.getFieldValue('SERVO');
        let code = 'sumorobot.set_servo(' + servo + ', ' + speed + ')\n';
        return code;
    };

    Blockly.Python['sumorobot_led'] = function(block) {
        let led = block.getFieldValue('LED');
        let state = block.getFieldValue('VALUE');
        let code = 'sumorobot.set_led(' + led + ', ' + state + ')\n';
        return code;
    };

    Blockly.Python['sumorobot_sonar_value'] = function(block) {
        let code = 'sumorobot.get_sonar_value() < ' + block.getFieldValue('THRESHOLD');
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    Blockly.Python['controls_whileTrue'] = function(block) {
        let branch = Blockly.Python.statementToCode(block, 'DO');
        branch = Blockly.Python.addLoopTrap(branch, block);
        return 'while True:\n' + branch + '\n';
    };

    // Inject Blockly
    let blocklyArea = document.getElementById('blocklyArea');
    let blocklyDiv = document.getElementById('blocklyDiv');
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
    let onresize = function(e) {
        // Compute the absolute coordinates and dimensions of blocklyArea.
        let element = blocklyArea;
        let x = 0;
        let y = 0;
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
    let code = getLocalStorageItem('sumorobot.blockly');
    // When there is code
    if (code) {
        // Convert it to XML
        let xml = Blockly.Xml.textToDom(code);
        // Resume the blocks from the XML
        Blockly.Xml.domToWorkspace(xml, workspace);
    }
    // On Blockly code change
    let onCodeChanged = function(event) {
        // When the if condition block was created
        if (event.type == Blockly.Events.CREATE) {
            if (event.xml.outerHTML.includes('controls_if')) {
                // Remember the control_if block id
                ifBlockId = event.blockId;
                console.log('blockly.js if was created');
                // Get the control_if block object
                //let block = workspace.getBlockById(event.blockId);
                // When the control_if block doesn't already have an else
                /*if (page == 'workshop' && block.elseCount_ == 0) {
                    // Automatically add the else statement input
                    block.elseCount_ = 1;
                    block.updateShape_();
                }*/
            }
            if (event.xml.outerHTML.includes('controls_whileTrue')) {
                whileBlockId = event.blockId;
                console.log('blockly.js while was created');
            }
        // When the if condition block was removed
        } else if (event.type == Blockly.Events.DELETE) {
            if (event.oldXml.outerHTML.includes('controls_if')) {
                // Remove the control_if block id
                ifBlockId = '';
                console.log('blockly.js if was deleted');
            }
            if (event.oldXml.outerHTML.includes('controls_whileTrue')) {
                whileBlockId = '';
                console.log('blockly.js while was deleted');
            }
        }

        // Only process change and move commands
        if (event.type != Blockly.Events.CHANGE &&
            event.type != Blockly.Events.MOVE &&
            event.type != Blockly.Events.DELETE) return;

        // Convert blocks to code
        let code = Blockly.Python.workspaceToCode(workspace);
        // Show the code in the ace editor
        readOnlyCodingEditor.setValue(code);
        readOnlyCodingEditor.clearSelection();

        // Convert blocks to XML
        let xml = Blockly.Xml.workspaceToDom(workspace);
        // Compress XML to text
        let blocksXML = Blockly.Xml.domToText(xml);

        // Save the code to the local storage
        localStorage.setItem('sumorobot.blockly', blocksXML);

        // When control_if block is used
        if (page == 'workshop') {
            if (ifBlockId != '' && whileBlockId != '') {
                // Disable the if condition block
                workspace.updateToolbox(document.getElementById('toolbox_no_if_no_while'));
            }
            else if (whileBlockId != '') {
                workspace.updateToolbox(document.getElementById('toolbox_no_while'));
            }
            else if (ifBlockId != '') {
                workspace.updateToolbox(document.getElementById('toolbox_no_if'));
            }
            else {
                workspace.updateToolbox(document.getElementById('toolbox'));
            }
        }
    }

    // Add the change listener to Blockly
    workspace.addChangeListener(onCodeChanged);

    // Set a click listener on the document
    $(document).click(function(e) {
        // Get the event target
        let target = e.target;
        // When control_if block is in use
        if (ifBlockId != '') {
            // When the user clicks anywhere outside the mutator and not on the mutator icon
            if (!$(target).is('.blocklyBubbleCanvas') && !$(target).parents().is('.blocklyBubbleCanvas')) {
                if (!$(target).is('.blocklyIconGroup') && !$(target).parents().is('.blocklyIconGroup')) {
                    // Hide the mutator
                    workspace.getBlockById(ifBlockId).mutator.setVisible(false);
                }
            }
        }
    });
});
