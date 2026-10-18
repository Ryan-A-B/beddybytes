export type License = {
    type: 'trial';
    start_unix_seconds: number;
    end_unix_seconds: number;
} | {
    type: 'provisional';
    start_unix_seconds: number;
    provisional_license: { trial_start_unix_seconds: number };
} | {
    type: 'perpetual';
    start_unix_seconds: number;
};

export interface Account {
    id: string;
    license: License;
}
