'use strict';

const filters = [
    { usbVendorId: 0x1a86, usbProductId: 0x7523 },
    { usbVendorId: 0x10c4, usbProductId: 0xea60 }
];

class Serialport {
    constructor() {
        this._port = null;
        this._reader = null;
        this._inputBuffer = [];
        this._outputStream = null;
    }

    /**
     * @name connect
     * Opens a Web Serial connection and sets up the input and output stream.
     */
    async connect(baud = 115200) {
        if (this._port == null)
            // Opens a port selector for the user.
            this._port = await navigator.serial.requestPort({ filters });

        debugMsg("Opening serialport");
        await this._port.open({ baudRate: baud, flowControl: "hardware" });

        this._outputStream = this._port.writable;
    }

    /**
     * @name disconnect
     * Closes the Web Serial connection.
     */
    async disconnect() {
        // Cancel input stream, cancels readloop
        if (this._reader) {
            await this._reader.cancel();
        }
        // Close output stream
        if (this._outputStream) {
            await this._outputStream.getWriter().close();
        }
        // Close serialport
        if (this._port) {
            await this._port.close();
        }
    }

    /**
     * @name reset
     * Reset the device connected to the Web Serial.
     */
    async bootloaderReset() {
        debugMsg("Entering bootloader, restting");
        const signals = await this._port.getSignals();
        await this._port.setSignals({ dataTerminalReady: false, requestToSend: true }); // IO0->HIGH, EN->LOW
        await new Promise(resolve => setTimeout(resolve, 100));
        await this._port.setSignals({ dataTerminalReady: true, requestToSend: false }); // IO0->LOW, EN->HIGH
        await new Promise(resolve => setTimeout(resolve, 100));
        await this._port.setSignals({ dataTerminalReady: false, requestToSend: false }); // IO0->HIGH, EN->HIGH
    }

    async hardReset() {
        debugMsg("Hard resetting");
        await this._port.setSignals({ dataTerminalReady: false, requestToSend: true }); // IO0->HIGH, EN->LOW
        await new Promise(resolve => setTimeout(resolve, 100));
        await this._port.setSignals({ dataTerminalReady: false, requestToSend: false }); // IO0->HIGH, EN->HIGH
    }

    /**
     * @name writeToStream
     * Gets a writer from the output stream and send the raw data over WebSerial.
     */
    async writeToStream(data) {
        const writer = this._outputStream.getWriter();
        await writer.write(new Uint8Array(data));
        writer.releaseLock();
    }

    /**
     * @name getInputBuffer
     * Returns the serialport read buffer
     */
    getInputBuffer() {
        return this._inputBuffer;
    }

    /**
     * @name getInputBufferByte
     * Returns and removed the serialport read buffer first byte, return 
     * undefined if buffer is empty.
     */
    getInputBufferByte() {
        return this._inputBuffer.shift();
    }

    /**
     * @name getInputBufferLength
     * Returns the serialport read buffer.
     */
    getInputBufferLength() {
        return this._inputBuffer.length;
    }

    /**
     * @name clearInputBuffer
     * Clears the serialport read buffer.
     */
    clearInputBuffer() {
        this._inputBuffer = [];
    }

    /**
     * @name readLoop
     * Reads data from the input stream and places it in the inputBuffer.
     */
    async readLoop() {
        this._reader = this._port.readable.getReader();

        try {
            while (true) {
                const { value, done } = await this._reader.read();
                if (done)
                    // |reader| has been canceled.
                    break;
                this._inputBuffer = this._inputBuffer.concat(Array.from(value));
            }
        } catch (error) {
            throw new Exception("Error while reading serial stream: " + error);
        } finally {
            this._reader.releaseLock();
            this._reader = null;
        }
    }
}
