// Blockly workspace
var workspace;

// Blockly WebSocket
var blockSocket = undefined;
// Blocks XML
var blocksXML;
var messageId = 0;
var onCodeChange;

function connectBlockSocket(robotId) {
    blockSocket = new WebSocket('ws://165.227.140.64:80/ws/blocks-' + robotId);
    blockSocket.onopen = function(evt) {
        console.log('blockly.js: open');
    };
    blockSocket.onclose = function(evt) {
        console.log('blockly.js: close');
    };
    blockSocket.onmessage = function(evt) {
        //console.log('blockly.js: message ' + evt.data);
        if (messageId != evt.data.substring(0, 8)) {
            updateBlocklyCode(evt.data.substring(8, evt.data.length));
        }
    };
    blockSocket.onerror = function(err) {
        console.log('ERROR websocket error ' + err);
    };
}

window.addEventListener('load', function() {
    // To remember the control_if blockId
    var controlBlockId = '';

    // Change the if block to be more cheerful
    Blockly.Msg.LOGIC_HUE = '#24c74f';

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
              "colour": "%{BKY_LOGIC_HUE}",
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
                ['move search', 'SEARCH'],
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

    Blockly.Blocks['sumorobot_sleep'] = {
        init: function() {
            this.setColour('#e98017');
            this.appendDummyInput()
              .appendField('sleep')
                .appendField(new Blockly.FieldTextInput('1000',
                  Blockly.FieldNumber.numberValidator), 'SLEEP');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
        }
    };

    Blockly.Blocks['sumorobot_opponent'] = {
        init: function() {
            this.setColour('#0099E6');
            this.appendDummyInput().appendField('opponent');
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
                ['led opponent', 'OPPONENT'],
                ['led left line', 'LEFT_LINE'],
                ['led right line', 'RIGHT_LINE']
            ];
            var OPERATORS2 = [
                ['off', 'False'],
                ['on', 'True']
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

    Blockly.Blocks['sumorobot_opponent_distance'] = {
        init: function() {
            this.setColour('#0099E6');
            this.appendDummyInput().appendField('opponent')
              .appendField(new Blockly.FieldTextInput('40',
                Blockly.FieldNumber.numberValidator), 'DISTANCE');
            this.setOutput(true, 'Boolean');
        }
    };

    Blockly.Python['sumorobot_move'] = function(block) {
        var code = 'sumorobot.move(' + block.getFieldValue('MOVE') + ');;' + block.id + '\n';
        return code;
    };

    Blockly.Python['sumorobot_sleep'] = function(block) {
        var code = 'sumorobot.sleep(' + parseFloat(block.getFieldValue('SLEEP')) + ');;' + block.id + '\n';
        return code;
    };

    Blockly.Python['sumorobot_opponent'] = function(block) {
        var code = 'sumorobot.is_opponent();;' + block.id;
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    Blockly.Python['sumorobot_line'] = function(block) {
        var code = 'sumorobot.is_line(' + block.getFieldValue('LINE') + ');;' + block.id;
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    Blockly.Python['sumorobot_servo'] = function(block) {
        var code = 'sumorobot.set_servo(' + block.getFieldValue('SERVO') + ', '+
          block.getFieldValue('SPEED') + ');;' + block.id + '\n';
        return code;
    };

    Blockly.Python['sumorobot_led'] = function(block) {
        var code = 'sumorobot.set_led(' + block.getFieldValue('LED') + ', '+
          block.getFieldValue('STATE') + ');;' + block.id + '\n';
        return code;
    };

    Blockly.Python['sumorobot_opponent_distance'] = function(block) {
        var code = 'sumorobot.get_opponent_distance() < ' + block.getFieldValue('DISTANCE') + ';;' + block.id;
        return [code, Blockly.Python.ORDER_ATOMIC];
    };

    // Inject Blockly
    var blocklyArea = document.getElementById('blocklyArea');
    var blocklyDiv = document.getElementById('blocklyDiv');
    workspace = Blockly.inject(blocklyDiv, {
        media: '/assets/blockly/media/',
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
    onCodeChange = function(event) {
        // When the if condition block was created
        if (event.type == Blockly.Events.CREATE &&
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

        // Show the code in the ace editor, filter out block IDs
        readOnlyCodingEditor.setValue(Blockly.Python.workspaceToCode(workspace).replace(/;;.{20}/g, ''));
        readOnlyCodingEditor.clearSelection();

        // Convert blocks to XML
        var xml = Blockly.Xml.workspaceToDom(workspace);
        // Compress XML to text
        blocksXML = Blockly.Xml.domToText(xml);

        // Save the code to the local storage
        localStorage.setItem('sumorobot.blockly', blocksXML);

        if (blockSocket !== undefined && blockSocket.readyState == 1) {
            messageId = Math.floor(Math.random() * 100000000);
            blockSocket.send(messageId + blocksXML);
        }

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
