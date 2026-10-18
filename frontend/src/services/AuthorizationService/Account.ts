interface TrialLicense {
    type: 'trial';
    start_unix_seconds: number;
    end_unix_seconds: number;
}

interface ProvisionalLicense {
    type: 'provisional';
    start_unix_seconds: number;
    provisional_license: {
        trial_start_unix_seconds: number;
    };
}

interface PerpetualLicense {
    type: 'perpetual';
    start_unix_seconds: number;
}

export type License = TrialLicense | ProvisionalLicense | PerpetualLicense;

export interface Account {
    id: string;
    license: License;
}
