import {
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";
import { getToken } from "./auth";

export function initApi() {
  setBaseUrl(import.meta.env.VITE_API_URL);
  setAuthTokenGetter(() => getToken());
}