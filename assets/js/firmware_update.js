const debug = false;
const maxLogLength = 100;
const log = document.getElementById('log');
const butConnect = document.getElementById('butConnect');
const baudRate = document.getElementById('baudRate');
const clear = document.getElementById('butClear');

let serialport = new Serialport();
// Needs to access read and write buffers
let esptool = new EspLoader(serialport);

function initBaudRate() {
    for (let rate of baudRates) {
        var option = document.createElement("option");
        option.text = `${rate} Baud`;
        option.value = rate;
        baudRate.add(option);
    }
}

function logMsg(text, replaceLast = false) {
    let logLines = log.innerHTML.split("<br>");

    if (replaceLast)
        logLines.pop();

    logLines.push(text);

    // Remove old log content
    if (logLines.length > maxLogLength)
        logLines = logLines.splice(-maxLogLength);

    log.innerHTML = logLines.join("<br>\n");
}

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
    let prefix = `<span class="debug-function">[${top.func}:${top.pos}]</span>`;
    for (let arg of args) {
        if (typeof arg == "string") {
            logMsg(prefix + arg);
        } else if (typeof arg == "number") {
            logMsg(prefix + arg);
        } else if (typeof arg == "boolean") {
            logMsg(prefix + arg ? "true" : "false");
        } else if (Array.isArray(arg)) {
            logMsg(`${prefix}[${arg.map(value => toHex(value)).join(", ")}]`);
        } else if (typeof arg == "object" && (arg instanceof Uint8Array)) {
            logMsg(`${prefix}[${Array.from(arg).map(value => toHex(value)).join(", ")}]`);
        } else {
            logMsg(`${prefix}Unhandled type of argument:${typeof arg}`);
        }
        prefix = "";  // Only show for first argument
    }
}

function errorMsg(text) {
    logMsg(`<span class="error-message">Error:</span> ${text}`);
}

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
    toggleUIConnected(true);

    try {
        await serialport.connect();
        serialport.readLoop();

        logMsg("Syncing to ESP...");
        if (await esptool.sync()) {
            logMsg(`Connected to ${await esptool.chipName()}`);
            logMsg(`MAC Address: ${formatMacAddr(esptool.macAddr())}`);
            let baud = parseInt(baudRate.value);

            // Enables additional functionality (flash erase and faster baud rates)
            let stubLoader = await esptool.runStub();

            // TODO: only 115200 works, fix changing to faster bauds
            if (baudRates.includes(baud) && baud != ESP_ROM_BAUD) {
                await stubLoader.setBaudrate(baud);
            }

            logMsg("Erasing flash memory. Please wait...");
            let timestamp = Date.now();
            //await stubLoader.eraseFlash();
            logMsg(`Finished. Took ${Date.now() - timestamp}ms to erase.`);

            const url = 'https://sumo.robokoding.com/assets/binary/sumofirmware.bin';
            let file = await getFileFromUrl(url, 'sumorobot.bin')
            let contents = await readUploadedFileAsArrayBuffer(file);

            let offset = 4096;
            await stubLoader.flashData(contents, offset);
        }
    } catch (e) {
        errorMsg(e);
    } finally {
        await serialport.disconnect();
        toggleUIConnected(false);
    }
}

/**
 * @name changeBaudRate
 * Change handler for the Baud Rate selector.
 */
async function changeBaudRate() {
    saveSetting('baudrate', baudRate.value);
}

/**
 * @name clickClear
 * Click handler for the clear button.
 */
async function clickClear() {
    log.innerHTML = "";
}

function toggleUIConnected(connected) {
    if (connected) {
        baudRate.disabled = true;
        butConnect.disabled = true;
    } else {
        baudRate.disabled = false;
        butConnect.disabled = false;
    }
}

function loadAllSettings() {
    // Load all saved settings or defaults
    baudRate.value = loadSetting('baudrate', 115200);
}

function loadSetting(setting, defaultValue) {
    let value = JSON.parse(window.localStorage.getItem(setting));
    if (value == null) {
        return defaultValue;
    }

    return value;
}

function saveSetting(setting, value) {
    window.localStorage.setItem(setting, JSON.stringify(value));
}
