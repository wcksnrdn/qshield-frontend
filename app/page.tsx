"use client";

import { useEffect, useRef, useState } from "react";
import "./globals.css";

declare global {
  interface Window {
    __qsid?: string;
  }
}

type Action = "proceed" | "warn" | "step_up" | "cooling_off";
type Verdict = "verified" | "unknown" | "anomaly";

type Merchant = {
  name: string;
  city?: string;
  criteria?: string;
  is_static?: boolean;
  nmid: string;
};

type VerifyResult = {
  action: Action;
  verdict: Verdict;
  merchant: Merchant;
  reasons: string[];
  risk_score: number;
  processing_ms: number;
};

type Coords = { lat: number; lng: number; acc?: number };
type LatLng = { lat: number; lng: number };

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8000";

const WARUNG = { lat: -6.914744, lng: 107.60981 };

const PRESETS = [
  {
    label: "QR asli di Warung Bu Sri",
    note: "Jangkar mapan, 47 pengamatan",
    payload:
      "00020101021126660014ID.CO.QRIS.WWW01189360001490000000010215ID10243654789120303UMI5204581253033605802ID5913WARUNG BU SRI6007BANDUNG6105402576304E671",
    lat: WARUNG.lat,
    lng: WARUNG.lng,
  },
  {
    label: "Stiker palsu di lokasi yang sama",
    note: "NMID berbeda di jangkar mapan",
    payload:
      "00020101021126660014ID.CO.QRIS.WWW01189360001490000000020215ID10998877665540303UMI5204581253033605802ID5913WARUNG BU SRI6007BANDUNG61054025763049058",
    lat: WARUNG.lat,
    lng: WARUNG.lng,
  },
  {
    label: "Stiker palsu di lokasi lain",
    note: "NMID sama tersebar antar kota",
    payload:
      "00020101021126660014ID.CO.QRIS.WWW01189360001490000000020215ID10998877665540303UMI5204581253033605802ID5913WARUNG BU SRI6007BANDUNG61054025763049058",
    lat: -6.9,
    lng: 107.62,
  },
];

const TONE = {
  proceed: "tone-ok",
  warn: "tone-warn",
  step_up: "tone-warn",
  cooling_off: "tone-alert",
};

const TITLE = {
  verified: "Merchant terverifikasi",
  unknown: "Lokasi belum terverifikasi",
  anomaly: "Transaksi ditahan",
};

const SUBTITLE = {
  proceed: "Aman untuk dilanjutkan",
  warn: "Periksa kembali sebelum membayar",
  step_up: "Perlu verifikasi tambahan",
  cooling_off: "Pembayaran dijeda 30 menit",
};

function IconOk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v5M12 17.5v.01" />
      <path d="M10.3 3.9L2.4 17.4A2 2 0 004.1 20.4h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}

function deviceId() {
  if (typeof window === "undefined") return "server";
  let id = window.__qsid;
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 12);
    window.__qsid = id;
  }
  return id;
}

export default function Page() {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [sheetUp, setSheetUp] = useState(false);
  const [error, setError] = useState("");
  const [gps, setGps] = useState<Coords | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [manual, setManual] = useState({ payload: "", lat: "", lng: "" });
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pinned, setPinned] = useState<LatLng | null>(null);

  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const lockRef = useRef(false);

  // --- lokasi -----------------------------------------------------

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        }),
      () => setGps(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // --- kamera -----------------------------------------------------

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode("reader", { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (text: string) => {
            if (lockRef.current) return;
            lockRef.current = true;
            verify(text);
            setTimeout(() => (lockRef.current = false), 2500);
          },
          () => {}
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            "Kamera tidak dapat diakses. Gunakan panel demo di kanan atas untuk menjalankan skenario secara manual."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) scanner.stop().catch(() => {});
    };
  }, []);

  // --- hitung mundur cooling-off ----------------------------------

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // --- verifikasi -------------------------------------------------

  async function verify(payload: string, coords?: Coords) {
    const loc: Coords = coords || pinned || gps || WARUNG;
    setBusy(true);
    setError("");
    try {
      const body: {
        payload: string;
        lat: number;
        lng: number;
        device_anon_id: string;
        accuracy_m?: number;
      } = {
        payload: payload.trim(),
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        device_anon_id: deviceId(),
      };
      if (loc.acc) body.accuracy_m = loc.acc;

      const res = await fetch(`${API}/api/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Kode QR tidak dapat dibaca.");
        setBusy(false);
        return;
      }

      setResult(data);
      setSheetUp(true);
      setShowDemo(false);
      if (data.action === "cooling_off") setCooldown(30 * 60);
      if (navigator.vibrate) {
        navigator.vibrate(data.action === "proceed" ? 30 : [50, 60, 50]);
      }
    } catch (e) {
      setError(
        `Tidak dapat menghubungi ${API}. Pastikan backend berjalan.`
      );
    }
    setBusy(false);
  }

  function close() {
    setSheetUp(false);
    setTimeout(() => setResult(null), 420);
  }

  const tone = result ? TONE[result.action] : "";
  const locked = result && result.action !== "proceed";

  const mm = String(Math.floor(cooldown / 60)).padStart(2, "0");
  const ss = String(cooldown % 60).padStart(2, "0");

  return (
    <div className="stage">
      <div className="phone">
        <header className="topbar">
          <div className="topbar-row">
            <div className="wordmark">Dompetku</div>
            <div className="shield-chip">
              <span className="shield-dot" />
              Q-Shield aktif
            </div>
          </div>
          <div className="balance-label">Saldo</div>
          <div className="balance">Rp 1.240.500</div>
        </header>

        <button
          className="demo-toggle"
          onClick={() => setShowDemo((s) => !s)}
          aria-label="Panel demo"
        >
          {showDemo ? "\u00d7" : "\u2699"}
        </button>

        <div className="scan-area">
          <div id="reader" />
          <div className="scan-frame">
            <div className="bracket">
              <span /><span /><span /><span />
            </div>
          </div>
          {pinned ? (
            <div className="gps-pill">
              {Number(pinned.lat).toFixed(5)}, {Number(pinned.lng).toFixed(5)} · terkunci
            </div>
          ) : gps ? (
            <div className="gps-pill">
              {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · ±{Math.round(gps.acc ?? 0)}m
            </div>
          ) : null}
          <div className="scan-hint">
            {busy ? "Memeriksa…" : "Arahkan kamera ke kode QRIS"}
          </div>
        </div>

        <div className={`pinpad ${locked ? "locked" : ""}`}>
          <div className="pin-label">Masukkan PIN untuk membayar</div>
          <div className="pin-dots">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="keys">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "\u232b"].map((k, i) => (
              <button key={i} disabled tabIndex={-1}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {error && !showDemo && <div className="err" style={{ margin: "0 20px 16px" }}>{error}</div>}

        <div className={`scrim ${sheetUp ? "on" : ""}`} onClick={close} />

        <div className={`sheet ${sheetUp ? "up" : ""} ${tone}`}>
          <div className="grip" />
          {result && (
            <div className="sheet-body">
              <div className="verdict-head">
                <div className="verdict-mark">
                  {result.action === "proceed" ? (
                    <IconOk />
                  ) : result.action === "cooling_off" ? (
                    <IconStop />
                  ) : (
                    <IconWarn />
                  )}
                </div>
                <div>
                  <div className="verdict-title">{TITLE[result.verdict]}</div>
                  <div className="verdict-sub">{SUBTITLE[result.action]}</div>
                </div>
              </div>

              <div className="merchant-card">
                <div className="merchant-name">
                  {result.merchant.name || "Merchant tidak bernama"}
                </div>
                <div className="merchant-meta">
                  {[result.merchant.city, result.merchant.criteria,
                    result.merchant.is_static ? "QR statis" : "QR dinamis"]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="nmid">{result.merchant.nmid}</div>
              </div>

              <div className="reasons">
                {result.reasons.map((r, i) => (
                  <div className="reason" key={i}>
                    {r}
                  </div>
                ))}
              </div>

              <div className="meter">
                <div className="meter-top">
                  <span>Skor risiko</span>
                  <span className="meter-score">{result.risk_score}/100</span>
                </div>
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{ width: sheetUp ? `${result.risk_score}%` : "0%" }}
                  />
                </div>
                <div className="latency">
                  diperiksa dalam {result.processing_ms} ms · sebelum PIN
                </div>
              </div>

              {result.action === "cooling_off" && cooldown > 0 && (
                <div className="countdown">
                  Pembayaran dijeda selama <b>{mm}:{ss}</b>. Jeda ini memberi
                  waktu untuk memastikan, terutama bila ada yang mendesak Anda
                  membayar sekarang.
                </div>
              )}

              <div className="actions">
                {result.action === "proceed" && (
                  <button className="btn btn-primary">Bayar Rp 25.000</button>
                )}
                {result.action === "warn" && (
                  <>
                    <button className="btn btn-primary">Lanjut membayar</button>
                    <button className="btn btn-ghost" onClick={close}>
                      Batalkan
                    </button>
                  </>
                )}
                {result.action === "step_up" && (
                  <>
                    <button className="btn btn-primary">
                      Verifikasi dengan biometrik
                    </button>
                    <button className="btn btn-ghost" onClick={close}>
                      Batalkan
                    </button>
                  </>
                )}
                {result.action === "cooling_off" && (
                  <>
                    <button className="btn btn-danger">
                      Laporkan ke penyelenggara
                    </button>
                    <button className="btn btn-ghost" onClick={close}>
                      Tutup
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {showDemo && (
          <div className="demo-panel">
            <h2>Panel demo</h2>
            <p>
              Jalankan skenario tanpa kamera. Berguna saat merekam atau bila
              izin kamera tidak tersedia.
            </p>

            <div className="field">
              <label>Lokasi yang dipakai saat memindai</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="preset"
                  style={{ flex: 1, marginBottom: 0, textAlign: "center" }}
                  onClick={() => {
                    if (gps) setPinned({ lat: gps.lat, lng: gps.lng });
                  }}
                >
                  <b>Kunci di titik ini</b>
                  <span>
                    {gps
                      ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
                      : "GPS belum tersedia"}
                  </span>
                </button>
                <button
                  className="preset"
                  style={{ flex: 1, marginBottom: 0, textAlign: "center" }}
                  onClick={() => setPinned(null)}
                >
                  <b>Ikuti GPS</b>
                  <span>{pinned ? "sedang terkunci" : "sedang aktif"}</span>
                </button>
              </div>
            </div>

            <p style={{ marginTop: 4, marginBottom: 14 }}>
              Kunci lokasi bila GPS dalam ruangan tidak stabil. Pastikan
              koordinat yang dikunci sama dengan yang dipakai saat menjalankan
              <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {" "}seed.py
              </code>
              .
            </p>

            {PRESETS.map((p, i) => (
              <button
                key={i}
                className="preset"
                onClick={() => verify(p.payload, { lat: p.lat, lng: p.lng })}
              >
                <b>{p.label}</b>
                <span>{p.note}</span>
              </button>
            ))}

            <div style={{ height: 18 }} />

            <div className="field">
              <label>Payload QRIS</label>
              <textarea
                value={manual.payload}
                onChange={(e) =>
                  setManual({ ...manual, payload: e.target.value })
                }
                placeholder="0002010102..."
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Lintang</label>
                <input
                  value={manual.lat}
                  onChange={(e) => setManual({ ...manual, lat: e.target.value })}
                  placeholder={String(WARUNG.lat)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Bujur</label>
                <input
                  value={manual.lng}
                  onChange={(e) => setManual({ ...manual, lng: e.target.value })}
                  placeholder={String(WARUNG.lng)}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() =>
                verify(manual.payload, {
                  lat: Number(manual.lat) || WARUNG.lat,
                  lng: Number(manual.lng) || WARUNG.lng,
                })
              }
            >
              Periksa
            </button>

            {error && <div className="err">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}