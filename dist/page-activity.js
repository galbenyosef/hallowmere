// A visible mobile page can lose focus without the player asking to pause.
// Keep background suspension separate from the game's explicit pause menus.
export function bindPageActivity({windowTarget=window,documentTarget=document,releaseInput,setBackgrounded}){
 const onBlur=()=>releaseInput({resetTouch:documentTarget.hidden});
 const syncVisibility=()=>{
  const hidden=documentTarget.hidden;
  if(hidden)releaseInput({resetTouch:true});
  setBackgrounded(hidden);
 };
 windowTarget.addEventListener('blur',onBlur);
 documentTarget.addEventListener('visibilitychange',syncVisibility);
 syncVisibility();
 return ()=>{
  windowTarget.removeEventListener('blur',onBlur);
  documentTarget.removeEventListener('visibilitychange',syncVisibility);
 };
}
