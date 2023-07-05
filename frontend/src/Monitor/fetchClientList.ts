import authorization from "../authorization"
import { Device } from "../DeviceRegistrar"

const fetchClientList = async (host: string) => {
    const accessToken = await authorization.getAccessToken()
    const response = await fetch(`https://${host}/clients`, {
        method: 'GET',
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        }
    })
    if (!response.ok) {
        const payload = await response.text()
        throw new Error(`Failed to list devices: ${payload}`)
    }
    const payload = await response.json()
    return payload as Device[]
}

export default fetchClientList
