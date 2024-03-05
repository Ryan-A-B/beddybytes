import React from 'react'
import moment from 'moment'
import MediaStreamDisconnectMonitor from './index'

const useMediaStreamDisconnectMonitor = (mediaStream: MediaStream): MediaStreamConnectionState => {
    // TODO add an unintialized state?
    const [state, setState] = React.useState<MediaStreamConnectionState>({
        state: 'connected',
        start: moment(),
    })
    React.useEffect(() => {
        const monitor = new MediaStreamDisconnectMonitor(mediaStream)
        setState(monitor.get_state())
        monitor.addEventListener('statechange', () => {
            setState(monitor.get_state())
        })
        return () => monitor.stop()
    }, [mediaStream])
    return state
}

export default useMediaStreamDisconnectMonitor;
