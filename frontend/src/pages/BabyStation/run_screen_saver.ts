const update_interval = 2 * 60 * 1000; // 30 seconds
const text_color = '#505050';
const text_font = '30px Arial';
const text_width = 200;
const text_height = 24;
const text_margin_x = 30;
const text_margin_y = 15;

const run_screen_saver = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const render = () => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = text_color;
        ctx.font = text_font;
        const x = Math.random() * (canvas.width - 2 * text_margin_x - text_width) + text_margin_x;
        const y = (Math.random() * (canvas.height - 2 * text_margin_y - text_height)) + text_margin_y + text_height;
        ctx.fillText('BeddyBytes', x, y);
    }
    render();

    let stop = false;
    let last_update = Date.now();
    const update = () => {
        if (stop) return;
        requestAnimationFrame(update);
        const now = Date.now();
        if (now - last_update < update_interval) return;
        last_update = now;
        render();
    };
    update();

    const stream = canvas.captureStream();
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();
    document.body.appendChild(video);

    const stop_screen_saver = () => {
        if (stop) return;
        stop = true;
        video.pause();
        document.body.removeChild(video);
        canvas.remove();
        video.remove();
    }

    try {
        await video.requestFullscreen();
        video.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement)
                stop_screen_saver();
        });
        video.addEventListener('click', () => {
            document.exitFullscreen();
            stop_screen_saver();
        });
    } catch (e) {
        stop_screen_saver();
    }
}

export default run_screen_saver;