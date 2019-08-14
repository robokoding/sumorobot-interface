// Where Python code is written
var codingEditor = null;
// Where Blockly is converted to Python
var readOnlyCodingEditor = null;
// Range for ace editor line highlighting
var Range = ace.require('ace/range').Range;

window.addEventListener('load', function() {
    // Load read only ace editor
    readOnlyCodingEditor = ace.edit('readOnlyBlocklyCode');
    // Set the style
    readOnlyCodingEditor.setTheme('ace/theme/textmate');
    readOnlyCodingEditor.session.setMode('ace/mode/python');
    readOnlyCodingEditor.session.setTabSize(2);
    // Make as read only
    readOnlyCodingEditor.setReadOnly(true);
    // Disable scrolling warning
    readOnlyCodingEditor.$blockScrolling = Infinity;

    // Load ace editor
    codingEditor = ace.edit('blocklyCode');
    // Set the style
    codingEditor.setTheme('ace/theme/textmate');
    codingEditor.session.setMode('ace/mode/python');
    codingEditor.session.setTabSize(2);
    // Disable scrolling warning
    codingEditor.$blockScrolling = Infinity;
    // Enable autocomplete
    ace.require('ace/ext/language_tools');
    codingEditor.setOptions({
        enableSnippets: true,
        enableLiveAutocompletion: true,
        enableBasicAutocompletion: true
    });
    // Add autocomplete keywords
    codingEditor.completers.push({
    getCompletions: function(editor, session, pos, prefix, callback) {
            callback(null, [
                {value: 'STOP', score: 1000, meta: 'sumorobot'},
                {value: 'LEFT', score: 1000, meta: 'sumorobot'},
                {value: 'RIGHT', score: 1000, meta: 'sumorobot'},
                {value: 'SEARCH', score: 1000, meta: 'sumorobot'},
                {value: 'FORWARD', score: 1000, meta: 'sumorobot'},
                {value: 'BACKWARD', score: 1000, meta: 'sumorobot'},
                {value: 'STATUS', score: 1000, meta: 'sumorobot'},
                {value: 'OPPONENT', score: 1000, meta: 'sumorobot'},
                {value: 'LEFT_LINE', score: 1000, meta: 'sumorobot'},
                {value: 'RIGHT_LINE', score: 1000, meta: 'sumorobot'},
                {value: 'sumorobot', score: 1000, meta: 'sumorobot'},
                {value: 'move(dir)', score: 1000, meta: 'sumorobot', caption: 'move(dir)', snippet: "move(${1:dir})$0"},
                {value: 'wait(time)', score: 1000, meta: 'sumorobot', caption: 'sleep(time)', snippet: "sleep(${1:time})$0"},
                {value: 'setLed(led, enable)', score: 1000, meta: 'sumorobot', caption: 'setLed(led, enable)', snippet: "setLed(${1:led}, ${2:enable})$0"},
                {value: 'isLine(dir)', score: 1000, meta: 'sumorobot', caption: 'isLine(dir)', snippet: "isLine(${1:dir})$0"},
                {value: 'getLine(dir)', score: 1000, meta: 'sumorobot', caption: 'getLine(dir)', snippet: "getLine(${1:dir})$0"},
                {value: 'setServo(dir, speed)', score: 1000, meta: 'sumorobot', caption: 'setServo(dir, speed)', snippet: "setServo(${1:dir}, ${2:speed})$0"},
                {value: 'isSonar()', score: 1000, meta: 'sumorobot', caption: 'isSonar()', snippet: "isSonar()$0"},
                {value: 'calibrateLineValue()', score: 1000, meta: 'sumorobot', caption: 'calibrateLineValue()', snippet: "calibrateLineValue()$0"},
                {value: 'calibrateLineThreshold(val)', score: 1000, meta: 'sumorobot', caption: 'calibrateLineThreshold(val)', snippet: "calibrateLineThreshold(${1:val})$0"},
                {value: 'getBatteryVoltage()', score: 1000, meta: 'sumorobot', caption: 'getBatteryVoltage()', snippet: "getBatteryVoltage()$0"},
                {value: 'getSonarDistance()', score: 1000, meta: 'sumorobot', caption: 'getSonarDistance()', snippet: "getOpponentDistance()$0"}
            ]);
        }
    });
    // Set the code to the saved code from local storage or empty
    codingEditor.setValue(getLocalStorageItem('sumorobot.code') || '');
    // Clear the selection after setting the value
    codingEditor.clearSelection();
    // Add an change listener for the code editor
    codingEditor.on('change', function() {
        // When change occurs, save the new code to the localstorage
        setLocalStorageItem('sumorobot.code', codingEditor.getValue())
    });
});
