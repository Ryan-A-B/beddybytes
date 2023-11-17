import React from "react";
import { AccountStatus, EventTypeAccountStatusChanged } from "../services/AccountService";
import account_service from "../instances/account_service";

const useAccountStatus = (): AccountStatus => {
    const [status, set_status] = React.useState<AccountStatus>(account_service.get_status());

    React.useEffect(() => {
        const handle_account_status_changed = () => {
            set_status(account_service.get_status());
        }
        account_service.addEventListener(EventTypeAccountStatusChanged, handle_account_status_changed);
        return () => {
            account_service.removeEventListener(EventTypeAccountStatusChanged, handle_account_status_changed);
        }
    }, []);

    return status;
}

export default useAccountStatus;