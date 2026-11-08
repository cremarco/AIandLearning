/** Real native clicks in one directly nested, untransformed iframe.
 * Read-only DOM geometry and hit tests only; input uses actual CDP events or an explicitly recorded documented locator click.
 */
const finite=n=>typeof n==='number'&&Number.isFinite(n)
const approximately=(a,b,t=.75)=>finite(a)&&finite(b)&&Math.abs(a-b)<=t
const box=r=>({x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height})
const zeroValues=values=>Array.isArray(values)&&values.every(n=>finite(n)&&Math.abs(n)<.001)
const zeroCssEdges=values=>Array.isArray(values)&&values.length===4&&values.every(v=>v==='0px'||v==='0')
export function nativeFrameInputContract(method='native-cdp') {
  if(method==='native-cdp')return {nativeInputMethod:method,clickSource:'native-cdp-mouse-input',clickCoordinateSource:'actual-native-CDP-input-point',deliveredPointerCoordinatesExposed:true,nativeCDPPressReleaseSent:true}
  if(method==='documented-locator-click')return {nativeInputMethod:method,clickSource:'documented-browser-locator-click',clickCoordinateSource:'fresh-hit-tested-native-target-center; exact delivered pointer coordinates are not exposed',deliveredPointerCoordinatesExposed:false,nativeCDPPressReleaseSent:false}
  throw Error('Use native-cdp or the explicitly documented locator-click input method')
}

const SCF='iframe[src*=".scf.usercontent.goog/"]'
const MIND_MAP_BRANCHES=new Set(["Training and Fine-Tuning (§1.2), 3 children", "Ordinary Inference (§1.2), 2 children", "Context and Prompt Variations (§1.2, §1.7), 2 children", "Retrieval-Augmented Generation RAG (§1.2, §1.7), 2 children"])
export function nativeFrameLocatorContract(contract) {
  if(contract?.frameSelector!==SCF||contract.exact!==true)throw Error('Use the exact observed SCF selector and exact native label')
  if(contract.descendant!==undefined&&!(contract.role==='treeitem'&&MIND_MAP_BRANCHES.has(contract.name)&&contract.descendant==='circle'))throw Error('Only the observed Mind Map treeitem toggle circle is permitted')
  if(contract.role==='button'&&typeof contract.name==='string'&&contract.name)return {locatorKind:'role',role:'button',name:contract.name}
  if(contract.role==='menuitem'&&['Download set','Retake missed questions'].includes(contract.name))return {locatorKind:'role',role:'menuitem',name:contract.name}
  if(contract.role==='treeitem'&&MIND_MAP_BRANCHES.has(contract.name))return {locatorKind:'role',role:'treeitem',name:contract.name,...(contract.descendant?{descendant:contract.descendant}:{})}
  if(contract.role===undefined&&contract.text==='Download set')return {locatorKind:'text',role:null,name:contract.text}
  throw Error('Use an observed button, or the narrowly approved exact Download set or Retake missed questions control')
}
/** The helper itself creates root locator and frameLocator from one selector.
 * ownerDocument observations prove its unique root owner and leaf local DOM.
 * Scoped window identities and an incomplete OOPiframe frameTree are not used.
 */
export function validateFrameLocatorBinding(outer,local,rootDocumentUrl,contract) {
  const selection=nativeFrameLocatorContract(contract)
  if(outer.tagName!=='IFRAME'||outer.ownerDocumentUrl!==rootDocumentUrl||outer.matchingRootSelectorCount!==1||outer.selectedRootElementMatches!==true)throw Error('Actual root iframe must match the unique observed selector')
  const src=new URL(outer.src)
  if(!src.hostname.endsWith('.scf.usercontent.goog')||src.protocol!=='https:')throw Error('Actual root iframe is not the observed native SCF surface')
  if(typeof local.documentUrl!=='string'||!local.documentUrl.startsWith('blob:')||local.documentUrl===rootDocumentUrl||local.nestedFrameCount!==0||local.targetInOwnDocument!==true)throw Error('Actual frameLocator document must be a native blob leaf with no nested iframe/frame')
  if(selection.locatorKind==='text'&&(typeof local.targetVisibleText!=='string'||local.targetVisibleText.trim()!=='Download set'))throw Error('The actual exact native Download set text must be visible in the local target')
  if(selection.descendant==='circle'&&(local.targetTagName?.toLowerCase()!=='circle'||local.targetTreeOwnerRole!=='treeitem'))throw Error('Actual native toggle must be a circle inside the selected treeitem')
  return {method:'documented-CUA-same-selector-frameLocator-and-readonly-ownerDocument',frameSelector:contract.frameSelector,...selection,exact:true,rootDocumentUrl,documentUrl:local.documentUrl,actualIframeSrc:outer.src,uniqueRootOwner:true,localNestedFrameCount:0,sameSelectorConstructedByHelper:true,scopedWindowIdentityUsedAsProof:false,CDPFrameTreeUsedAsProof:false}
}

export function mapNativeFramePoint(outer,local,viewport,frameProof) {
  const frame=outer?.bounds,target=local?.bounds
  if(!frame||!target||![frame,target].every(r=>Object.values(r).every(finite)&&r.width>0&&r.height>0))throw Error('Visible finite native rectangles required')
  if(outer.tagName!=='IFRAME'||frameProof?.method!=='documented-CUA-same-selector-frameLocator-and-readonly-ownerDocument'||frameProof.documentUrl!==local.documentUrl||frameProof.uniqueRootOwner!==true||frameProof.localNestedFrameCount!==0||frameProof.sameSelectorConstructedByHelper!==true)throw Error('Actual same-selector frameLocator binding and leaf DOM proof are required')
  if(outer.transform!=='none'||outer.zoom!=='1'||outer.ancestorTransforms?.length||!zeroValues(outer.borders)||!zeroValues(outer.padding)||!zeroCssEdges(outer.bordersCss)||!zeroCssEdges(outer.paddingCss)||outer.clientLeft!==0||outer.clientTop!==0)throw Error('Iframe borders, transforms, zoom or padding require a different coordinate contract')
  if(outer.visualScale!==1||outer.visualOffsetLeft!==0||outer.visualOffsetTop!==0||local.visualScale!==1||local.visualOffsetLeft!==0||local.visualOffsetTop!==0)throw Error('Visual viewport scaling or panning is unsupported')
  if(!approximately(frame.width,outer.clientWidth)||!approximately(frame.height,outer.clientHeight)||!approximately(frame.width,outer.offsetWidth)||!approximately(frame.height,outer.offsetHeight)||!approximately(local.viewport.width,outer.clientWidth)||!approximately(local.viewport.height,outer.clientHeight))throw Error('Iframe and local viewport geometry disagree')
  if(!approximately(outer.topViewport.width,viewport.width)||!approximately(outer.topViewport.height,viewport.height))throw Error('Recorded top-level viewport differs from native geometry')
  if(!local.hit?.passed||local.hit.disabled||!outer.hit?.passed)throw Error('Native iframe or local target is occluded or disabled')
  const x=frame.left+target.left+target.width/2,y=frame.top+target.top+target.height/2
  if(target.left<0||target.top<0||target.right>local.viewport.width||target.bottom>local.viewport.height||x<0||y<0||x>=viewport.width||y>=viewport.height)throw Error('Native frame target is outside the visible CSS viewport')
  if(!approximately(local.hit.x,target.left+target.width/2)||!approximately(local.hit.y,target.top+target.height/2)||!approximately(outer.hit.x,x)||!approximately(outer.hit.y,y))throw Error('Native hit tests do not match the actual mapped point')
  const bounds={x:frame.left+target.left,y:frame.top+target.top,left:frame.left+target.left,top:frame.top+target.top,right:frame.left+target.right,bottom:frame.top+target.bottom,width:target.width,height:target.height}
  return {x,y,bounds,frameBounds:frame,localBounds:target,frameProof}
}

export function nativeFrameGeometryStable(first,second,tolerance=.75) {
  if(!finite(tolerance)||tolerance<0||tolerance>.75)throw Error('Native stability tolerance must be at most0.75 CSS pixels')
  return ['x','y'].every(k=>approximately(first[k],second[k],tolerance))&&['frameSelector','rootDocumentUrl','documentUrl','actualIframeSrc','role','name','descendant'].every(k=>first.frameProof?.[k]===second.frameProof?.[k])&&['bounds','frameBounds','localBounds'].every(part=>['left','top','right','bottom','width','height'].every(k=>approximately(first[part][k],second[part][k],tolerance)))
}

/** Match ops.recordClick's return/action schema, using global CSS coordinates.
 * Usage: const frameClick=createNativeFrameClick(ops);
 * await frameClick(job,{frameSelector:'iframe[src*=".scf.usercontent.goog/"]',
 *   role:'button',name:'Activate to see answer',exact:true},
 *   'Reveal the actual answer',2200)
 */
export function createNativeFrameClick(ops) {
  if(typeof ops?.forceState!=='function')throw Error('Pass the actual capture operations object')
  const localObservation=async locator=>locator.evaluate(element=>{
    const d=element.ownerDocument,r=element.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=d.elementFromPoint(x,y),v=d.defaultView.visualViewport
    return {bounds:{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},viewport:{width:d.documentElement.clientWidth,height:d.documentElement.clientHeight},visualScale:v?.scale??1,visualOffsetLeft:v?.offsetLeft??0,visualOffsetTop:v?.offsetTop??0,documentUrl:d.URL,nestedFrameCount:d.querySelectorAll('iframe,frame').length,targetInOwnDocument:d.documentElement.contains(element),targetTagName:element.tagName,targetRoleAttribute:element.getAttribute('role'),targetTreeOwnerRole:element.closest('[role="treeitem"]')?.getAttribute('role')??null,targetVisibleText:element.innerText,hit:{passed:!!h&&(h===element||element.contains(h)),disabled:!!element.disabled||element.getAttribute('aria-disabled')==='true',x,y}}
  })
  const outerObservation=async(locator,local)=>locator.evaluate((element,p)=>{
    const d=element.ownerDocument,r=element.getBoundingClientRect(),s=getComputedStyle(element),x=r.left+p.x,y=r.top+p.y,h=d.elementFromPoint(x,y),v=d.defaultView.visualViewport,ancestorTransforms=[]
    for(let a=element.parentElement;a;a=a.parentElement){const c=getComputedStyle(a);if(c.transform!=='none'||(c.zoom&&c.zoom!=='1')||(c.scale&&c.scale!=='none')||(c.rotate&&c.rotate!=='none')||(c.translate&&c.translate!=='none'))ancestorTransforms.push({tag:a.tagName,transform:c.transform,zoom:c.zoom,scale:c.scale,rotate:c.rotate,translate:c.translate})}
    if((s.scale&&s.scale!=='none')||(s.rotate&&s.rotate!=='none')||(s.translate&&s.translate!=='none'))ancestorTransforms.push({tag:element.tagName,scale:s.scale,rotate:s.rotate,translate:s.translate})
    const bordersCss=[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],paddingCss=[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]
    return {bounds:{x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},tagName:element.tagName,ownerDocumentUrl:d.URL,src:element.getAttribute('src'),matchingRootSelectorCount:d.querySelectorAll(p.selector).length,selectedRootElementMatches:d.querySelector(p.selector)===element,topViewport:{width:d.documentElement.clientWidth,height:d.documentElement.clientHeight},clientWidth:element.clientWidth,clientHeight:element.clientHeight,offsetWidth:element.offsetWidth,offsetHeight:element.offsetHeight,clientLeft:element.clientLeft,clientTop:element.clientTop,transform:s.transform,zoom:s.zoom||'1',bordersCss,paddingCss,borders:bordersCss.map(v=>v==='0px'||v==='0'?0:1),padding:paddingCss.map(v=>v==='0px'||v==='0'?0:1),ancestorTransforms,visualScale:v?.scale??1,visualOffsetLeft:v?.offsetLeft??0,visualOffsetTop:v?.offsetTop??0,hit:{passed:!!h&&h===element,x,y}}
  },{x:local.bounds.left+local.bounds.width/2,y:local.bounds.top+local.bounds.height/2,selector:SCF})
  return async function recordFrameClick(job,contract,label='Use the actual framed control',holdMs=1800,options={}) {
    const capture=job?.rec?.current()
    if(!capture||capture.complete||!capture.recordingWindows?.some(w=>w.end===null)||!job.cdp?.send||!finite(holdMs)||holdMs<0)throw Error('An active running native recording and valid hold are required')
    if(contract.role==='menuitem'&&contract.name==='Retake missed questions'&&(capture.service!=='NotebookLM'||capture.slideId!=='S67'||capture.evidence?.nativeNotebookAppReader!==true))throw Error('Retake missed questions is limited to the observed native Quiz reader')
    if(contract.role==='treeitem'&&(capture.slideId!=='S66'||capture.evidence?.nativeNotebookAppReader!==true))throw Error('Observed tree branches are limited to the actual native Mind Map reader')
    const selection=nativeFrameLocatorContract(contract),iframeLocator=job.tab.playwright.locator(contract.frameSelector),scope=job.tab.playwright.frameLocator(contract.frameSelector)
    const ownerLocator=selection.locatorKind==='text'?scope.getByText(selection.name,{exact:true}):scope.getByRole(selection.role,{name:selection.name,exact:true})
    const targetLocator=selection.descendant==='circle'?ownerLocator.locator('circle'):ownerLocator
    if(selection.descendant==='circle'&&await ownerLocator.count()!==1)throw Error('Exactly one actual named native treeitem is required')
    if(await iframeLocator.count()!==1||await targetLocator.count()!==1)throw Error('Exactly one actual iframe and one actual target are required')
    const tolerance=options.stabilityTolerancePx??.75
    if(!finite(tolerance)||tolerance<0||tolerance>.75)throw Error('Use at most0.75 CSS pixels stability tolerance')
    const inputContract=nativeFrameInputContract(options.inputMethod)
    const index=capture.actions.length
    let delivered
    const observe=async()=>{
      const local=await localObservation(targetLocator),outer=await outerObservation(iframeLocator,local)
      const rootDocumentUrl=await job.tab.url()
      if(rootDocumentUrl!==job.rec.current().conversationUrl)throw Error('Actual root URL differs from the recorded child source')
      const proof=validateFrameLocatorBinding(outer,local,rootDocumentUrl,contract)
      return {local,outer,point:mapNativeFramePoint(outer,local,job.viewport,proof)}
    }
    await job.rec.step(label,async()=>{
      for(let attempt=0;attempt<3;attempt++) {
        const initial=await observe(),first=initial.point
        if(inputContract.nativeInputMethod==='native-cdp')await job.cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:first.x,y:first.y})
        const final=await observe(),{local,outer,point}=final
        if(!nativeFrameGeometryStable(first,point,tolerance))continue
        const requestedWall=Date.now()
        if(inputContract.nativeInputMethod==='documented-locator-click')await targetLocator.click()
        else {
          await job.cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1})
          await job.cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1})
        }
        delivered={...point,requestedWall,confirmedWall:Date.now(),hitEvidence:{method:'documented-same-selector-native-frameLocator-and-readonly-global-local-DOM-hit-tests-before-actual-input',stabilityTolerancePx:tolerance,hoverPreparation:inputContract.nativeInputMethod==='native-cdp'?'native-cdp-mouseMoved':'none; two fresh readonly DOM checks before documented locator click',outer,local,firstOuter:initial.outer,firstLocal:initial.local,frameProof:point.frameProof,firstFrameProof:first.frameProof,scopedWindowIdentityUsedAsProof:false,CDPFrameTreeUsedAsProof:false,firstGlobalPoint:{x:first.x,y:first.y},globalPoint:{x:point.x,y:point.y}}}
        return
      }
      throw Error('Actual framed target moved during the two native hit tests')
    },0)
    const action=job.rec.current().actions[index]
    if(!action||!delivered)throw Error('Actual framed input was not recorded')
    Object.assign(action,{stepRequestedAt:action.at,at:delivered.requestedWall-capture.started,kind:'click',click:{x:delivered.x,y:delivered.y,bounds:delivered.bounds},...inputContract,nativeHitTestPassed:true,nativeFrameHitTest:delivered.hitEvidence,nativeInputRequestedAt:delivered.requestedWall-capture.started,nativeInputConfirmedAt:delivered.confirmedWall-capture.started})
    await job.rec.annotate({actions:job.rec.current().actions})
    const frame=await ops.forceState(job,label)
    action.nativeStateFrame=frame.file
    await job.rec.annotate({actions:job.rec.current().actions})
    if(holdMs>0)await job.rec.pause(holdMs)
    return action
  }
}
