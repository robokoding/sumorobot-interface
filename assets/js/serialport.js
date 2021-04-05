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
        this._inputStream = null;
        this._outputStream = null;
    }

    /**
     * @name connect
     * Opens a Web Serial connection to a micro:bit and sets up the input and
     * output stream.
     */
    async connect() {
        // Opens a port selector for the user.
        this._port = await navigator.serial.requestPort({ filters });

        logMsg("Opening serialport...");
        await this._port.open({ baudRate: ESP_ROM_BAUD });
        await this.reset();

        this._outputStream = this._port.writable;
        this._inputStream = this._port.readable;
    }

    /**
     * @name disconnect
     * Closes the Web Serial connection.
     */
    async disconnect() {
        if (this._reader) {
            await this._reader.cancel();
            this._reader = null;
        }

        if (this._outputStream) {
            await this._outputStream.getWriter().close();
            this._outputStream = null;
        }

        if (this._port) {
            await this._port.close();
            this._port = null;
        }
    }

    /**
     * @name reset
     * Reset the device connected to the Web Serial.
     */
    async reset() {
        logMsg("Resetting serial device...");
        const signals = await this._port.getSignals();
        await this._port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await this._port.setSignals({ dataTerminalReady: true, requestToSend: false });
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    changeBaudrate(baud) {
        this._port.baudrate = baud;
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
        while (true) {
            const { value, done } = await this._reader.read();
            if (done) {
                this._reader.releaseLock();
                break;
            }
            this._inputBuffer = this._inputBuffer.concat(Array.from(value));
        }
    }
}
