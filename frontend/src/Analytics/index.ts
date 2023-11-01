import settings from '../settings';
import InfluxAnalytics from './InfluxAnalytics';

const analytics = new InfluxAnalytics(settings.API.clientID);

export default analytics;
