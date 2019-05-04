// Function to get data from localStorage
function getLocalStorageItem(item) {
    // Try to get data from localStorage
    try {
        return localStorage.getItem(item);
    // Failed to access localStorage
    } catch(err) {
        // Return empty result
        return "";
    }
}

// Function to set data to local storage
function setLocalStorageItem(item, value) {
    // Try to save data to localStorage
    try {
        localStorage.setItem(item, value)
    // Failed to access localStorage
    } catch(err) {}
}
