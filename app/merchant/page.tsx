"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const ASLI =
  "00020101021126660014ID.CO.QRIS.WWW01189360001490000000010215ID10243654789120303UMI5204581253033605802ID5913WARUNG BU SRI6007BANDUNG6105402576304E671";

const PALSU =
  "00020101021126660014ID.CO.QRIS.WWW01189360001490000000020215ID10998877665540303UMI5204581253033605802ID5913WARUNG BU SRI6007BANDUNG61054025763049058";

export default function Merchant() {
  const [fake, setFake] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      if (cancelled || !canvasRef.current) return;
      await QRCode.toCanvas(canvasRef.current, fake ? PALSU : ASLI, {
        width: 460,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [fake]);

  // Spasi menukar stiker — supaya tangan tidak terlihat di rekaman.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setFake((f) => !f);
      }
      if (e.key === "l" || e.key === "L") setShowLabel((s) => !s);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={S.page}>
      <div style={S.sticker}>
        <div style={S.header}>QRIS</div>
        <div style={S.qrWrap}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>
        <div style={S.name}>WARUNG BU SRI</div>
        <div style={S.city}>BANDUNG</div>
        {showLabel && (
          <div style={{ ...S.label, color: fake ? "#c9202f" : "#067a4e" }}>
            {fake ? "PALSU" : "ASLI"} · {fake ? "ID1099887766554" : "ID1024365478912"}
          </div>
        )}
      </div>

      <div style={S.hint}>
        <kbd style={S.kbd}>Spasi</kbd> tukar stiker &nbsp;·&nbsp;
        <kbd style={S.kbd}>L</kbd> tampilkan label
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "#e9ebf2",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  sticker: {
    background: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 18px 50px rgba(15,20,50,.16)",
    width: 540,
    maxWidth: "92vw",
    textAlign: "center",
    paddingBottom: 26,
  },
  header: {
    background: "#c8102e",
    color: "#fff",
    fontWeight: 800,
    fontSize: 40,
    letterSpacing: "-.02em",
    padding: "18px 0",
  },
  qrWrap: { display: "flex", justifyContent: "center", padding: "28px 0 18px" },
  name: { fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" },
  city: { fontSize: 15, color: "#8b90ad", marginTop: 4, letterSpacing: ".04em" },
  label: {
    marginTop: 14,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    fontWeight: 500,
  },
  hint: { fontSize: 13, color: "#6b7090" },
  kbd: {
    background: "#fff",
    border: "1px solid #d5d9e6",
    borderRadius: 5,
    padding: "2px 7px",
    fontSize: 12,
    fontFamily: "'IBM Plex Mono', monospace",
  },
};
