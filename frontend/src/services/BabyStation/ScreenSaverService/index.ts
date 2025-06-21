import LoggingService, { Severity } from "../../LoggingService";
import Service, { SetStateFunction } from "../../Service";
import CanvasAnimation from "./CanvasAnimation";

import './style.scss';

interface ServiceProxy {
    logging_service: LoggingService;
    get_state: () => ScreenSaverState;
    set_state: SetStateFunction<ScreenSaverState>;
}

abstract class AbstractState {
    abstract readonly name: string;
    abstract start(service: ServiceProxy): void;
    abstract handle_click(service: ServiceProxy, event: MouseEvent): void;
    abstract handle_request_fullscreen_resolved(service: ServiceProxy): void;
    abstract handle_request_fullscreen_rejected(service: ServiceProxy): void;
    abstract handle_fullscreenchange(service: ServiceProxy): void;
}

class NotRunning extends AbstractState {
    readonly name = 'not_running';

    start = (service: ServiceProxy) => {
        const canvas_animation = new CanvasAnimation();
        document.body.appendChild(canvas_animation.canvas_element);
        canvas_animation.canvas_element.requestFullscreen()
            .then(() => service.get_state().handle_request_fullscreen_resolved(service))
            .catch(() => service.get_state().handle_request_fullscreen_rejected(service));
        service.set_state(new EnteringFullScreen(canvas_animation));
        canvas_animation.canvas_element.addEventListener('click', (event: MouseEvent) => {
            service.get_state().handle_click(service, event);
        });
    }

    handle_click = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_click called in NotRunning state',
        });
    }

    handle_request_fullscreen_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_request_fullscreen_resolved called in NotRunning state',
        });
    }

    handle_request_fullscreen_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'ScreenSaverService::handle_request_fullscreen_rejected called in NotRunning state',
        });
    }

    handle_fullscreenchange = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_fullscreenchange called in NotRunning state',
        });
    }
}

class EnteringFullScreen extends AbstractState {
    readonly name = 'entering_fullscreen';
    readonly canvas_animation: CanvasAnimation;

    constructor(canvas_animation: CanvasAnimation) {
        super();
        this.canvas_animation = canvas_animation;
    }

    start = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::start called in EnteringFullScreen state',
        });
    }

    handle_click = (service: ServiceProxy, event: MouseEvent) => {
        if (event.target !== this.canvas_animation.canvas_element) return;
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_click called in EnteringFullScreen state',
        });
    }

    handle_request_fullscreen_resolved = (service: ServiceProxy) => {
        service.set_state(new Running(this.canvas_animation));
    }

    handle_request_fullscreen_rejected = (service: ServiceProxy) => {
        service.set_state(new NotRunning());
    }

    handle_fullscreenchange = (service: ServiceProxy) => {
        if (document.fullscreenElement === this.canvas_animation.canvas_element) return;
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'ScreenSaverService::handle_fullscreenchange called in EnteringFullScreen state',
        });
    }
}

class Running extends AbstractState {
    readonly name = 'running';
    readonly canvas_animation: CanvasAnimation;

    constructor(canvas_animation: CanvasAnimation) {
        super();
        this.canvas_animation = canvas_animation;
    }

    start = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::start called in Running state',
        });
    }

    handle_click = (service: ServiceProxy, event: MouseEvent) => {
        if (event.target !== this.canvas_animation.canvas_element) return;
        service.set_state(new ExitingFullScreen(this.canvas_animation));
        document.exitFullscreen()
            .catch(() => service.get_state().handle_request_fullscreen_rejected(service));
    }

    handle_request_fullscreen_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_request_fullscreen_resolved called in Running state',
        });
    }

    handle_request_fullscreen_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Warning,
            message: 'ScreenSaverService::handle_request_fullscreen_rejected called in Running state',
        });
    }

    handle_fullscreenchange = (service: ServiceProxy) => {
        if (document.fullscreenElement === this.canvas_animation.canvas_element) return;
        service.set_state(new NotRunning());
        document.body.removeChild(this.canvas_animation.canvas_element);
    }
}

class ExitingFullScreen extends AbstractState {
    readonly name = 'exiting_fullscreen';
    readonly canvas_animation: CanvasAnimation;

    constructor(canvas_animation: CanvasAnimation) {
        super();
        this.canvas_animation = canvas_animation;
    }

    start = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::start called in ExitingFullScreen state',
        });
    }

    handle_click = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'ScreenSaverService::handle_click called in ExitingFullScreen state',
        });
    }

    handle_request_fullscreen_resolved = (service: ServiceProxy) => {
        // Should not be called in ExitingFullScreen
        throw new Error('ScreenSaverService::handle_request_fullscreen_resolved called in ExitingFullScreen state');
    }

    handle_request_fullscreen_rejected = (service: ServiceProxy) => {
        // Should not be called in ExitingFullScreen
        throw new Error('ScreenSaverService::handle_request_fullscreen_rejected called in ExitingFullScreen state');
    }

    handle_fullscreenchange = (service: ServiceProxy) => {
        if (document.fullscreenElement === this.canvas_animation.canvas_element) return;
        service.set_state(new NotRunning());
        document.body.removeChild(this.canvas_animation.canvas_element);
    }
}

namespace Fallback {
    export class NotRunning extends AbstractState {
        readonly name = 'not_running';

        start = (service: ServiceProxy) => {
            const canvas_animation = new CanvasAnimation();
            const container_element = document.createElement('div');
            container_element.classList.add('screen-saver');
            const media_stream = canvas_animation.canvas_element.captureStream();
            const video_element = document.createElement('video');
            video_element.autoplay = true;
            video_element.playsInline = true;
            video_element.width = canvas_animation.canvas_element.width;
            video_element.height = canvas_animation.canvas_element.height;
            video_element.srcObject = media_stream;
            container_element.appendChild(video_element);
            container_element.appendChild(canvas_animation.canvas_element);
            document.body.appendChild(container_element);
            container_element.addEventListener('click', (event: MouseEvent) => {
                service.get_state().handle_click(service, event);
            });
            service.set_state(new Running(container_element));
        }

        handle_click = (service: ServiceProxy, event: MouseEvent) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::handle_click called in Fallback NotRunning state',
            });
        }

        handle_request_fullscreen_resolved = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::handle_request_fullscreen_resolved called in Fallback NotRunning state',
            });
        }

        handle_request_fullscreen_rejected = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Warning,
                message: 'ScreenSaverService::handle_request_fullscreen_rejected called in Fallback NotRunning state',
            });
        }

        handle_fullscreenchange = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::handle_fullscreenchange called in Fallback NotRunning state',
            });
        }
    }

    export class Running extends AbstractState {
        readonly name = 'running';
        readonly container_element: HTMLDivElement;

        constructor(container_element: HTMLDivElement) {
            super();
            this.container_element = container_element;
        }

        start = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::start called in Fallback Running state',
            });
        }

        handle_click = (service: ServiceProxy, event: MouseEvent) => {
            if (!(event.target instanceof HTMLElement)) return;
            if (!is_decendant(this.container_element, event.target)) return;
            service.set_state(new Fallback.NotRunning());
            document.body.removeChild(this.container_element);
        }

        handle_request_fullscreen_resolved = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::handle_request_fullscreen_resolved called in Fallback Running state',
            });
        }

        handle_request_fullscreen_rejected = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Warning,
                message: 'ScreenSaverService::handle_request_fullscreen_rejected called in Fallback Running state',
            });
        }

        handle_fullscreenchange = (service: ServiceProxy) => {
            service.logging_service.log({
                severity: Severity.Notice,
                message: 'ScreenSaverService::handle_fullscreenchange called in Fallback Running state',
            });
        }
    }
}

type ScreenSaverState = NotRunning | EnteringFullScreen | Running | ExitingFullScreen |
    Fallback.NotRunning | Fallback.Running;

interface NewScreenSaverServiceInput {
    logging_service: LoggingService;
}

class ScreenSaverService extends Service<ScreenSaverState> {
    protected readonly name = 'ScreenSaverService';
    private readonly proxy: ServiceProxy;

    constructor(input: NewScreenSaverServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: ScreenSaverService.get_initial_state(),
        });
        this.proxy = {
            logging_service: input.logging_service,
            get_state: this.get_state,
            set_state: this.set_state,
        };
        document.addEventListener('fullscreenchange', this.handle_fullscreenchange);
    }

    protected to_string = (state: ScreenSaverState): string => {
        return state.name;
    }

    public start = () => {
        this.get_state().start(this.proxy);
    }

    private handle_fullscreenchange = () => {
        this.get_state().handle_fullscreenchange(this.proxy);
    }

    private static get_initial_state = (): ScreenSaverState => {
        const available = 'requestFullscreen' in HTMLCanvasElement.prototype;
        if (!available) return new Fallback.NotRunning();
        return new NotRunning();
    }
}

export default ScreenSaverService;

const is_decendant = (element: HTMLElement, target: HTMLElement): boolean => {
    if (element === target) return true;
    if (target.parentElement === null) return false;
    return is_decendant(element, target.parentElement);
};