import React from 'react';
import moment from 'moment';
import Analytics from './Analytics';

interface Props {
    analytics: Analytics;
    page: string;
}

const PageViewTracker: React.FunctionComponent<Props> = ({ analytics, page }) => {
    React.useEffect(() => {
        const t0 = moment();
        analytics.recordPageView(page);
        return () => {
            const t1 = moment();
            analytics.recordPageViewDuration(page, moment.duration(t1.diff(t0)));
        };
    }, [analytics, page]);
    return null;
}

export default PageViewTracker;
