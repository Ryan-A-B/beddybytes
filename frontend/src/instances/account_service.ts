import AccountService from '../services/AccountService';
import authorization_service from './authorization_service';

const account_service = new AccountService({
    authorization_service,
});

export default account_service;
