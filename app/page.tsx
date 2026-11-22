"use client";

import { useMemo, useState } from "react";

type Trip = { id: string; from: string; to: string; time: string; duration: string; vehicle: string; price: number; seats: number };
const trips: Trip[] = [
  { id: "lj-0715", from: "Yogyakarta", to: "Semarang", time: "07.15", duration: "3 jam 30 menit", vehicle: "Toyota Hiace Premio · 10 kursi", price: 165000, seats: 4 },
  { id: "lj-1030", from: "Yogyakarta", to: "Semarang", time: "10.30", duration: "3 jam 30 menit", vehicle: "Toyota Hiace Premio · 10 kursi", price: 165000, seats: 7 },
  { id: "lj-1400", from: "Yogyakarta", to: "Semarang", time: "14.00", duration: "3 jam 30 menit", vehicle: "Isuzu Elf Long · 16 kursi", price: 145000, seats: 9 },
];
const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function Home() {
  const [origin, setOrigin] = useState("Yogyakarta");
  const [destination, setDestination] = useState("Semarang");
  const [date, setDate] = useState("");
  const [count, setCount] = useState("1");
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const results = useMemo(() => trips.filter(t => t.from === origin && t.to === destination), [origin, destination]);
  const activeTrip = results.find(t => t.id === active);
  const seats = Array.from({ length: activeTrip?.vehicle.includes("16") ? 16 : 10 }, (_, i) => String(i + 1));
  const unavailable = active === "lj-0715" ? ["2", "5", "8", "10"] : active === "lj-1030" ? ["1", "3", "4"] : ["2"];
  function search() { setSearched(true); setActive(null); setSelected([]); setNotice(""); }
  function toggleSeat(no: string) { if (unavailable.includes(no)) return; setSelected(s => s.includes(no) ? s.filter(x => x !== no) : s.length < Number(count) ? [...s, no] : s); }
  return <main>
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">LJ</span><span>Travel <b>Laju Jagat</b></span></a><nav><a href="#jadwal">Jadwal</a><a href="#bantuan">Bantuan</a><a className="nav-link" href="#cek">Cek pesanan</a></nav></header>
    <section className="hero"><div className="hero-inner"><p className="eyebrow">PERJALANAN ANTAR KOTA</p><h1>Berangkat nyaman.<br/><span>Sampai tujuan.</span></h1><p className="hero-copy">Cari jadwal, pilih kursi, dan rencanakan perjalanan Anda dalam beberapa langkah.</p>
      <form className="search-panel" onSubmit={e => { e.preventDefault(); search(); }}><div className="field"><label htmlFor="origin">Kota asal</label><select id="origin" value={origin} onChange={e => setOrigin(e.target.value)}><option>Yogyakarta</option><option>Semarang</option><option>Temanggung</option><option>Magelang</option></select></div><button className="swap" type="button" aria-label="Tukar kota" onClick={() => { setOrigin(destination); setDestination(origin); }}>↔</button><div className="field"><label htmlFor="destination">Kota tujuan</label><select id="destination" value={destination} onChange={e => setDestination(e.target.value)}><option>Semarang</option><option>Yogyakarta</option><option>Temanggung</option><option>Magelang</option></select></div><div className="field"><label htmlFor="date">Tanggal berangkat</label><input id="date" type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={e => setDate(e.target.value)} required /></div><div className="field"><label htmlFor="count">Penumpang</label><select id="count" value={count} onChange={e => setCount(e.target.value)}>{[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} orang</option>)}</select></div><button className="primary search-btn" type="submit">Cari jadwal <span aria-hidden>→</span></button></form>
      <p className="hero-note"><span className="dot"/> Informasi perjalanan jelas, dari awal sampai tiba.</p>
    </div></section>
    <section className="content" id="jadwal"><div className="section-heading"><div><p className="eyebrow">PILIH PERJALANAN</p><h2>{searched ? `${origin} ke ${destination}` : "Jadwal keberangkatan"}</h2><p className="muted">{searched && date ? new Date(date+"T00:00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "Pilih jadwal yang sesuai dengan rencana Anda."}</p></div>{searched && <span className="result-count">{results.length} jadwal</span>}</div>
      {!searched ? <div className="empty-state"><div className="empty-icon">↗</div><h3>Perjalanan Anda dimulai di sini</h3><p>Isi kota asal, tujuan, dan tanggal untuk melihat jadwal yang tersedia.</p></div> : results.length === 0 ? <div className="empty-state"><h3>Belum ada jadwal untuk rute ini</h3><p>Coba pilih kota lain atau tukar titik keberangkatan.</p></div> : <div className="trip-list">{results.map(trip => <article className={`trip-card ${active === trip.id ? "trip-active" : ""}`} key={trip.id}><div className="trip-time"><strong>{trip.time}</strong><span>{trip.from}</span></div><div className="trip-route"><span className="route-line"/><small>{trip.duration}</small></div><div className="trip-time"><strong>{trip.time === "07.15" ? "10.45" : trip.time === "10.30" ? "14.00" : "17.30"}</strong><span>{trip.to}</span></div><div className="trip-meta"><b>{trip.vehicle}</b><span>{trip.seats} kursi tersedia</span></div><div className="trip-price"><strong>{money(trip.price)}</strong><span>/ kursi</span><button className="outline-btn" onClick={() => { setActive(active === trip.id ? null : trip.id); setSelected([]); setNotice(""); }}>Pilih kursi</button></div></article>)}</div>}
      {activeTrip && <section className="seat-section"><div className="seat-heading"><div><p className="eyebrow">DENAH KURSI</p><h3>{activeTrip.vehicle}</h3><p className="muted">Pilih {count} kursi. Harga {money(activeTrip.price)} per kursi.</p></div><button className="text-btn" onClick={() => { setActive(null); setSelected([]); }}>Tutup</button></div><div className="seat-layout"><div className="driver">Sopir <span>Depan</span></div><div className="seat-grid">{seats.map(no => <button key={no} disabled={unavailable.includes(no)} aria-pressed={selected.includes(no)} className={`seat ${unavailable.includes(no) ? "booked" : selected.includes(no) ? "chosen" : ""}`} onClick={() => toggleSeat(no)}>{no}</button>)}</div><div className="seat-legend"><span><i/> Tersedia</span><span><i className="legend-chosen"/> Dipilih</span><span><i className="legend-booked"/> Terisi</span></div></div><div className="seat-summary"><div><span className="muted">{selected.length} dari {count} kursi dipilih</span><strong>{money(selected.length * activeTrip.price)}</strong></div><button className="primary" disabled={selected.length !== Number(count)} onClick={() => setNotice("Pilihan kursi siap dilanjutkan. Penguncian kursi dan pembayaran akan aktif setelah backend pemesanan terhubung.")}>Lanjutkan <span aria-hidden>→</span></button></div>{notice && <p className="notice" role="status">{notice}</p>}</section>}
      <p className="demo-note">Jadwal dan ketersediaan yang tampil saat ini adalah data demonstrasi untuk pengembangan antarmuka, bukan inventaris keberangkatan aktual.</p>
    </section>
    <section className="help-band" id="bantuan"><div><p className="eyebrow">BUTUH BANTUAN?</p><h2>Perjalanan lebih tenang<br/>dimulai dari informasi yang jelas.</h2></div><p>Untuk pemesanan aktual, hubungi petugas Travel Laju Jagat melalui kanal resmi yang akan ditambahkan setelah data operasional dikonfirmasi.</p></section>
    <footer id="cek"><a className="brand" href="#"><span className="brand-mark">LJ</span><span>Travel <b>Laju Jagat</b></span></a><span>© {new Date().getFullYear()} Travel Laju Jagat</span><a href="#jadwal">Kembali ke atas ↑</a></footer>
  </main>;
}
