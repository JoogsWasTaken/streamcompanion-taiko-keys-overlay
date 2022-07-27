/**
 * Array of requested tokens.
 */
const tokens = ["status"];

/**
 * Mapping of token => taiko key.
 */
const tokenToTaikoKeyMap = new Map();

/**
 * Mapping of taiko key => last hit timestamp.
 */
const taikoKeyToTimestampMap = new Map();

/**
 * True if currently playing, false if not.
 */
let isPlaying = false;

/**
 * Taiko key layout.
 */
let taikoKeyLayout = [];

/**
 * Color for dons.
 */
let donColor = "";

/**
 * Color for kats.
 */
let katColor = "";

/**
 * Fade out duration in milliseconds.
 */
let fadeOutMillis = 300;

/**
 * Debug mode.
 */
let debug = false;

/**
 * Runs setup with the provided config. 
 * 
 * @param {object} config Config object sourced from "config.json" file
 */
const setup = (config) => {
    const keyConfig = config["keys"];

    for (const taikoKey of Object.keys(keyConfig)) {
        const t = `key-${keyConfig[taikoKey]}`.toLowerCase();
        tokens.push(t);
        tokenToTaikoKeyMap.set(t, taikoKey);
    }

    console.log("constructed mapping", tokenToTaikoKeyMap);

    // populate other fields
    taikoKeyLayout = config["layout"];
    donColor = config["colorDon"];
    katColor = config["colorKat"];
    fadeOutMillis = config["fadeOutMillis"];
    debug = config["debug"];
}

/**
 * Handles the "status" token.
 * 
 * @param {string} key "status" 
 * @param {number} value Numeric status
 */
const onStatus = (key, value) => {
    // update "isPlaying" if status changes.
    isPlaying = value == window.overlay.osuStatus.Playing;
}

/**
 * Handles any input token.
 * 
 * @param {string} key Key token 
 * @param {number} value Amount of times hit (not really important here)
 */
const onKey = (key, value) => {
    console.log("isPlaying", isPlaying, "debug", debug);

    // ignore inputs if not playing
    if (!isPlaying && !debug) {
        return;
    }
    
    const taikoKeyName = tokenToTaikoKeyMap.get(key);
    taikoKeyToTimestampMap.set(taikoKeyName, performance.now());
}

/**
 * Performs updates based on new token data.
 * 
 * @param {object} tokenData Object with new token data
 */
const update = (tokenData) => {
    execIfPresent(tokenData, "status", onStatus);

    for (const keyToken of tokenToTaikoKeyMap.keys()) {
        execIfPresent(tokenData, keyToken, onKey);
    }
}

/**
 * Renders a frame onto the canvas using the provided 2D rendering context.
 * 
 * @param {CanvasRenderingContext2D} ctx Rendering context 
 * @param {number} w Canvas width 
 * @param {number} h Canvas height 
 */
const render = (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    const l = taikoKeyLayout.length;
    const keyWidth = w / l;

    for (let i = 0; i < l; i++) {
        const taikoKey = taikoKeyLayout[i];
        const hitTime = taikoKeyToTimestampMap.get(taikoKey);

        // check if the key is set
        if (hitTime === undefined) {
            continue;
        }

        const delta = performance.now() - hitTime;

        // check if the key needs to be drawn
        if (delta > fadeOutMillis) {
            continue;
        }

        console.log("rendering", taikoKey);

        const x = keyWidth * i;
        const isDon = ["centerLeft", "centerRight"].includes(taikoKey);
        const alpha = Math.round(255 * (fadeOutMillis - delta) / fadeOutMillis);

        let color = isDon ? donColor : katColor;
        color += alpha.toString(16).padStart(2, "0");

        ctx.fillStyle = color;
        ctx.fillRect(x, 0, keyWidth, h);
    }
}

// /!\ DO NOT CHANGE ANYTHING PAST THIS POINT /!\
(async () => {
    // fetch config.json and pass it on to setup function
    setup(await (await fetch("config.json")).json());

    // create web socket
    const socket = new ReconnectingWebSocket(`${window.overlay.config.getWs()}/tokens`, null, {
        automaticOpen: false,
        reconnectInterval: 3000
    });
    
    // send query to listen to tokens once the socket is open
    socket.onopen = () => {
        console.log("socket is open, listening to changes to the following tokens", tokens);
        socket.send(JSON.stringify(tokens));
    }
    
    // handler for incoming messages
    socket.onmessage = (eventData) => {
        try {
            update(JSON.parse(eventData.data));
        } catch (err) {
            console.error("failed to process socket message", err)
        }
    }

    // create canvas and rendering context
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // null type guard
    if (ctx == null) {
        console.error("cannot create rendering context")
        return;
    }

    // add canvas to body
    document.body.insertBefore(canvas, document.body.firstChild);

    // handler for when the window is resized to make the canvas fit
    const updateCanvasSize = () => {
        canvas.width = document.body.offsetWidth;
        canvas.height = document.body.offsetHeight;
    }

    window.addEventListener("resize", updateCanvasSize);
    updateCanvasSize();

    // open socket
    socket.open();

    // start rendering loop
    const doLoop = () => {
        render(ctx, canvas.width, canvas.height);
        requestAnimationFrame(doLoop);
    }

    requestAnimationFrame(doLoop);
})().catch((err) => {
    console.error("error during initialization", err)
});