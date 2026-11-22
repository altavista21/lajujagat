"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type SeatStatus = "AVAILABLE" | "LOCKED" | "BOOKED";
type Trip = {
  id: string; origin: string; destination: string; departureAt: string;
  arrivalAt: string; price: number; vehicle: string; capacity: number;
  availableSeats: number; seats: { seatNo: string; status: SeatStatus }[];
};
type BookingResult = { bookingCode: string; expiresAt: string; amount: number };

const money = (n: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(n);
const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const time = (value: string) => new Date(value).toLocaleTimeString("id-ID", {
  hour: "2-digit", minute: "2-digit", hour12: false
});

export default function Home() {
  const [locations, setLocations] = useState<{ origins: string[]; destinations: string[] }>({ origins: [], destinations: [] });
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(localDate());
  const [count, setCount] = useState("1");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/routes", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Rute belum dapat dimuat.");
        return response.json();
      })
      .then((result: { routes: { origin: string; destination: string }[]; origins: string[]; destinations: string[] }) => {
        setLocations({ origins: result.origins ?? [], destinations: result.destinations ?? [] });
        setOrigin((current) => current || result.routes?.[0]?.origin || "");
        setDestination((current) => current || result.routes?.[0]?.destination || "");
      })
      .catch(() => setLocations({ origins: [], destinations: [] }));
  }, []);

  const activeTrip = trips.find((trip) => trip.id === active) ?? null;
  const orderedSeats = useMemo(() => activeTrip?.seats ?? [], [activeTrip]);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true); setError(""); setNotice(""); setBooking(null); setCheckoutUrl(null);
    setActive(null); setSelected([]);
    try {
      const params = new URLSearchParams({ origin, destination, date, passengers: count });
      const response = await fetch(`/api/trips?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Jadwal gagal dimuat.");
      setTrips(data.trips ?? []);
      setSearched(true);
    } catch (e) {
      setTrips([]);
      setSearched(true);
      setError(e instanceof Error ? e.message : "Tidak dapat memuat jadwal.");
    } finally { setLoading(false); }
  }

  function toggleSeat(seat: { seatNo: string; status: SeatStatus }) {
    if (booking || seat.status !== "AVAILABLE") return;
    setSelected((current) => current.includes(seat.seatNo)
      ? current.filter((item) => item !== seat.seatNo)
      : current.length < Number(count) ? [...current, seat.seatNo] : current);
    setNotice(""); setError("");
  }

  async function lockSeats() {
    if (!activeTrip || selected.length !== Number(count)) return;
    const activeTripId = activeTrip.id;
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/bookings/lock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: activeTrip.id, seatNos: selected,
          customerName, customerPhone, customerEmail: customerEmail || undefined,
          passengers: selected.map((seatNo) => ({ seatNo, name: (passengerNames[seatNo] || customerName).trim() }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Kursi gagal dikunci.");
      setBooking(data.booking);
      setTrips((current) => current.map((trip) => trip.id === activeTripId ? {
        ...trip,
        availableSeats: Math.max(0, trip.availableSeats - selected.length),
        seats: trip.seats.map((seat) => selected.includes(seat.seatNo) ? { ...seat, status: "LOCKED" as SeatStatus } : seat)
      } : trip));
      setNotice(data.message || "Kursi berhasil dikunci.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pemesanan gagal diproses.");
    } finally { setLoading(false); }
  }

  async function startPayment() {
    if (!booking) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(booking.bookingCode)}/payment`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Tagihan gagal dibuat.");
      setCheckoutUrl(data.checkoutUrl);
      window.location.assign(data.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tidak dapat memulai pembayaran.");
    } finally { setLoading(false); }
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">LJ</span><span>Travel <b>Laju Jagat</b></span></a>
      <nav><a href="#jadwal">Jadwal</a><a href="#bantuan">Bantuan</a><a className="nav-link" href="#cek">Cek pesanan</a></nav>
    </header>
    <section className="hero"><div className="hero-inner">
      <p className="eyebrow">PERJALANAN ANTAR KOTA</p>
      <h1>Berangkat nyaman.<br/><span>Sampai tujuan.</span></h1>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-art-glow"></div>
        <svg viewBox="0 0 560 260" role="img">
          <path d="M18 215 C120 190 190 225 285 205 S440 178 545 202" fill="none" stroke="#b9d5e9" strokeWidth="3" strokeDasharray="10 12"/>
          <path d="M80 182 L105 113 Q112 94 139 89 L397 89 Q421 91 437 113 L477 171 L493 185 L493 211 L70 211 L70 193Z" fill="#fff" stroke="#8aaec7" strokeWidth="4"/>
          <path d="M128 111 Q134 101 151 101 L226 101 L226 157 L111 157Z" fill="#cfe7f7" stroke="#8aaec7" strokeWidth="3"/>
          <path d="M239 101 L389 101 Q405 102 416 118 L444 157 L239 157Z" fill="#cfe7f7" stroke="#8aaec7" strokeWidth="3"/>
          <path d="M82 172 L477 172 L477 195 L82 195Z" fill="#15548b"/>
          <path d="M82 181 L477 181" stroke="#4da1df" strokeWidth="5"/>
          <path d="M93 163 L110 163 M455 163 L475 163" stroke="#f6c66b" strokeWidth="7" strokeLinecap="round"/>
          <circle cx="151" cy="207" r="25" fill="#203c50"/><circle cx="151" cy="207" r="11" fill="#dce8ef"/>
          <circle cx="415" cy="207" r="25" fill="#203c50"/><circle cx="415" cy="207" r="11" fill="#dce8ef"/>
          <text x="286" y="146" textAnchor="middle" fontSize="19" fontWeight="800" fill="#164d7c">LAJU JAGAT</text>
          <path d="M70 191 L52 191 L52 178 L73 178 M493 190 L510 190 L510 176 L491 176" fill="none" stroke="#8aaec7" strokeWidth="4"/>
        </svg>
        <span className="art-caption">Nyaman di setiap perjalanan</span>
      </div>
      <p className="hero-copy">Cari jadwal, pilih kursi, dan rencanakan perjalanan Anda dalam beberapa langkah.</p>
      <form className="search-panel" onSubmit={search}>
        <div className="field"><label htmlFor="origin">Kota asal</label><select id="origin" value={origin} onChange={e => { setOrigin(e.target.value); if (e.target.value === destination) setDestination(locations.destinations.find(value => value !== e.target.value) ?? ""); }} required><option value="">Pilih kota asal</option>{locations.origins.map(value => <option key={value}>{value}</option>)}</select></div>
        <button className="swap" type="button" aria-label="Tukar kota" onClick={() => { setOrigin(destination); setDestination(origin); }}>↔</button>
        <div className="field"><label htmlFor="destination">Kota tujuan</label><select id="destination" value={destination} onChange={e => setDestination(e.target.value)} required><option value="">Pilih kota tujuan</option>{locations.destinations.filter(value => value !== origin).map(value => <option key={value}>{value}</option>)}</select></div>
        <div className="field"><label htmlFor="date">Tanggal berangkat</label><input id="date" type="date" value={date} min={localDate()} onChange={e => setDate(e.target.value)} required /></div>
        <div className="field"><label htmlFor="count">Penumpang</label><select id="count" value={count} onChange={e => setCount(e.target.value)}>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} orang</option>)}</select></div>
        <button className="primary search-btn" type="submit" disabled={loading}>Cari jadwal <span aria-hidden>→</span></button>
      </form>
      <p className="hero-note"><span className="dot"/> Jadwal dan kursi diambil dari data operasional.</p>
    </div></section>

    <section className="content" id="jadwal">
      <div className="section-heading"><div><p className="eyebrow">PILIH PERJALANAN</p><h2>{searched ? `${origin} ke ${destination}` : "Jadwal keberangkatan"}</h2><p className="muted">{searched ? new Date(date+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "Pilih kota, tanggal, dan jumlah penumpang."}</p></div>{searched && <span className="result-count">{trips.length} jadwal</span>}</div>
      {error && <p className="notice" role="alert">{error}</p>}
      {!searched ? <div className="empty-state"><div className="empty-icon">↗</div><h3>Perjalanan Anda dimulai di sini</h3><p>Isi kota asal, tujuan, dan tanggal untuk melihat jadwal yang tersedia.</p></div>
      : loading && trips.length === 0 ? <div className="empty-state"><p>Memuat jadwal...</p></div>
      : trips.length === 0 ? <div className="empty-state"><h3>Belum ada jadwal tersedia</h3><p>Belum ada perjalanan aktif untuk rute dan tanggal tersebut.</p></div>
      : <div className="trip-list">{trips.map(trip => <article className={`trip-card ${active === trip.id ? "trip-active" : ""}`} key={trip.id}>
        <div className="trip-time"><strong>{time(trip.departureAt)}</strong><span>{trip.origin}</span></div>
        <div className="trip-route"><span className="route-line"/><small>{Math.max(0, Math.round((new Date(trip.arrivalAt).getTime()-new Date(trip.departureAt).getTime())/60000))} menit</small></div>
        <div className="trip-time"><strong>{time(trip.arrivalAt)}</strong><span>{trip.destination}</span></div>
        <div className="trip-meta"><b>{trip.vehicle}</b><span>{trip.availableSeats} kursi tersedia</span></div>
        <div className="trip-price"><strong>{money(trip.price)}</strong><span>/ kursi</span><button className="outline-btn" onClick={() => { setActive(active === trip.id ? null : trip.id); setSelected([]); setNotice(""); setBooking(null); }}>Pilih kursi</button></div>
      </article>)}</div>}

      {activeTrip && <section className="seat-section">
        <div className="seat-heading"><div><p className="eyebrow">DENAH KURSI</p><h3>{activeTrip.vehicle}</h3><p className="muted">Pilih {count} kursi. Harga {money(activeTrip.price)} per kursi.</p></div><button className="text-btn" onClick={() => { setActive(null); setSelected([]); }}>Tutup</button></div>
        <div className="seat-layout"><div className="driver">Sopir <span>Depan</span></div><div className="seat-grid">{orderedSeats.map(seat => <button key={seat.seatNo} disabled={booking !== null || seat.status !== "AVAILABLE"} aria-pressed={selected.includes(seat.seatNo)} className={`seat ${seat.status !== "AVAILABLE" ? "booked" : selected.includes(seat.seatNo) ? "chosen" : ""}`} onClick={() => toggleSeat(seat)}>{seat.seatNo}</button>)}</div>
          <div className="seat-legend"><span><i/> Tersedia</span><span><i className="legend-chosen"/> Dipilih</span><span><i className="legend-booked"/> Terkunci / Terisi</span></div>
        </div>
        <div className="seat-summary"><div><span className="muted">{selected.length} dari {count} kursi dipilih</span><strong>{money(selected.length * activeTrip.price)}</strong></div></div>
        {selected.length === Number(count) && !booking && <div className="booking-form">
          <h3>Data pemesan</h3>
          <div className="field"><label htmlFor="customerName">Nama lengkap</label><input id="customerName" value={customerName} onChange={e=>setCustomerName(e.target.value)} minLength={2} required placeholder="Nama sesuai identitas"/></div>
          <div className="field"><label htmlFor="customerPhone">Nomor WhatsApp</label><input id="customerPhone" type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} required placeholder="Contoh: 081234567890"/></div>
          <div className="field"><label htmlFor="customerEmail">Email (opsional)</label><input id="customerEmail" type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="nama@email.com"/></div>
          {selected.map((seatNo) => <div className="field" key={seatNo}><label htmlFor={`passenger-${seatNo}`}>Nama penumpang kursi {seatNo}</label><input id={`passenger-${seatNo}`} value={passengerNames[seatNo] ?? customerName} onChange={e=>setPassengerNames(current=>({...current,[seatNo]:e.target.value}))} minLength={2} required /></div>)}
          <button className="primary" disabled={loading || customerName.trim().length < 2 || !/^\\+?[0-9]{9,15}$/.test(customerPhone.trim()) || selected.some(seatNo=>(passengerNames[seatNo] ?? customerName).trim().length < 2)} onClick={lockSeats}>Kunci kursi 15 menit <span aria-hidden>→</span></button>
        </div>}
        {booking && <div className="notice" role="status"><b>Kode booking: {booking.bookingCode}</b><p>Kursi ditahan sampai {new Date(booking.expiresAt).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}. Total: {money(booking.amount)}.</p><p>Lanjutkan pembayaran melalui halaman aman Xendit sebelum batas waktu berakhir.</p><button className="primary" disabled={loading} onClick={startPayment}>{loading ? "Menyiapkan pembayaran..." : "Bayar dengan Xendit →"}</button>{checkoutUrl && <p><a href={checkoutUrl}>Buka halaman pembayaran Xendit</a></p>}</div>}
        {notice && !booking && <p className="notice" role="status">{notice}</p>}
      </section>}
    </section>
    <section className="help-band" id="bantuan"><div><p className="eyebrow">BUTUH BANTUAN?</p><h2>Perjalanan lebih tenang<br/>dimulai dari informasi yang jelas.</h2></div><p>Informasi kontak resmi dan kanal bantuan akan ditambahkan setelah data operasional dikonfirmasi.</p></section>
    <footer id="cek"><a className="brand" href="#"><span className="brand-mark">LJ</span><span>Travel <b>Laju Jagat</b></span></a><span>© {new Date().getFullYear()} Travel Laju Jagat</span><a href="#jadwal">Kembali ke atas ↑</a></footer>
  </main>;
}
