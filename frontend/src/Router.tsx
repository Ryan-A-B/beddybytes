import React from 'react';
import * as DeviceRegistrar from './DeviceRegistrar';
import Camera from './Camera';
import Monitor from './Monitor';

const Router: React.FunctionComponent = () => {
    const device = DeviceRegistrar.useDevice()
    switch (device.type) {
        case "camera":
            return <Camera />
        case "monitor":
            return <Monitor />
    }
    return null
}

export default Router
