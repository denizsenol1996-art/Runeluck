(function(){
  var overlay = document.createElement('div');
  overlay.id = 'slotsOverlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;';
  
  // Blurred backdrop
  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(8px);';
  
  var closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:14px;right:18px;z-index:10001;background:rgba(0,0,0,0.6);border:2px solid rgba(255,255,255,0.15);color:#fff;font-size:22px;cursor:pointer;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s;backdrop-filter:blur(4px);';
  closeBtn.onmouseenter = function(){ this.style.borderColor='#4ade80'; this.style.color='#4ade80'; };
  closeBtn.onmouseleave = function(){ this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='#fff'; };
  
  var iframe = document.createElement('iframe');
  iframe.id = 'slotsFrame';
  iframe.style.cssText = 'position:relative;z-index:10000;width:100%;height:100%;border:none;background:transparent;';
  iframe.setAttribute('allowtransparency','true');
  
  overlay.appendChild(backdrop);
  overlay.appendChild(closeBtn);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  
  function openSlots(){
    var oldOverlay = document.getElementById('gameOverlay');
    if(oldOverlay) oldOverlay.style.display = 'none';
    iframe.src = 'slots.html';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
  
  function closeSlots(e){
    if(e) { e.stopPropagation(); e.preventDefault(); }
    overlay.style.display = 'none';
    iframe.src = '';
    document.body.style.overflow = '';
    // Block next click so you don't walk in the 3D game
    setTimeout(function(){}, 100);
  }
  
  closeBtn.onclick = closeSlots;
  
  // Block all clicks on the overlay from reaching the 3D game
  overlay.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  overlay.addEventListener('mouseup', function(e){ e.stopPropagation(); });
  overlay.addEventListener('click', function(e){ e.stopPropagation(); });
  
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && overlay.style.display === 'block'){
      e.stopPropagation(); e.preventDefault();
      closeSlots();
    }
  });
  
  if(!window.RL) window.RL = {};
  RL.slots = { open: openSlots, close: closeSlots };
  
  setTimeout(function(){
    if(RL.games && RL.games.open){
      var originalOpen = RL.games.open;
      RL.games.open = function(type){
        if(type === 'Slots' || type === 'slots' || type === 'slot'){
          openSlots();
        } else {
          originalOpen.apply(this, arguments);
        }
      };
    }
    var btns = document.querySelectorAll('.gbtn');
    for(var i = 0; i < btns.length; i++){
      if(btns[i].textContent.indexOf('SLOTS') !== -1){
        btns[i].onclick = function(e){ e.preventDefault(); e.stopPropagation(); openSlots(); };
      }
    }
  }, 500);
})();
