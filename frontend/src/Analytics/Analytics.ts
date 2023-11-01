import { Duration } from "moment";


interface Analytics {
    recordPageView: (page: string) => void;
    recordPageViewDuration: (page: string, duration: Duration) => void;
}

export default Analytics;