"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Route = { id: string; origin: string; destination: string; active: boolean };
type VehicleTemplate = { id: string; name: string; capacity: number };
type Vehicle = { id: string; name: string; plate: string; active: boolean; template: VehicleTemplate };
type Schedule = { id: string; departureTime: string; durationMinutes: number; basePrice: number; active: boolean; route: Route; vehicleTemplate: VehicleTemplate };
type Trip = { id: string; departureAt: string; arrivalAt: string; price: number; status: string; route: Route; vehicle: Vehicle; seats: { status: string }[] };
type Booking = { id: string; bookingCode: string; customerName: string; customerPhone: string; status: string; createdAt: string; trip: { route: Route }; payments: { status: string; amount: number }[] };
type DashboardData = { routes: Route[]; vehicles: Vehicle[]; vehicleTemplates: VehicleTemplate[]; scheduleTemplates: Schedule[]; trips: Trip[]; bookings: Booking[]; stats: { bookingCount: number; pendingPayments: number; paidAmount: number } };

const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
const inputStyle = { width: "100%", padding: "12px", border: "1px solid #d5ded9", borderRadius: 9, background: "white", color: "#17211d" } as const;
const buttonStyle = { padding: "12px 16px", border: 0, borderRadius: 9, background: "#176b4a", color: "white", fontWeight: 700, cursor: "pointer" } as const;

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/data", { cache: "no-store" });
    if (!response.ok) { setAuthenticated(false); setData(null); return; }
    setData(await response.json());
    setAuthenticated(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Login gagal.");
      setPassword("");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Login gagal."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false); setData(null);
  }

  async function save(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/admin/data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, action })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Data gagal disimpan.");
      form.reset();
      setMessage("Data berhasil disimpan.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Data gagal disimpan."); }
    finally { setBusy(false); }
  }

  if (!authenticated) return <main className="admin-page admin-login" style={{ maxWidth: 420, margin: "12vh auto", padding: 24, fontFamily: "Arial,sans-serif", color: "#17211d" }}>
    <a href="/" style={{ color: "#176b4a" }}>← Travel Laju Jagat</a>
    <h1 style={{ marginTop: 28 }}>Admin Laju Jagat</h1>
    <p>Masuk untuk mengelola data operasional dan pemesanan.</p>
    <form onSubmit={login} style={{ display: "grid", gap: 12 }}>
      <label htmlFor="admin-password">Password admin</label>
      <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required style={inputStyle}/>
      <button style={buttonStyle} disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
    </form>
    {message && <p role="alert">{message}</p>}
  </main>;

  if (!data) return <main style={{ padding: 32 }}>Memuat dashboard...</main>;

  return <main className="admin-page" style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 60px", fontFamily: "Arial,sans-serif", color: "#17211d" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><a href="/" style={{ color: "#176b4a" }}>Travel Laju Jagat</a><h1 style={{ margin: "10px 0 0" }}>Dashboard Admin</h1></div>
      <button onClick={logout} style={{ ...buttonStyle, background: "#eef3f0", color: "#176b4a" }}>Keluar</button>
    </header>
    {message && <p role="status" style={{ padding: 12, background: "#eef7f1", borderRadius: 9 }}>{message}</p>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "24px 0" }}>
      {[
        ["Total booking", String(data.stats.bookingCount)],
        ["Menunggu pembayaran", String(data.stats.pendingPayments)],
        ["Pembayaran terverifikasi", money(data.stats.paidAmount)],
        ["Jadwal perjalanan", String(data.trips.length)]
      ].map(([label, value]) => <article key={label} style={{ padding: 18, border: "1px solid #dce5df", borderRadius: 14 }}><p style={{ margin: 0, color: "#63736b" }}>{label}</p><strong style={{ display: "block", marginTop: 8, fontSize: 22 }}>{value}</strong></article>)}
    </section>

    <h2>Data operasional</h2>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 16, alignItems: "start" }}>
      <form onSubmit={event => save(event, "route")} style={{ border: "1px solid #dce5df", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Tambah rute</h3>
        <label>Kota asal<input name="origin" required minLength={2} style={inputStyle}/></label>
        <label>Kota tujuan<input name="destination" required minLength={2} style={inputStyle}/></label>
        <button style={buttonStyle} disabled={busy}>Simpan rute</button>
      </form>

      <form onSubmit={event => save(event, "vehicle")} style={{ border: "1px solid #dce5df", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Tambah armada</h3>
        <label>Nama / tipe armada<input name="name" required placeholder="Contoh: Hiace" style={inputStyle}/></label>
        <label>Nomor polisi<input name="plate" required style={inputStyle}/></label>
        <label>Kapasitas kursi<input name="capacity" type="number" min="1" max="32" required style={inputStyle}/></label>
        <button style={buttonStyle} disabled={busy}>Simpan armada</button>
      </form>

      <form onSubmit={event => save(event, "schedule")} style={{ border: "1px solid #dce5df", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Template jadwal</h3>
        <label>Rute<select name="routeId" required style={inputStyle}><option value="">Pilih rute</option>{data.routes.filter(route => route.active).map(route => <option key={route.id} value={route.id}>{route.origin} → {route.destination}</option>)}</select></label>
        <label>Tipe armada<select name="vehicleTemplateId" required style={inputStyle}><option value="">Pilih tipe</option>{data.vehicleTemplates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.capacity} kursi</option>)}</select></label>
        <label>Jam berangkat<input name="departureTime" type="time" required style={inputStyle}/></label>
        <label>Durasi (menit)<input name="durationMinutes" type="number" min="15" max="1440" required style={inputStyle}/></label>
        <label>Tarif dasar (Rp)<input name="basePrice" type="number" min="1000" required style={inputStyle}/></label>
        <button style={buttonStyle} disabled={busy}>Simpan template</button>
      </form>

      <form onSubmit={event => save(event, "trip")} style={{ border: "1px solid #dce5df", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Buat perjalanan</h3>
        <label>Template jadwal<select name="templateId" required style={inputStyle}><option value="">Pilih jadwal</option>{data.scheduleTemplates.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.route.origin} → {item.route.destination} · {item.departureTime} · {item.vehicleTemplate.name}</option>)}</select></label>
        <label>Armada<select name="vehicleId" required style={inputStyle}><option value="">Pilih kendaraan</option>{data.vehicles.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.plate}</option>)}</select></label>
        <label>Tanggal & jam<input name="departureAt" type="datetime-local" required style={inputStyle}/></label>
        <button style={buttonStyle} disabled={busy}>Buat trip dan kursi</button>
      </form>
    </section>

    <section style={{ marginTop: 28 }}>
      <h2>Rute aktif</h2>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}><thead><tr><th align="left">Asal</th><th align="left">Tujuan</th><th align="left">Status</th></tr></thead><tbody>{data.routes.map(route => <tr key={route.id}><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{route.origin}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{route.destination}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{route.active ? "Aktif" : "Nonaktif"}</td></tr>)}</tbody></table></div>
    </section>

    <section style={{ marginTop: 28 }}>
      <h2>Armada</h2>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}><thead><tr><th align="left">Nama</th><th align="left">Nomor polisi</th><th align="left">Kapasitas</th><th align="left">Status</th></tr></thead><tbody>{data.vehicles.map(vehicle => <tr key={vehicle.id}><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{vehicle.name}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{vehicle.plate}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{vehicle.template.capacity}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{vehicle.active ? "Aktif" : "Nonaktif"}</td></tr>)}</tbody></table></div>
    </section>

    <section style={{ marginTop: 28 }}>
      <h2>Perjalanan terbaru</h2>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}><thead><tr><th align="left">Keberangkatan</th><th align="left">Rute</th><th align="left">Armada</th><th align="left">Kursi tersedia</th><th align="left">Tarif</th></tr></thead><tbody>{data.trips.map(trip => <tr key={trip.id}><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{new Date(trip.departureAt).toLocaleString("id-ID")}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{trip.route.origin} → {trip.route.destination}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{trip.vehicle.name}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{trip.seats.filter(seat => seat.status === "AVAILABLE").length}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{money(trip.price)}</td></tr>)}</tbody></table></div>
    </section>

    <section style={{ marginTop: 28 }}>
      <h2>Pemesanan terbaru</h2>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}><thead><tr><th align="left">Kode</th><th align="left">Pemesan</th><th align="left">Rute</th><th align="left">Status</th><th align="left">Pembayaran</th></tr></thead><tbody>{data.bookings.map(booking => <tr key={booking.id}><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{booking.bookingCode}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{booking.customerName}<br/>{booking.customerPhone}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{booking.trip.route.origin} → {booking.trip.route.destination}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{booking.status}</td><td style={{ padding: 10, borderTop: "1px solid #e3e9e5" }}>{booking.payments[0]?.status ?? "Belum ada"}{booking.payments[0] ? ` · ${money(booking.payments[0].amount)}` : ""}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
