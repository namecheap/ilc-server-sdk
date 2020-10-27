/**
 * Result of the "processRequest" method
 */
export interface IntlAdapter {
    config: IntlAdapterConfig;
    /** Allows to get current Intl config */
    get: () => Required<IntlConfig>;
    /** [Passed only at CSR] Allows to change current Intl config */
    set?: (p: IntlConfig) => void;
}

export interface IntlAdapterConfig {
    default: Required<IntlConfig>;
    supported: { locale: string[]; currency: string[] };
}

/**
 * Result of the "processRequest" method
 */
export interface ClientSdkAdapter {
    /** Unique application ID, if same app will be rendered twice on a page - it will get different IDs */
    appId?: string;
    intl: IntlAdapter | null;
}

export interface IntlConfig {
    locale?: string;
    currency?: string;
}
