// Where Python code is written
let codingEditor = null;
// Where Blockly is converted to Python
let readOnlyCodingEditor = null;
// Range for ace editor line highlighting
let Range = ace.require('ace/range').Range;

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
                {value: 'FORWARD', score: 1000, meta: 'sumorobot'},
                {value: 'BACKWARD', score: 1000, meta: 'sumorobot'},
                {value: 'STATUS', score: 1000, meta: 'sumorobot'},
                {value: 'SONAR', score: 1000, meta: 'sumorobot'},
                {value: 'LEFT_LINE', score: 1000, meta: 'sumorobot'},
                {value: 'RIGHT_LINE', score: 1000, meta: 'sumorobot'},
                {value: 'sumorobot', score: 1000, meta: 'sumorobot'},
                {value: 'move(dir)', score: 1000, meta: 'sumorobot', caption: 'move(dir)', snippet: "move(${1:dir})$0"},
                {value: 'sleep(time)', score: 1000, meta: 'sumorobot', caption: 'sleep(time)', snippet: "sleep(${1:time})$0"},
                {value: 'set_led(led, value)', score: 1000, meta: 'sumorobot', caption: 'set_led(led, value)', snippet: "set_led(${1:led}, ${2:value})$0"},
                {value: 'is_line(line)', score: 1000, meta: 'sumorobot', caption: 'is_line(line)', snippet: "is_line(${1:line})$0"},
                {value: 'get_line(line)', score: 1000, meta: 'sumorobot', caption: 'get_line(line)', snippet: "get_line(${1:line})$0"},
                {value: 'set_servo(servo, speed)', score: 1000, meta: 'sumorobot', caption: 'set_servo(servo, speed)', snippet: "set_servo(${1:servo}, ${2:speed})$0"},
                {value: 'is_sonar()', score: 1000, meta: 'sumorobot', caption: 'is_sonar()', snippet: "is_sonar()$0"},
                {value: 'get_battery_level()', score: 1000, meta: 'sumorobot', caption: 'get_battery_level()', snippet: "get_battery_level()$0"},
                {value: 'get_sonar_value()', score: 1000, meta: 'sumorobot', caption: 'get_sonar_value()', snippet: "get_sonar_value()$0"},
                {value: 'is_battery_charging()', score: 1000, meta: 'sumorobot', caption: 'is_battery_charging()', snippet: "is_battery_charging()$0"}
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
