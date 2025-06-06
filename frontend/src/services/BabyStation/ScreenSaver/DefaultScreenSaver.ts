import wake_lock_service from "../../instances/wake_lock_service";
import CanvasAnimation from "./CanvasAnimation";

const run_screen_saver = async (): Promise<void> => {
    const canvas_animation = new CanvasAnimation();
    const canvas_element = canvas_animation.canvas_element;

    document.body.appendChild(canvas_element);
    await canvas_element.requestFullscreen();
    wake_lock_service.lock();

    const exit_fullscreen = async () => {
        await document.exitFullscreen();
    }

    const handle_fullscreen_change = async (event: Event) => {
        if (document.fullscreenElement === canvas_element) return;
        document.body.removeChild(canvas_element);
        wake_lock_service.unlock();
        document.removeEventListener('fullscreenchange', handle_fullscreen_change);
    }

    document.addEventListener('fullscreenchange', handle_fullscreen_change);
    canvas_element.addEventListener('click', exit_fullscreen, { once: true });
}

run_screen_saver.can_i_use = (): boolean => {
    const wait_lock_supported = wake_lock_service.get_state().name !== 'unavailable';
    if (!wait_lock_supported) return false;
    const fullscreen_supported = 'requestFullscreen' in HTMLCanvasElement.prototype;
    if (!fullscreen_supported) return false;
    return true;
}

export default run_screen_saver;
