export interface Claims {
    has_scope(scope: string): boolean;
    has_empty_scope(): boolean;
}

class PreparedClaims implements Claims {
    private readonly scopes: ReadonlySet<string>;
    private readonly empty_scope: boolean;

    constructor(scopes: string[], empty_scope = false) {
        this.scopes = new Set(scopes);
        this.empty_scope = empty_scope;
    }

    public has_scope = (scope: string): boolean => {
        // Pre-release tokens without scopes retain their existing access.
        return this.empty_scope || this.scopes.has(scope);
    };

    public has_empty_scope = (): boolean => this.empty_scope;
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
            return new PreparedClaims([], true);
        }
        if (typeof scopes !== 'string') return NoClaims;
        return new PreparedClaims(scopes.trim().split(/\s+/));
    } catch {
        return NoClaims;
    }
};
