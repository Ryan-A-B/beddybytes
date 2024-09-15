import DefaultScreenSaver from "./DefaultScreenSaver";
import FallbackScreenSaver from "./FallbackScreenSaver";

const run_screen_saver = (() => {
    if (DefaultScreenSaver.can_i_use()) return DefaultScreenSaver;
    if (FallbackScreenSaver.can_i_use()) return FallbackScreenSaver;
    throw new Error('No screen saver available');
})();

export default run_screen_saver;