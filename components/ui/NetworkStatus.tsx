"use client";

import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="global-network-banner" role="status" aria-live="polite">
      Anda sedang offline. Hindari berpindah halaman sampai koneksi kembali dan status perubahan menunjukkan “Tersimpan”.
    </div>
  );
}
