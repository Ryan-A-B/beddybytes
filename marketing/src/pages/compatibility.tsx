import React from 'react'
import type { HeadFC, PageProps } from 'gatsby'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import SEOHead from '../components/SEOHead'
import DefaultPageWrapper from '../components/DefaultPageWrapper'

interface FeatureSupportNotChecked {
    state: 'not_checked'
}

interface FeatureSupportResult {
    state: 'result',
    supported: boolean
}

type FeatureSupport = FeatureSupportNotChecked | FeatureSupportResult

type useFeatureSupportOutput = [FeatureSupport, () => Promise<void>]

const useMicrophoneSupport = (): useFeatureSupportOutput => {
    const [microphoneSupport, setMicrophoneSupport] = React.useState<FeatureSupport>({ state: 'not_checked' })
    const checkForMicrophoneSupport = async () => {
        try {
            const media_stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            media_stream.getTracks().forEach(track => track.stop())
            setMicrophoneSupport({
                state: 'result',
                supported: true
            })
        } catch {
            setMicrophoneSupport({
                state: 'result',
                supported: false
            })
        }
    }
    return [microphoneSupport, checkForMicrophoneSupport]
}

const useCameraSupport = (): useFeatureSupportOutput => {
    const [cameraSupport, setCameraSupport] = React.useState<FeatureSupport>({ state: 'not_checked' })
    const checkForCameraSupport = async () => {
        try {
            const media_stream = await navigator.mediaDevices.getUserMedia({ video: true })
            media_stream.getTracks().forEach(track => track.stop())
            setCameraSupport({
                state: 'result',
                supported: true
            })
        } catch {
            setCameraSupport({
                state: 'result',
                supported: false
            })
        }
    }
    return [cameraSupport, checkForCameraSupport]
}

const useWebsocketSupport = (): useFeatureSupportOutput => {
    const [websocketSupport, setWebsocketSupport] = React.useState<FeatureSupport>({ state: 'not_checked' })
    const checkForWebsocketSupport = async () => {
        setWebsocketSupport({
            state: 'result',
            supported: 'WebSocket' in window
        })
    }
    return [websocketSupport, checkForWebsocketSupport]
}

const useWebrtcSupport = (): useFeatureSupportOutput => {
    const [webrtcSupport, setWebrtcSupport] = React.useState<FeatureSupport>({ state: 'not_checked' })
    const checkForWebrtcSupport = async () => {
        setWebrtcSupport({
            state: 'result',
            supported: 'RTCPeerConnection' in window
        })
    }
    return [webrtcSupport, checkForWebrtcSupport]
}

const CompatibilityPage: React.FunctionComponent<PageProps> = () => {
    const [microphoneSupport, checkForMicrophoneSupport] = useMicrophoneSupport()
    const [cameraSupport, checkForCameraSupport] = useCameraSupport()
    const [websocketSupport, checkForWebsocketSupport] = useWebsocketSupport()
    const [webrtcSupport, checkForWebrtcSupport] = useWebrtcSupport()

    const checkAll = async () => {
        await checkForWebsocketSupport()
        await checkForWebrtcSupport()
        await checkForMicrophoneSupport()
        await checkForCameraSupport()
    }

    const microphone_props = React.useMemo(() => ({
        title: 'Microphone',
        description: 'BeddyBytes requires a microphone to stream audio from the Baby Station to the Parent Station.',
        feature_support: microphoneSupport,
        check_support: checkForMicrophoneSupport,
        supported_message: 'Yes',
        not_supported_message: 'No',
    }), [microphoneSupport, checkForMicrophoneSupport])

    const camera_props = React.useMemo(() => ({
        title: 'Camera',
        description: 'BeddyBytes requires a camera to stream video from the Baby Station to the Parent Station.',
        feature_support: cameraSupport,
        check_support: checkForCameraSupport,
        supported_message: 'Yes',
        not_supported_message: 'No',
    }), [cameraSupport, checkForCameraSupport])

    const websocket_props = React.useMemo(() => ({
        title: 'Web Socket',
        description: 'BeddyBytes uses Web Sockets to communicate messages between the Baby Station and the Parent Station.',
        feature_support: websocketSupport,
        check_support: checkForWebsocketSupport,
        supported_message: 'Yes',
        not_supported_message: 'No',
    }), [websocketSupport, checkForWebsocketSupport])

    const webrtc_props = React.useMemo(() => ({
        title: 'WebRTC',
        description: 'BeddyBytes uses WebRTC to stream video and audio from the Baby Station to the Parent Station.',
        feature_support: webrtcSupport,
        check_support: checkForWebrtcSupport,
        supported_message: 'Yes',
        not_supported_message: 'No',
    }), [webrtcSupport, checkForWebrtcSupport])

    const baby_station_features_props = React.useMemo(() => [
        microphone_props,
        camera_props,
        websocket_props,
        webrtc_props,
    ], [microphone_props, camera_props, websocket_props, webrtc_props])

    const parent_station_features_props = React.useMemo(() => [
        websocket_props,
        webrtc_props,
    ], [websocket_props, webrtc_props])

    return (
        <DefaultPageWrapper>
            <main className="py-5">
                <div className="container" style={{maxWidth: 520}}>
                    <h1 className="text-center mt-3">Is my device compatible?</h1>
                    <div className="text-center">
                        <button onClick={checkAll} className="btn btn-primary">
                            Check all requirements
                        </button>
                    </div>
                    <section className="my-5">
                        <h2>Baby Station Requirements</h2>
                        {baby_station_features_props.map((props) => (
                            <FeatureComponent key={props.title} {...props} />
                        ))}
                    </section>
                    <section className="my-5">
                        <h2>Parent Station Requirements</h2>
                        {parent_station_features_props.map((props) => (
                            <FeatureComponent key={props.title} {...props} />
                        ))}
                    </section>
                </div>
            </main>
        </DefaultPageWrapper>
    )
}

export default CompatibilityPage

export const Head: HeadFC = () => (
    <SEOHead
        title="Compatibility"
        description="BeddyBytes compatibility information"
    />
)

interface FeatureProps {
    title: string
    description: string
    feature_support: FeatureSupport
    check_support: () => Promise<void>
    supported_message: string
    not_supported_message: string
}

const getCardClass = (feature_support: FeatureSupport) => {
    switch (feature_support.state) {
        case 'not_checked':
            return 'text-bg-light'
        case 'result':
            return feature_support.supported ? 'text-bg-success' : 'text-bg-danger'
    }
}

const FeatureComponent: React.FunctionComponent<FeatureProps> = ({ title, description, feature_support, check_support, supported_message, not_supported_message }) => {
    const [show, setShow] = React.useState(false)
    const toggleCollapse = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLButtonElement) return
        setShow(!show)
    }, [show])
    return (
        <div className={`card ${getCardClass(feature_support)}`}>
            <div onClick={toggleCollapse} className="card-header d-flex align-items-center justify-content-between pointer" role="button">
                <h3>{title}</h3>
                {feature_support.state === 'not_checked' && (
                    <button type="button" onClick={check_support} className="btn btn-secondary">
                        Check
                    </button>
                )}
                <span>
                    {show ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
                </span>
            </div>
            <div className={`card-body collapse ${show ? 'show' : ''}`}>
                <p>{description}</p>
            </div>
        </div>
    )
}
