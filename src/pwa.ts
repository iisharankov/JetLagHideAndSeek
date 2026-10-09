// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- virtual module types live in vite-plugin-pwa, which pnpm doesn't hoist
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });
