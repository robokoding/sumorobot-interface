// Sumorobot constructor
var Sumorobot = function(wsUri, robotId) {
    // Assign the WebSocket URI
    this.wsUri = wsUri;
    // Assign the SumoRobot ID
    this.robotId = robotId;
    // To keep track of the WebSocket connection
    this.watchdogCounter = 0;
    // When connection was intentionally closed
    this.terminate = false;
    // To store Python and Blockly code
    this.pythonCode = '';
    this.blocklyCode = '';
    // Callback function when message received
    this.callback = undefined;
    // If robot is moving
    this.isMoving = false;
    // Sensor data
    this.sensorScope = {
        'opponent': 99,
        'line_left': 0,
        'line_right': 0,
        'battery_voltage': 0
    };
    this.lineScope = {
        'left_line_value': 0,
        'right_line_value': 0,
        'left_line_threshold': 0,
        'right_line_threshold': 0
    };
    // Start connecting to the WebSocket
    this.connect();
};

// Function to initiate the WebSocket connection
Sumorobot.prototype.connect = function() {
    // To have access to this object inside events
    var self = this;
    this.websocket = new WebSocket(this.wsUri);
    // Setup connection watchdog interval
    self.connectionTimer = setInterval(function() {
        if (self.watchdogCounter == 0 && !self.terminate) {
            $("#battery img").attr("src", "/assets/img/battery_disconnected.png");
        }
        // Reset watchdog counter
        self.watchdogCounter = 0;
    }, 3000);
    // When the WebSocket gets connected
    this.websocket.onopen = function(evt) {
        // Setup a timer to ping the robot
        self.watchdogTimer = setInterval(function() {
            // Send a ping to the robot
            self.send('get_sensor_scope');
        }, 500);
    };
    // When the WebSocket closes
    this.websocket.onclose = function(evt) {
        // Clear the timers
        clearInterval(self.watchdogTimer);
        clearInterval(self.connectionTimer);
        // Try to recnnect to the sumorobot
        // Only if the connection wasn't closed intentionally
        if (!self.terminate) {
            self.connect();
        }
    };
    // When there is a message from the WebSocket
    this.websocket.onmessage = function(evt) {
        // When scope is received
        var jsonData = evt.data;
        //console.log(jsonData);
        var data = JSON.parse(jsonData);
        // Switch between different message types
        switch (data['type']) {
            // When sensor data was received
            case "sensor_scope":
                self.sensorScope = data;
                var batImgSrc = "/assets/img/battery_";
                // Check battery charge level and set image accordignly
                if (self.sensorScope['battery_voltage'] > 4.0) {
                    batImgSrc += "full";
                } else if (self.sensorScope['battery_voltage'] > 3.1) {
                    batImgSrc += "half";
                } else {
                    batImgSrc += "empty";
                }
                // Check if battery charging and set image accordingly
                if (self.sensorScope['battery_charge']) {
                    batImgSrc += "_charge.png";
                } else {
                    batImgSrc += ".png";
                }
                // Show the battery image
                $("#battery img").attr("src", batImgSrc);
                var temp = "";
                for (var name in data) {
                    temp += name + ": " + data[name] + "<br>";
                }
                $("#pythonConsoleText").html(temp);
                break;
            case "line_scope":
                self.lineScope = data;
                break;
            case "blockly_code":
                updateBlocklyCode(data['val']);
                break;
            case "python_code":
                updatePythonCode(data['val']);
                break;
        }
        // Count data received packets
        self.watchdogCounter += 1;
    };
    // When there is an WebSocket error
    this.websocket.onerror = function(err) {
        console.log('ERROR websocket error: ' + err);
    };
};

// Function to send WebSocket data
Sumorobot.prototype.send = function(cmd, val, callback) {
    if (cmd == 'set_python_code' || cmd == 'move') {
        this.isMoving = true;
    } else {
        this.isMoving = false;
    }
    // Ready state constants: CONNECTING 0, OPEN 1, CLOSING 2, CLOSED 3
    // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
    if (!this.terminate && this.websocket.readyState == 1) {
        if (val !== 'undefined') {
            this.websocket.send(`{"cmd": "${cmd}", "val": "${val}"}`);
        } else {
            this.websocket.send(`{"cmd": "${cmd}"}`);
        }
    }
    // Save the callback function
    this.callback = callback;
};

// Function to close the WebSocket connection
Sumorobot.prototype.close = function() {
    this.terminate = true;
    // Close the WebSocket connection
    this.websocket.close();
};
