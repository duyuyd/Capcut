'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Download,Film,Music,Trash2,MoveVertical,Type,SlidersHorizontal,Scissors,Play,Pause,Plus,Image as ImageIcon,PanelsTopLeft,ChevronDown,Volume2,Undo2,Redo2,Split,Save} from 'lucide-react';
import {FFmpeg} from '@ffmpeg/ffmpeg';
import {fetchFile,toBlobURL} from '@ffmpeg/util';
import {DndContext,closestCenter,PointerSensor,TouchSensor,useSensor,useSensors,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,useSortable,arrayMove,horizontalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {readProject,saveProject,type StoredClip} from '@/lib/project-store';

type Clip=StoredClip & {preview:string};
function getDuration(file:File):Promise<number>{return new Promise((resolve,reject)=>{const v=document.createElement('video');const url=URL.createObjectURL(file);v.preload='metadata';v.onloadedmetadata=()=>{const d=v.duration;URL.revokeObjectURL(url);Number.isFinite(d)?resolve(d):reject(Error('Invalid video duration'))};v.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Cannot load this video'))};v.src=url})}
function Track({item,index,remove,selected,select,zoom}:{item:Clip,index:number,remove:()=>void,selected:boolean,select:()=>void,zoom:number}){
 const {setNodeRef,attributes,listeners,transform,transition}=useSortable({id:item.id});
 return <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,width:Math.max(95,Math.round((item.trimEnd-item.trimStart)/item.speed*zoom))}} className={'studio-clip '+(selected?'studio-selected-clip':'')}>
 <button type="button" className="studio-clip-handle" onClick={select} {...attributes} {...listeners}><MoveVertical size={14}/><span className="studio-clip-number">{index+1}</span><span className="studio-clip-label">{item.file.name}</span><small>{((item.trimEnd-item.trimStart)/item.speed).toFixed(1)}s · {item.speed}x</small></button>
 <button aria-label="Xóa clip" className="studio-clip-delete" onClick={remove}><Trash2 size={15}/></button>
 </div>;
}
export default function VideoEditor(){
 const worker=useRef<FFmpeg|null>(null),allUrls=useRef<Set<string>>(new Set());
 const [clips,setClips]=useState<Clip[]>([]),[audio,setAudio]=useState<File|null>(null),[text,setText]=useState(''),[textColor,setTextColor]=useState('#ffffff'),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
 const [restored,setRestored]=useState(false),[saved,setSaved]=useState(false),[revision,setRevision]=useState(0);
 const history=useRef<{past:Clip[][],future:Clip[][]}>({past:[],future:[]});
 const commitClips=(next:Clip[])=>{history.current.past.push(clips);if(history.current.past.length>50)history.current.past.shift();history.current.future=[];setClips(next);setRevision(r=>r+1);setSaved(false)};
 const patchClip=(id:string,patch:Partial<Clip>)=>commitClips(clips.map(c=>c.id===id?{...c,...patch}:c));
 const undo=()=>{const last=history.current.past.pop();if(!last)return;history.current.future.push(clips);setClips(last);setSelected(i=>Math.min(i,Math.max(0,last.length-1)));setRevision(r=>r+1)};
 const redo=()=>{const next=history.current.future.pop();if(!next)return;history.current.past.push(clips);setClips(next);setSelected(i=>Math.min(i,Math.max(0,next.length-1)));setRevision(r=>r+1)};
 const split=()=>{const c=clips[selected],t=preview.current?.currentTime;if(!c||t===undefined||!Number.isFinite(t)||t<=c.trimStart+.05||t>=c.trimEnd-.05){setError('Di chuyển video đến vị trí bên trong clip trước khi tách');return}commitClips([...clips.slice(0,selected),{...c,trimEnd:t},{...c,id:crypto.randomUUID(),trimStart:t},...clips.slice(selected+1)]);setSelected(selected+1);setStatus('Đã tách clip tại '+t.toFixed(2)+'s')};

 useEffect(()=>()=>{allUrls.current.forEach(url=>URL.revokeObjectURL(url));if(worker.current?.loaded)worker.current.terminate()},[]);
 const sensors=useSensors(useSensor(PointerSensor),useSensor(TouchSensor,{activationConstraint:{delay:200,tolerance:8}}));
 const add=async(list:FileList|null)=>{if(!list)return;setError('');try{const next:Clip[]=[];for(const file of Array.from(list)){if(!file.type.startsWith('video/'))continue;const duration=await getDuration(file);const preview=URL.createObjectURL(file);allUrls.current.add(preview);next.push({id:crypto.randomUUID(),file,preview,duration,trimStart:0,trimEnd:duration,speed:1,volume:1})}if(next.length)commitClips([...clips,...next])}catch(e){setError(String(e))}};
 const remove=(id:string)=>{commitClips(clips.filter(c=>c.id!==id));setSelected(i=>Math.min(i,Math.max(0,clips.length-2)))};
 const reorder=(e:DragEndEvent)=>{if(!e.over||e.active.id===e.over.id)return;const moved=arrayMove(clips,clips.findIndex(c=>c.id===e.active.id),clips.findIndex(c=>c.id===e.over!.id));const chosen=clips[selected]?.id;commitClips(moved);setSelected(Math.max(0,moved.findIndex(c=>c.id===chosen)))};
 const load=async()=>{if(worker.current?.loaded)return worker.current;const ffmpeg=worker.current||new FFmpeg();worker.current=ffmpeg;setStatus('Đang tải FFmpeg.wasm lần đầu (~32 MB)');ffmpeg.on('progress',({progress})=>{if(Number.isFinite(progress))setStatus('Xử lý '+Math.round(Math.max(0,Math.min(1,progress))*100)+'%')});const base='/ffmpeg';await ffmpeg.load({coreURL:await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),wasmURL:await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm')});return ffmpeg};
 const exportVideo=async()=>{if(!clips.length)return;setBusy(true);setError('');try{const ff=await load();const parts:string[]=[];const [outputWidth,outputHeight]=ratio==='9:16'?[720,1280]:ratio==='1:1'?[720,720]:[1280,720];const videoFilter=`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p${effect==='mono'?',hue=s=0':effect==='sepia'?',colorchannelmixer=.393:.769:.189:.349:.686:.168:.272:.534:.131':effect==='vivid'?',eq=contrast=1.12:saturation=1.35':''}`;for(let i=0;i<clips.length;i++){const clip=clips[i];const ext=clip.file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'mp4';const name='source'+i+'.'+ext;await ff.writeFile(name,await fetchFile(clip.file));const from=clip.trimStart;const until=clip.trimEnd;if(until<=from)throw Error('Thời gian kết thúc phải lớn hơn bắt đầu');setStatus('Đang chuẩn hóa '+(i+1)+'/'+clips.length);const output='part'+i+'.mp4';const code=await ff.exec(['-i',name,'-ss',String(from),'-t',String(until-from),'-vf',videoFilter+',setpts=PTS/'+clip.speed,'-af','atempo='+clip.speed+',volume='+clip.volume,'-c:v','libx264','-preset','ultrafast','-crf','27','-c:a','aac','-ar','44100','-ac','2','-pix_fmt','yuv420p',output]);if(code!==0)throw Error('Lỗi mã hóa clip '+(i+1));parts.push(output)}
 await ff.writeFile('files.txt',new TextEncoder().encode(parts.map(p=>"file '"+p+"'").join('\n')));let output='joined.mp4';const concat=await ff.exec(['-f','concat','-safe','0','-i','files.txt','-c','copy',output]);if(concat!==0)throw Error('Không thể ghép video');
 if(audio){setStatus('Đang thêm nhạc nền');const ext=audio.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'mp3';const path='music.'+ext;await ff.writeFile(path,await fetchFile(audio));const music=await ff.exec(['-i',output,'-stream_loop','-1','-i',path,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-shortest','with-music.mp4']);if(music!==0)throw Error('Không thể thêm nhạc');output='with-music.mp4'}
 if(text.trim()){setStatus('Đang thêm chữ');const canvas=document.createElement('canvas');canvas.width=outputWidth;canvas.height=outputHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas not supported');ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+Math.round(outputWidth*.04)+'px Arial';ctx.strokeStyle='#000000';ctx.lineWidth=7;const lines=text.match(/.{1,35}(?:\s|$)/g)||[text];for(let i=0;i<lines.length;i++){const y=outputHeight*.79+(i-(lines.length-1)/2)*(outputWidth*.048);ctx.strokeText(lines[i].trim(),outputWidth/2,y);ctx.fillStyle=textColor;ctx.fillText(lines[i].trim(),outputWidth/2,y)}const blob=await new Promise<Blob>((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('Cannot render caption')),'image/png'));await ff.writeFile('overlay.png',await fetchFile(blob));const overlay=await ff.exec(['-i',output,'-loop','1','-i','overlay.png','-filter_complex','[1:v][0:v]scale2ref=w=main_w:h=main_h[over][base];[base][over]overlay=0:0:shortest=1[v]','-map','[v]','-map','0:a?','-c:v','libx264','-preset','ultrafast','-crf','27','-c:a','copy','-shortest','captioned.mp4']);if(overlay!==0)throw Error('Lỗi thêm chữ');output='captioned.mp4'}
 setStatus('Đang tải video');const data=await ff.readFile(output);const bytes=typeof data==='string'?new TextEncoder().encode(data):new Uint8Array(data);const arrayBuffer=new ArrayBuffer(bytes.byteLength);new Uint8Array(arrayBuffer).set(bytes);const blob=new Blob([arrayBuffer],{type:'video/mp4'});if(blob.size<1000)throw Error('File xuất không hợp lệ');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='capcut-export.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setStatus('Xuất MP4 thành công: '+(blob.size/1048576).toFixed(1)+' MB')}catch(e){setError(e instanceof Error?e.message:String(e));setStatus('')}finally{setBusy(false)}};
 const [effect,setEffect]=useState<'none'|'mono'|'sepia'|'vivid'>('none');const [tab,setTab]=useState<'media'|'audio'|'text'|'effects'>('media');const [ratio,setRatio]=useState('16:9');const [playhead,setPlayhead]=useState(0);const [playing,setPlaying]=useState(false);const [zoom,setZoom]=useState(70);const preview=useRef<HTMLVideoElement>(null);const current=clips[Math.min(selected,clips.length-1)];const totalDuration=clips.reduce((sum,c)=>sum+Math.max(0,c.trimEnd-c.trimStart)/c.speed,0);const fmt=(n:number)=>{const v=Math.max(0,Math.floor(n));return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')};
 useEffect(()=>{
  let cancelled=false;
  void readProject().then(savedProject=>{
   if(cancelled||!savedProject)return;
   const loaded:Clip[]=savedProject.clips.map(c=>{
     const url=URL.createObjectURL(c.file);allUrls.current.add(url);
     return {...c,trimStart:c.trimStart??0,trimEnd:c.trimEnd??c.duration,speed:c.speed||1,volume:c.volume??1,preview:url};
   });
   setClips(loaded);setAudio(savedProject.audio);setText(savedProject.text);setTextColor(savedProject.textColor);setRatio(savedProject.ratio);setEffect(savedProject.effect);
   setStatus(loaded.length?'Đã khôi phục '+loaded.length+' clip từ bộ nhớ thiết bị':'');
  }).catch(e=>{if(!cancelled)setError('Không đọc được dự án đã lưu: '+String(e))}).finally(()=>{if(!cancelled)setRestored(true)});
  return()=>{cancelled=true};
 },[]);
 useEffect(()=>{
  if(!restored)return;
  setSaved(false);
  const timer=setTimeout(()=>{
   void saveProject({clips:clips.map(({preview:unused,...rest})=>rest),audio,text,textColor,ratio,effect,updatedAt:Date.now()})
    .then(()=>setSaved(true))
    .catch(e=>setError('Không lưu được dự án vào máy: '+String(e)));
  },900);
  return()=>clearTimeout(timer);
 },[restored,clips,audio,text,textColor,ratio,effect]);
 useEffect(()=>{
  const shortcut=(event:KeyboardEvent)=>{
   if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z')return;
   const target=event.target;if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)return;
   event.preventDefault();
   if(event.shiftKey)redo();else undo();
  };
  window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
 },[clips,revision]);


 return <main className="studio-root">
 <header className="studio-topbar">
   <Link className="studio-brand" href="/"><span className="studio-logo">✦</span><strong>Capcut Studio</strong><span className="studio-project">Dự án không tên <ChevronDown size={13}/></span></Link>
   <span className="studio-top-sub">Trình biên tập video · Xử lý trên thiết bị</span>
   <div className="studio-top-actions"><button className="studio-history" title="Hoàn tác" aria-label="Hoàn tác" disabled={!history.current.past.length} onClick={undo}><Undo2 size={17}/></button><button className="studio-history" title="Làm lại" aria-label="Làm lại" disabled={!history.current.future.length} onClick={redo}><Redo2 size={17}/></button><span className="studio-save"><Save size={13}/> {saved?'Đã lưu trên máy':restored?'Đang lưu':'Đang mở'}</span><button className="studio-export" disabled={busy||!clips.length} onClick={()=>void exportVideo()}><Download size={16}/>{busy?'Đang xuất...':'Xuất video'}</button></div>
 </header>
 <div className="studio-workspace">
 <aside className="studio-asset-area">
   <nav className="studio-sidebar" aria-label="Công cụ">
     {([{id:'media',icon:Film,label:'Media'},{id:'audio',icon:Music,label:'Âm thanh'},{id:'text',icon:Type,label:'Văn bản'},{id:'effects',icon:SlidersHorizontal,label:'Hiệu ứng'}] as const).map(item=><button type="button" key={item.id} onClick={()=>setTab(item.id)} className={'studio-nav-item '+(tab===item.id?'is-active':'')}><item.icon size={20}/><span>{item.label}</span></button>)}
     <Link className="studio-nav-item" href="/photo-editor"><ImageIcon size={20}/><span>Ảnh</span></Link>
   </nav>
   <section className="studio-library">
     <div className="studio-section-heading"><b>{tab==='media'?'Kho tài nguyên':tab==='audio'?'Âm thanh':tab==='text'?'Văn bản':'Điều chỉnh'}</b><span>⋯</span></div>
     {tab==='media'&&<><label className="studio-upload"><Plus size={17}/> Nhập video<input type="file" accept="video/*" multiple className="sr-only" onChange={e=>void add(e.target.files)}/></label><p className="studio-minor">Đã nhập · {clips.length} video</p><div className="studio-media-grid">{clips.map((c,i)=><button key={c.id} className={'studio-media-card '+(i===selected?'selected':'')} onClick={()=>setSelected(i)}><video src={c.preview} muted preload="metadata"/><span>{c.file.name}</span><small>{fmt(c.duration)}</small></button>)}</div>{!clips.length&&<div className="studio-empty-small"><Film size={28}/><p>Nhập video để thêm vào dự án</p></div>}</>}
     {tab==='audio'&&<><label className="studio-upload"><Music size={17}/> Nhập âm thanh<input type="file" accept="audio/*" className="sr-only" onChange={e=>setAudio(e.target.files?.[0]??null)}/></label>{audio?<div className="studio-audio-card"><Music size={18}/><span className="truncate">{audio.name}</span><button aria-label="Bỏ âm thanh" onClick={()=>setAudio(null)}><Trash2 size={16}/></button></div>:<p className="studio-minor">Chưa có nhạc nền. Nhạc nhập sẽ thay thế âm thanh gốc khi xuất.</p>}</>}
     {tab==='text'&&<><label className="studio-form-label" htmlFor="overlay-text">Nội dung chữ</label><textarea id="overlay-text" className="studio-input min-h-24" value={text} onChange={e=>setText(e.target.value)} placeholder="Nhập chữ phủ lên video"/><label className="studio-form-label">Màu chữ <input type="color" aria-label="Màu chữ video" value={textColor} onChange={e=>setTextColor(e.target.value)}/></label><p className="studio-minor">Chữ được xuất trực tiếp vào file MP4.</p></>}
     {tab==='effects'&&<><p className="studio-minor">Bộ lọc màu cho toàn bộ video, áp dụng cả khi xuất MP4.</p><div className="studio-filter-grid">{([{id:'none',label:'Gốc',css:'none'},{id:'mono',label:'Đen trắng',css:'grayscale(1)'},{id:'sepia',label:'Cổ điển',css:'sepia(1)'},{id:'vivid',label:'Rực rỡ',css:'contrast(1.12) saturate(1.35)'}] as const).map(filter=><button key={filter.id} type="button" className={'studio-filter-choice '+(effect===filter.id?'selected':'')} onClick={()=>setEffect(filter.id)}><span style={{filter:filter.css}}>◉</span>{filter.label}</button>)}</div></>}
   </section>
 </aside>
 <section className="studio-player-area">
   <div className="studio-pane-heading"><span><PanelsTopLeft size={15}/> Trình xem</span><span>Preview · {ratio}</span></div>
   <div className="studio-stage">
     <div className={'studio-screen '+(ratio==='9:16'?'portrait':ratio==='1:1'?'square':'landscape')}>
       {current?<><video ref={preview} style={{filter:effect==='mono'?'grayscale(1)':effect==='sepia'?'sepia(1)':effect==='vivid'?'contrast(1.12) saturate(1.35)':'none'}} key={current.id} src={current.preview} playsInline onLoadedMetadata={e=>{e.currentTarget.currentTime=current.trimStart;setPlayhead(current.trimStart)}} onTimeUpdate={e=>{const player=e.currentTarget;setPlayhead(player.currentTime);if(player.currentTime>=current.trimEnd){player.pause();player.currentTime=current.trimStart}}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>{text.trim()&&<div className="studio-text-overlay" style={{color:textColor}}>{text}</div>}</>:<div className="studio-empty-player"><Film size={42}/><b>Không có video</b><p>Nhập video ở bảng bên trái để bắt đầu chỉnh sửa</p></div>}
     </div>
   </div>
   <div className="studio-play-controls"><span>{fmt(playhead)} / {fmt(current?.trimEnd||0)}</span><button aria-label={playing?'Tạm dừng':'Phát'} disabled={!current} onClick={()=>{const p=preview.current;if(!p)return;if(p.paused)void p.play();else p.pause()}}>{playing?<Pause size={19}/>:<Play size={19}/>}</button><input className="studio-seek" type="range" aria-label="Vị trí phát" min={current?.trimStart??0} max={current?.trimEnd??1} step=".01" disabled={!current} value={Math.min(Math.max(playhead,current?.trimStart??0),current?.trimEnd??1)} onChange={e=>{const value=Number(e.target.value);if(preview.current)preview.current.currentTime=value;setPlayhead(value)}}/><select aria-label="Tỷ lệ khung hình" value={ratio} onChange={e=>setRatio(e.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option></select></div>
 </section>
 <aside className="studio-inspector">
   <div className="studio-pane-heading"><span>Thuộc tính</span><span>Video</span></div>
   <div className="studio-property-tabs"><span className="active">Cơ bản</span><span>Điều chỉnh</span></div>
   {current?<div className="studio-properties"><p className="studio-minor truncate">{current.file.name}</p><label className="studio-form-label" htmlFor="trim-start">Bắt đầu (giây)</label><input id="trim-start" aria-label="Bắt đầu" className="studio-input" type="number" min="0" max={current.trimEnd} step=".1" value={current.trimStart} onChange={e=>patchClip(current.id,{trimStart:Math.max(0,Math.min(current.trimEnd-.05,Number(e.target.value)))})}/>
 <label className="studio-form-label" htmlFor="trim-end">Kết thúc (giây)</label><input id="trim-end" aria-label="Kết thúc" className="studio-input" type="number" min={current.trimStart} max={current.duration} step=".1" value={current.trimEnd} onChange={e=>patchClip(current.id,{trimEnd:Math.min(current.duration,Math.max(current.trimStart+.05,Number(e.target.value)))})}/>
 <label className="studio-form-label" htmlFor="clip-speed">Tốc độ clip</label><select id="clip-speed" aria-label="Tốc độ clip" className="studio-input" value={current.speed} onChange={e=>patchClip(current.id,{speed:Number(e.target.value)})}><option value="0.5">0.5x · Chậm</option><option value="1">1x · Bình thường</option><option value="1.5">1.5x · Nhanh</option><option value="2">2x · Nhanh hơn</option></select>
 <label className="studio-form-label" htmlFor="clip-volume">Âm lượng gốc: {Math.round(current.volume*100)}%</label><input id="clip-volume" aria-label="Âm lượng gốc" type="range" min="0" max="2" step=".1" value={current.volume} onChange={e=>patchClip(current.id,{volume:Number(e.target.value)})} className="w-full"/>
 <button type="button" className="studio-action-split" onClick={split}><Split size={17}/> Tách clip tại vị trí xem</button><div className="studio-separator"/><b className="studio-minor">Thông tin nguồn</b><p className="studio-minor">Thời lượng: {current.duration.toFixed(2)}s</p><p className="studio-minor">Dung lượng: {(current.file.size/1048576).toFixed(1)} MB</p></div>:<p className="studio-minor p-4">Chọn một video để chỉnh sửa thuộc tính.</p>}
 </aside>
 </div>
 <section className="studio-timeline">
   <div className="studio-timeline-header"><div className="studio-timeline-title"><Scissors size={16}/> Timeline <span className="studio-minor">· {clips.length} đoạn · {fmt(totalDuration)}</span></div><div className="studio-timeline-actions"><button type="button" className="studio-action-split" disabled={!current} onClick={split}><Split size={15}/> Tách clip</button><span>Thu phóng</span><input type="range" min="35" max="160" value={zoom} aria-label="Thu phóng timeline" onChange={e=>setZoom(Number(e.target.value))}/></div></div>
   <div className="studio-timeline-scroll"><div className="studio-ruler" style={{minWidth:Math.max(600,totalDuration*zoom)}}>{Array.from({length:Math.min(40,Math.floor(totalDuration/5)+2)},(_,i)=><span key={i} style={{left:i*5*zoom}}>{fmt(i*5)}</span>)}</div>
   <div className="studio-track-row"><div className="studio-track-name"><Film size={16}/> Video</div><div className="studio-clip-track" style={{minWidth:Math.max(600,totalDuration*zoom)}}><DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={reorder}><SortableContext items={clips.map(c=>c.id)} strategy={horizontalListSortingStrategy}><div className="studio-clips">{clips.map((c,i)=><Track key={c.id} item={c} index={i} selected={selected===i} zoom={zoom} select={()=>setSelected(i)} remove={()=>remove(c.id)}/>)}</div></SortableContext></DndContext></div></div>
   <div className="studio-track-row"><div className="studio-track-name"><Type size={16}/> Văn bản</div><div className="studio-clip-track" style={{minWidth:Math.max(600,totalDuration*zoom)}}>{text.trim()&&<div className="studio-text-track" style={{width:Math.max(130,totalDuration*zoom)}}>{text}</div>}</div></div>
   <div className="studio-track-row"><div className="studio-track-name"><Volume2 size={16}/> Âm thanh</div><div className="studio-clip-track" style={{minWidth:Math.max(600,totalDuration*zoom)}}>{audio&&<div className="studio-audio-track" style={{width:Math.max(130,totalDuration*zoom)}}><Music size={15}/>{audio.name}</div>}</div></div></div>
   <div className="studio-footer">{status&&<span role="status" className="success">{status}</span>}{error&&<span role="alert" className="error">{error}</span>}{!status&&!error&&<span>FFmpeg.wasm · Thiết bị của bạn xử lý video, không cần API key.</span>}</div>
 </section>
 </main>
}