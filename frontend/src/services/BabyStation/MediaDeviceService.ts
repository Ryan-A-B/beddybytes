import LoggingService from '../LoggingService';
import Service from "../Service";
import MediaDevicePermissionService from './MediaDevicePermissionService';

interface MediaDeviceState {
    active: boolean;
    devices: MediaDeviceInfo[];
    audio_device_id: string;
    video_device_id: string;
    media_stream_state: MediaStreamState;
};

interface MediaStreamNotAvailable {
    state: 'not_available';
}

interface MediaStreamLoading {
    state: 'loading';
    promise: Promise<MediaStream>;
}

interface MediaStreamAvailable {
    state: 'available';
    media_stream: MediaStream;
}

interface MediaStreamRejected {
    state: 'rejected';
    error: unknown;
}

type MediaStreamState = MediaStreamNotAvailable | MediaStreamLoading | MediaStreamAvailable | MediaStreamRejected;

const InitialState: MediaDeviceState = {
    active: false,
    devices: [],
    audio_device_id: '',
    video_device_id: '',
    media_stream_state: { state: 'not_available' },
};

interface NewMediaDeviceService {
    logging_service: LoggingService;
    media_device_permission_service: MediaDevicePermissionService;
}

class MediaDeviceService extends Service<MediaDeviceState> {
    protected readonly name = 'MediaDevicePermissionService';
    private static LocalStorageAudioDeviceIDKey = 'audio_device_id';
    private static LocalStorageVideoDeviceIDKey = 'video_device_id';

    constructor(input: NewMediaDeviceService) {
        super({
            logging_service: input.logging_service,
            initial_state: {
                ...InitialState,
                audio_device_id: MediaDeviceService.get_device_id_from_localstorage(MediaDeviceService.LocalStorageAudioDeviceIDKey),
                video_device_id: MediaDeviceService.get_device_id_from_localstorage(MediaDeviceService.LocalStorageVideoDeviceIDKey),
            },
        });
        navigator.mediaDevices.addEventListener('devicechange', this.handle_devicechange);
    }

    protected to_string = (state: MediaDeviceState): string => {
        return `active:${state.active}, device_count:${state.devices.length}, audio_device_id:${state.audio_device_id}, video_device_id:${state.video_device_id}`;
    }

    public start = () => {
        const state = this.get_state();
        if (state.active) return;
        this.get_user_media(state.audio_device_id, state.video_device_id)
            .then(this.update_devices);
        this.set_state({
            ...state,
            active: true,
        })
    }

    public stop = () => {
        const state = this.get_state();
        if (!state.active) return;
    }

    public set_audio_device_id = async (audio_device_id: string): Promise<void> => {
        const state = this.get_state();
        await this.get_user_media(audio_device_id, state.video_device_id);
        MediaDeviceService.put_device_id_in_localstorage(MediaDeviceService.LocalStorageAudioDeviceIDKey, audio_device_id);
    }

    public set_video_device_id = async (video_device_id: string): Promise<void> => {
        const state = this.get_state();
        await this.get_user_media(state.audio_device_id, video_device_id);
        MediaDeviceService.put_device_id_in_localstorage(MediaDeviceService.LocalStorageVideoDeviceIDKey, video_device_id);
    }

    public retry_get_user_media = async () => {
        const state = this.get_state();
        if (state.media_stream_state.state !== 'rejected') return;
        const promise = navigator.mediaDevices.getUserMedia({
            audio: MediaDeviceService.get_audio_constraint(state.audio_device_id),
            video: MediaDeviceService.get_video_constraint(state.video_device_id),
        });
        this.set_state({
            ...state,
            media_stream_state: {
                state: 'loading',
                promise,
            },
        })
        try {
            const media_stream = await promise;
            this.set_state({
                ...this.get_state(),
                media_stream_state: { state: 'available', media_stream },
            });
        } catch (error) {
            this.set_state({
                ...this.get_state(),
                media_stream_state: { state: 'rejected', error },
            });
        }
    }

    private handle_devicechange = (event: Event): void => {
        this.update_devices();
    }

    private update_devices = async (): Promise<void> => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.set_state({
            ...this.get_state(),
            devices,
        });
    }

    private get_user_media = async (audio_device_id: string, video_device_id: string) => {
        const state = this.get_state();
        switch (state.media_stream_state.state) {
            case 'loading':
                state.media_stream_state.promise.then((media_stream) => media_stream.getTracks().forEach((track) => track.stop()));
                break;
            case 'available':
                state.media_stream_state.media_stream.getTracks().forEach((track) => track.stop());
                break;
        }
        if (state.media_stream_state.state === 'available')
            state.media_stream_state.media_stream.getTracks().forEach((track) => track.stop());
        const promise = navigator.mediaDevices.getUserMedia({
            audio: MediaDeviceService.get_audio_constraint(audio_device_id),
            video: MediaDeviceService.get_video_constraint(video_device_id),
        });
        this.set_state({
            ...state,
            audio_device_id,
            video_device_id,
            media_stream_state: {
                state: 'loading',
                promise,
            },
        })
        try {
            const media_stream = await promise;
            this.set_state({
                ...this.get_state(),
                media_stream_state: { state: 'available', media_stream },
            });
        } catch (error) {
            this.set_state({
                ...this.get_state(),
                media_stream_state: { state: 'rejected', error },
            });
        }
    }

    private static get_audio_constraint = (audio_device_id: string): MediaStreamConstraints["audio"] => {
        if (audio_device_id === '') return true;
        return { deviceId: audio_device_id };
    }

    private static get_video_constraint = (video_device_id: string): MediaStreamConstraints["video"] => {
        if (video_device_id === '') return false;
        return { deviceId: video_device_id };
    }

    private static get_device_id_from_localstorage = (key: string): string => {
        const device_id = localStorage.getItem(key);
        if (device_id === null) return '';
        return device_id;
    }

    private static put_device_id_in_localstorage = (key: string, device_id: string): void => {
        if (device_id === '') localStorage.removeItem(key);
        else localStorage.setItem(key, device_id);
    }
}

export default MediaDeviceService;