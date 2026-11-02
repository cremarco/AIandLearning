import fs from 'node:fs'
const common=(id,type,x,y,w,h)=>({id,type,x,y,width:w,height:h,angle:0,strokeColor:'#51408c',backgroundColor:'transparent',fillStyle:'solid',strokeWidth:1,strokeStyle:'solid',roughness:0,opacity:100,groupIds:[],frameId:null,roundness:null,seed:1,version:1,versionNonce:1,isDeleted:false,boundElements:null,updated:1793574000000,link:null,locked:false})
function map(revised){
 const elements=[]
 const text=(id,t,x,y,size=24)=>({...common(id,'text',x,y,t.length*size*.52,size*1.25),fontSize:size,fontFamily:2,text:t,textAlign:'left',verticalAlign:'top',containerId:null,originalText:t,autoResize:true,lineHeight:1.25})
 for(const [id,label,x]of [['context','Context',0],['model','Model',430],['output',revised?'Token probabilities':'Response',860]]){
  elements.push({...common(id,'rectangle',x,150,230,90),roundness:{type:3}})
  elements.push(text(id+'-label',label,x+20,180,label.length>10?22:27))
 }
 for(const [id,x]of [['left',230],['right',660]])elements.push({...common(id,'arrow',x,195,190,0),points:[[0,0],[190,0]],startBinding:null,endBinding:null,startArrowhead:null,endArrowhead:'arrow',elbowed:false})
 elements.push(text('rel-left',revised?'conditions':'trains again?',240,155,22),text('rel-right',revised?'computes':'produces… how?',670,155,22))
 if(revised){elements.push(text('parameters','Parameters learned from data',370,35,24));elements.push({...common('param-arrow','arrow',545,80,0,60),points:[[0,0],[0,60]],startBinding:null,endBinding:null,startArrowhead:null,endArrowhead:'arrow',elbowed:false})}
 elements.push(text('caption',revised?'Parameters remain fixed during this generation.':'“?” marks a relationship to check against the chapter.',140,300,24))
 return {type:'excalidraw',version:2,source:'https://excalidraw.com',elements,appState:{gridSize:null,viewBackgroundColor:'#fbfaff'},files:{}}
}
for(const revised of [false,true])fs.writeFileSync(`public/materials/map-${revised?'revised':'initial'}.excalidraw`,JSON.stringify(map(revised),null,2)+'\n')
fs.writeFileSync('public/materials/formula-desmos.txt',`SOFTMAX WITH TEMPERATURE — WORKED EXAMPLE\n\nIllustrative scores [2, 1, 0]. These are not measurements from Qwen.\n\np_i = exp(z_i/T) / sum_j exp(z_j/T), T > 0\n\nDesmos Graphing Calculator: https://www.desmos.com/calculator?lang=en\nUse x for temperature. Paste one LaTeX expression into each expression row:\n\nf(x)=\\frac{e^{2/x}}{e^{2/x}+e^{1/x}+1}\\left\\{x>0\\right\\}\ng(x)=\\frac{e^{1/x}}{e^{2/x}+e^{1/x}+1}\\left\\{x>0\\right\\}\nh(x)=\\frac{1}{e^{2/x}+e^{1/x}+1}\\left\\{x>0\\right\\}\n\nSet the X range from 0 to 4 and Y range from 0 to 1. Label the axes Temperature T and Probability.\nAt T = 0.5: 0.8668, 0.1173, 0.0159.\nAt T = 1: 0.6652, 0.2447, 0.0900.\nAt T = 2: 0.5065, 0.3072, 0.1863.\nValues are rounded. The unrounded distributions sum to one.\n\nFirst predict how concentration changes; then compare values. Explain why the ranking remains the same when only a positive temperature changes.\n`)
