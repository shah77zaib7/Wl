import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-ChQCUHU-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	(0, import_react.useEffect)(() => {
		window.location.replace("/wl.html");
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		style: {
			minHeight: "100vh",
			margin: 0,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			gap: 12,
			background: "#050504",
			color: "#e4b43c",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
			letterSpacing: "0.14em",
			textTransform: "uppercase",
			textAlign: "center",
			padding: 24
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					fontSize: 12,
					opacity: .7
				},
				children: "ZEC 1.0 · PROTOCOL WL-555"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				style: {
					margin: 0,
					fontSize: 22,
					fontWeight: 500
				},
				children: "WL Access Terminal"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					fontSize: 13,
					color: "#9a9078"
				},
				children: "Linking to access protocol…"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "/wl.html",
				style: {
					color: "#e4b43c",
					marginTop: 8
				},
				children: "Open terminal"
			})
		]
	});
}
//#endregion
export { Home as component };
