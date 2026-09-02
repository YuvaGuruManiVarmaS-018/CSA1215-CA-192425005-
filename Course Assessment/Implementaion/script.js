const $=id=>document.getElementById(id);
const navItems=document.querySelectorAll(".nav-item"), views=document.querySelectorAll(".view"), title=$("viewTitle");
const titles={dashboard:"System Dashboard",booth:"Booth Multiplier",division:"Restoring Division",fp:"IEEE-754 Unit",pipeline:"Pipeline Lab",cache:"Cache Simulator",dma:"DMA / ADC"};
function go(v){views.forEach(x=>x.classList.toggle("active",x.id===v));navItems.forEach(x=>x.classList.toggle("active",x.dataset.view===v));title.textContent=titles[v];log("Opened "+titles[v]);window.scrollTo({top:0,behavior:"smooth"})}
navItems.forEach(n=>n.onclick=()=>go(n.dataset.view));document.querySelectorAll("[data-go]").forEach(x=>x.onclick=()=>go(x.dataset.go));
setInterval(()=>$("clock").textContent=new Date().toLocaleTimeString([], {hour12:false}),1000);

function log(s){let d=document.createElement("div");d.className="log-line";d.innerHTML="<b>["+new Date().toLocaleTimeString([], {hour12:false})+"]</b> "+s;$("log").prepend(d)}
$("clearLog").onclick=()=>$("log").innerHTML="";
log("Reference model ready.");log("Architecture loaded: Booth + division + FP + pipeline + cache + DMA.");

let boothSteps=[],boothPos=0,boothTimer;
function bits8(n){return ((n<0?n+256:n)&255).toString(2).padStart(8,"0")}
function boothPrepare(){let M=+$("boothM").value,Q0=+$("boothQ").value;if(M>127||M<-128||Q0>127||Q0<-128)return;
let q=Q0<0?Q0+256:Q0,a=0,qm=0;boothSteps=[{a,q,qm,act:"Initial"}];
for(let i=1;i<=8;i++){let pair=(q&1)*2+qm;let act="None";if(pair===1){a=(a+M)&255;act="A = A + M"}if(pair===2){a=(a-M)&255;act="A = A − M"}let sign=(a&128)?128:0;let newQ=((a&1)<<7)|(q>>1);a=(a>>1)|sign;q=newQ;qm=pair===1?1:pair===2?0:(q&1);boothSteps.push({a,q,qm,act})}
boothPos=0;renderBooth();renderBoothRows();log("Booth prepared for "+M+" × "+Q0)}
function renderBooth(){let s=boothSteps[boothPos];$("regA").textContent=bits8(s.a);$("regQ").textContent=bits8(s.q);$("regQm1").textContent=s.qm;$("boothStep").textContent=boothPos;let M=+$("boothM").value,Q=+$("boothQ").value;$("boothResult").textContent=(M*Q).toString().replace("-","−")}
function renderBoothRows(){ $("boothTrack").innerHTML=boothSteps.map((s,i)=>`<div class="trace-row ${i===boothPos?"active":""}"><span>${i}</span><b>${s.act}</b><span>A ${bits8(s.a)}</span><em>Q ${bits8(s.q)}</em></div>`).join("")}
$("runBooth").onclick=boothPrepare;$("boothNext").onclick=()=>{if(!boothSteps.length)boothPrepare();if(boothPos<8){boothPos++;renderBooth();renderBoothRows()}else log("Booth complete: "+$("boothResult").textContent)};
$("boothAuto").onclick=()=>{if(!boothSteps.length)boothPrepare();clearInterval(boothTimer);boothTimer=setInterval(()=>{if(boothPos>=8){clearInterval(boothTimer);return}boothPos++;renderBooth();renderBoothRows()},450)};

$("runDiv").onclick=()=>{let n=+$("divN").value,d=+$("divD").value;if(d===0){$("divStatus").textContent="ERROR · DIVIDE BY ZERO";$("divStatus").style.color="var(--red)";return}let q=Math.trunc(n/d),r=n%d;$("divResult").textContent=String(q).replace("-","−");$("remResult").textContent=r;$("divStatus").textContent="COMPLETE · remainder restored to 0";$("divStatus").style.color="var(--lime)";let mag=Math.abs(n),dm=Math.abs(d),steps=Math.max(4,Math.ceil(Math.log2(Math.max(mag,1))));$("divProcess").innerHTML=Array.from({length:8},(_,i)=>`<div class="proc"><b>STEP ${i+1}</b><strong>${i<steps?"SHIFT":"—"}</strong><small>${i<steps?(i%2?"subtract D":"bring down bit"):"complete"}</small></div>`).join("");log("Division: "+n+" ÷ "+d+" = "+q+" remainder "+r)};

function floatHex(v){let b=new ArrayBuffer(4),f=new Float32Array(b),u=new Uint32Array(b);f[0]=v;return"0x"+u[0].toString(16).padStart(8,"0").toUpperCase()}
function fpBits(v){let b=new ArrayBuffer(4),f=new Float32Array(b),u=new Uint32Array(b);f[0]=v;let s=u[0].toString(2).padStart(32,"0");return[s[0],s.slice(1,9),s.slice(9)]}
$("runFP").onclick=()=>{let x=+$("fpX").value,y=+$("fpY").value,op=$("fpOp").value;let r=op==="+"?x+y:x-y;let f32=new Float32Array([r])[0];$("fpResult").textContent=String(f32);$("fpHex").textContent=floatHex(f32);let inf=!Number.isFinite(f32);$("fpStatus").textContent=inf?"OVERFLOW → +∞":"EXACT / REPRESENTABLE";let bits=fpBits(f32);$("fpSign").textContent=bits[0];$("fpExp").textContent=bits[1];$("fpFrac").textContent=bits[2];log("FP result: "+x+" "+op+" "+y+" = "+f32)};

let forwarding=true,branch=false;
$("forwardToggle").onclick=()=>{forwarding=!forwarding;$("forwardToggle").classList.toggle("on",forwarding);updatePipe()};
$("branchToggle").onclick=()=>{branch=!branch;$("branchToggle").classList.toggle("on",branch);updatePipe()};
$("runPipe").onclick=()=>{updatePipe();log("Pipeline executed with forwarding="+forwarding)};
function updatePipe(){let cycles=forwarding?10:13,stalls=forwarding?1:4;$("pipeCycles").textContent=cycles;$("pipeStalls").textContent=stalls;$("pipeImprove").textContent=((13-cycles)/13*100).toFixed(1)+"%";$("dashCycles").textContent=cycles;let names=["I1","I2","I3","I4","I5"];let starts=forwarding?[0,2,3,4,5]:[0,3,5,7,9];$("timeline").innerHTML=names.map((n,r)=>{let row=`<div class="pipe-row"><label>${n}</label>`;for(let c=0;c<14;c++){let stage=["IF","ID","EX","MEM","WB"][(c-starts[r])];let filled=stage&&c>=starts[r]&&c<starts[r]+5;let stall=forwarding&&r===1&&c===2||!forwarding&&r>0&&c===starts[r]-1;row+=`<div class="cell ${filled?"filled":""} ${stall?"stall":""}">${filled?stage:stall?"ST":""}</div>`}return row+"</div>"}).join("")}
updatePipe();

function runCache(){let trace=$("traceInput").value.split(",").map(x=>parseInt(x.trim())).filter(Number.isFinite);let dm=new Array(4).fill(null),tw=Array.from({length:4},()=>[null,null]),dh=0,th=0;
trace.forEach(a=>{let i=a%4;if(dm[i]===a)dh++;else dm[i]=a;let set=a%4,way=tw[set].indexOf(a);if(way>=0)th++;else{tw[set][0]=tw[set][1]??a;tw[set][1]=a}});
let miss=trace.length-dh,tm=trace.length-th;$("dmHits").textContent=dh;$("dmMiss").textContent=miss;$("dmAmat").textContent=(1+(miss/Math.max(trace.length,1))*12).toFixed(2);$("twHits").textContent=th;$("twMiss").textContent=tm;$("twAmat").textContent=(1+(tm/Math.max(trace.length,1))*12).toFixed(2);
$("dmGrid").innerHTML=dm.map((x,i)=>`<div class="cache-cell ${x!=null?"hit":""}"><b>SET ${i}</b><br>${x??"EMPTY"}</div>`).join("");$("twGrid").innerHTML=tw.map((x,i)=>`<div class="cache-cell ${x[0]!=null?"hit":""}"><b>SET ${i}</b><br>A: ${x[0]??"—"}<br>B: ${x[1]??"—"}</div>`).join("");log("Cache trace: DM "+dh+"/"+trace.length+" hits; 2-way "+th+"/"+trace.length+" hits")}
$("runCache").onclick=runCache;runCache();

let dmaTimer=null,dmaCount=0,block=8;
function setupBuffer(){block=+$("blockSize").value;dmaCount=0;$("dmaCount").textContent="0 / "+block;$("bufferCells").innerHTML=Array.from({length:block},()=>'<span class="buf"></span>').join("");$("bufferPct").textContent="0%"}
function startDma(){setupBuffer();clearInterval(dmaTimer);dmaTimer=setInterval(()=>{dmaCount++;let cells=document.querySelectorAll(".buf");cells[dmaCount-1].classList.add("filled");let val=Math.floor(300+Math.random()*700);$("adcValue").textContent=val;$("dmaCount").textContent=dmaCount+" / "+block;$("bufferPct").textContent=Math.round(dmaCount/block*100)+"%";$("cpuState").textContent="SLEEP";if(dmaCount>=block){$("cpuState").textContent="PROCESS";log("DMA block transferred: "+block+" samples");clearInterval(dmaTimer);setTimeout(()=>{$("cpuState").textContent="SLEEP"},600)}},180)}
$("startDma").onclick=startDma;$("stopDma").onclick=()=>{clearInterval(dmaTimer);$("cpuState").textContent="STOPPED";log("DMA stream stopped")};$("blockSize").onchange=setupBuffer;setupBuffer();
