interface NetworkInformation extends EventTarget {

}

interface NavigatorWithConnection extends Navigator {
    connection: NetworkInformation;
}

const awaitConnectionChange = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const connection = (navigator as NavigatorWithConnection).connection;
        if (!connection) return;
        const handleConnectionChange = () => {
            connection.removeEventListener('change', handleConnectionChange);
            resolve();
        };
        connection.addEventListener('change', handleConnectionChange);
    });
}

export default awaitConnectionChange;
