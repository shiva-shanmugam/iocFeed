"""Trim the recorded browser walkthrough into chapters and encode a shareable MP4."""
import math
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]/'artifacts'/'walkthrough'
edit=json.loads((ROOT/'edit.json').read_text())
if edit.get('failure'):
    raise SystemExit('Recording failed; refusing to publish an incomplete walkthrough.')
raw=Path(edit['rawVideo'])

def run(args):
    result=subprocess.run(args,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:])
    return result.stdout

def probe(file):
    return json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(file)]))

raw_info=probe(raw)
raw_duration=float(raw_info['format']['duration'])
# Align against the visible blue callout border. Closing the browser adds a tail
# to the raw video, so total duration alone is not a reliable recording clock.
first=edit['callouts'][0]
box=first.get('box',{'x':1370,'y':180})
seek=max(0,first['start']-1.5)
alignment_file=ROOT/'production'/'alignment.txt'
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(seek),'-i',str(raw),'-t','3',
     '-vf',f"crop=2:80:{box['x']}:{box['y']+20},signalstats,metadata=print:file={alignment_file}",'-f','null','-'])
samples=[]
for block in alignment_file.read_text().split('frame:')[1:]:
    time=re.search(r'pts_time:([0-9.]+)',block)
    level=re.search(r'lavfi.signalstats.YAVG=([0-9.]+)',block)
    if time and level: samples.append((seek+float(time.group(1)),float(level.group(1))))
visible=next((t for t,level in samples if level>55),None)
if visible is None: raise RuntimeError('Cannot align callout onset to the raw recording.')
offset=first['start']+.05-visible
scenes=edit['scenes']
print(f'Raw {raw_duration:.2f}s; clock alignment {offset:+.3f}s; editing {len(scenes)} chapters.',flush=True)

# Decode the source once and encode a single continuous H.264 stream. This avoids
# incompatible per-clip parameter sets when joining independently encoded clips.
cuts=[]
for scene in scenes:
    first_frame=math.ceil(max(0,scene['start']-offset+.04)*25)
    last_frame=math.ceil(min(raw_duration,scene['end']-offset)*25)-1
    cuts.append({'first':first_frame,'last':last_frame,'duration':(last_frame-first_frame+1)/25})

chapter_file=ROOT/'production'/'chapters.ffmetadata'
metadata=[';FFMETADATA1','title=Tracefold — Guided walkthrough','comment=Real local browser recording. The dataset is synthetic and Replay simulations are labeled.']
chapters=[]
elapsed=0
for index,scene in enumerate(scenes):
    duration=cuts[index]['duration']
    chapters.append({'title':scene['title'],'start':elapsed,'end':elapsed+duration})
    metadata.extend(['[CHAPTER]','TIMEBASE=1/1000',f'START={round(elapsed*1000)}',f'END={round((elapsed+duration)*1000)}',f'title={scene["title"]}'])
    elapsed+=duration
chapter_file.write_text('\n'.join(metadata)+'\n')
video=ROOT/'Tracefold-Walkthrough.mp4'
selection='+'.join(f"between(n,{cut['first']},{cut['last']})" for cut in cuts)
filtergraph=f"fps=25,select='{selection}',setpts=N/(25*TB),format=yuv420p,fade=t=in:d=0.12,fade=t=out:st={elapsed-.12:.3f}:d=0.12"
print(f'Encoding {elapsed:.2f}s as one continuous H.264 stream.',flush=True)
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-f','ffmetadata','-i',str(chapter_file),
     '-map','0:v:0','-map_metadata','1','-map_chapters','1','-vf',filtergraph,'-an','-c:v','libx264','-preset','veryfast','-crf','18','-profile:v','high','-bf','0','-g','50','-threads','2','-movflags','+faststart',str(video)])

def timestamp(seconds):
    ms=round(seconds*1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'

def short_time(seconds):
    return f'{int(seconds)//60}:{int(seconds)%60:02d}'

captions=[]
for number,note in enumerate(edit['callouts'],1):
    scene_index=note['scene']-1
    scene=scenes[scene_index]
    chapter=chapters[scene_index]
    start=chapter['start']+max(0,note['start']-offset-cuts[scene_index]['first']/25)
    end=min(chapter['end'],chapter['start']+note['end']-offset-cuts[scene_index]['first']/25)
    captions.append(f'{number}\n{timestamp(start)} --> {timestamp(end)}\n{note["title"]}\n{note["text"]}\n')
(ROOT/'Tracefold-Walkthrough.srt').write_text('\n'.join(captions))
(ROOT/'chapters.json').write_text(json.dumps(chapters,indent=2)+'\n')

run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','2','-i',str(video),'-frames:v','1',str(ROOT/'poster.jpg')])
review=ROOT/'review'
review.mkdir(exist_ok=True)
frame_checks=[]
for index,chapter in enumerate(chapters):
    # Sample the middle of the first explanation in each chapter for final editorial QA.
    note=next(n for n in edit['callouts'] if n['scene']==index+1)
    sample=chapter['start']+(note['start']+note['end'])/2-offset-cuts[index]['first']/25
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{max(0,sample):.3f}','-i',str(video),'-frames:v','1',str(review/f'{index+1:02d}.png')])
    original=review/f'{index+1:02d}-source.png'
    raw_time=(note['start']+note['end'])/2-offset
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{raw_time:.3f}','-i',str(raw),'-frames:v','1',str(original)])
    comparison=subprocess.run(['ffmpeg','-hide_banner','-i',str(original),'-i',str(review/f'{index+1:02d}.png'),'-lavfi','ssim','-f','null','-'],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
    score=float(re.search(r'All:([0-9.]+)',comparison.stderr).group(1))
    frame_checks.append({'chapter':index+1,'ssim':score})
    if score<.985: raise RuntimeError(f'Chapter {index+1} does not visually match its source: SSIM {score}')
    print(f'Visual check {index+1:02d}: SSIM {score:.5f}',flush=True)

info=probe(video)
stream=next(s for s in info['streams'] if s['codec_type']=='video')
assert stream['codec_name']=='h264'
assert (stream['width'],stream['height'])==(1920,1080)
assert stream['pix_fmt']=='yuv420p'
assert 100<float(info['format']['duration'])<240
run(['ffmpeg','-hide_banner','-v','error','-i',str(video),'-f','null','-'])
report={'file':str(video),'duration_seconds':float(info['format']['duration']),'width':stream['width'],'height':stream['height'],'codec':stream['codec_name'],'pixel_format':stream['pix_fmt'],'fps':stream['avg_frame_rate'],'bytes':int(info['format']['size']),'chapters':chapters,'callouts':len(edit['callouts']),'full_decode':'passed','source_frame_checks':frame_checks,'audio':'silent / caption-led','source':'real browser interaction recording'}
(ROOT/'video-report.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Tracefold walkthrough','',f'1080p MP4 · {short_time(report["duration_seconds"])} · {len(edit["callouts"])} baked-in callouts · silent / caption-led','',
       'Recorded from the actual local app with a browser-window frame, moving pointer, app-themed callouts, focus outlines and lightweight chapter transitions. Loading gaps between chapters are removed. The app source and dataset are unchanged by the recording.','',
       'The demonstration uses 1,310,000 synthetic IOCs. Replay simulations and synthetic geography are identified on screen. The graph and Replay examples include 172.20.165.27, 172.20.169.11, and 172.20.172.249; each has 200 direct stored relationships.','',
       '## Chapters','']
for chapter in chapters:lines.append(f'- **{short_time(chapter["start"])}** {chapter["title"]}')
lines += ['', '## Files','', '- `Tracefold-Walkthrough.mp4`: finished shareable video, including chapter metadata.', '- `Tracefold-Walkthrough.srt`: optional accessible transcript/caption timing. Text callouts are already baked into the MP4.', '- `poster.jpg`: preview still.', '- `edit.json`: original scene and callout timing.', '- `video-report.json`: encoding and full-decode validation.', '- `production/render.py`: repeatable cuts, fades, chapters, encoding, and validation.', '- `frontend/scripts/record-walkthrough.mjs` in the repository records the actual interactions. Run from the frontend directory; `--dry` rehearses the tour and saves preview frames.', '', 'No ingestion worker is started by this walkthrough.']
(ROOT/'README.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(report,indent=2),flush=True)
