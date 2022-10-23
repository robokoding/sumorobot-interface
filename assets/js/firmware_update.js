import { Transport } from './esp/webserial.js'
import { ESPLoader } from './esp/ESPLoader.js'
import { ESPError } from './esp/error.js'


const debug = false;
const maxLogLength = 100;

const filters = [
    { usbVendorId: 0x1a86, usbProductId: 0x7523 },
    { usbVendorId: 0x10c4, usbProductId: 0xea60 }
];


class FirmwareUpdate {

    constructor(view) {
        // UI Fields
        this.view = view
        this.baudrateSelect = null;
        this.updateButton = null;

        // ESPLoader
        this.esploader = null;
        this.device = null;
        this.term = null;
    }

    firmwareUpdateInit() {
        // Update SumoFirmware version in SumoFirmware panel
        this.view.setFirmwareVersion(null);

        let that = this;
        // SumoFirmware panel update button
        $('#btn-firmware-update').click(function() {
            that.clickUpdate();
        });

        // SumoFirmware panel cancel button
        $('#btn-firmware-cancel').click(function() {
            $('#notification-panel').hide();
        });

        this.cancelButton = document.getElementById('btn-firmware-cancel');
        this.updateButton = document.getElementById('btn-firmware-update');
        this.baudrateSelect = document.getElementById('firmware-baudrates');
        this.progBar = document.getElementById('progress-bar-firmware');
        this.progVal = document.getElementById('progress-val-firmware');
    }

    // Convert file into a arraybuffer
    async readUploadedFileAsArrayBuffer(inputFile) {
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.onerror = () => {
                reader.abort();
                reject(new DOMException("Problem parsing input file."));
            };

            reader.onload = () => {
                resolve(reader.result);
            };
            reader.readAsBinaryString(inputFile);
        });
    }

    // Read file from url
    async getFileFromUrl(url, name) {
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
    async clickUpdate() {
        this.toggleUIUpdating(true);

        this.device = await navigator.serial.requestPort({ filters });
        this.transport = new Transport(this.device);
        this.esploader = new ESPLoader(this.transport, this.baudrateSelect.value);

        try {
            let chip = await this.esploader.main_fn();
            const url = 'https://sumo.robokoding.com/assets/binary/sumofirmware.bin';
            let file = await this.getFileFromUrl(url, 'sumorobot.bin')
            let contents = await this.readUploadedFileAsArrayBuffer(file);
            const fileArray = [{data:contents, address:0x1000}];

            let progBar = this.progBar;
            let progVal = this.progVal;

            await this.esploader.write_flash({
                fileArray,
                flash_size: 'keep',
                reportProgress(fileIndex, written, total) {
                    let curVal = written / total * 100;

                    // Show 100 a bit later, as flash verify is still performed after write is done
                    if (curVal != 100) {
                        progBar.value = curVal;
                        progVal.innerHTML = parseInt(written / total * 100) + "%";
                    }
                },
                calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
            });

            await this.esploader.hard_reset();

            progBar.value = 100;
            progVal.innerHTML = "100%";

        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            await this.device.close();
            this.toggleUIUpdating(false);
        }
    }

    toggleUIUpdating(updating) {
        if (updating) {
            this.baudrateSelect.disabled = true;
            this.updateButton.disabled = true;
            this.cancelButton.disabled = true;
        } else {
            this.baudrateSelect.disabled = false;
            this.updateButton.disabled = false;
            this.cancelButton.disabled = false;
        }
    }

}

export { FirmwareUpdate };