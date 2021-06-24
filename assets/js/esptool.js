'use strict';

const baudrates = [460800, 230400, 115200];
const flashSizes = {
    "512KB": 0x00,
    "256KB": 0x10,
    "1MB": 0x20,
    "2MB": 0x30,
    "4MB": 0x40,
    "2MB-c1": 0x50,
    "4MB-c1": 0x60,
    "8MB": 0x80,
    "16MB": 0x90,
};

const FLASH_WRITE_SIZE = 0x200;
const ESP32S2_FLASH_WRITE_SIZE = 0x400;
const FLASH_SECTOR_SIZE = 0x1000;  // Flash sector size, minimum unit of erase.
const ESP_ROM_BAUD = 115200;

const SYNC_PACKET = toByteArray("\x07\x07\x12 UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU");
const CHIP_DETECT_MAGIC_REG_ADDR = 0x40001000;
const ESP8266 = 0x8266;
const ESP32 = 0x32;
const ESP32S2 = 0x3252;
const ESP32_DATAREGVALUE = 0x15122500;
const ESP8266_DATAREGVALUE = 0x00062000;
const ESP32S2_DATAREGVALUE = 0x500;

// Commands supported by ESP8266 ROM bootloader
const ESP_FLASH_BEGIN = 0x02;
const ESP_FLASH_DATA = 0x03;
const ESP_FLASH_END = 0x04;
const ESP_MEM_BEGIN = 0x05;
const ESP_MEM_END = 0x06;
const ESP_MEM_DATA = 0x07;
const ESP_SYNC = 0x08;
const ESP_WRITE_REG = 0x09;
const ESP_READ_REG = 0x0A;

const ESP_ERASE_FLASH = 0xD0;
const ESP_ERASE_REGION = 0xD1;

const ESP_SPI_SET_PARAMS = 0x0B;
const ESP_SPI_ATTACH = 0x0D;
const ESP_CHANGE_BAUDRATE = 0x0F;
const ESP_SPI_FLASH_MD5 = 0x13;
const ESP_CHECKSUM_MAGIC = 0xEF;

const ROM_INVALID_RECV_MSG = 0x05;

const USB_RAM_BLOCK = 0x800;
const ESP_RAM_BLOCK = 0x1800;

// Timeouts
const DEFAULT_TIMEOUT = 3000;
const CHIP_ERASE_TIMEOUT = 600000;             // timeout for full chip erase in ms
const MAX_TIMEOUT = CHIP_ERASE_TIMEOUT * 2;    // longest any command can run in ms
const SYNC_TIMEOUT = 100;                      // timeout for syncing with bootloader in ms
const ERASE_REGION_TIMEOUT_PER_MB = 30000;     // timeout (per megabyte) for erasing a region in ms
const MEM_END_ROM_TIMEOUT = 50;

/**
 * @name toByteArray
 * Convert a string to a byte array
 */
function toByteArray(str) {
    let byteArray = [];
    for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode <= 0xFF) {
            byteArray.push(charcode);
        }
    }
    return byteArray;
}

function formatMacAddr(macAddr) {
    return macAddr.map(value => value.toString(16).toUpperCase().padStart(2, "0")).join(":");
}

function toHex(value, size = 2) {
    return "0x" + value.toString(16).toUpperCase().padStart(size, "0");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class EspLoader {
    constructor(serialport) {
        this._serialport = serialport;
        this._chipfamily = null;
        this._efuses = new Array(4).fill(0);
        this._flashsize = 4 * 1024 * 1024;
        this.IS_STUB = false;
    }

    /**
     * @name slipEncode
     * Take an array buffer and return back a new array where
     * 0xdb is replaced with 0xdb 0xdd and 0xc0 is replaced with 0xdb 0xdc
     */
    slipEncode(buffer) {
        let encoded = [];
        for (let byte of buffer) {
            if (byte == 0xDB) {
                encoded = encoded.concat([0xDB, 0xDD]);
            } else if (byte == 0xC0) {
                encoded = encoded.concat([0xDB, 0xDC]);
            } else {
                encoded.push(byte);
            }
        }
        return encoded;
    }

    /**
     * @name macAddr
     * The MAC address burned into the OTP memory of the ESP chip
     */
    macAddr() {
        let macAddr = new Array(6).fill(0);
        let mac0 = this._efuses[0];
        let mac1 = this._efuses[1];
        let mac2 = this._efuses[2];
        let mac3 = this._efuses[3];
        let oui;
        if (this._chipfamily == ESP8266) {
            if (mac3 != 0) {
                oui = [(mac3 >> 16) & 0xFF, (mac3 >> 8) & 0xFF, mac3 & 0xFF];
            } else if (((mac1 >> 16) & 0xFF) == 0) {
                oui = [0x18, 0xFE, 0x34];
            } else if (((mac1 >> 16) & 0xFF) == 1) {
                oui = [0xAC, 0xD0, 0x74];
            } else {
                throw ("Couldnt determine OUI");
            }

            macAddr[0] = oui[0];
            macAddr[1] = oui[1];
            macAddr[2] = oui[2];
            macAddr[3] = (mac1 >> 8) & 0xFF;
            macAddr[4] = mac1 & 0xFF;
            macAddr[5] = (mac0 >> 24) & 0xFF;
        } else if (this._chipfamily == ESP32) {
            macAddr[0] = mac2 >> 8 & 0xFF;
            macAddr[1] = mac2 & 0xFF;
            macAddr[2] = mac1 >> 24 & 0xFF;
            macAddr[3] = mac1 >> 16 & 0xFF;
            macAddr[4] = mac1 >> 8 & 0xFF;
            macAddr[5] = mac1 & 0xFF;
        } else if (this._chipfamily == ESP32S2) {
            macAddr[0] = mac2 >> 8 & 0xFF;
            macAddr[1] = mac2 & 0xFF;
            macAddr[2] = mac1 >> 24 & 0xFF;
            macAddr[3] = mac1 >> 16 & 0xFF;
            macAddr[4] = mac1 >> 8 & 0xFF;
            macAddr[5] = mac1 & 0xFF;
        } else {
            throw ("Unknown chip family")
        }
        return macAddr;
    }

    /**
     * @name _readEfuses
     * Read the OTP data for this chip and store into this.efuses array
     */
    async _readEfuses() {
        let baseAddr
        if (this._chipfamily == ESP8266) {
            baseAddr = 0x3FF00050;
        } else if (this._chipfamily == ESP32) {
            baseAddr = 0x6001A000;
        } else if (this._chipfamily == ESP32S2) {
            baseAddr = 0x6001A000;
        } else {
            throw ("Don't know what chip this is");
        }
        for (let i = 0; i < 4; i++) {
            this._efuses[i] = await this.readRegister(baseAddr + 4 * i);
        }
    }

    /**
     * @name readRegister
     * Read a register within the ESP chip RAM, returns a 4-element list
     */
    async readRegister(reg) {
        debugMsg("Reading Register", reg);

        let packet = this.pack("I", reg);
        let register = (await this.checkCommand(ESP_READ_REG, packet))[0];
        return this.unpack("I", register)[0];
    }

    /**
     * @name chipType
     * ESP32 or ESP8266 based on which chip type we're talking to
     */
    async chipType() {
        if (this._chipfamily === null) {
            let datareg = await this.readRegister(0x60000078);
            if (datareg == ESP32_DATAREGVALUE) {
                this._chipfamily = ESP32;
            } else if (datareg == ESP8266_DATAREGVALUE) {
                this._chipfamily = ESP8266;
            } else if (datareg == ESP32S2_DATAREGVALUE) {
                this._chipfamily = ESP32S2;
            } else {
                throw ("Unknown Chip.");
            }
        }
        return this._chipfamily;
    }

    /**
     * @name chipType
     * The specific name of the chip, e.g. ESP8266EX, to the best
     * of our ability to determine without a stub bootloader.
     */
    async chipName() {
        await this.chipType();
        await this._readEfuses();

        if (await this.chipType() == ESP32) {
            return "ESP32";
        }
        if (await this.chipType() == ESP32S2) {
            return "ESP32-S2";
        }
        if (await this.chipType() == ESP8266) {
            if (this._efuses[0] & (1 << 4) || this._efuses[2] & (1 << 16)) {
                return "ESP8285";
            }
            return "ESP8266EX";
        }
        return null;
    }

    /**
     * @name checkCommand
     * Send a command packet, check that the command succeeded and
     * return a tuple with the value and data.
     * See the ESP Serial Protocol for more details on what value/data are
     */
    async checkCommand(opcode, buffer, checksum = 0, timeout = DEFAULT_TIMEOUT) {
        timeout = Math.min(timeout, MAX_TIMEOUT);
        await this.sendCommand(opcode, buffer, checksum);
        let [value, data] = await this.getResponse(opcode, timeout);
        let statusLen;

        if (data !== null) {
            if (this.IS_STUB) {
                statusLen = 2;
            } else if (this._chipfamily == ESP8266) {
                statusLen = 2;
            } else if ([ESP32, ESP32S2].includes(this._chipfamily)) {
                statusLen = 4;
            } else {
                if ([2, 4].includes(data.length)) {
                    statusLen = data.length;
                }
            }
        }

        if (data === null || data.length < statusLen) {
            errorMsg("not enough status bytes");//throw ("Didn't get enough status bytes");
            return [null, null];
        }

        let status = data.slice(-statusLen, data.length);
        data = data.slice(0, -statusLen);
        debugMsg("status", status);
        debugMsg("value", value);
        debugMsg("data", data);

        if (status[0] == 1) {
            if (status[1] == ROM_INVALID_RECV_MSG) {
                throw (`Invalid (unsupported) command ${toHex(opcode)}`);
            } else {
                throw (`Command failure error code ${toHex(status[1])}`);
            }
        }

        return [value, data];
    }

    /**
     * @name timeoutPerMb
     * Scales timeouts which are size-specific
     */
    timeoutPerMb(secondsPerMb, sizeBytes) {
        let result = Math.floor(secondsPerMb * (sizeBytes / 0x1e6));
        if (result < DEFAULT_TIMEOUT) {
            return DEFAULT_TIMEOUT;
        }
        return result;
    }

    /**
     * @name sendCommand
     * Send a slip-encoded, checksummed command over the UART,
     * does not check response.
     */
    async sendCommand(opcode, buffer, checksum = 0) {
        this._serialport.clearInputBuffer();
        let packet = [0xC0, 0x00]; // direction
        packet.push(opcode);
        packet = packet.concat(this.pack("H", buffer.length));
        packet = packet.concat(this.slipEncode(this.pack("I", checksum)));
        packet = packet.concat(this.slipEncode(buffer));
        packet.push(0xC0);
        debugMsg(`Writing ${packet.length} byte${(packet.length == 1 ? "" : "s")}:`, packet);
        await this._serialport.writeToStream(packet);
    }

    /**
     * @name getResponse
     * Read response data and decodes the slip packet, then parses
     * out the value/data and returns as a tuple of (value, data) where
     * each is a list of bytes.
     */
    async getResponse(opcode, timeout = DEFAULT_TIMEOUT) {
        let reply = [];
        let packetLength = 0;
        let escapedByte = false;
        let stamp = Date.now();
        while (Date.now() - stamp < timeout) {
            if (this._serialport.getInputBufferLength() > 0) {
                let c = this._serialport.getInputBufferByte();
                if (c == 0xDB) {
                    escapedByte = true;
                } else if (escapedByte) {
                    if (c == 0xDD) {
                        reply.push(0xDC);
                    } else if (c == 0xDC) {
                        reply.push(0xC0);
                    } else {
                        reply = reply.concat([0xDB, c]);
                    }
                    escapedByte = false;
                } else {
                    reply.push(c);
                }
            } else {
                await sleep(10);
            }
            if (reply.length > 0 && reply[0] != 0xC0) {
                // packets must start with 0xC0
                reply.shift();
            }
            if (reply.length > 1 && reply[1] != 0x01) {
                reply.shift();
            }
            if (reply.length > 2 && reply[2] != opcode) {
                reply.shift();
            }
            if (reply.length > 4) {
                // get the length
                packetLength = reply[3] + (reply[4] << 8);
            }
            if (reply.length == packetLength + 10) {
                break;
            }
        }

        // Check to see if we have a complete packet. If not, we timed out.
        if (reply.length != packetLength + 10) {
            //logMsg("Timed out after " + timeout + " milliseconds");
            return [null, null];
        }

        let value = reply.slice(5, 9);
        let data = reply.slice(9, -1);

        debugMsg("value:", value, "data:", data);
        debugMsg(`Reading ${reply.length} byte${reply.length == 1 ? "" : "s"}:`, reply);

        return [value, data];
    }

    /**
       * @name read
       * Read response data and decodes the slip packet.
       * Keeps reading until we hit the timeout or get
       * a packet closing byte
       */
    async readBuffer(timeout = DEFAULT_TIMEOUT) {
        let reply = [];
        let packetLength = 0;
        let escapedByte = false;
        let stamp = Date.now();
        while (Date.now() - stamp < timeout) {
            if (this._serialport.getInputBufferLength() > 0) {
                let c = this._serialport.getInputBufferByte();
                if (c == 0xDB) {
                    escapedByte = true;
                } else if (escapedByte) {
                    if (c == 0xDD) {
                        reply.push(0xDC);
                    } else if (c == 0xDC) {
                        reply.push(0xC0);
                    } else {
                        reply = reply.concat([0xDB, c]);
                    }
                    escapedByte = false;
                } else {
                    reply.push(c);
                }
            } else {
                await sleep(10);
            }
            if (reply.length > 0 && reply[0] != 0xC0) {
                // packets must start with 0xC0
                reply.shift();
            }
            if (reply.length > 1 && reply[reply.length - 1] == 0xC0) {
                break;
            }
        }

        // Check to see if we have a complete packet. If not, we timed out.
        if (reply.length < 2) {
            logMsg(`Timed out after ${timeout} milliseconds`);
            return null;
        }

        let data = reply.slice(1, -1);
        debugMsg("data:", data);
        debugMsg(`Reading ${reply.length} byte${reply.length == 1 ? "" : "s"}:`, reply);

        return data;
    }

    /**
     * @name checksum
     * Calculate checksum of a blob, as it is defined by the ROM
     */
    checksum(data, state = ESP_CHECKSUM_MAGIC) {
        for (let b of data) {
            state ^= b;
        }
        return state;
    }

    /**
     * @name setBaurate
     * Set new baudrate for the ESP and open serialport
     */
    async setBaudrate(baud) {
        if (this._chipfamily == ESP8266) {
            logMsg("Baud rate can only change on ESP32 and ESP32-S2");
        } else {
            logMsg(`Attempting to change baud rate to ${baud}...`);
            let buffer = this.pack("<II", baud, 115200);
            await this.checkCommand(ESP_CHANGE_BAUDRATE, buffer);

            // Since SerialPort does not allow to be reconfigured,
            // we need to close it, and re-open it with the new BaudRate
            await this._serialport.disconnect();
            // Reopen the port
            await this._serialport.connect(baud);
            // Restart the readloop
            this._serialport.readLoop();

            logMsg(`Changed baud rate to ${baud}`);
        }
    }

    pack(...args) {
        let pointer = 0;
        let format = args[0];
        let data = args.slice(1);
        if (format.replace(/[<>]/, '').length != data.length) {
            errorMsg("Pack format to Argument count mismatch");
            return;
        }
        let bytes = [];
        let littleEndian = true;
        for (let i = 0; i < format.length; i++) {
            if (format[i] == "<") {
                littleEndian = true;
            } else if (format[i] == ">") {
                littleEndian = false;
            } else if (format[i] == "B") {
                pushBytes(data[pointer], 1);
                pointer++;
            } else if (format[i] == "H") {
                pushBytes(data[pointer], 2);
                pointer++;
            } else if (format[i] == "I") {
                pushBytes(data[pointer], 4);
                pointer++;
            } else {
                errorMsg("Unhandled character in pack format");
            }
        }

        function pushBytes(value, byteCount) {
            for (let i = 0; i < byteCount; i++) {
                if (littleEndian) {
                    bytes.push((value >> (i * 8)) & 0xFF);
                } else {
                    bytes.push((value >> ((byteCount - i) * 8)) & 0xFF);
                }
            }
        }

        return bytes;
    }

    unpack(format, bytes) {
        let pointer = 0;
        let data = [];
        for (let c of format) {
            if (c == "B") {
                data.push((bytes[pointer] & 0xFF));
                pointer += 1;
            } else if (c == "H") {
                data.push(
                    (bytes[pointer] & 0xFF) |
                    ((bytes[pointer + 1] & 0xFF) << 8)
                );
                pointer += 2;
            } else if (c == "I") {
                data.push(
                    (bytes[pointer] & 0xFF) |
                    ((bytes[pointer + 1] & 0xFF) << 8) |
                    ((bytes[pointer + 2] & 0xFF) << 16) |
                    ((bytes[pointer + 3] & 0xFF) << 24))
                pointer += 4;
            } else {
                errorMsg("Unhandled character in unpack format");
            }
        }
        return data;
    }

    /**
     * @name sync
     * Put into ROM bootload mode & attempt to synchronize with the
     * ESP ROM bootloader, we will retry a few times
     */
    async sync() {
        for (let i = 0; i < 5; i++) {
            let response = await this._sync();
            if (response) {
                await sleep(100);
                return true;
            }
            await sleep(100);
        }

        throw ("Couldn't sync to ESP. Try resetting.");
    }

    /**
     * @name _sync
     * Perform a soft-sync using AT sync packets, does not perform
     * any hardware resetting
     */
    async _sync() {
        await this.sendCommand(ESP_SYNC, SYNC_PACKET);
        for (let i = 0; i < 8; i++) {
            let [reply, data] = await this.getResponse(ESP_SYNC, SYNC_TIMEOUT);
            if (data === null) {
                continue;
            }
            if (data.length > 1 && data[0] == 0 && data[1] == 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * @name getFlashWriteSize
     * Get the Flash write size based on the chip
     */
    getFlashWriteSize() {
        if (this._chipfamily == ESP32S2) {
            return ESP32S2_FLASH_WRITE_SIZE;
        }
        return FLASH_WRITE_SIZE;
    }

    /**
     * @name flashData
     * Program a full, uncompressed binary file into SPI Flash at
     *   a given offset. If an ESP32 and md5 string is passed in, will also
     *   verify memory. ESP8266 does not have checksum memory verification in
     *   ROM
     */
    async flashData(binaryData, offset = 0, part = 0) {
        let seq = 0;
        let block = [];
        let written = 0;
        let position = 0;
        let address = offset;
        let timestamp = Date.now();
        let filesize = binaryData.byteLength;

        logMsg(`\nWriting data with filesize: ${filesize} bytes`);
        let blocks = await this.flashBegin(filesize, offset);
        let flashWriteSize = this.getFlashWriteSize();
        let prev_percentage = 0;

        while (filesize - position > 0) {
            let percentage = Math.floor(100 * (seq + 1) / blocks);
            if (percentage > prev_percentage)
                logMsg(`Writing at ${toHex(address + seq * flashWriteSize, 8)}... (${percentage} %)`, true);

            prev_percentage = percentage;

            if (filesize - position >= flashWriteSize) {
                block = Array.from(new Uint8Array(binaryData, position, flashWriteSize));
            } else {
                // Pad the last block
                block = Array.from(new Uint8Array(binaryData, position, filesize - position));
                block = block.concat(new Array(flashWriteSize - block.length).fill(0xFF));
            }

            await this.flashBlock(block, seq, 2000);
            seq += 1;
            written += block.length;
            position += flashWriteSize;
        }

        successMsg(`Flashing successful. Took ${Date.now() - timestamp}ms to write ${filesize} bytes`);
    }

    /**
     * @name flashBlock
     * Send one block of data to program into SPI Flash memory
     */
    async flashBlock(data, seq, timeout = 100) {
        await this.checkCommand(
            ESP_FLASH_DATA,
            this.pack("<IIII", data.length, seq, 0, 0).concat(data),
            this.checksum(data),
            timeout,
        );
    }

    /**
     * @name flashBegin
     * Prepare for flashing by attaching SPI chip and erasing the
     *   number of blocks requred.
     */
    async flashBegin(size = 0, offset = 0, encrypted = false) {
        let eraseSize;
        let buffer;
        let flashWriteSize = this.getFlashWriteSize();
        if ([ESP32, ESP32S2].includes(this._chipfamily)) {
            await this.checkCommand(ESP_SPI_ATTACH, new Array(8).fill(0));
        }
        if (this._chipfamily == ESP32) {
            // We are hardcoded for 4MB flash on ESP32
            buffer = this.pack("<IIIIII", 0, this._flashsize, 0x10000, 4096, 256, 0xFFFF)
            await this.checkCommand(ESP_SPI_SET_PARAMS, buffer);
        }
        let numBlocks = Math.floor((size + flashWriteSize - 1) / flashWriteSize);
        if (this._chipfamily == ESP8266) {
            eraseSize = this.getEraseSize(offset, size);
        } else {
            eraseSize = size;
        }

        let timeout;
        if (this.IS_STUB) {
            timeout = DEFAULT_TIMEOUT;
        } else {
            timeout = this.timeoutPerMb(ERASE_REGION_TIMEOUT_PER_MB, size);
        }

        let stamp = Date.now();
        buffer = this.pack("<IIII", eraseSize, numBlocks, flashWriteSize, offset);

        if (this._chipfamily == ESP32S2) {
            buffer = buffer.concat(this.pack("<I", encrypted ? 1 : 0));
        }

        logMsg(`Erase size ${eraseSize}, blocks ${numBlocks}, block \
            size ${flashWriteSize}, offset ${toHex(offset, 4)}, encrypted ${encrypted ? "yes" : "no"}`);

        await this.checkCommand(ESP_FLASH_BEGIN, buffer, 0, timeout);

        if (size != 0 && !this.IS_STUB) {
            logMsg(`Took ${Date.now() - stamp}ms to erase ${numBlocks} bytes`);
        }

        return numBlocks;
    }

    async flashFinish() {
        let buffer = this.pack('<I', 1);
        await this.checkCommand(ESP_FLASH_END, buffer);
    }

    /**
     * @name getEraseSize
     * Calculate an erase size given a specific size in bytes.
     *   Provides a workaround for the bootloader erase bug on ESP8266.
     */
    getEraseSize(offset, size) {
        let sectorsPerBlock = 16;
        let sectorSize = FLASH_SECTOR_SIZE;
        let numSectors = Math.floor((size + sectorSize - 1) / sectorSize);
        let startSector = Math.floor(offset / sectorSize);

        let headSectors = sectorsPerBlock - (startSector % sectorsPerBlock);
        if (numSectors < headSectors) {
            headSectors = numSectors;
        }

        if (numSectors < 2 * headSectors) {
            return Math.floor((numSectors + 1) / 2 * sectorSize);
        }

        return (numSectors - headSectors) * sectorSize;
    }

    /**
   * @name memBegin (592)
   * Start downloading an application image to RAM
   */
    async memBegin(size, blocks, blocksize, offset) {
        if (this.IS_STUB) {
            let stub = await this.getStubCode();
            let load_start = offset;
            let load_end = offset + size;

            for (let [start, end] of [
                [stub.data_start, stub.data_start + stub.data.length],
                [stub.text_start, stub.text_start + stub.text.length]]
            ) {
                if (load_start < end && load_end > start) {
                    throw (`Software loader is resident at ${toHex(start, 8)}-${toHex(end, 8)}. \
                        Can't load binary at overlapping address range ${toHex(load_start, 8)}-${toHex(load_end, 8)}. \
                        Try changing the binary loading address.`);
                }
            }
        }

        return this.checkCommand(ESP_MEM_BEGIN, this.pack('<IIII', size, blocks, blocksize, offset));
    }

    /**
     * @name memBlock (609)
     * Send a block of an image to RAM
     */
    async memBlock(data, seq) {
        return await this.checkCommand(
            ESP_MEM_DATA,
            this.pack('<IIII', data.length, seq, 0, 0).concat(data),
            this.checksum(data)
        );
    }

    /**
     * @name memFinish (615)
     * Leave download mode and run the application
     *
     * Sending ESP_MEM_END usually sends a correct response back, however sometimes
     * (with ROM loader) the executed code may reset the UART or change the baud rate
     * before the transmit FIFO is empty. So in these cases we set a short timeout and
     * ignore errors.
     */
    async memFinish(entrypoint = 0) {
        let timeout = this.IS_STUB ? DEFAULT_TIMEOUT : MEM_END_ROM_TIMEOUT;
        let data = this.pack('<II', parseInt(entrypoint == 0), entrypoint);
        try {
            return await this.checkCommand(ESP_MEM_END, data, 0, timeout);
        } catch (e) {
            if (this.IS_STUB) {
                throw (`ESP mem finish error ${e}`);
            }
            return [null, null];
        }
    }

    async getStubCode() {
        //let response = await fetch('stubs/' + this.getStubFile() + '.json');
        //let stubcode = await response.json();
        let stubcode = { "text": "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", "text_start": 1074520064, "entry": 1074521516, "data": "CMD8Pw==", "data_start": 1073605544 };
        // Base64 decode the text and data
        stubcode.text = toByteArray(atob(stubcode.text));
        stubcode.data = toByteArray(atob(stubcode.data));
        return stubcode;
    }

    getStubFile() {
        if (this._chipfamily == ESP32) {
            return "esp32";
        } else if (this._chipfamily == ESP32S2) {
            return "esp32s2";
        } else if (this._chipfamily == ESP8266) {
            return "esp8266";
        }
    }

    // ESPTool Line 706
    async runStub(stub = null) {
        if (stub === null) {
            stub = await this.getStubCode();
        }

        // We're transferring over USB, right?
        let ramBlock = USB_RAM_BLOCK;

        // Upload
        logMsg("Uploading stub...")
        for (let field of ['text', 'data']) {
            if (Object.keys(stub).includes(field)) {
                let offset = stub[`${field}_start`];
                let length = stub[field].length;
                let blocks = Math.floor((length + ramBlock - 1) / ramBlock);
                await this.memBegin(length, blocks, ramBlock, offset);
                for (let seq of Array(blocks).keys()) {
                    let fromOffs = seq * ramBlock;
                    let toOffs = fromOffs + ramBlock;
                    if (toOffs > length) {
                        toOffs = length;
                    }
                    await this.memBlock(stub[field].slice(fromOffs, toOffs), seq);
                }
            }
        }
        debugMsg("Running stub...")
        await this.memFinish(stub['entry']);

        let p = await this.readBuffer(100);
        p = String.fromCharCode(...p);

        if (p != 'OHAI') {
            throw `Failed to start stub. Unexpected response: ${p}`;
        }
        successMsg("Stub is now running successfully");
        return new EspStubLoader(this._serialport);
    }
}

class EspStubLoader extends EspLoader {
    /*
      The Stubloader has commands that run on the uploaded Stub Code in RAM
      rather than built in commands.
    */
    constructor(serialport) {
        super(serialport);
        this.IS_STUB = true;
    }

    /**
     * @name eraseFlash
     * Depending on flash chip model the erase may take quite long
     */
    async eraseFlash() {
        await this.checkCommand(ESP_ERASE_FLASH, [], 0, CHIP_ERASE_TIMEOUT);
    }
}
