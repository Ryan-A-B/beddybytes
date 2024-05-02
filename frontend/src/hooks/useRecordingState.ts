import React from "react"
import RecordingService, { RecordingServiceState } from "../services/ParentStation/RecordingService"

const useRecordingState = (recording_service: RecordingService) => {
    const [state, setState] = React.useState<RecordingServiceState>(recording_service.get_state)
    React.useEffect(() => {
        const handleStateChange = () => {
            setState(recording_service.get_state())
        }
        recording_service.addEventListener('statechange', handleStateChange)
        return () => {
            recording_service.removeEventListener('statechange', handleStateChange)
        }
    }, [recording_service])
    return state
}

export default useRecordingState