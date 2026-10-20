// Where the title screen (title.js) and the world (main.js) meet. The world loads behind the
// title and waits there: it begins once thou hast set out (`setOut`, the title's one button) and
// it's ready (`markReady`, main.js), whichever comes last.

let setOutNow;
let readyNow;
export const started = new Promise((resolve) => { setOutNow = resolve; });
export const ready = new Promise((resolve) => { readyNow = resolve; });
export const setOut = () => setOutNow();
export const markReady = () => readyNow();

// The tutorial asked for again (tutorial.js: at its end, or at the training yard's grace): the page
// is loaded afresh for it, and the title stands aside at once, the screen dark till the world's
// ready (title.js); asked for once, for that one load.
export const AGAIN = 'elden-code:tutorial-again';
export const again = (() => {
  try {
    const asked = sessionStorage.getItem(AGAIN) === '1';
    sessionStorage.removeItem(AGAIN);
    return asked;
  } catch {
    return false;
  }
})();
