import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZEC DESK — WL Access Terminal" },
      { httpEquiv: "refresh", content: "0;url=/wl.html" },
    ],
  }),
  component: Home,
});

function Home() {
  useEffect(() => {
    window.location.replace("/wl.html");
  }, []);

  return (
    <main
      style={{
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
        padding: 24,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>ZEC DESK · PROTOCOL WL-555</p>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>WL Access Terminal</h1>
      <p style={{ margin: 0, fontSize: 13, color: "#9a9078" }}>Linking to access protocol…</p>
      <a href="/wl.html" style={{ color: "#e4b43c", marginTop: 8 }}>
        Open terminal
      </a>
    </main>
  );
}
