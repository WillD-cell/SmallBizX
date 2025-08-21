import express from "express";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";

const app = express();
const PORT = process.env.PORT || 3000;
const APP_NAME = process.env.APP_NAME || "SmallBizX";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

// --- DB: a file right in Replit/GitHub clone ---
const db = new Database("smallbizx.db");
db.exec(`
  create table if not exists listings (
    id text primary key,
    title text not null,
    category text not null,
    location text,
    description text,
    price_usd real not null,
    equity_percent real,
    logo_url text,
    pay_url text not null,
    status text not null default 'LIVE',
    created_at text not null default (datetime('now'))
  );
`);
const q = {
  insert: db.prepare(`insert into listings (id,title,category,location,description,price_usd,equity_percent,logo_url,pay_url,status) values (@id,@title,@category,@location,@description,@price_usd,@equity_percent,@logo_url,@pay_url,@status)`),
  update: db.prepare(`update listings set title=@title,category=@category,location=@location,description=@description,price_usd=@price_usd,equity_percent=@equity_percent,logo_url=@logo_url,pay_url=@pay_url,status=@status where id=@id`),
  del: db.prepare(`delete from listings where id=?`),
  get: db.prepare(`select * from listings where id=?`),
  live: db.prepare(`select * from listings where status='LIVE' order by datetime(created_at) desc`),
  all: db.prepare(`select * from listings order by datetime(created_at) desc`)
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (Math.round(Number(n)*100)/100).toFixed(2);

// ---------- homepage (buyers) ----------
app.get("/", (_req, res) => {
  const rows = q.live.all();
  const cards = rows.length ? rows.map(r => `
    <a class="card" href="/checkout?id=${encodeURIComponent(r.id)}">
      <div class="img" style="background-image:url('${esc(r.logo_url)}')"></div>
      <div class="info">
        <h3>${esc(r.title)}</h3>
        <div class="meta">
          <span class="badge">${esc(r.category)}</span>
          ${r.location ? `<span class="dot"></span><span>${esc(r.location)}</span>` : ""}
        </div>
        <div class="price">$${money(r.price_usd)} ${r.equity_percent ? `• ${esc(r.equity_percent)}% equity` : ""}</div>
        <button>Buy / Invest</button>
      </div>
    </a>`).join("") : `<p>No listings yet.</p>`;
  res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${APP_NAME}</title>
<style>
:root{--bg:#0b0c10;--card:#111317;--fg:#e8e8f0;--muted:#9aa3b2;--accent:#6ee7b7}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:16px system-ui,Segoe UI,Roboto}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #151820}
a.logo{font-weight:800;color:var(--fg);text-decoration:none}
.wrap{max-width:1100px;margin:0 auto;padding:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.card{background:var(--card);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;border:1px solid #1c212b;display:flex;flex-direction:column}
.card .img{width:100%;height:150px;background:#0f1218 center/cover no-repeat}
.card .info{padding:12px}
.meta{display:flex;align-items:center;color:var(--muted);font-size:13px;margin:2px 0 6px}
.badge{background:#1a2130;border:1px solid #283041;border-radius:999px;padding:3px 8px;margin-right:8px}
.dot{width:4px;height:4px;border-radius:50%;background:#394150;margin:0 8px}
.price{font-weight:700;margin:10px 0 12px}
button{background:var(--accent);border:0;padding:10px 12px;border-radius:10px;font-weight:700;cursor:pointer}
footer{opacity:.7;font-size:12px;text-align:center;margin:20px 0}
nav a{color:#9aa3b2;margin-left:12px;text-decoration:none}
</style></head><body>
<header>
  <a class="logo" href="/">${esc(APP_NAME)}</a>
  <nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/admin">Admin</a></nav>
</header>
<div class="wrap"><h2>Live Listings</h2><div class="grid">${cards}</div></div>
<footer>5% platform fee shown at checkout • USD only</footer>
</body></html>`);
});

// ---------- checkout (shows 5% fee and forwards to seller pay link) ----------
app.get("/checkout", (req, res) => {
  const id = String(req.query.id || "");
  const r = q.get.get(id);
  if (!r || r.status !== "LIVE") return res.status(404).send("Listing not found.");
  const base = Number(r.price_usd);
  const fee = Math.round(base * 0.05 * 100)/100;
  const total = Math.round((base + fee) * 100)/100;
  const payUrl = r.pay_url || "#";
  res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Checkout • ${esc(r.title)}</title>
<style>
body{margin:0;background:#0b0c10;color:#e8e8f0;font:16px system-ui} .wrap{max-width:720px;margin:0 auto;padding:24px}
.box{background:#111317;border:1px solid #1c212b;border-radius:14px;padding:20px}
.row{display:flex;justify-content:space-between;margin:8px 0;color:#cbd2e1}
.row .v{font-weight:700;color:#fff}
.head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.img{width:56px;height:56px;border-radius:10px;background:#0f1218 center/cover no-repeat}
.muted{color:#9aa3b2}
.pay{margin-top:18px}
a.btn{display:inline-block;background:#6ee7b7;color:#000;text-decoration:none;font-weight:800;padding:12px 14px;border-radius:10px}
</style></head><body>
<div class="wrap">
  <div class="box">
    <div class="head">
      <div class="img" style="background-image:url('${esc(r.logo_url)}')"></div>
      <div><h2 style="margin:0">${esc(r.title)}</h2>
      <div class="muted">${esc(r.category)} ${r.equity_percent ? "• "+esc(r.equity_percent)+"% equity" : ""}</div></div>
    </div>
    <div class="row"><div>Base price</div><div class="v">$${money(base)}</div></div>
    <div class="row"><div>Platform fee (5%)</div><div class="v">$${money(fee)}</div></div>
    <div class="row" style="border-top:1px solid #1c212b;padding-top:8px"><div>Total</div><div class="v">$${money(total)}</div></div>
    <div class="pay"><a class="btn" href="${esc(payUrl)}" target="_blank" rel="noopener">Pay $${money(total)}</a></div>
    <p class="muted" style="margin-top:10px">You’ll complete payment on the seller’s checkout page (Gumroad/Stripe/LemonSqueezy).</p>
  </div>
  <p style="text-align:center;margin-top:14px"><a href="/">← Back to listings</a></p>
</div></body></html>`);
});

// ---------- admin (protected by ?key=ADMIN_KEY) ----------
const guard = (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) {
    res.status(401).send("Unauthorized. Append ?key=YOUR_ADMIN_KEY to the URL."); return false;
  } return true;
};

app.get("/admin", (req, res) => {
  if (!guard(req, res)) return;
  const rows = q.all.all();
  const list = rows.map(r => `<tr>
    <td>${esc(r.title)}</td><td>${esc(r.category)}</td><td>$${money(r.price_usd)}</td>
    <td>${r.equity_percent ?? ""}</td><td>${esc(r.status)}</td>
    <td>
      <a href="/checkout?id=${encodeURIComponent(r.id)}" target="_blank">View</a> |
      <a href="/admin/edit?id=${encodeURIComponent(r.id)}&key=${encodeURIComponent(ADMIN_KEY)}">Edit</a> |
      <a href="/admin/delete?id=${encodeURIComponent(r.id)}&key=${encodeURIComponent(ADMIN_KEY)}" onclick="return confirm('Delete listing?')">Delete</a>
    </td>
  </tr>`).join("") || `<tr><td colspan="6">No listings yet</td></tr>`;
  res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin • ${esc(APP_NAME)}</title>
<style>
body{font:14px system-ui;margin:20px} input,select,textarea{width:100%;padding:8px;margin:4px 0}
table{border-collapse:collapse;width:100%;margin-top:14px} td,th{border:1px solid #ccc;padding:8px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
</style></head><body>
<h2>${esc(APP_NAME)} — Admin</h2>
<form method="post" action="/admin/create?key=${encodeURIComponent(ADMIN_KEY)}">
  <div class="grid">
    <div><label>Title<input name="title" required></label></div>
    <div><label>Category
      <select name="category" required>
        <option>Business Idea</option><option>Patent</option><option>Equity/Shares</option>
        <option>Side Hustle</option><option>Digital Asset</option><option>Other</option>
      </select></label></div>
    <div><label>Location<input name="location" placeholder="Remote/Global"></label></div>
    <div><label>Price USD<input name="price_usd" type="number" step="0.01" min="0" required></label></div>
    <div><label>Equity % (optional)<input name="equity_percent" type="number" step="0.01" min="0" max="100"></label></div>
    <div><label>Logo URL<input name="logo_url" placeholder="https://..."></label></div>
    <div style="grid-column:1/-1"><label>Description<textarea name="description" rows="4"></textarea></label></div>
    <div style="grid-column:1/-1"><label>Payment URL (Gumroad/Stripe/LemonSqueezy) <input name="pay_url" required placeholder="https://..."></label></div>
    <div><label>Status
      <select name="status"><option>LIVE</option><option>DRAFT</option><option>CLOSED</option></select></label></div>
  </div>
  <button type="submit">Create Listing</button>
</form>
<h3>All Listings</h3>
<table>
  <tr><th>Title</th><th>Category</th><th>Price</th><th>Equity</th><th>Status</th><th>Actions</th></tr>
  ${list}
</table>
</body></html>`);
});

app.post("/admin/create", (req, res) => {
  if (!guard(req, res)) return;
  const row = {
    id: nanoid(10),
    title: req.body.title || "",
    category: req.body.category || "Other",
    location: req.body.location || "",
    description: req.body.description || "",
    price_usd: Number(req.body.price_usd || 0),
    equity_percent: req.body.equity_percent ? Number(req.body.equity_percent) : null,
    logo_url: req.body.logo_url || "",
    pay_url: req.body.pay_url || "",
    status: req.body.status || "LIVE"
  };
  q.insert.run(row);
  res.redirect(`/admin?key=${encodeURIComponent(ADMIN_KEY)}`);
});

app.get("/admin/edit", (req, res) => {
  if (!guard(req, res)) return;
  const r = q.get.get(String(req.query.id||""));
  if (!r) return res.status(404).send("Not found");
  res.send(`<!doctype html><html><body style="font:14px system-ui;margin:20px">
<h2>Edit Listing</h2>
<form method="post" action="/admin/update?key=${encodeURIComponent(ADMIN_KEY)}">
  <input type="hidden" name="id" value="${esc(r.id)}"/>
  <label>Title <input name="title" value="${esc(r.title)}" required></label><br/>
  <label>Category
    <select name="category">
      ${["Business Idea","Patent","Equity/Shares","Side Hustle","Digital Asset","Other"].map(o=>`<option${o===r.category?" selected":""}>${o}</option>`).join("")}
    </select>
  </label><br/>
  <label>Location <input name="location" value="${esc(r.location||"")}"></label><br/>
  <label>Price USD <input name="price_usd" type="number" step="0.01" value="${money(r.price_usd)}" required></label><br/>
  <label>Equity % <input name="equity_percent" type="number" step="0.01" min="0" max="100" value="${r.equity_percent ?? ""}"></label><br/>
  <label>Logo URL <input name="logo_url" value="${esc(r.logo_url||"")}"></label><br/>
  <label>Description <br/><textarea name="description" rows="5">${esc(r.description||"")}</textarea></label><br/>
  <label>Payment URL <input name="pay_url" value="${esc(r.pay_url||"")}" required></label><br/>
  <label>Status
    <select name="status">
      ${["LIVE","DRAFT","CLOSED"].map(o=>`<option${o===r.status?" selected":""}>${o}</option>`).join("")}
    </select>
  </label><br/><br/>
  <button type="submit">Save</button> • <a href="/admin?key=${encodeURIComponent(ADMIN_KEY)}">Cancel</a>
</form>
</body></html>`);
});

app.post("/admin/update", (req, res) => {
  if (!guard(req, res)) return;
  const row = {
    id: req.body.id,
    title: req.body.title,
    category: req.body.category,
    location: req.body.location || "",
    description: req.body.description || "",
    price_usd: Number(req.body.price_usd || 0),
    equity_percent: req.body.equity_percent ? Number(req.body.equity_percent) : null,
    logo_url: req.body.logo_url || "",
    pay_url: req.body.pay_url || "",
    status: req.body.status || "LIVE"
  };
  q.update.run(row);
  res.redirect(`/admin?key=${encodeURIComponent(ADMIN_KEY)}`);
});

app.get("/admin/delete", (req, res) => {
  if (!guard(req, res)) return;
  q.del.run(String(req.query.id||""));
  res.redirect(`/admin?key=${encodeURIComponent(ADMIN_KEY)}`);
});

// ---------- legal pages (very simple placeholders; get real legal advice before launch) ----------
app.get("/terms", (_req, res) => {
  res.send(`<!doctype html><html><body style="font:14px/1.5 system-ui;max-width:800px;margin:40px auto;padding:0 16px">
<h1>Terms of Use — ${esc(APP_NAME)}</h1>
<p>This is a peer-to-peer marketplace for selling ideas, patents and equity/shares. ${esc(APP_NAME)} provides listing, discovery and checkout redirection only. We do not own, review or guarantee any listing.</p>
<p><strong>Platform Fee:</strong> A 5% platform fee is shown at checkout.</p>
<p><strong>No Financial Advice:</strong> Listings may involve risk. Nothing on this site is investment, legal, accounting or tax advice.</p>
<p><strong>Third-Party Payments:</strong> Payments are completed on external processors (e.g., Stripe, Gumroad, LemonSqueezy). Refunds, chargebacks and disputes are handled by the processor and/or the seller.</p>
<p><strong>Seller Responsibility:</strong> Sellers are solely responsible for the accuracy and legality of their listings, including intellectual property and securities compliance in their jurisdiction.</p>
<p><strong>Jurisdiction:</strong> Operated from Jersey, Channel Islands. You agree that use of the service must comply with local laws where you and the seller reside. ${esc(APP_NAME)} disclaims liability to the maximum extent permitted by law.</p>
<p><strong>Prohibited:</strong> illegal goods/services, unlicensed financial services, deceptive claims.</p>
<p>By using this service, you agree to these terms.</p>
<p><a href="/">Back</a></p>
</body></html>`);
});

app.get("/privacy", (_req, res) => {
  res.send(`<!doctype html><html><body style="font:14px/1.5 system-ui;max-width:800px;margin:40px auto;padding:0 16px">
<h1>Privacy Policy — ${esc(APP_NAME)}</h1>
<p>We store listing data you submit and basic usage logs for security and debugging. We do not process card data; payments occur on third‑party processors. Those processors have their own privacy policies.</p>
<p>You may request deletion of your listings by contacting support.</p>
<p>We may update this policy as the service evolves.</p>
<p><a href="/">Back</a></p>
</body></html>`);
});

app.listen(PORT, () => console.log(`${APP_NAME} running on http://localhost:${PORT}`));
