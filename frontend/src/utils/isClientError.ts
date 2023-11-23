const isClientError = (code: number): boolean => (code >= 400 && code < 500);

export default isClientError;