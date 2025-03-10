

interface HTMLElementX extends HTMLElement {
    mozRequestFullScreen?(): void;
    webkitRequestFullscreen?(): void;
    webkitEnterFullscreen?(): void;
    msRequestFullscreen?(): void;
}

export const request_fullscreen = (element: HTMLElement) => {
    const element_x = element as HTMLElementX;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element_x.mozRequestFullScreen) { /* Firefox */
        element_x.mozRequestFullScreen();
    } else if (element_x.webkitRequestFullscreen) { /* Chrome and Opera */
        element_x.webkitRequestFullscreen();
    } else if (element_x.msRequestFullscreen) { /* IE/Edge */
        element_x.msRequestFullscreen();
    } else if (element_x.webkitEnterFullscreen) { /* Safari */
        element_x.webkitEnterFullscreen();
    }
}

interface DocumentX extends Document {
    webkitFullscreenElement?: Element;
    webkitCurrentFullScreenElement?: Element;
    webkitIsFullScreen?: boolean;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;

    mozCancelFullScreen?(): void;
    webkitExitFullscreen?(): void;
    webkitCancelFullScreen?(): void;
    msExitFullscreen?(): void;
}

export const exit_fullscreen = (document: Document) => {
    const document_x = document as DocumentX;
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document_x.mozCancelFullScreen) { /* Firefox */
        document_x.mozCancelFullScreen();
    } else if (document_x.webkitExitFullscreen) { /* Chrome and Opera */
        document_x.webkitExitFullscreen();
    } else if (document_x.webkitCancelFullScreen) { /* Safari */
        document_x.webkitCancelFullScreen();
    } else if (document_x.msExitFullscreen) { /* IE/Edge */
        document_x.msExitFullscreen();
    }
}

export const is_fullscreen = (): boolean => {
    const document_x = document as DocumentX;
    if (document_x.fullscreenElement) return true;
    if (document_x.webkitFullscreenElement) return true;
    if (document_x.webkitCurrentFullScreenElement) return true;
    if (document_x.webkitIsFullScreen) return true;
    if (document_x.mozFullScreenElement) return true;
    if (document_x.msFullscreenElement) return true;
    return false;
}

export const add_fullscreen_change_listener = (video_element: HTMLVideoElement, callback: () => void) => {
    document.addEventListener('fullscreenchange', callback);
    document.addEventListener('webkitfullscreenchange', callback, false);
    document.addEventListener('mozfullscreenchange', callback);
    document.addEventListener('MSFullscreenChange', callback);
    video_element.addEventListener('webkitbeginfullscreen', callback);
    video_element.addEventListener('webkitendfullscreen', callback);
}

export const remove_fullscreen_change_listener = (video_element: HTMLVideoElement, callback: () => void) => {
    document.removeEventListener('fullscreenchange', callback);
    document.removeEventListener('webkitfullscreenchange', callback);
    document.removeEventListener('mozfullscreenchange', callback);
    document.removeEventListener('MSFullscreenChange', callback);
    video_element.removeEventListener('webkitbeginfullscreen', callback);
    video_element.removeEventListener('webkitendfullscreen', callback);
}