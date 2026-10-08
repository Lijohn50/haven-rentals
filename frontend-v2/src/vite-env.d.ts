interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_PAYMENT_MODE?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}