document.documentElement.classList.add('js');
// Hides the news bar straight away for visitors who closed it (before the page draws, so it doesn't flicker).
try { var oabClosed = localStorage.getItem('oab-announce-closed'); if (oabClosed) document.documentElement.setAttribute('data-announce-closed', oabClosed); } catch (e) { /* storage blocked: the bar just shows */ }
