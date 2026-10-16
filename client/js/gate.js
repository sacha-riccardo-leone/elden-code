// Where the title screen (title.js) and the world (main.js) meet. The world loads behind the
// title and waits there: it begins once thou hast set out (`setOut`, the title's one button) and
// it's ready (`markReady`, main.js), whichever comes last.

let setOutNow;
let readyNow;
export const started = new Promise((resolve) => { setOutNow = resolve; });
export const ready = new Promise((resolve) => { readyNow = resolve; });
export const setOut = () => setOutNow();
export const markReady = () => readyNow();
