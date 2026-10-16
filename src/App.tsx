import { useEffect, useRef, useState, useCallback } from 'react';

type Lang = 'zh' | 'en';
const STR = {
  zh: {
    appTitle: 'FlashBack Studio',
    newProject: '新增專案', openProject: '開啟專案…', save: '儲存', saveAs: '另存新檔…',
    importReplay: '匯入 Replay…', setGameDir: '設定 Minecraft 資料夾…', export: '匯出到 Flashback',
    welcomeTitle: '歡迎使用 FlashBack Studio',
    welcomeSub: '獨立的 Flashback 錄製檔剪輯器 · 無需開啟 Minecraft 即可編輯',
    welcomeNew: '新增專案', welcomeOpen: '開啟專案',
    clips: '素材庫', noClips: '尚未匯入素材',
    importHint: '點上方「匯入 Replay…」選擇 .zip 錄製檔', remove: '移除',
    inspector: 'Inspector', uiElements: '介面元素', worldRender: '世界渲染',
    fov: 'FOV / 鏡頭', exportRange: '匯出範圍', projectInfo: '專案資訊',
    startTick: '開始 Tick', endTick: '結束 Tick', fps: '輸出 FPS',
    gameDir: 'Minecraft 資料夾', notSet: '未設定',
    saved: '已儲存', exportDone: '已寫入 Flashback editor_states：',
    select: '選擇 (V)', razor: '刀片 (C)', empty: '從左側素材庫選擇一個 clip 以預覽',
    shortcuts: 'Space 播放 · J/K/L · ←/→ 逐幀 · V 選擇 · C 刀片 · Ctrl+S 儲存',
    seconds: '秒', mb: 'MB', mcVer: 'MC',
  },
  en: {
    appTitle: 'FlashBack Studio',
    newProject: 'New Project', openProject: 'Open Project…', save: 'Save', saveAs: 'Save As…',
    importReplay: 'Import Replay…', setGameDir: 'Set Minecraft Folder…', export: 'Export to Flashback',
    welcomeTitle: 'Welcome to FlashBack Studio',
    welcomeSub: 'Standalone editor for Flashback recordings · edit without launching Minecraft',
    welcomeNew: 'New Project', welcomeOpen: 'Open Project',
    clips: 'Clips', noClips: 'No clips imported yet',
    importHint: 'Click Import Replay above to add .zip recordings', remove: 'Remove',
    inspector: 'Inspector', uiElements: 'UI Elements', worldRender: 'World Render',
    fov: 'FOV / Camera', exportRange: 'Export Range', projectInfo: 'Project Info',
    startTick: 'Start Tick', endTick: 'End Tick', fps: 'Output FPS',
    gameDir: 'Minecraft Folder', notSet: 'Not set',
    saved: 'Saved', exportDone: 'Written to Flashback editor_states:',
    select: 'Select (V)', razor: 'Razor (C)', empty: 'Select a clip from the library to preview',
    shortcuts: 'Space play · J/K/L · arrows step · V select · C razor · Ctrl+S save',
    seconds: 's', mb: 'MB', mcVer: 'MC',
  },
};

const TRACK_TYPES = [
  { id: 'camera', name: 'Camera', color: '#3ea6ff' },
  { id: 'camera_orbit', name: 'Camera Orbit', color: '#5ec8ff' },
  { id: 'track_entity', name: 'Track Entity', color: '#7fd6ff' },
  { id: 'fov', name: 'FOV', color: '#b06bd6' },
  { id: 'tickrate', name: 'Speed / Tickrate', color: '#d66b6b' },
  { id: 'timelapse', name: 'Timelapse', color: '#d68a6b' },
  { id: 'freeze', name: 'Freeze', color: '#999' },
  { id: 'time_of_day', name: 'Time of Day', color: '#ffd54f' },
  { id: 'camera_shake', name: 'Camera Shake', color: '#ff8a80' },
  { id: 'audio', name: 'Audio', color: '#81c784' },
  { id: 'block_override', name: 'Block Override', color: '#a5d6a7' },
];

const UI_KEYS = [['showChat','Chat'],['showBossBar','Boss Bar'],['showTitleText','Title'],['showScoreboard','Scoreboard'],['showActionBar','Action Bar'],['showHotbar','Hotbar'],['renderNametags','Nametags'],['ruleOfThirdsGuide','Rule of Thirds'],['centerGuide','Center Guide'],['cameraPath','Camera Path']];
const WORLD_KEYS = [['renderBlocks','Blocks'],['renderEntities','Entities'],['renderPlayers','Players'],['renderParticles','Particles'],['renderSky','Sky'],['renderBeaconBeams','Beacon Beams']];

function fmtTime(tick: number, fps: number = 20) {
  const totalSec = tick / fps;
  const m = Math.floor(totalSec / 60), s = Math.floor(totalSec % 60), f = Math.floor((totalSec - Math.floor(totalSec)) * fps);
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${f.toString().padStart(2,'0')}`;
}

export default function App() {
  const [lang, setLang] = useState<Lang>('zh');
  const t = STR[lang];
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [tool, setTool] = useState<'select'|'razor'>('select');
  const [status, setStatus] = useState('');
  const [chunks, setChunks] = useState<Record<string, ParsedChunk>>({});
  const rafRef = useRef<number|null>(null);
  const lastTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const project = payload?.project ?? null;
  const clips = project?.clips ?? [];
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;
  const totalTicks = clips.reduce((acc, c) => acc + (c.outPoint - c.inPoint), 0);

  useEffect(() => {
    if (!selectedClip) { setChunks({}); return; }
    setChunks({});
    const all: Record<string, ParsedChunk> = {};
    Promise.all(selectedClip.chunkFiles.map(async (name) => {
      try { all[name] = await window.fbstudio.parseChunk(selectedClip.id, name); } catch {}
    })).then(() => setChunks(all));
  }, [selectedClip?.id]);

  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    lastTimeRef.current = performance.now();
    const step = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000; lastTimeRef.current = now;
      setTick((tt) => { const nt = tt + dt * 20; if (nt >= totalTicks) { setPlaying(false); return totalTicks; } return nt; });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, totalTicks]);

  const save = useCallback(async () => {
    const r = await window.fbstudio.projectSave();
    setStatus(t.saved + ': ' + r.path);
    setTimeout(() => setStatus(''), 3000);
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.code === 'ArrowRight') setTick((tt) => Math.min(totalTicks, tt + (e.shiftKey?10:1)));
      else if (e.code === 'ArrowLeft') setTick((tt) => Math.max(0, tt - (e.shiftKey?10:1)));
      else if (e.code === 'KeyJ') { setPlaying(false); setTick((tt) => Math.max(0, tick - 5)); }
      else if (e.code === 'KeyL') { setPlaying(false); setTick((tt) => Math.min(totalTicks, tick + 5)); }
      else if (e.code === 'KeyK') setPlaying(false);
      else if (e.code === 'KeyV') setTool('select');
      else if (e.code === 'KeyC') setTool('razor');
      else if (e.code === 'Home') setTick(0);
      else if (e.code === 'End') setTick(totalTicks);
      else if ((e.ctrlKey||e.metaKey) && e.code === 'KeyS') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalTicks, tick, save]);

  const doNew = useCallback(async () => setPayload(await window.fbstudio.projectNew()), []);
  const doOpen = useCallback(async () => setPayload(await window.fbstudio.projectOpen()), []);
  const doSaveAs = useCallback(async () => setPayload(await window.fbstudio.projectSaveAs()), []);
  const doImport = useCallback(async () => {
    const r = await window.fbstudio.importReplay();
    if (r) { setPayload((p) => p ? { ...p, project: r.project } : p); if (r.clips[0]) setSelectedClipId(r.clips[0].id); }
  }, []);
  const doSetGameDir = useCallback(async () => {
    const d = await window.fbstudio.pickGameDir();
    if (d && project) { project.export.gameDir = d; setPayload((p) => p ? { ...p, project: { ...project } } : p); }
  }, [project]);
  const doExport = useCallback(async () => {
    try { const r = await window.fbstudio.exportToFlashback(); setStatus(t.exportDone + ' ' + r.written.length); setTimeout(()=>setStatus(''),5000); }
    catch (e: any) { setStatus('Error: ' + (e?.message||e)); }
  }, [t]);
  const doToggleLang = useCallback(() => setLang((l) => (l==='zh'?'en':'zh')), []);

  useEffect(() => {
    window.fbstudio.onMenu((action) => {
      if (action==='newProject') doNew();
      else if (action==='openProject') doOpen();
      else if (action==='save') save();
      else if (action==='saveAs') doSaveAs();
      else if (action==='importReplay') doImport();
      else if (action==='setGameDir') doSetGameDir();
      else if (action==='export') doExport();
      else if (action==='toggleLang') doToggleLang();
    });
  }, [doNew,doOpen,save,doSaveAs,doImport,doSetGameDir,doExport,doToggleLang]);

  useEffect(() => {
    const cv = previewRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width = cv.clientWidth * devicePixelRatio;
    const H = cv.height = cv.clientHeight * devicePixelRatio;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
    if (!selectedClip) { ctx.fillStyle='#444'; ctx.font=`${14*devicePixelRatio}px sans-serif`; ctx.textAlign='center'; ctx.fillText(t.empty, W/2, H/2); return; }
    const allPath = Object.values(chunks).flatMap((c) => c.cameraPath || []);
    if (allPath.length > 1) {
      const xs = allPath.map((p)=>p.x), zs = allPath.map((p)=>p.z);
      const minX=Math.min(...xs), maxX=Math.max(...xs), minZ=Math.min(...zs), maxZ=Math.max(...zs);
      const sc = Math.min(W/(maxX-minX+1), H/(maxZ-minZ+1))*0.9;
      const cx = W/2-((minX+maxX)/2)*sc, cy = H/2-((minZ+maxZ)/2)*sc;
      ctx.strokeStyle='#3ea6ff'; ctx.lineWidth=1.5*devicePixelRatio; ctx.beginPath();
      allPath.forEach((p,i)=>{ const px=cx+p.x*sc, py=cy+p.z*sc; if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); });
      ctx.stroke();
      const cur = allPath.reduce((best,p)=>Math.abs(p.tick-tick)<Math.abs(best.tick-tick)?p:best, allPath[0]);
      ctx.fillStyle='#ff6b6b'; ctx.beginPath(); ctx.arc(cx+cur.x*sc, cy+cur.z*sc, 5*devicePixelRatio, 0, Math.PI*2); ctx.fill();
    }
  }, [selectedClip, chunks, tick, t]);

  const pxPerSec = zoom, pxPerTick = pxPerSec/20;
  const onTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    setTick(Math.max(0, Math.min(totalTicks, x/pxPerTick)));
  };
  const updateVisual = (k: string, v: any) => { if(!project) return; project.replayVisuals[k]=v; setPayload({...payload!, project:{...project}}); };

  if (!project) {
    return (
      <div className="app">
        <Topbar t={t} lang={lang} onToggleLang={doToggleLang} project={null} onNew={doNew} onOpen={doOpen} status={status} />
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text)'}}>
          <h1 style={{fontWeight:300,marginBottom:8}}>{t.welcomeTitle}</h1>
          <p style={{color:'var(--text-dim)',marginBottom:32}}>{t.welcomeSub}</p>
          <div style={{display:'flex',gap:16}}>
            <button onClick={doNew} style={{padding:'12px 28px',background:'#3ea6ff',color:'#000',border:'none',borderRadius:6,fontSize:14,cursor:'pointer'}}>{t.welcomeNew}</button>
            <button onClick={doOpen} style={{padding:'12px 28px',background:'var(--bg-3)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:6,fontSize:14,cursor:'pointer'}}>{t.welcomeOpen}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Topbar t={t} lang={lang} onToggleLang={doToggleLang} project={project} onNew={doNew} onOpen={doOpen}
              onSave={save} onSaveAs={doSaveAs} onImport={doImport} onSetGameDir={doSetGameDir} onExport={doExport} status={status} />
      <div className="body">
        <div className="left">
          <div className="panel-title">{t.clips} ({clips.length})</div>
          <div className="library-list">
            {clips.length===0 && <div style={{padding:16,color:'var(--text-dim)',fontSize:12,lineHeight:1.6}}>{t.noClips}<br/>{t.importHint}</div>}
            {clips.map((c) => (
              <div key={c.id} className={`library-item ${selectedClipId===c.id?'active':''}`} onClick={()=>setSelectedClipId(c.id)}>
                <div className="name">{c.originalName}</div>
                <div className="meta">{t.mcVer} {c.metadata.version_string ?? '?'} · {((c.metadata.total_ticks??0)/20).toFixed(1)}{t.seconds}</div>
                <button style={{position:'absolute',top:4,right:4,background:'transparent',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:11}}
                  onClick={async(e)=>{e.stopPropagation(); setPayload(await window.fbstudio.removeClip(c.id)); if(selectedClipId===c.id) setSelectedClipId(null);}} title={t.remove}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="center">
          <div className="preview">
            <canvas ref={previewRef} style={{width:'100%',height:'100%'}} />
            {selectedClip && <div className="hint">{selectedClip.originalName} · {t.mcVer} {selectedClip.metadata.version_string} · {fmtTime(tick)} / {fmtTime(totalTicks)}</div>}
          </div>
          <div className="transport">
            <button onClick={()=>setTick(0)} disabled={!selectedClip}>⏮</button>
            <button onClick={()=>setTick((tt)=>Math.max(0,tt-20))} disabled={!selectedClip}>◀</button>
            <button onClick={()=>setPlaying((p)=>!p)} disabled={!selectedClip}>{playing?'⏸':'▶'}</button>
            <button onClick={()=>setTick((tt)=>Math.min(totalTicks,tt+20))} disabled={!selectedClip}>▶</button>
            <button onClick={()=>setTick(totalTicks)} disabled={!selectedClip}>⏭</button>
            <div className="time">{selectedClip?`${fmtTime(tick)} / ${fmtTime(totalTicks)}`:'--:--'}</div>
          </div>
          <div className="timeline">
            <div className="timeline-toolbar">
              <button className={tool==='select'?'active':''} onClick={()=>setTool('select')}>⬚ {t.select}</button>
              <button className={tool==='razor'?'active':''} onClick={()=>setTool('razor')}>✂ {t.razor}</button>
              <span style={{flex:1}} />
              <button onClick={()=>setZoom((z)=>Math.max(10,z-10))}>−</button>
              <span style={{width:50,textAlign:'center',color:'var(--text-dim)'}}>{pxPerSec}px/s</span>
              <button onClick={()=>setZoom((z)=>Math.min(200,z+10))}>+</button>
            </div>
            <div className="timeline-body">
              <div className="track-labels">
                <div className="track-label" style={{height:20}}>時間</div>
                <div className="track-label"><span className="dot" style={{background:'var(--track-replay)'}}/>Replay</div>
                {TRACK_TYPES.map((tr)=>(<div key={tr.id} className="track-label"><span className="dot" style={{background:tr.color}}/>{tr.name}</div>))}
                <div className="track-label"><span className="dot" style={{background:'var(--track-markers)'}}/>Markers</div>
              </div>
              <div className="track-scroll" ref={timelineRef} onClick={selectedClip?onTimelineClick:undefined}>
                <div className="track-canvas" style={{width:Math.max(800,totalTicks*pxPerTick)}}>
                  <div className="ruler" style={{width:Math.max(800,totalTicks*pxPerTick)}}>
                    {Array.from({length:Math.ceil(totalTicks/20)+1}).map((_,s)=>(<div key={s} className="tick" style={{left:s*pxPerSec}}><span>{s}{t.seconds}</span></div>))}
                  </div>
                  {clips.reduce((acc,c)=>{
                    const start=acc.offset, dur=c.outPoint-c.inPoint;
                    return (<>{acc.node}
                      <div className="track-row" style={{height:28,background:'rgba(91,108,140,0.15)'}}>
                        <div className="clip" style={{left:start*pxPerTick,width:dur*pxPerTick,background:'var(--track-replay)'}} onClick={(e)=>{e.stopPropagation();setSelectedClipId(c.id);}} title={c.originalName}>{c.originalName}</div>
                      </div>
                      {TRACK_TYPES.map((tr)=><div key={tr.id} className="track-row"/>)}
                      <div className="markers-row"/>
                    </>);
                  }, {node:null,offset:0} as any)}
                  <div className="playhead" style={{left:tick*pxPerTick}}/>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="right">
          <div className="panel-title">{t.inspector}</div>
          <div className="inspector-section"><h4>{t.uiElements}</h4>
            {UI_KEYS.map(([k,label])=>(<div className="row" key={k}><label>{label}</label><input type="checkbox" checked={!!project.replayVisuals[k]} onChange={(e)=>updateVisual(k,e.target.checked)}/></div>))}
          </div>
          <div className="inspector-section"><h4>{t.worldRender}</h4>
            {WORLD_KEYS.map(([k,label])=>(<div className="row" key={k}><label>{label}</label><input type="checkbox" checked={!!project.replayVisuals[k]} onChange={(e)=>updateVisual(k,e.target.checked)}/></div>))}
          </div>
          <div className="inspector-section"><h4>{t.fov}</h4>
            <div className="row"><label>Override FOV</label><input type="checkbox" checked={!!project.replayVisuals.overrideFov} onChange={(e)=>updateVisual('overrideFov',e.target.checked)}/></div>
            <div className="row"><label>FOV</label><input type="number" value={project.replayVisuals.overrideFovAmount} onChange={(e)=>updateVisual('overrideFovAmount',Number(e.target.value))}/></div>
          </div>
          <div className="inspector-section"><h4>{t.exportRange}</h4>
            <div className="row"><label>{t.startTick}</label><input type="number" value={project.export.startTick} onChange={(e)=>{project.export.startTick=Number(e.target.value); setPayload({...payload!,project:{...project}});}}/></div>
            <div className="row"><label>{t.endTick}</label><input type="number" value={project.export.endTick} onChange={(e)=>{project.export.endTick=Number(e.target.value); setPayload({...payload!,project:{...project}});}}/></div>
            <div className="row"><label>{t.fps}</label><input type="number" value={project.export.fps} onChange={(e)=>{project.export.fps=Number(e.target.value); setPayload({...payload!,project:{...project}});}}/></div>
            <div className="row"><label>{t.gameDir}</label><span style={{fontSize:10,color:'var(--text-dim)'}}>{project.export.gameDir||t.notSet}</span></div>
          </div>
          <div className="inspector-section"><h4>{t.projectInfo}</h4>
            <div className="row"><label>{t.project}</label><span>{project.name}</span></div>
            <div className="row"><label>Clips</label><span>{clips.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar(props: any) {
  const { t, lang, onToggleLang, project, onNew, onOpen, onSave, onSaveAs, onImport, onSetGameDir, onExport, status } = props;
  return (
    <div className="topbar">
      <span className="title">{t.appTitle}</span>
      <button onClick={onNew}>{t.newProject}</button>
      <button onClick={onOpen}>{t.openProject}</button>
      {project && <button onClick={onSave}>{t.save} (Ctrl+S)</button>}
      {project && <button onClick={onSaveAs}>{t.saveAs}</button>}
      {project && <button onClick={onImport} style={{background:'#3ea6ff',color:'#000'}}>{t.importReplay}</button>}
      {project && <button onClick={onSetGameDir}>{t.setGameDir}</button>}
      {project && <button onClick={onExport} style={{background:'#4caf50',color:'#000'}}>{t.export}</button>}
      <div className="spacer"/>
      <button onClick={onToggleLang} style={{background:'var(--bg-3)',border:'none',color:'var(--text)',padding:'3px 10px',borderRadius:4,cursor:'pointer'}}>{lang==='zh'?'EN':'繁中'}</button>
      <span className="status">{status || t.shortcuts}</span>
    </div>
  );
}
