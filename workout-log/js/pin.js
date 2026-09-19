const STORAGE_KEY='tahmid-workout:app-passcode:v1';
const LOCK_AFTER_MS=5*60*1000;

function encode(bytes){return btoa(String.fromCharCode(...bytes));}
function decode(value){return Uint8Array.from(atob(value),char=>char.charCodeAt(0));}
async function digest(pin,salt){
  const input=new TextEncoder().encode(`${salt}:${pin}`);
  return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',input)));
}
export function configured(){return Boolean(localStorage.getItem(STORAGE_KEY));}
export async function set(pin){
  if(!/^\d{4}$/.test(pin))throw new Error('Enter exactly four numeric digits.');
  const salt=encode(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(STORAGE_KEY,JSON.stringify({salt,hash:await digest(pin,salt)}));
}
export async function verify(pin){
  if(!/^\d{4}$/.test(pin))return false;
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  return Boolean(stored?.salt&&stored?.hash&&(await digest(pin,stored.salt))===stored.hash);
}
export function clear(){localStorage.removeItem(STORAGE_KEY);}
export function lockAfter(){return LOCK_AFTER_MS;}
