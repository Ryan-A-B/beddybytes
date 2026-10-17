export type License = {
    type: 'Trial';
    start_unix_seconds: number;
    end_unix_seconds: number;
} | {
    type: 'Provisional';
    start_unix_seconds: number;
    provisional_license: { trial_start_unix_seconds: number };
} | {
    type: 'Perpetual';
    start_unix_seconds: number;
};

export interface Account {
    id: string;
    license: License;
}
