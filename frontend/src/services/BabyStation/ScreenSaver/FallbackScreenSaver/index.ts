import CanvasAnimation from "../CanvasAnimation";
import "./style.scss";

const run_screen_saver = async (): Promise<void> => {
    const canvas_animation = new CanvasAnimation();
    const canvas_element = canvas_animation.canvas_element;

    const container_element = document.createElement('div');
    container_element.classList.add('screen-saver');
    const media_stream = canvas_element.captureStream();
    const video_element = document.createElement('video');
    video_element.autoplay = true;
    video_element.playsInline = true;
    video_element.width = canvas_element.width;
    video_element.height = canvas_element.height;
    video_element.srcObject = media_stream;
    container_element.appendChild(video_element);
    container_element.appendChild(canvas_element);
    document.body.appendChild(container_element);

    const stop = () => {
        document.body.removeChild(container_element);
    }

    container_element.addEventListener('click', stop, { once: true });
}

run_screen_saver.can_i_use = (): boolean => {
    return true;
}

export default run_screen_saver;
