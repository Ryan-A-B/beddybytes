import TrialExpiryService from '../TrialExpiryService';
import authorization_service from './authorization_service';

const trial_expiry_service = new TrialExpiryService(authorization_service);

export default trial_expiry_service;
