// UI helpers (no frameworks)
export const $ = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

export function fmtMoney(n){
  const v = Number(n||0);
  return v.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function today(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

export function toast(msg, ms=2200){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(()=> t.hidden = true, ms);
}

export function openModal({title, body, actions=[]}){
  const m = $("#modal");
  $("#modalTitle").textContent = title || "";
  const b = $("#modalBody");
  b.innerHTML = "";
  if (typeof body === "string") b.innerHTML = body;
  else b.appendChild(body);

  const foot = $("#modalFoot");
  foot.innerHTML = "";
  actions.forEach(a=>{
    const btn = document.createElement("button");
    btn.className = "btn " + (a.variant || "");
    btn.textContent = a.label;
    btn.onclick = async ()=>{
      try{
        if (a.onClick) await a.onClick();
      } finally {
        if (a.close !== false) closeModal();
      }
    };
    foot.appendChild(btn);
  });

  m.hidden = false;
  m.addEventListener("click", (e)=>{
    if (e.target === m) closeModal();
  }, { once:true });
}

export function closeModal(){
  $("#modal").hidden = true;
}

export function downloadBlob(filename, blob){
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

export function renderCanvasBarChart(canvas, labels, values){
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth * devicePixelRatio;
  const h = canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.clearRect(0,0,w,h);

  const pad = 24 * devicePixelRatio;
  const max = Math.max(1, ...values.map(v=>Math.abs(v)));
  const barW = (w - pad*2) / Math.max(1, values.length);

  // axes
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1 * devicePixelRatio;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "rgba(0,0,0,.2)";
  ctx.beginPath();
  ctx.moveTo(pad, h-pad);
  ctx.lineTo(w-pad, h-pad);
  ctx.stroke();

  values.forEach((v,i)=>{
    const x = pad + i*barW + barW*0.15;
    const bw = barW*0.7;
    const bh = (Math.abs(v) / max) * (h - pad*2);
    const y = (h-pad) - bh;

    // color via current theme (not hard-coded)
    ctx.fillStyle = v >= 0 ? getComputedStyle(document.documentElement).getPropertyValue("--success").trim() || "#10B981"
                           : getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "#F87171";
    ctx.globalAlpha = 0.8;
    roundRect(ctx, x, y, bw, bh, 10*devicePixelRatio);
    ctx.fill();

    // labels
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#64748B";
    ctx.font = `${12*devicePixelRatio}px sans-serif`;
    const lbl = labels[i] ?? "";
    ctx.save();
    ctx.translate(x + bw/2, h - pad + 14*devicePixelRatio);
    ctx.rotate(0);
    ctx.textAlign = "center";
    ctx.fillText(lbl, 0, 0);
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r){
  const min = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+min, y);
  ctx.arcTo(x+w, y, x+w, y+h, min);
  ctx.arcTo(x+w, y+h, x, y+h, min);
  ctx.arcTo(x, y+h, x, y, min);
  ctx.arcTo(x, y, x+w, y, min);
  ctx.closePath();
}
