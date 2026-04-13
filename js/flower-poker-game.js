// RuneLuck Flower Poker — iframe overlay (same pattern as slots-game.js)
(function(){
  var root = document.createElement('div');
  root.id = 'flowerPokerRoot';
  root.style.cssText = 'display:none;position:fixed;inset:0;z-index:400;background:transparent';

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'position:absolute;top:12px;right:16px;z-index:10;background:rgba(255,60,60,0.1);border:1px solid rgba(255,60,60,0.3);color:#ff6666;font-size:18px;cursor:pointer;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:all .15s';
  closeBtn.addEventListener('mouseenter', function(){ this.style.background='rgba(255,60,60,0.22)'; this.style.color='#fff'; });
  closeBtn.addEventListener('mouseleave', function(){ this.style.background='rgba(255,60,60,0.1)'; this.style.color='#ff6666'; });
  closeBtn.addEventListener('click', closeFP);
  root.appendChild(closeBtn);

  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;z-index:5;background:transparent';
  iframe.setAttribute('allowtransparency','true');
  root.appendChild(iframe);

  document.body.appendChild(root);

  root.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  root.addEventListener('mouseup',   function(e){ e.stopPropagation(); });
  root.addEventListener('click',     function(e){ e.stopPropagation(); });

  var loaded = false;

  function openFP(){
    root.style.display = 'block';
    if(!loaded){
      loaded = true;
      iframe.src = 'flower-poker.html';
    }
  }

  function closeFP(e){
    if(e){ e.stopPropagation(); e.preventDefault(); }
    root.style.display = 'none';
  }

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && root.style.display === 'block'){ e.stopPropagation(); e.preventDefault(); closeFP(); }
  });

  if(!window.RL) window.RL = {};
  RL.flowerPoker = { open: openFP, close: closeFP };

  // Hook into games.open for 'FlowerPoker'
  function installHook(){
    if(RL.games && RL.games.open){
      var orig = RL.games.open;
      RL.games.open = function(type){
        if(type === 'FlowerPoker' || type === 'flowerpoker'){ openFP(); return; }
        orig.apply(this, arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(installHook() || tries > 20) clearInterval(iv);
    }, 100);
  }
})();
