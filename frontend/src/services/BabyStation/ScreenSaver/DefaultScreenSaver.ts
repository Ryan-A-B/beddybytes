import CanvasAnimation from "./CanvasAnimation";

const run_screen_saver = async (): Promise<void> => {
    const canvas_animation = new CanvasAnimation();
    const canvas_element = canvas_animation.canvas_element;

    document.body.appendChild(canvas_element);
    await canvas_element.requestFullscreen();
    const wake_lock_sentinel = await navigator.wakeLock.request('screen');

    const exit_fullscreen = async () => {
        await document.exitFullscreen();
    }

    const handle_fullscreen_change = async (event: Event) => {
        if (document.fullscreenElement === canvas_element) return;
        document.body.removeChild(canvas_element);
        await wake_lock_sentinel.release();
        document.removeEventListener('fullscreenchange', handle_fullscreen_change);
    }

    document.addEventListener('fullscreenchange', handle_fullscreen_change);
    canvas_element.addEventListener('click', exit_fullscreen, { once: true });
}

run_screen_saver.can_i_use = (): boolean => {
    const wait_lock_supported = 'wakeLock' in navigator;
    if (!wait_lock_supported) return false;
    const fullscreen_supported = 'requestFullscreen' in HTMLCanvasElement.prototype;
    if (!fullscreen_supported) return false;
    return true;
}

export default run_screen_saver;
