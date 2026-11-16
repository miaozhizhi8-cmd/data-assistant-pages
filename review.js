const reviewCore={favorites:'收藏',totalClicks:'总点击',comments:'评论',points:'积分'};
function dayKey(time){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
function dailyRecords(records){
  const days=new Map();for(const r of [...records].sort((a,b)=>new Date(a.time)-new Date(b.time)))days.set(dayKey(r.time),r);
  return [...days.values()].sort((a,b)=>new Date(a.time)-new Date(b.time));
}
function targetDay(day,period){
  const [year,month,date]=day.split('-').map(Number);const d=new Date(Date.UTC(year,month-1,date));
  if(period==='week')d.setUTCDate(d.getUTCDate()-7);
  else if(period==='month'){d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);d.setUTCDate(Math.min(date,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()))}
  return d.toISOString().slice(0,10);
}
function reviewBaseline(records,period){
  const daily=dailyRecords(records),current=daily.at(-1);if(!current)return null;
  if(period==='previous')return daily.at(-2)||null;
  const target=targetDay(dayKey(current.time),period);return daily.filter(r=>dayKey(r.time)<=target).at(-1)||null;
}
function reviewDifference(current,base){if(current==null||base==null)return null;return current-base}
function cardDifference(records,key){
 const rows=[...records].sort((a,b)=>new Date(a.time)-new Date(b.time));
 return rows.length>1?reviewDifference(rows.at(-1)[key],rows.at(-2)[key]):null;
}
function cardChangeMarkup(records,key){
 const value=cardDifference(records,key);
 if(value===0)return '';
 return `<span class="${value>0?'change-up':value<0?'change-down':'muted'}">${value==null?'-':(value>0?'+':'')+reviewNumber(value)}</span>`;
}
function periodKey(time,mode){
  const day=dayKey(time);if(mode==='month')return day.slice(0,7);
  if(mode==='week'){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+3)%7));return d.toISOString().slice(0,10)}return day;
}
function periodRecords(records,mode='history'){
  const sorted=[...records].sort((a,b)=>new Date(a.time)-new Date(b.time));
  if(mode==='history')return sorted.map(r=>({...r,periodLabel:new Date(r.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}));
  const groups=new Map();for(const r of sorted)groups.set(periodKey(r.time,mode),r);
  return [...groups].map(([key,r])=>({...r,periodKey:key,periodLabel:mode==='week'?weekRange(key):mode==='month'?monthRange(key):key}));
}
function monthRange(key){const [year,month]=key.split('-').map(Number);const last=new Date(Date.UTC(year,month,0)).getUTCDate();return key.replace('-','.')+'.01~'+last}
function weekRange(key){const end=new Date(key+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);const last=end.toISOString().slice(0,10);return key.replaceAll('-','.')+'~'+(key.slice(0,7)===last.slice(0,7)?last.slice(8):key.slice(0,4)===last.slice(0,4)?last.slice(5).replace('-','.'):last.replaceAll('-','.'))}
function adjacentPeriod(key,mode){const d=new Date((key.length===7?key+'-01':key)+'T00:00:00Z');if(mode==='month')d.setUTCMonth(d.getUTCMonth()-1);else d.setUTCDate(d.getUTCDate()-(mode==='week'?7:1));return d.toISOString().slice(0,mode==='month'?7:10)}
function periodPrevious(rows,index,mode){if(index<1)return null;if(mode==='history'||mode==='day')return rows[index-1];return rows[index-1].periodKey===adjacentPeriod(rows[index].periodKey,mode)?rows[index-1]:null}
function reviewEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function reviewNumber(v){return v==null?'-':Number(v).toLocaleString('zh-CN')}
function reviewDelta(v,b){const n=reviewDifference(v,b);return n==null?'-':n===0?'/':`<span class="${n>0?'change-up':'change-down'}">${n>0?'+':''}${reviewNumber(n)}</span>`}
function reviewTable(rows,metrics,mode){
 if(!rows.length)return '<div class="empty">暂无数据记录</div>';
 return '<div class="table-wrap"><table class="record-table"><thead><tr><th>日期'+(mode==='week'?'<small style="font-weight:400;margin-left:8px">（周四 00:00 至下周三 23:59）</small>':mode==='day'?'<small style="font-weight:400;margin-left:8px">（同一天多个数据以最后一次为准）</small>':'')+'</th>'+Object.values(metrics).map(l=>'<th>'+reviewEscape(l)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((r,i)=>{const prev=periodPrevious(rows,i,mode),older=prev?periodPrevious(rows,i-1,mode):null;const keys=Object.keys(metrics);return '<tr><td>'+reviewEscape(r.periodLabel)+'</td>'+keys.map(k=>'<td>'+reviewNumber(r[k])+'</td>').join('')+'</tr><tr class="increment-row"><td>'+(mode==='week'?'本周新增':mode==='month'?'本月新增':'较上次')+'</td>'+keys.map(k=>'<td>'+reviewDelta(r[k],prev?.[k])+'</td>').join('')+'</tr>'+(['week','month'].includes(mode)?'<tr class="increment-row"><td>较上'+(mode==='week'?'周':'月')+'新增</td>'+keys.map(k=>'<td>'+reviewDelta(reviewDifference(r[k],prev?.[k]),reviewDifference(prev?.[k],older?.[k]))+'</td>').join('')+'</tr>':'')}).reverse().join('')+'</tbody></table></div>';
}
function reviewChart(rows,key,label){
 const vals=rows.filter(r=>r[key]!=null);if(!vals.length)return '<div class="empty">该指标暂无数据</div>';
 const W=1100,H=360,p=55,lo=Math.min(...vals.map(r=>r[key])),hi=Math.max(...vals.map(r=>r[key])),spread=Math.max(hi-lo,1),min=Math.max(0,lo-spread*.1),max=hi+spread*.1,x=i=>p+i/Math.max(rows.length-1,1)*(W-2*p),y=v=>H-p-(v-min)/(max-min)*(H-2*p);let last=null,shapes='';
 rows.forEach((r,i)=>{if(r[key]==null){last=null;return}if(last)shapes+=`<path d="M${last.x},${last.y} L${x(i)},${y(r[key])}" fill="none" stroke="var(--accent,#718ab8)" stroke-width="2.5"/>`;shapes+=`<circle cx="${x(i)}" cy="${y(r[key])}" r="4" fill="var(--accent,#718ab8)"><title>${reviewEscape(r.periodLabel)} · ${reviewEscape(label)} ${reviewNumber(r[key])}</title></circle>`;last={x:x(i),y:y(r[key])}});
 return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${reviewEscape(label)}折线图">${[0,.5,1].map(v=>`<text x="3" y="${H-p-v*(H-2*p)}" fill="var(--muted,#999)" font-size="12">${reviewNumber(Math.round(min+(max-min)*v))}</text>`).join('')}${shapes}<text x="${p}" y="${H-12}" fill="var(--muted,#999)" font-size="12">${reviewEscape(rows[0].periodLabel)}</text><text x="${W-p}" y="${H-12}" text-anchor="end" fill="var(--muted,#999)" font-size="12">${reviewEscape(rows.at(-1).periodLabel)}</text></svg>`;
}
if(typeof module!=='undefined')module.exports={cardDifference,cardChangeMarkup,dayKey,dailyRecords,targetDay,reviewBaseline,reviewDifference,periodKey,periodRecords,periodPrevious};
