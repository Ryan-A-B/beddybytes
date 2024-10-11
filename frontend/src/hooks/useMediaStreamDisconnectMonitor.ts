import React from 'react'
import moment from 'moment'
import MediaStreamDisconnectMonitor from '../services/ParentStation/MediaStreamDisconnectMonitor/index'

const useMediaStreamDisconnectMonitor = (media_stream: MediaStream): MediaStreamConnectionState => {
    // TODO add an unintialized state?
    const [state, setState] = React.useState<MediaStreamConnectionState>({
        state: 'connected',
        start: moment(),
    })
    React.useEffect(() => {
        const monitor = new MediaStreamDisconnectMonitor(media_stream)
        setState(monitor.get_state())
        monitor.addEventListener('statechange', () => {
            setState(monitor.get_state())
        })
        return () => monitor.stop()
    }, [media_stream])
    return state
}

export default useMediaStreamDisconnectMonitor;
