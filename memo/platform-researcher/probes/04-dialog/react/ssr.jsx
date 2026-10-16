import { renderToString } from "react-dom/server";
import { App } from "./app.jsx";
export const ssr = (variant) => renderToString(<App variant={variant} />);
