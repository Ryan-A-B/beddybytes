const update_interval = 2 * 60 * 1000;
const text_color = '#505050';
const text_font = '30px Arial';
const text_width = 200;
const text_height = 24;
const text_margin_x = 30;
const text_margin_y = 15;

class CanvasAnimation {
    readonly canvas_element: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private last_render = 0;
    private should_continue = true;

    constructor() {
        this.canvas_element = document.createElement('canvas');
        this.canvas_element.width = window.innerWidth;
        this.canvas_element.height = window.innerHeight;
        const ctx = this.canvas_element.getContext('2d');
        if (!ctx) throw new Error('Failed to get 2d context');
        this.ctx = ctx;
        this.update();
    }

    public stop(): void {
        this.should_continue = false;
    }

    private render(): void {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas_element.width, this.canvas_element.height);
        this.ctx.fillStyle = text_color;
        this.ctx.font = text_font;
        const x = Math.random() * (this.canvas_element.width - 2 * text_margin_x - text_width) + text_margin_x;
        const y = (Math.random() * (this.canvas_element.height - 2 * text_margin_y - text_height)) + text_margin_y + text_height;
        this.ctx.fillText('BeddyBytes', x, y);
        this.last_render = Date.now();
    }

    private update(): void {
        if (this.should_continue === false) return;
        requestAnimationFrame(this.update.bind(this));
        const now = Date.now();
        if (now - this.last_render < update_interval) return;
        this.render();
    }
}

export default CanvasAnimation;
