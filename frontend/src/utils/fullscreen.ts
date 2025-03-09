

interface HTMLElementX extends HTMLElement {
    mozRequestFullScreen?(): void;
    webkitRequestFullscreen?(): void;
    msRequestFullscreen?(): void;
}

export const request_fullscreen = (element: HTMLElement) => {
    const element_x = element as HTMLElementX;
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element_x.mozRequestFullScreen) { /* Firefox */
        element_x.mozRequestFullScreen();
    } else if (element_x.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        element_x.webkitRequestFullscreen();
    } else if (element_x.msRequestFullscreen) { /* IE/Edge */
        element_x.msRequestFullscreen();
    }
}

interface DocumentX extends Document {
    mozCancelFullScreen?(): void;
    webkitExitFullscreen?(): void;
    msExitFullscreen?(): void;
}

export const exit_fullscreen = (document: Document) => {
    const document_x = document as DocumentX;
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document_x.mozCancelFullScreen) { /* Firefox */
        document_x.mozCancelFullScreen();
    } else if (document_x.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document_x.webkitExitFullscreen();
    } else if (document_x.msExitFullscreen) { /* IE/Edge */
        document_x.msExitFullscreen();
    }
}