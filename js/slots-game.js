// RuneLuck Slots - Overlay with iframe
(function(){
var root = document.createElement('div');
root.id = 'slotsRoot';
root.style.cssText = 'display:none;position:fixed;inset:0;z-index:9998;background:rgba(2,5,10,0.92);';

// Close button
var closeBtn = document.createElement('button');
closeBtn.id = 'slotsClose';
closeBtn.textContent = '\u2715';
closeBtn.style.cssText = 'position:fixed;top:14px;right:18px;z-index:10001;background:rgba(0,0,0,0.7);border:2px solid rgba(255,255,255,0.15);color:#fff;font-size:22px;cursor:pointer;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s';
root.appendChild(closeBtn);

// Lobby button
var lobbyBtn = document.createElement('button');
lobbyBtn.textContent = '\u2190 Lobby';
lobbyBtn.style.cssText = 'position:fixed;top:14px;left:18px;z-index:10001;background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.1);color:#aaa;font-size:13px;cursor:pointer;padding:10px 18px;border-radius:8px;font-family:Outfit,sans-serif;font-weight:600;transition:all 0.2s';
lobbyBtn.onmouseenter = function(){ this.style.color='#4ade80'; this.style.borderColor='#4ade80'; };
lobbyBtn.onmouseleave = function(){ this.style.color='#aaa'; this.style.borderColor='rgba(255,255,255,0.1)'; };
lobbyBtn.onclick = closeSlots;
root.appendChild(lobbyBtn);

// Iframe container
var iframe = document.createElement('iframe');
iframe.id = 'slotsFrame';
iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:10000;background:transparent';
iframe.setAttribute('allowtransparency','true');
root.appendChild(iframe);

document.body.appendChild(root);

// Block clicks from reaching 3D
root.addEventListener('mousedown',function(e){e.stopPropagation();});
root.addEventListener('mouseup',function(e){e.stopPropagation();});
root.addEventListener('click',function(e){e.stopPropagation();});

var loaded = false;

function openSlots(){
  var old = document.getElementById('gameOverlay');
  if(old) old.style.display = 'none';
  root.style.display = 'block';
  document.body.style.overflow = 'hidden';
  if(!loaded){
    loaded = true;
    iframe.src = 'slots.html';
  }
}

function closeSlots(e){
  if(e){e.stopPropagation();e.preventDefault();}
  root.style.display = 'none';
  document.body.style.overflow = '';
}

closeBtn.addEventListener('click',closeSlots);
closeBtn.addEventListener('mouseenter',function(){this.style.borderColor='#ef4444';this.style.color='#ef4444';});
closeBtn.addEventListener('mouseleave',function(){this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='#fff';});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&root.style.display==='block'){e.stopPropagation();e.preventDefault();closeSlots();}
});

// Listen for close from iframe
window.addEventListener('message',function(e){
  if(e.data&&(e.data.type==='closeSlotsOverlay'||e.data==='closeSlots')) closeSlots();
});

if(!window.RL) window.RL={};
RL.slots={open:openSlots,close:closeSlots};

setTimeout(function(){
  if(RL.games&&RL.games.open){
    var orig=RL.games.open;
    RL.games.open=function(type){
      if(type==='Slots'||type==='slots')openSlots();
      else orig.apply(this,arguments);
    };
  }
  var btns=document.querySelectorAll('.gbtn');
  for(var i=0;i<btns.length;i++){
    if(btns[i].textContent.indexOf('SLOTS')!==-1){
      btns[i].onclick=function(e){e.preventDefault();e.stopPropagation();openSlots();};
    }
  }
},500);
})();
