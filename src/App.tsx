import { useEffect, useRef, useState, useCallback } from 'react';

interface ReplaySummary {
  absPath: string; fileName: string; sizeBytes: number; mtimeMs: number;
  uuid: string | null; name: string; versionString: string | null;
  worldName: string | null; totalTicks: number; durationSeconds: number;
}
interface FlashbackMetadata {
  uuid: string; name: string; version_string?: string; world_name?: string;
  data_version?: number; protocol_version?: number; total_ticks?: number;
  chunks: Record<string, { duration: number; forcePlaySnapshot: boolean }>;
  markers?: Record<string, unknown>;
  [k: string]: unknown;
}
interface ParsedChunk {
  fileName: string; duration: number; packetDensity: number[];
  cameraPath: { tick: number; x: number; y: number; z: number; yaw: number; pitch: number }[];
}
interface EditorState {
  replayVisuals: Record<string, unknown> & {
    skyColour: [number,number,number]; fogColour: [number,number,number];
  };
  scenes: { name: string; keyframeTracks: unknown[]; exportStartTicks: number; exportEndTicks: number }[];
  sceneIndex: number;
  [k: string]: unknown;
}

interface OpenResult {
  metadata: FlashbackMetadata;
  chunkFiles: string[];
  iconPath: string | null;
  editorState: EditorState;
  gameDir: string;
}

function fmtTime(tick: number, fps: number = 20) {
  const totalSec = tick / fps;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const f = Math.floor((totalSec - Math.floor(totalSec)) * fps);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`;
}

const TRACK_TYPES = [
  { id: 'camera',            name: 'Camera (Position)',  color: '#3ea6ff' },
  { id: 'camera_orbit',      name: 'Camera Orbit',       color: '#5ec8ff' },
  { id: 'track_entity',      name: 'Track Entity',       color: '#7fd6ff' },
  { id: 'fov',               name: 'FOV',                color: '#b06bd6' },
  { id: 'tickrate',          name: 'Speed / Tickrate',   color: '#d66b6b' },
  { id: 'timelapse',         name: 'Timelapse',          color: '#d68a6b' },
  { id: 'freeze',            name: 'Freeze',             color: '#999' },
  { id: 'time_of_day',       name: 'Time of Day',        color: '#ffd54f' },
  { id: 'camera_shake',      name: 'Camera Shake',       color: '#ff8a80' },
  { id: 'audio',             name: 'Audio',              color: '#81c784' },
  { id: 'block_override',    name: 'Block Override',     color: '#a5d6a7' },
];

export default function App() {
  const [library, setLibrary] = useState<ReplaySummary[]>([]);
  const [open, setOpen] = useState<OpenResult | null>(null);
  const [chunks, setChunks] = useState<Record<string, ParsedChunk>>({});
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(50);
  const [selectedTool, setSelectedTool] = useState<'select' | 'razor'>('select');
  const [saveStatus, setSaveStatus] = useState('');
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const totalTicks = open?.metadata.total_ticks ?? 0;

  useEffect(() => { window.fbstudio.scanLibrary().then(setLibrary); }, []);

  useEffect(() => {
    if (!open) return;
    const all: Record<string, ParsedChunk> = {};
    Promise.all(open.chunkFiles.map(async (name) => {
      all[name] = (await window.fbstudio.parseChunk(name)) as ParsedChunk;
    })).then(() => setChunks(all));
  }, [open]);

  useEffect(() => {
    if (!playing) { if (rafRef.current) cancelAnimationFrame(rafRef.current); return; }
    lastTimeRef.current = performance.now();
    const step = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      setTick((t) => { const nt = t + dt * 20; if (nt >= totalTicks) { setPlaying(false); return totalTicks; } return nt; });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, totalTicks]);

  const openReplay = useCallback(async (absPath: string) => {
    const res = await window.fbstudio.openReplay(absPath);
    setOpen(res); setTick(0); setChunks({});
  }, []);

  const save = useCallback(async () => {
    if (!open) return;
    const r = await window.fbstudio.saveState(open.editorState);
    setSaveStatus('已儲存到 ' + r.path);
    setTimeout(() => setSaveStatus(''), 3000);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.code === 'ArrowRight') setTick((t) => Math.min(totalTicks, t + (e.shiftKey ? 10 : 1)));
      else if (e.code === 'ArrowLeft')  setTick((t) => Math.max(0, t - (e.shiftKey ? 10 : 1)));
      else if (e.code === 'KeyJ') { setPlaying(false); setTick((t) => Math.max(0, tick - 5)); }
      else if (e.code === 'KeyL') { setPlaying(false); setTick((t) => Math.min(totalTicks, tick + 5)); }
      else if (e.code === 'KeyK') setPlaying(false);
      else if (e.code === 'KeyV') setSelectedTool('select');
      else if (e.code === 'KeyC') setSelectedTool('razor');
      else if (e.code === 'Home') setTick(0);
      else if (e.code === 'End') setTick(totalTicks);
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalTicks, tick, save]);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = previewCanvasRef.current;
    if (!cv || !open) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width = cv.clientWidth * devicePixelRatio;
    const H = cv.height = cv.clientHeight * devicePixelRatio;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const allPath = Object.values(chunks).flatMap((c) => c.cameraPath || []);
    if (allPath.length > 1) {
      const xs = allPath.map((p) => p.x), zs = allPath.map((p) => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const sc = Math.min(W / (maxX - minX + 1), H / (maxZ - minZ + 1)) * 0.9;
      const cx = W / 2 - ((minX + maxX) / 2) * sc;
      const cy = H / 2 - ((minZ + maxZ) / 2) * sc;
      ctx.strokeStyle = '#3ea6ff'; ctx.lineWidth = 1.5 * devicePixelRatio;
      ctx.beginPath();
      allPath.forEach((p, i) => {
        const px = cx + p.x * sc, py = cy + p.z * sc;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.stroke();
      const cur = allPath.reduce((best, p) => Math.abs(p.tick - tick) < Math.abs(best.tick - tick) ? p : best, allPath[0]);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(cx + cur.x * sc, cy + cur.z * sc, 5 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#666';
    ctx.font = `${12 * devicePixelRatio}px sans-serif`;
    ctx.fillText('(預覽占位：實際渲染需在 Minecraft + Flashback 中進行)', 10, H - 10 * devicePixelRatio);
  }, [open, chunks, tick]);

  const pxPerSec = zoom;
  const pxPerTick = pxPerSec / 20;
  const totalWidth = Math.max(800, totalTicks * pxPerTick);

  const onTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    setTick(Math.max(0, Math.min(totalTicks, x / pxPerTick)));
  };

  if (!open) {
    return (
      <div className="app">
        <Topbar onOpen={async () => { const p = await window.fbstudio.pickReplayFile(); if (p) openReplay(p); }} saveStatus={saveStatus} />
        <div className="empty-state">
          <h2>FlashBack Studio</h2>
          <p>從左側媒體庫選擇一個 Flashback 錄製檔，或按「開啟…」瀏覽。</p>
          <p style={{fontSize: 12, opacity: 0.7}}>AI-developed · 獨立第三方編輯器，與 Moulberry/Flashback 模組互通</p>
        </div>
      </div>
    );
  }

  const vs = open.editorState.replayVisuals;

  return (
    <div className="app">
      <Topbar onOpen={async () => { const p = await window.fbstudio.pickReplayFile(); if (p) openReplay(p); }}
              onSave={save} saveStatus={saveStatus} />
      <div className="body">
        <div className="left">
          <div className="panel-title">Replay 媒體庫</div>
          <div className="library-list">
            {library.map((r) => (
              <div key={r.absPath} className={`library-item ${open.metadata.name === r.name ? 'active' : ''}`}
                   onClick={() => openReplay(r.absPath)}>
                <div className="name">{r.name}{r.versionString ? ` · MC ${r.versionString}` : ''}</div>
                <div className="meta">{r.durationSeconds.toFixed(1)}s · {(r.sizeBytes/1024/1024).toFixed(1)} MB</div>
              </div>
            ))}
          </div>
        </div>

        <div className="center">
          <div className="preview">
            <div className="canvas-wrap" style={{width: '100%', height: '100%'}}>
              <canvas ref={previewCanvasRef} style={{width: '100%', height: '100%'}} />
            </div>
            <div className="hint">
              {open.metadata.world_name} · MC {open.metadata.version_string} · {fmtTime(tick)} / {fmtTime(totalTicks)}
            </div>
          </div>
          <div className="transport">
            <button onClick={() => setTick(0)}>⏮</button>
            <button onClick={() => setTick((t) => Math.max(0, t - 20))}>◀</button>
            <button onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
            <button onClick={() => setTick((t) => Math.min(totalTicks, t + 20))}>▶</button>
            <button onClick={() => setTick(totalTicks)}>⏭</button>
            <div className="time">{fmtTime(tick)} / {fmtTime(totalTicks)}</div>
          </div>

          <div className="timeline">
            <div className="timeline-toolbar">
              <button className={selectedTool === 'select' ? 'active' : ''} onClick={() => setSelectedTool('select')}>⬚ 選擇 (V)</button>
              <button className={selectedTool === 'razor' ? 'active' : ''} onClick={() => setSelectedTool('razor')}>✂ 刀片 (C)</button>
              <span style={{flex:1}} />
              <button onClick={() => setZoom((z) => Math.max(10, z - 10))}>−</button>
              <span style={{width:40, textAlign:'center', color:'var(--text-dim)'}}>{pxPerSec}px/s</span>
              <button onClick={() => setZoom((z) => Math.min(200, z + 10))}>+</button>
            </div>
            <div className="timeline-body">
              <div className="track-labels">
                <div className="track-label" style={{height:20}}>時間刻度</div>
                <div className="track-label"><span className="dot" style={{background: 'var(--track-replay)'}} />Replay 素材</div>
                {TRACK_TYPES.map((t) => (
                  <div key={t.id} className="track-label">
                    <span className="dot" style={{background: t.color}} />{t.name}
                  </div>
                ))}
                <div className="track-label"><span className="dot" style={{background: 'var(--track-markers)'}} />Markers</div>
              </div>
              <div className="track-scroll" ref={timelineRef} onClick={onTimelineClick}>
                <div className="track-canvas" style={{width: totalWidth}}>
                  <div className="ruler" style={{width: totalWidth}}>
                    {Array.from({ length: Math.ceil(totalTicks / 20) + 1 }).map((_, s) => (
                      <div key={s} className="tick" style={{left: s * pxPerSec}}>
                        <span>{s}s</span>
                      </div>
                    ))}
                  </div>
                  <div className="track-row" style={{height: 28, background: 'rgba(91,108,140,0.15)'}}>
                    {open.chunkFiles.map((name, i) => {
                      const start = open.chunkFiles.slice(0, i).reduce((acc, n) => acc + (open.metadata.chunks[n]?.duration ?? 0), 0);
                      const dur = open.metadata.chunks[name]?.duration ?? 0;
                      return (
                        <div key={name} className="clip" style={{
                          left: start * pxPerTick, width: dur * pxPerTick,
                          background: 'var(--track-replay)',
                        }} title={`${name} · ${(dur/20).toFixed(1)}s`}>
                          {name}
                        </div>
                      );
                    })}
                  </div>
                  {TRACK_TYPES.map((t) => (
                    <div key={t.id} className="track-row" />
                  ))}
                  <div className="markers-row">
                    {Object.entries(open.metadata.markers || {}).map(([tickStr, m]) => (
                      <div key={tickStr} className="marker-flag" style={{left: Number(tickStr) * pxPerTick - 6}} title={JSON.stringify(m)} />
                    ))}
                  </div>
                  <div className="playhead" style={{left: tick * pxPerTick}} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="right">
          <div className="panel-title">Inspector · 渲染與可見性</div>
          <div className="inspector-section">
            <h4>介面元素</h4>
            {([
              ['showChat', 'Chat'], ['showBossBar', 'Boss Bar'], ['showTitleText', 'Title Text'],
              ['showScoreboard', 'Scoreboard'], ['showActionBar', 'Action Bar'], ['showHotbar', 'Hotbar'],
              ['renderNametags', 'Nametags'], ['ruleOfThirdsGuide', '三分線'], ['centerGuide', '中心線'],
              ['cameraPath', '顯示 Camera Path'],
            ] as const).map(([k, label]) => (
              <div className="row" key={k}>
                <label>{label}</label>
                <input type="checkbox" checked={!!vs[k]}
                  onChange={(e) => { vs[k] = e.target.checked; setOpen({...open}); }} />
              </div>
            ))}
          </div>
          <div className="inspector-section">
            <h4>世界渲染</h4>
            {([
              ['renderBlocks', '方塊'], ['renderEntities', '實體'], ['renderPlayers', '玩家'],
              ['renderParticles', '粒子'], ['renderSky', '天空'], ['renderBeaconBeams', 'Beacon 光束'],
            ] as const).map(([k, label]) => (
              <div className="row" key={k}>
                <label>{label}</label>
                <input type="checkbox" checked={!!vs[k]}
                  onChange={(e) => { vs[k] = e.target.checked; setOpen({...open}); }} />
              </div>
            ))}
          </div>
          <div className="inspector-section">
            <h4>FOV / 鏡頭</h4>
            <div className="row"><label>Override FOV</label>
              <input type="checkbox" checked={!!vs.overrideFov}
                onChange={(e) => { vs.overrideFov = e.target.checked; setOpen({...open}); }} /></div>
            <div className="row"><label>FOV 值</label>
              <input type="number" value={vs.overrideFovAmount as number}
                onChange={(e) => { vs.overrideFovAmount = Number(e.target.value); setOpen({...open}); }} /></div>
            <div className="row"><label>Aspect Ratio</label>
              <input value={vs.changeAspectRatio as string} readOnly style={{width:110, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text)'}} />
            </div>
          </div>
          <div className="inspector-section">
            <h4>匯出範圍</h4>
            <div className="row"><label>開始 Tick</label>
              <input type="number" value={open.editorState.scenes[open.editorState.sceneIndex]?.exportStartTicks ?? -1}
                onChange={(e) => { open.editorState.scenes[open.editorState.sceneIndex].exportStartTicks = Number(e.target.value); setOpen({...open}); }} /></div>
            <div className="row"><label>結束 Tick</label>
              <input type="number" value={open.editorState.scenes[open.editorState.sceneIndex]?.exportEndTicks ?? -1}
                onChange={(e) => { open.editorState.scenes[open.editorState.sceneIndex].exportEndTicks = Number(e.target.value); setOpen({...open}); }} /></div>
          </div>
          <div className="inspector-section">
            <h4>專案資訊</h4>
            <div className="row"><label>UUID</label><span style={{fontSize:10, color:'var(--text-dim)'}}>{open.metadata.uuid.slice(0,8)}…</span></div>
            <div className="row"><label>MC 版本</label><span>{open.metadata.version_string}</span></div>
            <div className="row"><label>資料版本</label><span>{open.metadata.data_version}</span></div>
            <div className="row"><label>協定版本</label><span>{open.metadata.protocol_version}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ onOpen, onSave, saveStatus }: { onOpen: () => void; onSave?: () => void; saveStatus?: string }) {
  return (
    <div className="topbar">
      <span className="title">FlashBack Studio</span>
      <div className="menu">
        <button onClick={onOpen}>開啟 Replay…</button>
        {onSave && <button onClick={onSave}>儲存 (Ctrl+S)</button>}
      </div>
      <div className="spacer" />
      <span className="status">{saveStatus || 'Space=播放/暫停 · J/K/L · ←/→ 逐幀 · V=選擇 · C=刀片'}</span>
    </div>
  );
}
