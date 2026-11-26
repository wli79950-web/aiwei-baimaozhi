import numpy as np, wave, json, sys
import os; os.makedirs('sfx', exist_ok=True)
SR=48000; rng=np.random.default_rng(7)
def env(n,a=0.002,d=0.1):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def lp(x,k):  # one-pole lowpass, k in (0,1)
    y=np.zeros_like(x); s=0
    for i,v in enumerate(x): s+=k*(v-s); y[i]=s
    return y
def bp_noise(n,f0,f1):
    x=rng.standard_normal(n); X=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR)
    X[(f<f0)|(f>f1)]=0; return np.fft.irfft(X,n)
def sweep_noise(dur,f0,f1,att=.35):
    n=int(dur*SR); out=np.zeros(n); seg=1024
    for i in range(0,n,seg):
        fr=i/n; fc=f0*(f1/f0)**fr
        out[i:i+seg]=bp_noise(seg*2,fc*0.6,fc*1.6)[:min(seg,n-i)]
    t=np.arange(n)/n; e=np.sin(np.pi*np.clip(t/att,0,1)/2)*np.clip((1-t)/(1-att),0,1)**1.5
    return out*e
def tone(dur,f,d=.08,f1=None):
    n=int(dur*SR); t=np.arange(n)/SR; ff=f if f1 is None else f*(f1/f)**(t/dur)
    ph=2*np.pi*np.cumsum(ff)/SR; return np.sin(ph)*env(n,.001,d)
def norm(x,g): return x/ (np.max(np.abs(x))+1e-9)*g
K={}
K['pop']=norm(tone(.12,880,.03,1500)+0.3*tone(.12,1760,.02),0.45)
K['click']=norm(bp_noise(int(.04*SR),2000,6000)*env(int(.04*SR),.0005,.008),0.5)
K['tick']=norm(tone(.06,2200,.012)+0.5*bp_noise(int(.06*SR),3000,8000)*env(int(.06*SR),.0005,.006),0.38)
K['swipe']=norm(sweep_noise(.28,1500,6000,.2),0.40)
K['whoosh']=norm(sweep_noise(.5,300,2500,.55),0.42)
K['fly']=norm(sweep_noise(.32,600,3500,.5),0.32)
K['iris']=norm(sweep_noise(.42,200,1800,.6)+0.5*tone(.42,90,.3,60),0.45)
K['drop']=norm(tone(.25,160,.07,70)+0.4*bp_noise(int(.25*SR),100,900)*env(int(.25*SR),.001,.03),0.55)
K['flip']=norm(bp_noise(int(.12*SR),1500,7000)*env(int(.12*SR),.002,.03)+0.4*sweep_noise(.12,2000,5000,.3),0.42)
n=int(.5*SR); K['stamp']=norm(tone(.5,110,.12,55)*1.0+0.8*bp_noise(n,60,1200)*env(n,.0008,.05)+0.25*bp_noise(n,2000,6000)*env(n,.0005,.01),0.8)
K['alarm']=norm(np.concatenate([tone(.12,1320,.08),np.zeros(int(.03*SR)),tone(.14,1320,.1)]),0.3)
K['enter']=norm(bp_noise(int(.09*SR),800,5000)*env(int(.09*SR),.0005,.02)+0.6*tone(.09,300,.02),0.55)
# typing: 10 keystrokes 0.09s apart
ty=np.zeros(int(1.0*SR))
for i in range(10):
    s=int(i*0.09*SR); k=bp_noise(int(.03*SR),1500+rng.integers(0,1500),7000)*env(int(.03*SR),.0005,.006)
    ty[s:s+len(k)]+=k*(0.8+0.4*rng.random())
K['type']=norm(ty,0.35)
def wr(path,x):
    x=np.clip(x,-1,1); y=(x*32767).astype(np.int16); st=np.stack([y,y],1).ravel()
    w=wave.open(path,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
for k,v in K.items(): wr(f'sfx/{k}.wav',v)
cues=json.load(open(sys.argv[1])); dur=float(sys.argv[2])
mix=np.zeros(int((dur+1)*SR))
for c in cues:
    x=K[c['k']]; s=int(c['t']*SR); mix[s:s+len(x)]+=x[:len(mix)-s]
mix=mix[:int(dur*SR)]
wr('sfx/sfx_mix.wav',mix*0.9); print('ok',len(cues))
