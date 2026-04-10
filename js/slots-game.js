// RuneLuck Slots - Native Module
// Fetches slots.html and injects into overlay div (no iframe)
(function(){
var root = document.createElement('div');
root.id = 'slotsRoot';
root.style.cssText = 'display:none;position:fixed;inset:0;z-index:9998;';
root.innerHTML = '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)"></div>' +
  '<button id="slotsClose" style="position:fixed;top:14px;right:18px;z-index:10001;background:rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.15);color:#fff;font-size:22px;cursor:pointer;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s;backdrop-filter:blur(4px)">\u2715</button>' +
  '<div id="slotsContent" style="position:relative;z-index:10000;width:100%;height:100%;overflow:auto"></div>';
document.body.appendChild(root);

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
    var iframe = document.createElement('iframe');
    iframe.src = 'slots.html';
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent';
    iframe.setAttribute('allowtransparency','true');
    document.getElementById('slotsContent').appendChild(iframe);
  }
}

function closeSlots(e){
  if(e){e.stopPropagation();e.preventDefault();}
  root.style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('slotsClose').addEventListener('click',closeSlots);
document.getElementById('slotsClose').addEventListener('mouseenter',function(){this.style.borderColor='#4ade80';this.style.color='#4ade80';});
document.getElementById('slotsClose').addEventListener('mouseleave',function(){this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='#fff';});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&root.style.display==='block'){e.stopPropagation();e.preventDefault();closeSlots();}
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
