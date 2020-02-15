
// DOM elements
const statusElement = document.getElementById('status');
const output = document.getElementById('output');
const canvas = document.getElementById('canvas');
const code = document.getElementById('code');

// Getting Audio Context
var audioContext;

window.addEventListener('load', init, false);
function init() {

    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    }
    catch (e) {
        console.log("AudioContext not supported on this Browser.")
    }
}

//detecting keyboard layout...

//define valid layouts (this can be gotten by running the emulator with -keymap)
const layouts = [
    'en-us',
    'en-gb',
    'de',
    'nordic',
    'it',
    'pl',
    'hu',
    'es',
    'fr',
    'de-ch',
    'fr-be',
    'pt-br'
];

lang = getFirstBrowserLanguage().toLowerCase().trim();

if (layouts.includes(lang)) {
    logOutput('Using keyboard map: ' + lang);
} else {
    logOutput('Language (' + lang + ') not found in keymaps so using keyboard map: en-us');
    lang = 'en-us';
}

var url = new URL(window.location.href);
var manifest_link = url.searchParams.get("manifest");

var emuArguments = ['-keymap', lang];

if (manifest_link) {
    openFs();
}

var Module = {
    preRun: [
        function () { //Set the keyboard handling element (it's document by default). Keystrokes are stopped from propagating by emscripten, maybe there's an option to disable this?
            ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = "#canvas";
        },
        function () {
            if (manifest_link) {
                addRunDependency('load-manifest');
                fetch(manifest_link + 'manifest.json').then(function (response) {
                    return response.json();
                }).then(function (manifest) {
                    if (manifest.start_prg) {
                        emuArguments.push('-prg', manifest.start_prg, '-run');
                    }

                    console.log(manifest);
                    manifest.resources.forEach(element => {
                        element = manifest_link + element;
                        let filename = element.replace(/^.*[\\\/]/, '')
                        FS.createPreloadedFile('/', filename, element, true, true);

                    });
                    removeRunDependency('load-manifest');
                }).catch(function () {
                    console.log("Unable to read manifest. Check the manifest http parameter");
                });
            }
        }
    ],
    postRun: [
        function () {
            canvas.focus();
        }
    ],
    arguments: emuArguments,
    print: (function () {

        if (output) output.value = ''; // clear browser cache
        return function (text) {
            if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
            logOutput(text);
        };
    })(),
    printErr: function (text) {
        if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');

        logOutput("[error] " + text);


    },
    canvas: (function () {

        // As a default initial behavior, pop up an alert when webgl context is lost. To make your
        // application robust, you may want to override this behavior before shipping!
        // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
        canvas.addEventListener("webglcontextlost", function (e) {
            alert('WebGL context lost. You will need to reload the page.');
            e.preventDefault();
        }, false);
        return canvas;
    })(),
    setStatus: function (text) {
        statusElement.innerHTML = '';
        logOutput(text);
    },
    totalDependencies: 0,
    monitorRunDependencies: function (left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
        Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
    }
};

Module.setStatus('Downloading file...');
logOutput('Downloading file...');

window.onerror = function () {
    Module.setStatus('Exception thrown, see JavaScript console');
    Module.setStatus = function (text) {
        if (text) Module.printErr('[post-exception status] ' + text);
    };
};



function enableAudio(enable) {
    if (enable === true) {
        if (audioContext && audioContext.state != "running") {
            audioContext.resume().then(() => {
                console.log("Resumed Audio.")
                Module.ccall("j2c_start_audio", "void", ["void"], []);
            });
        }
    }
}

function resetEmulator() {
    j2c_reset = Module.cwrap("j2c_reset", "void", []);
    j2c_reset();
    canvas.focus();
}

function runCode() {
    enableAudio(true);
    Module.ccall("j2c_paste", "void", ["string"], ['\nNEW\n' + code.value + '\nRUN\n']);
    canvas.focus();

}

function closeFs() {
    canvas.parentElement.classList.remove("fullscreen");
    canvas.focus();
}

function openFs() {
    canvas.parentElement.classList.add("fullscreen");
    canvas.focus();
}

function logOutput(text) {
    if (output) {
        output.innerHTML += text + "\n";
        output.parentElement.scrollTop = output.parentElement.scrollHeight; // focus on bottom
    }
    console.log(text);
}


function getFirstBrowserLanguage() {
    const nav = window.navigator,
        browserLanguagePropertyKeys = ['language', 'browserLanguage', 'systemLanguage', 'userLanguage'];
    let i,
        language;

    // support for HTML 5.1 "navigator.languages"
    if (Array.isArray(nav.languages)) {
        for (i = 0; i < nav.languages.length; i++) {
            language = nav.languages[i];
            if (language && language.length) {
                return language;
            }
        }
    }

    // support for other well known properties in browsers
    for (i = 0; i < browserLanguagePropertyKeys.length; i++) {
        language = nav[browserLanguagePropertyKeys[i]];
        if (language && language.length) {
            return language;
        }
    }

    return null;
}
