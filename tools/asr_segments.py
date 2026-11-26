import sherpa_onnx, numpy as np, wave, json, sys
import os
M=os.environ.get('ASR_MODEL','models/sherpa-onnx-paraformer-zh-2024-03-09/')
rec=sherpa_onnx.OfflineRecognizer.from_paraformer(paraformer=M+'model.int8.onnx',tokens=M+'tokens.txt',num_threads=4)
w=wave.open(sys.argv[1]); sr=w.getframerate(); a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=160; win=400
e=np.array([np.sqrt(np.mean(a[i:i+win]**2)) for i in range(0,len(a)-win,hop)])
thr=np.percentile(e,25)*2.0+0.003
sp=e>thr
# smooth: fill gaps < 120ms, drop blips < 60ms
def runs(b):
    r=[];s=None
    for i,v in enumerate(b):
        if v and s is None:s=i
        if not v and s is not None:r.append([s,i]);s=None
    if s is not None:r.append([s,len(b)])
    return r
R=runs(sp); m=[]
for s,t in R:
    if m and s-m[-1][1]<int(0.12*sr/hop): m[-1][1]=t
    else: m.append([s,t])
m=[x for x in m if x[1]-x[0]>int(0.06*sr/hop)]
out=[]
for s,t in m:
    S=max(0,s*hop-1600);T=min(len(a),t*hop+1600)
    st=rec.create_stream(); st.accept_waveform(sr,a[S:T]); rec.decode_stream(st)
    txt=st.result.text
    out.append({'s':round(s*hop/sr,3),'e':round(t*hop/sr,3),'text':txt}); print(out[-1])
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
