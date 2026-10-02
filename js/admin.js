/* Anoxara  — Owner Studio
   Visual dashboard layer + existing owner authentication.
   No database schema or order RPC is changed here. */

let OWNER_DB = null;

function $(id){return document.getElementById(id)}
function setLoginMessage(text,error=false){const el=$("loginMessage");if(!el)return;el.textContent=text||"";el.classList.toggle("error",Boolean(error))}
function money(value){return new Intl.NumberFormat("fr-DZ").format(Number(value||0))+" DA"}

async function ensureOwner(){
  if(!OWNER_DB)OWNER_DB=await initSupabase();
  const {data:{user}}=await OWNER_DB.auth.getUser();
  if(!user)return null;
  const {data:profile,error}=await OWNER_DB.from("profiles").select("id,role,full_name").eq("id",user.id).maybeSingle();
  if(error)throw error;
  if(profile?.role!=="owner")return null;
  return {user,profile};
}

function showLogin(){
  $("loginView").style.display="grid";
  $("dashboardView").style.display="none";
  if($("logoutBtn"))$("logoutBtn").style.display="none";
  document.querySelector(".admin-top")?.style.setProperty("display","none");
}

async function showDashboard(owner){
  $("loginView").style.display="none";
  $("dashboardView").style.display="grid";
  document.querySelector(".admin-top")?.style.setProperty("display","flex");
  if($("logoutBtn"))$("logoutBtn").style.display="inline-flex";
  if($("ownerEmail"))$("ownerEmail").textContent=owner.user.email||"Owner";
  adminRender("overview");
}

async function ownerLogin(event){
  event.preventDefault();
  const email=$("loginEmail")?.value.trim();
  const password=$("loginPassword")?.value||"";
  if(!email||!password)return;
  const button=document.querySelector('#loginForm button[type="submit"]');
  if(button){button.disabled=true;button.textContent="جاري الدخول..."}
  setLoginMessage("جاري التحقق من بيانات المالك...");
  try{
    if(!OWNER_DB)OWNER_DB=await initSupabase();
    const {error}=await OWNER_DB.auth.signInWithPassword({email,password});
    if(error)throw error;
    const owner=await ensureOwner();
    if(!owner){await OWNER_DB.auth.signOut();throw new Error("هذا الحساب ليس حساب مالك Anoxara .")}
    setLoginMessage("");
    await showDashboard(owner);
  }catch(error){
    console.error("Owner authentication:",error);
    setLoginMessage(error?.message||"بيانات الدخول غير صحيحة.",true);
    if(button){button.disabled=false;button.textContent="دخول المالك ↗"}
  }
}

async function ownerLogout(){
  try{if(OWNER_DB)await OWNER_DB.auth.signOut()}catch(error){console.error(error)}
  showLogin();
}

function toggleOwnerTheme(){
  const dark=document.body.classList.toggle("owner-light");
  localStorage.setItem("atelierOwnerTheme",dark?"light":"dark");
}
function loadOwnerTheme(){
  if(localStorage.getItem("atelierOwnerTheme")==="light")document.body.classList.add("owner-light");
}

document.addEventListener("DOMContentLoaded",()=>{
  loadOwnerTheme();
  $("loginForm")?.addEventListener("submit",ownerLogin);
  $("logoutBtn")?.addEventListener("click",ownerLogout);
  $("ownerTheme")?.addEventListener("click",toggleOwnerTheme);
  document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");adminRender(b.dataset.tab)}));
  bootOwner();
});

async function bootOwner(){
  try{OWNER_DB=await initSupabase();const owner=await ensureOwner();if(owner)await showDashboard(owner);else showLogin()}catch(error){console.error("Owner Studio boot:",error);showLogin();setLoginMessage(error?.message||"تعذر الاتصال بخدمة تسجيل الدخول.",true)}
}
