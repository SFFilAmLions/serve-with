import { createTheme } from '@mui/material/styles';
export type Appearance = 'light'|'dark';
export const clubGold = '#F1C232';
/** Contrast-safe brand tokens; bright club gold is used as an accent, not small text. */
export function createClubTheme(mode:Appearance){
 const dark=mode==='dark';
 return createTheme({
  palette:{
   mode,
   primary:{main:dark?'#F1C232':'#735600',contrastText:dark?'#25200B':'#FFFFFF'},
   secondary:{main:dark?'#E4C765':'#69530A'},
   background:{default:dark?'#141613':'#FCFBF6',paper:dark?'#20231E':'#FFFFFF'},
   text:{primary:dark?'#F2F0E8':'#23251F',secondary:dark?'#CDCABF':'#51564C'},
   divider:dark?'#484D43':'#DDE0D6'
  },
  shape:{borderRadius:16},
  typography:{
   fontFamily:'Alata, system-ui, sans-serif',
   h1:{fontFamily:'Ubuntu, system-ui, sans-serif',fontWeight:700},
   h3:{fontFamily:'Ubuntu, system-ui, sans-serif',fontWeight:700},
   h4:{fontFamily:'Ubuntu, system-ui, sans-serif',fontWeight:700},
   h5:{fontFamily:'Ubuntu, system-ui, sans-serif',fontWeight:700},
   h6:{fontFamily:'Ubuntu, system-ui, sans-serif',fontWeight:700},
   subtitle1:{fontFamily:'"Ubuntu Condensed", Ubuntu, system-ui, sans-serif'}
  },
  components:{
   MuiCssBaseline:{styleOverrides:{'html':{colorScheme:mode},'body':{backgroundColor:dark?'#141613':'#FCFBF6'}}},
   MuiCard:{styleOverrides:{root:{borderRadius:20}}},
   MuiAlert:{styleOverrides:{root:{borderRadius:16}}},
   MuiButton:{styleOverrides:{root:{borderRadius:20,textTransform:'none',fontWeight:700}}},
   MuiToggleButton:{styleOverrides:{root:{borderRadius:24,textTransform:'none',fontWeight:700,
    '&.Mui-selected,&.Mui-selected:hover':{backgroundColor:clubGold,color:'#25200B',borderColor:clubGold}}}},
   MuiTabs:{styleOverrides:{root:{borderBottom:dark?'1px solid #484D43':'1px solid #DDE0D6'}}}
  }
 });
}
