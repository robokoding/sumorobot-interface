const debug = false;
const maxLogLength = 100;

// UI Fields
let logField = null;
let connectButton = null;
let baudrateSelect = null;

function firmwareUpdateInit() {
    // Update SumoFirmware version in SumoFirmware panel
    $.getJSON('https://api.github.com/repos/robokoding/sumorobot-firmware/releases/latest', function(json) {
        $('#sumofirmware-latest').html(json['tag_name']);
    });

    // SumoFirmware panel update button
    $('#btn-firmware-update').click(function() {
        $('#firmware-log').html('');
        clickUpdate();
    });

    // SumoFirmware panel cancel button
    $('#btn-firmware-cancel').click(function() {
        $('#notification-panel').hide();
        $('#firmware-log').html('');
    });

    logField = document.getElementById('firmware-log');
    updateButton = document.getElementById('btn-firmware-update');
    baudrateSelect = document.getElementById('firmware-baudrates') || document.createElement("select");

    initBaudRate();
}

/**
 * @name initBaudrate
 * Populates the ESP baudrates into the UI form
 */
function initBaudRate() {
    for (let rate of baudrates) {
        var option = document.createElement("option");
        option.text = `${rate} Baud`;
        option.value = rate;
        baudrateSelect.add(option);
    }
}

/**
 * @name logMsg
 * To show a message in the log console.
 */
function logMsg(text, replaceLast = false) {
    let logLines = logField.innerHTML.split("<br>");

    if (replaceLast)
        logLines.pop();

    logLines.push(text);

    // Remove old log content
    if (logLines.length > maxLogLength)
        logLines = logLines.splice(-maxLogLength);

    logField.innerHTML = logLines.join("<br>\n");
}

/**
 * @name debugMsg
 * To show a debug message in the log console.
 */
function debugMsg(...args) {
    if (!debug)
        return;

    function getStackTrace() {
        let stack = new Error().stack;

        stack = stack.split("\n").map(v => v.trim());
        stack.shift();
        stack.shift();

        let trace = [];
        for (let line of stack) {
            line = line.replace("at ", "");
            trace.push({
                "func": line.substr(0, line.indexOf("(") - 1),
                "pos": line.substring(line.indexOf(".js:") + 4, line.lastIndexOf(":"))
            });
        }

        return trace;
    }

    let stack = getStackTrace();
    stack.shift();
    let top = stack.shift();
    let prefix = `<span class="text-muted">[${top.func}:${top.pos}]`;
    let postfix = "</span>";
    for (let arg of args) {
        if (typeof arg == "string") {
            logMsg(prefix + arg + postfix);
        } else if (typeof arg == "number") {
            logMsg(prefix + arg + postfix);
        } else if (typeof arg == "boolean") {
            logMsg(prefix + arg ? "true" : "false" + postfix);
        } else if (Array.isArray(arg)) {
            logMsg(`${prefix}[${arg.map(value => toHex(value)).join(", ")}]${postfix}`);
        } else if (typeof arg == "object" && (arg instanceof Uint8Array)) {
            logMsg(`${prefix}[${Array.from(arg).map(value => toHex(value)).join(", ")}]${postfix}`);
        } else {
            logMsg(`${prefix}Unhandled type of argument:${typeof arg}${postfix}`);
        }
    }
}

/**
 * @name successMsg
 * To show a success message in the log console.
 */
 function successMsg(text) {
    logMsg(`<span class="text-success">${text}</span>`);
}

/**
 * @name errorMsg
 * To show a error message in the log console.
 */
function errorMsg(text) {
    logMsg(`<span class="text-danger">Error: ${text}</span>`);
}

// Convert file into a arraybuffer
async function readUploadedFileAsArrayBuffer(inputFile) {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onerror = () => {
            reader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsArrayBuffer(inputFile);
    });
}

// Read file from url
async function getFileFromUrl(url, name) {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(response => response.blob())
            .then(blob => resolve(new File([blob], name)))
            .catch(error => reject(new DOMException(error)));
    });
}

/**
 * @name clickUpdate
 * Click handler for the update button.
 */
async function clickUpdate() {
    toggleUIUpdating(true);

    let serialport = new Serialport();
    // Needs to access read and write buffers
    let esptool = new EspLoader(serialport);

    try {
        await serialport.connect(ESP_ROM_BAUD);
        serialport.readLoop();
        // Enter bootloader
        await serialport.bootloaderReset();

        logMsg("Syncing to SumoRobot...");
        if (await esptool.sync()) {
            successMsg("Sync successful");

            // Enables additional functionality (flash erase and faster baud rates)
            let stubLoader = await esptool.runStub();

            logMsg("Erasing flash memory. Please wait...");
            let timestamp = Date.now();
            await stubLoader.eraseFlash();
            successMsg(`Erase successful. Took ${Date.now() - timestamp}ms to erase.`);

            const url = 'https://sumo.robokoding.com/assets/binary/sumofirmware.bin';
            let file = await getFileFromUrl(url, 'sumorobot.bin')
            let contents = await readUploadedFileAsArrayBuffer(file);

            // Change baudrate if the non default one was selected
            let baud = parseInt(baudrateSelect.value);
            if (baudrates.includes(baud) && baud != ESP_ROM_BAUD) {
                await stubLoader.setBaudrate(baud);
            }

            let offset = 4096;
            await stubLoader.flashData(contents, offset);
            await serialport.hardReset();
        } else {
            errorMsg("Syncing failed, try again and try lower baudrates");
        }
    } catch (error) {
        errorMsg(error);
    } finally {
        await serialport.disconnect();
        toggleUIUpdating(false);
    }
}

function toggleUIUpdating(updating) {
    if (updating) {
        $('#btn-firmware-cancel').prop('disabled', true);
        baudrateSelect.disabled = true;
        updateButton.disabled = true;
    } else {
        $('#btn-firmware-cancel').prop('disabled', false);
        baudrateSelect.disabled = false;
        updateButton.disabled = false;
    }
}
