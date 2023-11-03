const registerServiceWorker = async () => {
    if (process.env.NODE_ENV === 'development') return;
    const serviceWorkerAvailable = 'serviceWorker' in navigator
    if (!serviceWorkerAvailable) return;
    try {
        await navigator.serviceWorker.register(`/service-worker.js`, { scope: '/' });
    } catch (err) {
        console.error('ServiceWorker registration failed:', err);
    }
}

export default registerServiceWorker;
