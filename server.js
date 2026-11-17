import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'8kb'}));app.use(express.static(path.join(root,'public')));
const eventCode=process.env.EVENT_CODE||'';
const dataDir=process.env.DATA_DIR||root;fs.mkdirSync(dataDir,{recursive:true});const file=path.join(dataDir,'progress.json');
let teams={};try{teams=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
const missions=[
 {title:'사라진 연구 노트',story:'연구실 출입 기록: 민수 09:10, 지연 09:20, 하준 09:30. 노트는 09:15에 마지막으로 확인되었고 09:25에 사라진 사실이 발견되었습니다. 기록상 조사 대상 시간에 출입한 사람은?',options:['민수','지연','하준'],answer:1,why:'09:15~09:25 사이에 출입한 사람은 지연입니다. 다만 출입 기록만으로 범인이라고 단정할 수 없습니다.'},
 {title:'암호 해독',story:'암호 규칙은 알파벳을 한 칸 뒤로 옮기는 것입니다. DBU를 원래 단어로 해독하면?',options:['CAT','BAT','CAR'],answer:0,why:'D→C, B→A, U→T이므로 CAT입니다.'},
 {title:'가짜 뉴스 판별',story:'출처가 불분명한 게시물이 “내일 모든 수업 취소”라고 주장합니다. 가장 먼저 할 일은?',options:['바로 공유한다','학교 공식 공지를 확인한다','댓글 수만 확인한다'],answer:1,why:'공식 발표와 신뢰할 수 있는 출처를 확인해야 합니다.'},
 {title:'디지털 발자국',story:'사건 당시 사진을 올린 계정이 있습니다. 사진이 사건 당일 촬영됐는지 확인하려면?',options:['게시 날짜만 믿는다','원본 촬영 정보와 다른 증거를 교차 확인한다','좋아요 수를 확인한다'],answer:1,why:'게시 시간과 촬영 시간은 다를 수 있으므로 여러 증거를 확인해야 합니다.'},
 {title:'AI 답변 검증',story:'AI가 “증거가 확실하다”고 답했지만 출처를 제시하지 않았습니다. 탐정팀의 적절한 행동은?',options:['AI 답을 무조건 믿는다','독립된 근거로 검증한다','AI 답을 그대로 제출한다'],answer:1,why:'AI 답변도 오류가 있을 수 있으므로 근거를 확인해야 합니다.'},
 {title:'최종 추리',story:'세 단서: ① 출입 기록에 지연이 있다 ② 현장에 지연의 이름표가 있다 ③ CCTV는 고장 났다. 가장 타당한 결론은?',options:['지연이 범인으로 확정된다','추가 조사와 진술 확인이 필요하다','이름표만으로 사건이 끝난다'],answer:1,why:'정황 증거만으로 단정하지 않고 추가 검증해야 합니다.'}
];
function persist(){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(teams,null,2));fs.renameSync(temp,file)}
function safeEq(a,b){const x=crypto.createHash('sha256').update(String(a)).digest();const y=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(x,y)}
function teamAuth(req,res,next){const n=Number(req.body?.team??req.query.team);if(!Number.isInteger(n)||n<1||n>40)return res.status(400).json({error:'팀 번호는 1~40입니다'});if(eventCode&&!safeEq(req.body?.code??req.query.code??'',eventCode))return res.status(403).json({error:'행사 참가코드가 다릅니다'});req.team=n;next()}
function publicTeam(t){return {answers:t.answers,score:t.score}}
app.get('/api/missions',(req,res)=>res.json(missions.map(({answer,...m},i)=>({...m,id:i+1}))));
app.get('/api/teams',(req,res)=>res.json(teams));
app.post('/api/join',teamAuth,(req,res)=>{const key=String(req.team);teams[key]??={name:`${key}팀`,answers:{},score:0};persist();res.json(publicTeam(teams[key]))});
app.get('/api/team',teamAuth,(req,res)=>{const t=teams[req.team];if(!t)return res.status(404).json({error:'등록되지 않은 팀입니다'});res.json(publicTeam(t))});
app.post('/api/answer',teamAuth,(req,res)=>{const m=Number(req.body.mission),a=Number(req.body.answer);if(!Number.isInteger(m)||m<1||m>6||!Number.isInteger(a)||a<0||a>=missions[m-1].options.length)return res.status(400).json({error:'답안 입력 오류'});const t=teams[req.team];if(!t)return res.status(400).json({error:'팀을 먼저 등록하세요'});if(Object.hasOwn(t.answers,m))return res.status(409).json({error:'이미 제출한 미션입니다',team:publicTeam(t)});t.answers[m]=a;t.score=Object.entries(t.answers).reduce((s,[k,v])=>s+(missions[Number(k)-1].answer===v?100:0),0);persist();res.json({correct:a===missions[m-1].answer,explanation:missions[m-1].why,team:publicTeam(t)})});
app.post('/api/admin/reset',(req,res)=>{if(req.body?.confirm!=='전체초기화')return res.status(400).json({error:'확인 문구가 다릅니다'});teams={};persist();res.json({ok:true})});
app.get('/api/admin/export',(req,res)=>{res.set('Content-Disposition','attachment; filename="sh-results.json"');res.json(teams)});
app.get('/api/health',(req,res)=>res.json({ok:true}));
const port=Number(process.env.PORT)||3000;app.listen(port,'0.0.0.0',()=>console.log(`SH AI 탐정사무소: http://localhost:${port}`));
