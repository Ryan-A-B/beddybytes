import * as React from "react";
import ViewportService, { Viewport, ViewportChangedEvent } from "../pages/BabyStation/ZoomControls/ViewportService"

const useViewport = (viewport_service: ViewportService) => {
    const [viewport, setViewport] = React.useState<Viewport>(viewport_service.get_viewport());
    React.useEffect(() => {
        const handle_viewport_changed = (event: ViewportChangedEvent) => {
            setViewport(event.viewport);
        };
        viewport_service.addEventListener("viewport_changed", handle_viewport_changed);
        return () => {
            viewport_service.removeEventListener("viewport_changed", handle_viewport_changed);
        };
    }, [viewport_service]);
    return viewport;
};

export default useViewport;