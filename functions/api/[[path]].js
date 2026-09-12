import { handleAPI } from "../../server/api.js";
export const onRequest = ({ request, env }) => handleAPI(request, env);
