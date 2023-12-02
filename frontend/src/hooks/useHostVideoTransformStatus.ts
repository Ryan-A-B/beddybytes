import React from "react";
import HostVideoTransformService, { EventTypeHostVideoTransformStatusChanged } from "../services/HostVideoTransformService";

const useHostVideoTransformStatus = (host_video_transform_service: HostVideoTransformService) => {
    const [status, setStatus] = React.useState(host_video_transform_service.get_status);
    React.useEffect(() => {
        const handle_status_change = () => {
            setStatus(host_video_transform_service.get_status());
        }
        host_video_transform_service.addEventListener(EventTypeHostVideoTransformStatusChanged, handle_status_change);
        return () => {
            host_video_transform_service.removeEventListener(EventTypeHostVideoTransformStatusChanged, handle_status_change);
        }
    })
    return status;
}

export default useHostVideoTransformStatus;
