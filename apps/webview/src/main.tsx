import "@pkg/ui/src/theme.css";
import {Sessions} from "@/modules/sessions/sessions.tsx";
import {SESSIONS_WEBVIEW} from "@pkg/constants/src/sessionsView.constant.ts";
import {createRoot} from "react-dom/client";

const rootElement = document.getElementById(SESSIONS_WEBVIEW.ROOT_ELEMENT_ID);
if (rootElement === null) throw new Error(`The page has no #${SESSIONS_WEBVIEW.ROOT_ELEMENT_ID} element to mount on.`);

createRoot(rootElement).render(<Sessions />);
