/**
 * Executes a function if a key is present on an object.
 * The function receives the key and value as callback parameters.
 * 
 * @param {object} data Data object
 * @param {object} key Key in data object
 * @param {Function} fn Callback function receiving key and value as parameters, if key is present
 */
const execIfPresent = (data, key, fn) => {
    const val = data[key];

    if (val !== undefined) {
        fn(key, val);
    }
}