/* Atelier Noura — shared theme toggle */
(function(){
  const KEY="atelierTheme";
  function apply(theme){
    document.documentElement.classList.toggle("dark",theme==="dark");
    document.body?.classList.toggle("theme-dark",theme==="dark");
  }
  const saved=localStorage.getItem(KEY)||"light";
  apply(saved);
  document.addEventListener("DOMContentLoaded",()=>{
    const buttons=document.querySelectorAll("#ownerTheme,[data-theme-toggle]");
    buttons.forEach(btn=>btn.addEventListener("click",()=>{
      const next=(localStorage.getItem(KEY)||"light")==="dark"?"light":"dark";
      localStorage.setItem(KEY,next);apply(next);
    }));
  });
})();
