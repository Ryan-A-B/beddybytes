import signal_service from "../instances/signal_service"

const useSignalService = (): SignalService => {
    return signal_service;
}

export default useSignalService;
