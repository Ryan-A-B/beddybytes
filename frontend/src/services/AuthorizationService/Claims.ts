export interface Claims {
    has_scope(scope: string): boolean;
}

class PreparedClaims implements Claims {
    private readonly scopes: ReadonlySet<string>;

    constructor(scopes: string[]) {
        this.scopes = new Set(scopes);
    }

    public has_scope = (scope: string): boolean => {
        return this.scopes.has(scope);
    };
}

export const NoClaims: Claims = new PreparedClaims([]);

export const parse_claims = (access_token: string): Claims => {
    try {
        const payload = access_token.split('.')[1];
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
        if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) return NoClaims;
        const scopes = claims.scp;
        if (scopes === undefined || (typeof scopes === 'string' && scopes.trim() === '')) {
            return new PreparedClaims([]);
        }
        if (typeof scopes !== 'string') return NoClaims;
        return new PreparedClaims(scopes.trim().split(/\s+/));
    } catch {
        return NoClaims;
    }
};
